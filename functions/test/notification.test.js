"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildNotificationMessage, buildRegistrantConfirmationMessage, cleanText, normalizeSaudiMobile } = require("../lib/notification");

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

test("builds a short registrant confirmation that fits one Arabic SMS segment", () => {
  const message = buildRegistrantConfirmationMessage();
  assert.equal(message, "تم استلام طلب انضمامك. سنتواصل معكم قريبًا عبر واتساب.");
  assert.ok(message.length <= 70);
});

test("normalizes Saudi mobile numbers for Msegat", () => {
  assert.equal(normalizeSaudiMobile("0501234567"), "966501234567");
  assert.equal(normalizeSaudiMobile("+966 50 123 4567"), "966501234567");
  assert.equal(normalizeSaudiMobile("123"), "");
});
