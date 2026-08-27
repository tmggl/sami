"use strict";

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { cleanText, buildNotificationMessage, sendMsegatSms } = require("./lib/notification");

initializeApp();

const MSEGAT_USERNAME = defineSecret("MSEGAT_USERNAME");
const MSEGAT_API_KEY = defineSecret("MSEGAT_API_KEY");
const MSEGAT_SENDER_NAME = defineSecret("MSEGAT_SENDER_NAME");
const ADMIN_NOTIFICATION_PHONE = defineSecret("ADMIN_NOTIFICATION_PHONE");
const ADMIN_PANEL_URL = defineSecret("ADMIN_PANEL_URL");

exports.notifyAdminOnRegistration = onDocumentCreated({
  document: "registrations/{registrationId}",
  database: "sami-training",
  region: "europe-west3",
  secrets: [MSEGAT_USERNAME, MSEGAT_API_KEY, MSEGAT_SENDER_NAME, ADMIN_NOTIFICATION_PHONE, ADMIN_PANEL_URL],
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

  try {
    const result = await sendMsegatSms({
      username: MSEGAT_USERNAME.value(),
      apiKey: MSEGAT_API_KEY.value(),
      sender: MSEGAT_SENDER_NAME.value(),
      phone: ADMIN_NOTIFICATION_PHONE.value(),
      message: buildNotificationMessage(data, ADMIN_PANEL_URL.value()),
    });
    await eventRef.set({ status: "sent", providerId: result.id, sentAt: FieldValue.serverTimestamp() }, { merge: true });
    logger.info("Registration SMS notification sent", { registrationId: event.params.registrationId });
  } catch (error) {
    await eventRef.set({ status: "failed", error: cleanText(error.message, 120), failedAt: FieldValue.serverTimestamp() }, { merge: true });
    logger.error("Registration SMS notification failed", { registrationId: event.params.registrationId, error: cleanText(error.message, 120) });
  }
});
