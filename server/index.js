import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { createPool, initializeDatabase, registrationFromRow, audit } from "./db.js";
import { requireAdmin, requirePrimary, canAccessForm } from "./auth.js";
import { processNotificationJobs, triggerNotificationWorker } from "./notifications.js";
import {
  ValidationError,
  validateFormInput,
  validateMessageTemplate,
  validateRegistrationInput,
  validateStatus
} from "./validation.js";

const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = express();
const pool = createPool();
const port = Number(process.env.PORT || 10000);

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://www.gstatic.com"],
      connectSrc: ["'self'", "https://identitytoolkit.googleapis.com", "https://securetoken.googleapis.com"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: null
    }
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));
app.use(express.json({ limit: "40kb", strict: true }));

app.use((req, res, next) => {
  req.requestId = req.get("x-request-id") || crypto.randomUUID();
  res.set("x-request-id", req.requestId);
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});

const registrationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "تم إرسال عدد كبير من الطلبات من هذا الاتصال. انتظر قليلًا ثم حاول مجددًا." }
});

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, database: "connected" });
  } catch (error) {
    next(error);
  }
});

app.get("/api/forms", async (_req, res, next) => {
  try {
    const result = await pool.query("SELECT id, data FROM forms WHERE data->>'status' <> 'deleted' ORDER BY updated_at, id");
    res.json({ items: result.rows.map(row => ({ id: row.id, ...row.data })) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/forms/:id", async (req, res, next) => {
  try {
    const result = await pool.query("SELECT id, data FROM forms WHERE id = $1 AND data->>'status' <> 'deleted'", [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "النموذج غير موجود." });
    res.json({ item: { id: result.rows[0].id, ...result.rows[0].data } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/registrations", registrationLimiter, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const formResult = await client.query("SELECT id, data FROM forms WHERE id = $1", [String(req.body?.formId || "")]);
    if (!formResult.rowCount) throw new ValidationError("البرنامج المحدد غير موجود.", "formId");
    const form = { id: formResult.rows[0].id, ...formResult.rows[0].data };
    const input = validateRegistrationInput(req.body, form);
    const registrationId = crypto.randomUUID();

    await client.query("BEGIN");
    const inserted = await client.query(`
      INSERT INTO registrations (id, client_request_id, form_id, form_title, answers, status, source)
      VALUES ($1, $2, $3, $4, $5::jsonb, 'new', $6)
      ON CONFLICT (client_request_id) DO NOTHING
      RETURNING id, created_at
    `, [registrationId, input.clientRequestId, form.id, form.title, JSON.stringify(input.answers), input.source]);

    if (!inserted.rowCount) {
      const existing = await client.query("SELECT id, created_at FROM registrations WHERE client_request_id = $1", [input.clientRequestId]);
      await client.query("COMMIT");
      return res.status(200).json({ ok: true, id: existing.rows[0].id, duplicate: true, receivedAt: existing.rows[0].created_at });
    }

    await client.query("INSERT INTO notification_jobs (registration_id) VALUES ($1) ON CONFLICT DO NOTHING", [registrationId]);
    await client.query("COMMIT");
    res.status(201).json({ ok: true, id: registrationId, receivedAt: inserted.rows[0].created_at });
    triggerNotificationWorker(pool);
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch {}
    next(error);
  } finally {
    client.release();
  }
});

app.post("/api/internal/firestore-registration", async (req, res, next) => {
  try {
    const configuredSecret = process.env.LEGACY_BRIDGE_SECRET || "";
    const providedSecret = req.get("x-bridge-secret") || "";
    const secretsMatch = configuredSecret && providedSecret
      && configuredSecret.length === providedSecret.length
      && crypto.timingSafeEqual(Buffer.from(configuredSecret), Buffer.from(providedSecret));
    if (!secretsMatch) return res.status(401).json({ error: "غير مصرح." });
    const id = String(req.body?.id || "");
    const data = req.body?.data;
    if (!/^[a-zA-Z0-9_-]{2,160}$/.test(id) || !data || typeof data !== "object" || Array.isArray(data)) {
      throw new ValidationError("بيانات النقل غير صحيحة.");
    }
    const answers = data.answers && typeof data.answers === "object" && !Array.isArray(data.answers) ? data.answers : {};
    const status = ["new", "contacted", "accepted", "declined"].includes(data.status) ? data.status : "new";
    const createdAt = new Date(data.createdAt || data.createdAtISO || Date.now());
    const safeCreatedAt = Number.isNaN(createdAt.getTime()) ? new Date() : createdAt;
    const result = await pool.query(`
      INSERT INTO registrations (id, form_id, form_title, answers, status, source, created_at)
      VALUES ($1, $2, $3, $4::jsonb, $5, 'firestore-bridge', $6)
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `, [id, String(data.formId || "unknown").slice(0, 80), String(data.formTitle || "تسجيل سابق").slice(0, 240), JSON.stringify(answers), status, safeCreatedAt]);
    res.status(result.rowCount ? 201 : 200).json({ ok: true, duplicate: !result.rowCount });
  } catch (error) {
    next(error);
  }
});

app.use("/api/admin", requireAdmin);

app.get("/api/admin/dashboard", async (req, res, next) => {
  try {
    const junior = req.admin.role === "junior";
    const [formsResult, registrationsResult, messagesResult] = await Promise.all([
      pool.query(`SELECT id, data FROM forms WHERE data->>'status' <> 'deleted' ${junior ? "AND id = 'junior'" : ""} ORDER BY updated_at, id`),
      pool.query(`SELECT * FROM registrations ${junior ? "WHERE form_id = 'junior'" : ""} ORDER BY created_at DESC`),
      pool.query(`SELECT id, data FROM message_templates ${junior ? "WHERE id = 'junior'" : ""} ORDER BY id`)
    ]);
    res.json({
      role: req.admin.role,
      forms: formsResult.rows.map(row => ({ id: row.id, ...row.data })),
      registrations: registrationsResult.rows.map(registrationFromRow),
      messageTemplates: messagesResult.rows.map(row => ({ id: row.id, ...row.data }))
    });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/forms/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!canAccessForm(req.admin, id)) return res.status(403).json({ error: "لا توجد صلاحية لتعديل هذا النموذج." });
    if (req.admin.role === "junior") {
      const existing = await pool.query("SELECT 1 FROM forms WHERE id = 'junior'");
      if (!existing.rowCount) return res.status(403).json({ error: "لا يمكن إنشاء نموذج جديد بهذا الحساب." });
    }
    const data = validateFormInput(id, req.body);
    await pool.query(`
      INSERT INTO forms (id, data, updated_at) VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `, [id, JSON.stringify(data)]);
    await audit(pool, req.admin, "save", "form", id, { status: data.status });
    res.json({ ok: true, item: { id, ...data } });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/forms/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!canAccessForm(req.admin, id)) return res.status(403).json({ error: "لا توجد صلاحية لحذف هذا النموذج." });
    const result = await pool.query("UPDATE forms SET data = jsonb_set(data, '{status}', '\"deleted\"'::jsonb), updated_at = NOW() WHERE id = $1 RETURNING id", [id]);
    if (!result.rowCount) return res.status(404).json({ error: "النموذج غير موجود." });
    await audit(pool, req.admin, "delete", "form", id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/admin/registrations/:id/status", async (req, res, next) => {
  try {
    const status = validateStatus(req.body?.status);
    const scope = req.admin.role === "junior" ? "AND form_id = 'junior'" : "";
    const result = await pool.query(`UPDATE registrations SET status = $2, status_updated_at = NOW() WHERE id = $1 ${scope} RETURNING id`, [req.params.id, status]);
    if (!result.rowCount) return res.status(404).json({ error: "الطلب غير موجود أو خارج صلاحيتك." });
    await audit(pool, req.admin, "status", "registration", req.params.id, { status });
    res.json({ ok: true, status });
  } catch (error) {
    next(error);
  }
});

app.delete("/api/admin/registrations/:id", async (req, res, next) => {
  try {
    const scope = req.admin.role === "junior" ? "AND form_id = 'junior'" : "";
    const result = await pool.query(`DELETE FROM registrations WHERE id = $1 ${scope} RETURNING id`, [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "الطلب غير موجود أو خارج صلاحيتك." });
    await audit(pool, req.admin, "delete", "registration", req.params.id);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.put("/api/admin/message-templates/:id", async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!canAccessForm(req.admin, id)) return res.status(403).json({ error: "لا توجد صلاحية لتعديل هذا القالب." });
    const data = validateMessageTemplate(id, req.body);
    await pool.query(`
      INSERT INTO message_templates (id, data, updated_at, updated_by) VALUES ($1, $2::jsonb, NOW(), $3)
      ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW(), updated_by = EXCLUDED.updated_by
    `, [id, JSON.stringify(data), req.admin.uid]);
    await audit(pool, req.admin, "save", "message_template", id);
    res.json({ ok: true, item: { id, ...data } });
  } catch (error) {
    next(error);
  }
});

app.post("/api/admin/notifications/retry", requirePrimary, async (_req, res, next) => {
  try {
    await pool.query("UPDATE notification_jobs SET status = 'pending', next_attempt_at = NOW(), completed_at = NULL WHERE status IN ('failed', 'partial')");
    triggerNotificationWorker(pool);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

const publicDirectories = ["/assets/", "/images/", "/pdfs/", "/sections/"];
const publicFiles = new Set([
  "/index.html", "/admin.html", "/form.html", "/privacy.html", "/training.html",
  "/register-online.html", "/register-presence.html", "/learn.html", "/main.html",
  "/header.html", "/footer.html", "/logo.jpg", "/images.jpeg", "/cr.png",
  "/p1.jpg", "/p1.png", "/p2.png", "/p3.png", "/p4.png", "/p5.png", "/saudi-business-center.png"
]);
app.get("/", (_req, res) => res.sendFile(path.join(rootDirectory, "index.html")));
app.use((req, res, next) => {
  if (publicFiles.has(req.path) || publicDirectories.some(prefix => req.path.startsWith(prefix))) return next();
  res.status(404).type("text").send("Not found");
});
app.use(express.static(rootDirectory, { index: false, dotfiles: "deny", maxAge: 0, etag: true }));

app.use((error, req, res, _next) => {
  if (error instanceof ValidationError) {
    return res.status(error.statusCode).json({ error: error.message, field: error.field, requestId: req.requestId });
  }
  if (error?.type === "entity.parse.failed") return res.status(400).json({ error: "صيغة البيانات غير صحيحة.", requestId: req.requestId });
  console.error("request failed", { requestId: req.requestId, method: req.method, path: req.path, error: error?.message });
  res.status(500).json({ error: "تعذر إكمال الطلب الآن. حاول مرة أخرى.", requestId: req.requestId });
});

await initializeDatabase(pool);
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`Sami training server listening on ${port}`);
  triggerNotificationWorker(pool);
});

const workerTimer = setInterval(() => processNotificationJobs(pool).catch(error => console.error("notification interval failed", error)), 60_000);
workerTimer.unref();

async function shutdown(signal) {
  console.log(`Received ${signal}; shutting down`);
  clearInterval(workerTimer);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 15_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
