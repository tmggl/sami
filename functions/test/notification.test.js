"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildNotificationMessage, buildRegistrantConfirmationMessage, cleanText, normalizeSaudiMobile, normalizeWhatsAppGroupUrl } = require("../lib/notification");

test("builds a concise registration notification", () => {
  const message = buildNotificationMessage({
    formTitle: "تدريب الأشبال",
    answers: { name: "أحمد", phone: "0500000000", city: "الرياض" },
  }, "https://example.com/admin.html");
  assert.match(message, /أحمد/);
  assert.match(message, /تدريب الأشبال/);
  assert.match(message, /الرياض/);
  assert.match(message, /admin\.html/);
});

test("removes line breaks from untrusted fields", () => {
  assert.equal(cleanText("سطر\nثانٍ"), "سطر ثانٍ");
});

test("builds a registrant confirmation with the course and direct group link", () => {
  const message = buildRegistrantConfirmationMessage(
    { formTitle: "طلب الالتحاق بدورة برمجة المواقع والأنظمة (عن بُعد)" },
    "https://chat.whatsapp.com/IrubrVrAyoQHHLhAc51diu?mode=gi_t"
  );
  assert.match(message, /دورة برمجة المواقع والأنظمة/);
  assert.match(message, /لحجز مقعدك مؤقتًا/);
  assert.match(message, /https:\/\/chat\.whatsapp\.com\/IrubrVrAyoQHHLhAc51diu$/);
  assert.doesNotMatch(message, /mode=/);
});

test("confirms multiple children sharing one phone in a single message", () => {
  const message = buildRegistrantConfirmationMessage(
    { formTitle: "طلب الالتحاق بمعسكر الأشبال", familyNames: ["أحمد", "محمد"] },
    "https://chat.whatsapp.com/FpLB6lJn9KVCCwzy8UPU0f"
  );
  assert.match(message, /تسجيل 2 من الأشبال/);
  assert.match(message, /أحمد، محمد/);
  assert.equal((message.match(/chat\.whatsapp\.com/g) || []).length, 1);
});

test("keeps WhatsApp invite links direct while removing tracking parameters", () => {
  assert.equal(
    normalizeWhatsAppGroupUrl("https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv?s=cl&p=a"),
    "https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv"
  );
  assert.equal(normalizeWhatsAppGroupUrl("https://example.com/not-whatsapp"), "");
});

test("normalizes Saudi mobile numbers for Msegat", () => {
  assert.equal(normalizeSaudiMobile("0501234567"), "966501234567");
  assert.equal(normalizeSaudiMobile("+966 50 123 4567"), "966501234567");
  assert.equal(normalizeSaudiMobile("123"), "");
});
