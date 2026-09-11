import pg from "pg";
import { DEFAULT_FORMS, DEFAULT_MESSAGES } from "../assets/forms-config.js";

const { Pool } = pg;

export function createPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  return new Pool({
    connectionString,
    max: Number(process.env.DATABASE_POOL_SIZE || 5),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 8_000,
    keepAlive: true,
    ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false }
  });
}

export async function initializeDatabase(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS forms (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id TEXT PRIMARY KEY,
      client_request_id TEXT UNIQUE,
      form_id TEXT NOT NULL,
      form_title TEXT NOT NULL,
      answers JSONB NOT NULL,
      status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'accepted', 'declined')),
      source TEXT NOT NULL DEFAULT 'website',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      status_updated_at TIMESTAMPTZ
    );

    CREATE INDEX IF NOT EXISTS registrations_created_at_idx ON registrations (created_at DESC);
    CREATE INDEX IF NOT EXISTS registrations_form_id_idx ON registrations (form_id);
    CREATE INDEX IF NOT EXISTS registrations_status_idx ON registrations (status);
    CREATE INDEX IF NOT EXISTS registrations_city_idx ON registrations ((answers->>'city'));

    CREATE TABLE IF NOT EXISTS message_templates (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_by TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notification_jobs (
      id BIGSERIAL PRIMARY KEY,
      registration_id TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'partial', 'failed')),
      attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      locked_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      result JSONB,
      last_error TEXT,
      UNIQUE (registration_id)
    );

    CREATE INDEX IF NOT EXISTS notification_jobs_pending_idx
      ON notification_jobs (status, next_attempt_at)
      WHERE status IN ('pending', 'processing');

    CREATE TABLE IF NOT EXISTS audit_log (
      id BIGSERIAL PRIMARY KEY,
      actor_uid TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const form of DEFAULT_FORMS) {
      const { id, ...data } = form;
      await client.query(
        "INSERT INTO forms (id, data) VALUES ($1, $2::jsonb) ON CONFLICT (id) DO NOTHING",
        [id, JSON.stringify(data)]
      );
    }
    for (const template of DEFAULT_MESSAGES) {
      const { id, ...data } = template;
      await client.query(
        "INSERT INTO message_templates (id, data, updated_by) VALUES ($1, $2::jsonb, 'system') ON CONFLICT (id) DO NOTHING",
        [id, JSON.stringify(data)]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export function registrationFromRow(row) {
  return {
    id: row.id,
    formId: row.form_id,
    formTitle: row.form_title,
    answers: row.answers,
    status: row.status,
    source: row.source,
    createdAt: row.created_at,
    createdAtISO: row.created_at?.toISOString?.() || row.created_at,
    statusUpdatedAt: row.status_updated_at
  };
}

export async function audit(pool, actor, action, targetType, targetId, metadata = {}) {
  await pool.query(
    `INSERT INTO audit_log (actor_uid, actor_role, action, target_type, target_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [actor.uid, actor.role, action, targetType, targetId, JSON.stringify(metadata)]
  );
}
