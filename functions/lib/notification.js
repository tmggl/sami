"use strict";

function cleanText(value, maxLength = 80) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim().slice(0, maxLength);
}

function buildNotificationMessage(data, adminUrl) {
  const answers = data.answers || {};
  const name = cleanText(answers.name || data.name || "بدون اسم", 45);
  const form = cleanText(data.formTitle || data.formId || "برنامج تدريبي", 65);
  const choice = cleanText(answers.time || answers.city || answers.interest || "غير محدد", 55);
  return [
    "تسجيل جديد",
    `الاسم: ${name}`,
    `المسار: ${form}`,
    `الخيار: ${choice}`,
    cleanText(adminUrl, 180),
  ].filter(Boolean).join("\n");
}

async function sendMsegatSms({ username, apiKey, sender, phone, message }) {
  const response = await fetch("https://www.msegat.com/gw/sendsms.php", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      userName: username,
      apiKey,
      numbers: phone,
      userSender: sender,
      msg: message,
      msgEncoding: "UTF8",
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) throw new Error(`Msegat HTTP ${response.status}`);
  const raw = await response.text();
  let result = {};
  try { result = JSON.parse(raw); } catch { result = { code: raw.trim() }; }
  const code = String(result.code || result.Code || "").trim();
  if (!["1", "M0000"].includes(code)) throw new Error(`Msegat rejected request (${code || "unknown"})`);
  return { id: String(result.id || ""), code };
}

module.exports = { cleanText, buildNotificationMessage, sendMsegatSms };
