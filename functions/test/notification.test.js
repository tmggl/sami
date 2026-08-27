"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildNotificationMessage, cleanText } = require("../lib/notification");

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
