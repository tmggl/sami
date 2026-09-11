import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  buildNotificationMessage,
  buildRegistrantConfirmationMessage,
  cleanText,
  normalizeSaudiMobile,
  sendMsegatSms
} = require("../functions/lib/notification.js");

let processing = false;

function smsConfig() {
  return {
    username: process.env.MSEGAT_USERNAME || "",
    apiKey: process.env.MSEGAT_API_KEY || "",
    sender: process.env.MSEGAT_SENDER_NAME || "",
    adminPhone: process.env.ADMIN_NOTIFICATION_PHONE || "",
    juniorAdminPhone: process.env.JUNIOR_ADMIN_NOTIFICATION_PHONE || "",
    adminUrl: process.env.ADMIN_PANEL_URL || "https://www.samialzamzami.com/admin.html"
  };
}

export function triggerNotificationWorker(pool) {
  if (processing) return;
  setImmediate(() => processNotificationJobs(pool).catch(error => console.error("notification worker failed", error)));
}

export async function processNotificationJobs(pool, limit = 5) {
  if (processing) return;
  processing = true;
  try {
    for (let index = 0; index < limit; index += 1) {
      const job = await claimJob(pool);
      if (!job) break;
      await deliverJob(pool, job);
    }
  } finally {
    processing = false;
  }
}

async function claimJob(pool) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      SELECT j.id AS job_id, j.attempts AS job_attempts, j.result AS job_result,
             mt.data->>'groupUrl' AS group_url,
             CASE WHEN mt.data->>'smsGroupLinkEnabled' = 'false' THEN false ELSE true END AS sms_group_link_enabled,
             r.*
      FROM notification_jobs j
      JOIN registrations r ON r.id = j.registration_id
      LEFT JOIN message_templates mt ON mt.id = CASE
        WHEN r.form_id = 'junior' THEN 'junior'
        WHEN r.form_id = 'remote' THEN 'remote'
        ELSE 'in-person'
      END
      WHERE j.completed_at IS NULL AND (
        (j.status IN ('pending', 'partial', 'failed') AND j.next_attempt_at <= NOW())
        OR (j.status = 'processing' AND j.locked_at < NOW() - INTERVAL '5 minutes')
      )
      ORDER BY j.id
      FOR UPDATE OF j SKIP LOCKED
      LIMIT 1
    `);
    if (!result.rowCount) {
      await client.query("COMMIT");
      return null;
    }
    const row = result.rows[0];
    await client.query(
      "UPDATE notification_jobs SET status = 'processing', attempts = attempts + 1, locked_at = NOW() WHERE id = $1",
      [row.job_id]
    );
    await client.query("COMMIT");
    return row;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function deliverJob(pool, job) {
  const config = smsConfig();
  if (!config.username || !config.apiKey || !config.sender || !config.adminPhone) {
    await pool.query(
      "UPDATE notification_jobs SET status = 'failed', last_error = $2, next_attempt_at = NOW() + INTERVAL '15 minutes' WHERE id = $1",
      [job.job_id, "SMS configuration is incomplete"]
    );
    return;
  }

  const data = { formId: job.form_id, formTitle: job.form_title, answers: job.answers };
  const jobs = [{
    key: "adminSms",
    phone: config.adminPhone,
    message: buildNotificationMessage(data, config.adminUrl)
  }];
  if (job.form_id === "junior" && config.juniorAdminPhone) {
    jobs.push({ key: "juniorAdminSms", phone: config.juniorAdminPhone, message: buildNotificationMessage(data, config.adminUrl) });
  }
  const registrantPhone = normalizeSaudiMobile(job.answers?.phone);
  if (registrantPhone) jobs.push({
    key: "registrantSms",
    phone: registrantPhone,
    message: buildRegistrantConfirmationMessage(data, job.sms_group_link_enabled ? job.group_url : "")
  });

  const previousOutcome = job.job_result && typeof job.job_result === "object" ? job.job_result : {};
  const pendingJobs = jobs.filter(item => previousOutcome[item.key]?.status !== "sent");
  if (!pendingJobs.length) {
    await pool.query("UPDATE notification_jobs SET status = 'sent', completed_at = NOW(), locked_at = NULL WHERE id = $1", [job.job_id]);
    return;
  }
  const results = await Promise.allSettled(pendingJobs.map(item => sendMsegatSms({
    username: config.username,
    apiKey: config.apiKey,
    sender: config.sender,
    phone: item.phone,
    message: item.message
  })));
  const outcome = { ...previousOutcome };
  results.forEach((result, index) => {
    const key = pendingJobs[index].key;
    if (result.status === "fulfilled") {
      outcome[key] = { status: "sent", providerId: result.value.id };
    } else {
      outcome[key] = { status: "failed", error: cleanText(result.reason?.message, 160) };
    }
  });
  const finalStates = jobs.map(item => outcome[item.key]?.status || "failed");
  const sent = finalStates.filter(status => status === "sent").length;
  const failed = finalStates.length - sent;
  const attempts = Number(job.job_attempts || 0) + 1;
  const finalFailure = failed > 0 && attempts >= 5;
  const status = failed === 0 ? "sent" : sent > 0 ? "partial" : "failed";
  await pool.query(`
    UPDATE notification_jobs
    SET status = $2,
        result = $3::jsonb,
        last_error = $4,
        completed_at = CASE WHEN $5 OR $2 = 'sent' THEN NOW() ELSE NULL END,
        next_attempt_at = CASE WHEN $5 OR $2 = 'sent' THEN next_attempt_at ELSE NOW() + ($6 * INTERVAL '1 minute') END,
        locked_at = NULL
    WHERE id = $1
  `, [job.job_id, status, JSON.stringify(outcome), failed ? "تعذر إرسال بعض الرسائل النصية" : null, finalFailure, Math.min(60, 2 ** attempts)]);
}
