"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { cleanText, buildNotificationMessage, buildRegistrantConfirmationMessage, normalizeSaudiMobile, sendMsegatSms } = require("./lib/notification");

initializeApp();

const MSEGAT_USERNAME = defineSecret("MSEGAT_USERNAME");
const MSEGAT_API_KEY = defineSecret("MSEGAT_API_KEY");
const MSEGAT_SENDER_NAME = defineSecret("MSEGAT_SENDER_NAME");
const ADMIN_NOTIFICATION_PHONE = defineSecret("ADMIN_NOTIFICATION_PHONE");
const JUNIOR_ADMIN_NOTIFICATION_PHONE = defineSecret("JUNIOR_ADMIN_NOTIFICATION_PHONE");
const ADMIN_PANEL_URL = defineSecret("ADMIN_PANEL_URL");
const POSTGRES_API_URL = defineSecret("POSTGRES_API_URL");
const POSTGRES_BRIDGE_SECRET = defineSecret("POSTGRES_BRIDGE_SECRET");

async function registrationMessageSettings(formId) {
  try {
    const response = await fetch(`${POSTGRES_API_URL.value().replace(/\/$/, "")}/api/internal/message-settings/${encodeURIComponent(formId || "in-person")}`, {
      headers: { "x-bridge-secret": POSTGRES_BRIDGE_SECRET.value() },
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) throw new Error(`message settings HTTP ${response.status}`);
    const result = await response.json();
    return {
      groupUrl: String(result.groupUrl || ""),
      smsGroupLinkEnabled: result.smsGroupLinkEnabled !== false
    };
  } catch (error) {
    logger.warn("Could not load registration message settings; sending confirmation without a group link", { error: error.message });
    return { groupUrl: "", smsGroupLinkEnabled: false };
  }
}

exports.notifyAdminOnRegistration = onDocumentCreated({
  document: "registrations/{registrationId}",
  database: "sami-training",
  region: "europe-west3",
  secrets: [MSEGAT_USERNAME, MSEGAT_API_KEY, MSEGAT_SENDER_NAME, ADMIN_NOTIFICATION_PHONE, JUNIOR_ADMIN_NOTIFICATION_PHONE, ADMIN_PANEL_URL, POSTGRES_API_URL, POSTGRES_BRIDGE_SECRET],
}, async event => {
  const data = event.data?.data();
  if (!data) return;

  const db = getFirestore("sami-training");
  const eventRef = db.collection("_system_sms_events").doc(event.id);
  let shouldSend = false;
  await db.runTransaction(async transaction => {
    const existing = await transaction.get(eventRef);
    if (existing.exists) return;
    transaction.create(eventRef, {
      registrationId: event.params.registrationId,
      status: "sending",
      createdAt: FieldValue.serverTimestamp(),
    });
    shouldSend = true;
  });
  if (!shouldSend) return;

  const answers = data.answers || {};
  const registrantPhone = normalizeSaudiMobile(answers.phone || data.phone);
  const messageSettings = registrantPhone ? await registrationMessageSettings(data.formId) : { groupUrl: "", smsGroupLinkEnabled: false };
  const smsJobs = [{
    key: "adminSms",
    promise: sendMsegatSms({
      username: MSEGAT_USERNAME.value(),
      apiKey: MSEGAT_API_KEY.value(),
      sender: MSEGAT_SENDER_NAME.value(),
      phone: ADMIN_NOTIFICATION_PHONE.value(),
      message: buildNotificationMessage(data, ADMIN_PANEL_URL.value()),
    }),
  }];

  if (data.formId === "junior") {
    smsJobs.push({
      key: "juniorAdminSms",
      promise: sendMsegatSms({
        username: MSEGAT_USERNAME.value(),
        apiKey: MSEGAT_API_KEY.value(),
        sender: MSEGAT_SENDER_NAME.value(),
        phone: JUNIOR_ADMIN_NOTIFICATION_PHONE.value(),
        message: buildNotificationMessage(data, ADMIN_PANEL_URL.value()),
      }),
    });
  }

  if (registrantPhone) {
    smsJobs.push({
      key: "registrantSms",
      promise: sendMsegatSms({
        username: MSEGAT_USERNAME.value(),
        apiKey: MSEGAT_API_KEY.value(),
        sender: MSEGAT_SENDER_NAME.value(),
        phone: registrantPhone,
        message: buildRegistrantConfirmationMessage(data, messageSettings.smsGroupLinkEnabled ? messageSettings.groupUrl : ""),
      }),
    });
  }

  const results = await Promise.allSettled(smsJobs.map(job => job.promise));
  const update = { completedAt: FieldValue.serverTimestamp() };
  let sentCount = 0;
  let failedCount = 0;

  results.forEach((result, index) => {
    const key = smsJobs[index].key;
    if (result.status === "fulfilled") {
      sentCount += 1;
      update[`${key}Status`] = "sent";
      update[`${key}ProviderId`] = result.value.id;
    } else {
      failedCount += 1;
      update[`${key}Status`] = "failed";
      update[`${key}Error`] = cleanText(result.reason?.message, 120);
    }
  });

  if (!registrantPhone) update.registrantSmsStatus = "skipped_invalid_phone";
  update.status = failedCount === 0 && registrantPhone ? "sent" : sentCount ? "partial" : "failed";
  await eventRef.set(update, { merge: true });

  if (failedCount) logger.error("One or more registration SMS messages failed", { registrationId: event.params.registrationId, failedCount });
  else logger.info("Registration SMS messages completed", { registrationId: event.params.registrationId, registrantSent: Boolean(registrantPhone) });
});

exports.bridgeRegistrationToPostgres = onDocumentCreated({
  document: "registrations/{registrationId}",
  database: "sami-training",
  region: "europe-west3",
  retry: true,
  secrets: [POSTGRES_API_URL, POSTGRES_BRIDGE_SECRET],
}, async event => {
  const data = event.data?.data();
  if (!data) return;
  const createdAt = data.createdAt?.toDate?.().toISOString?.() || data.createdAtISO || event.data.createTime?.toDate?.().toISOString?.();
  const response = await fetch(`${POSTGRES_API_URL.value().replace(/\/$/, "")}/api/internal/firestore-registration`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bridge-secret": POSTGRES_BRIDGE_SECRET.value()
    },
    body: JSON.stringify({
      id: event.params.registrationId,
      data: { ...data, createdAt }
    }),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error(`Postgres bridge rejected registration (${response.status})`);
  logger.info("Registration copied to Postgres", { registrationId: event.params.registrationId });
});
