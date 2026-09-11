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

function normalizeWhatsAppGroupUrl(value = "") {
  try {
    const url = new URL(String(value).trim());
    const inviteCode = url.pathname.match(/^\/([a-zA-Z0-9_-]{10,80})\/?$/)?.[1] || "";
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "chat.whatsapp.com" || !inviteCode) return "";
    return `https://chat.whatsapp.com/${inviteCode}`;
  } catch {
    return "";
  }
}

function buildRegistrantConfirmationMessage(data = {}, groupUrl = "") {
  const form = cleanText(data.formTitle || data.formId || "البرنامج التدريبي", 70).replace(/^طلب الالتحاق ب/, "");
  const link = normalizeWhatsAppGroupUrl(groupUrl);
  if (!link) return `تم استلام طلبك في ${form}. سنتواصل معك قريبًا عبر واتساب.`;
  return `تم استلام طلبك في ${form}.\nلحجز مقعدك مؤقتًا، انضم إلى مجموعة واتساب:\n${link}`;
}

function normalizeSaudiMobile(value = "") {
  let digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("9660")) digits = `966${digits.slice(4)}`;
  else if (digits.startsWith("0")) digits = `966${digits.slice(1)}`;
  else if (digits.startsWith("5") && digits.length === 9) digits = `966${digits}`;
  return /^9665\d{8}$/.test(digits) ? digits : "";
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

module.exports = { cleanText, buildNotificationMessage, buildRegistrantConfirmationMessage, normalizeSaudiMobile, normalizeWhatsAppGroupUrl, sendMsegatSms };
