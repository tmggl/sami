import fs from "node:fs";
import path from "node:path";

// Server-only migration coordination. Ordinary deployments have no controls.
// Requests wait briefly instead of failing or being executed against two DBs.
export function createMigrationControl({ enabled = false, timeoutMs = 30000, statusFile = "" } = {}) {
  let paused = false;
  let active = 0;
  let timer;
  let release;
  let pending = Promise.resolve();
  let busy = () => false;
  let generation = "render";
  let error = "";
  function snapshot() { return { enabled, paused, activeRequests: active, notificationBusy: busy(), generation, error }; }
  function record() {
    if (enabled && statusFile) fs.writeFileSync(statusFile, JSON.stringify(snapshot()), { mode: 0o600 });
  }
  function resume() {
    clearTimeout(timer);
    paused = false;
    release?.();
    release = undefined;
    record();
  }
  function pause() {
    if (!enabled || paused) return;
    paused = true;
    error = "";
    pending = new Promise(resolve => { release = resolve; });
    timer = setTimeout(() => { error = "PAUSE_EXPIRED_USING_ORIGINAL_DATABASE"; resume(); }, timeoutMs);
    timer.unref();
    record();
  }
  async function switchDatabase(swap, config) {
    if (!enabled || !paused || active || busy()) throw new Error("MIGRATION_NOT_DRAINED");
    clearTimeout(timer);
    try {
      await swap(config);
      generation = String(config.generation || "local").slice(0, 64);
      error = "";
    } catch (failure) {
      error = "DATABASE_SWITCH_FAILED_ORIGINAL_RETAINED";
      throw failure;
    } finally { resume(); }
  }
  async function middleware(req, res, next) {
    if (!enabled || !req.path.startsWith("/api/") || req.path === "/api/health") return next();
    if (paused) await pending;
    if (res.destroyed) return;
    active++;
    record();
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      active--;
      record();
    };
    res.once("finish", done);
    res.once("close", done);
    next();
  }
  return { pause, resume, middleware, switchDatabase, snapshot, record, setBusyReader(fn) { busy = fn; record(); }, isPaused: () => paused };
}

export const migrationControl = createMigrationControl({
  enabled: Boolean(process.env.MIGRATION_CONTROL_DIR),
  statusFile: process.env.MIGRATION_CONTROL_DIR ? "/tmp/sami-migration-status.json" : ""
});

export function installMigrationSignals(pool) {
  const directory = process.env.MIGRATION_CONTROL_DIR;
  if (!directory) return;
  migrationControl.record();
  process.on("SIGUSR1", () => migrationControl.pause());
  process.on("SIGUSR2", async () => {
    try {
      const config = JSON.parse(fs.readFileSync(path.join(directory, "database.json"), "utf8"));
      if (!config.url || !["disable", "verify-full"].includes(config.sslMode)) throw new Error("INVALID_MIGRATION_CONFIGURATION");
      await migrationControl.switchDatabase(value => pool.switchDatabase(value.url, value.sslMode), config);
    } catch {
      // Do not log URLs, credentials or customer data. The status file is private.
      console.error("Sami database switch was not completed; original database retained");
    }
  });
}
