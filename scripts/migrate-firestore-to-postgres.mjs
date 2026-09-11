import { decodeFirestoreDocument } from "../assets/firestore-rest.js";
import { createPool, initializeDatabase } from "../server/db.js";

const projectId = process.env.FIREBASE_PROJECT_ID || "tmggal";
const databaseId = process.env.FIRESTORE_DATABASE || "sami-training";
const accessToken = process.env.FIREBASE_ACCESS_TOKEN;
if (!accessToken) throw new Error("FIREBASE_ACCESS_TOKEN is required");

const pool = createPool();

const formOverrides = {
  "in-person": {
    cardTitle: "دورة برمجة المواقع والأنظمة (حضوري)",
    title: "طلب الالتحاق بدورة برمجة المواقع والأنظمة (حضوري)",
    price: 2600,
    oldPrice: 2800
  },
  remote: {
    cardTitle: "دورة برمجة المواقع والأنظمة (عن بُعد)",
    title: "طلب الالتحاق بدورة برمجة المواقع والأنظمة (عن بُعد)"
  },
  junior: {
    cardTitle: "معسكر الأشبال",
    title: "طلب الالتحاق بمعسكر الأشبال"
  },
  "in-person-project": { status: "upcoming" }
};

async function listCollection(collection) {
  const documents = [];
  let pageToken = "";
  do {
    const url = new URL(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${collection}`);
    url.searchParams.set("pageSize", "1000");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Firestore ${collection} export failed (${response.status})`);
    const result = await response.json();
    documents.push(...(result.documents || []).map(document => ({
      id: decodeURIComponent(document.name.split("/").pop()),
      data: decodeFirestoreDocument(document)
    })));
    pageToken = result.nextPageToken || "";
  } while (pageToken);
  return documents;
}

function registrationAnswers(data) {
  const answers = data.answers && typeof data.answers === "object" ? { ...data.answers } : {};
  for (const key of ["name", "phone", "age", "degree", "city", "time", "computer", "english", "laptop", "riyadh", "project", "guardian", "experience", "interest", "notes"]) {
    if (answers[key] === undefined && data[key] !== undefined) answers[key] = data[key];
  }
  return answers;
}

function safeDate(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) || date.getTime() === 0 ? new Date() : date;
}

async function migrate() {
  await initializeDatabase(pool);
  const [forms, registrations, templates, settings] = await Promise.all([
    listCollection("forms"),
    listCollection("registrations"),
    listCollection("messageTemplates"),
    listCollection("settings")
  ]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const { id, data } of forms) {
      const { updatedAt: _updatedAt, deletedAt: _deletedAt, ...formData } = data;
      Object.assign(formData, formOverrides[id] || {});
      await client.query(`
        INSERT INTO forms (id, data, updated_at) VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `, [id, JSON.stringify(formData)]);
    }
    for (const { id, data } of registrations) {
      const status = ["new", "contacted", "accepted", "declined"].includes(data.status) ? data.status : "new";
      await client.query(`
        INSERT INTO registrations (id, client_request_id, form_id, form_title, answers, status, source, created_at, status_updated_at)
        VALUES ($1, NULL, $2, $3, $4::jsonb, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          form_id = EXCLUDED.form_id,
          form_title = EXCLUDED.form_title,
          answers = EXCLUDED.answers,
          status = EXCLUDED.status,
          source = EXCLUDED.source,
          created_at = EXCLUDED.created_at,
          status_updated_at = EXCLUDED.status_updated_at
      `, [
        id,
        String(data.formId || "unknown"),
        String(data.formTitle || "تسجيل سابق"),
        JSON.stringify(registrationAnswers(data)),
        status,
        String(data.source || "firestore-migration"),
        safeDate(data.createdAt || data.createdAtISO),
        data.statusUpdatedAt ? safeDate(data.statusUpdatedAt) : null
      ]);
    }
    for (const { id, data } of templates) {
      const { updatedAt: _updatedAt, updatedBy, ...templateData } = data;
      await client.query(`
        INSERT INTO message_templates (id, data, updated_at, updated_by) VALUES ($1, $2::jsonb, NOW(), $3)
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW(), updated_by = EXCLUDED.updated_by
      `, [id, JSON.stringify(templateData), String(updatedBy || "firestore-migration")]);
    }
    for (const { id, data } of settings) {
      await client.query(`
        INSERT INTO settings (id, data, updated_at) VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      `, [id, JSON.stringify(data)]);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  console.log(JSON.stringify({ forms: forms.length, registrations: registrations.length, messageTemplates: templates.length, settings: settings.length }));
}

try {
  await migrate();
} finally {
  await pool.end();
}
