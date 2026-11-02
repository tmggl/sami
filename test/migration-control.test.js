import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createMigrationControl } from "../server/migration-control.js";
import { processNotificationJobs } from "../server/notifications.js";

const request = () => ({ path: "/api/registrations" });
test("ordinary deployments do not gate requests or change responses", async () => {
  const control = createMigrationControl();
  control.pause();
  let called = 0;
  await control.middleware(request(), new EventEmitter(), () => called++);
  assert.equal(called, 1);
  assert.equal(control.snapshot().paused, false);
});
test("migration holds a request once then resumes without replay", async () => {
  const control = createMigrationControl({ enabled: true });
  control.pause();
  let called = 0;
  const res = new EventEmitter();
  const pending = control.middleware(request(), res, () => called++);
  assert.equal(called, 0);
  await control.switchDatabase(async () => {}, { generation: "local" });
  await pending;
  assert.equal(called, 1);
  res.emit("finish"); res.emit("close");
  assert.equal(control.snapshot().activeRequests, 0);
});
test("cannot switch while a customer request or notification is active", async () => {
  const control = createMigrationControl({ enabled: true });
  const res = new EventEmitter();
  await control.middleware(request(), res, () => {});
  control.pause();
  await assert.rejects(control.switchDatabase(async () => {}, {}), /NOT_DRAINED/);
  res.emit("finish");
  control.setBusyReader(() => true);
  await assert.rejects(control.switchDatabase(async () => {}, {}), /NOT_DRAINED/);
  control.resume();
});
test("failed replacement releases held requests to the original database", async () => {
  const control = createMigrationControl({ enabled: true });
  control.pause();
  await assert.rejects(control.switchDatabase(async () => { throw new Error("connection failed"); }, {}));
  assert.equal(control.snapshot().paused, false);
  assert.equal(control.snapshot().generation, "render");
});
test("watchdog releases a pause automatically if management disconnects", async () => {
  const control = createMigrationControl({ enabled: true, timeoutMs: 10 });
  control.pause();
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(control.snapshot().paused, false);
});
test("standby cannot claim or send any notification", async () => {
  const old = process.env.NOTIFICATION_WORKER_ENABLED;
  process.env.NOTIFICATION_WORKER_ENABLED = "false";
  try { await processNotificationJobs({ connect() { throw new Error("must not connect"); } }); }
  finally { if (old === undefined) delete process.env.NOTIFICATION_WORKER_ENABLED; else process.env.NOTIFICATION_WORKER_ENABLED = old; }
});
