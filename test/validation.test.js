import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FORMS } from "../assets/forms-config.js";
import { normalizeWhatsAppGroupUrl, validateFamilyRegistrationInput, validateFormInput, validateMessageTemplate, validateRegistrationInput, validateSaudiLocalPhone, ValidationError } from "../server/validation.js";

test("accepts only a ten-digit Saudi mobile beginning with 05", () => {
  assert.equal(validateSaudiLocalPhone("0501234567"), "0501234567");
  for (const invalid of ["501234567", "+966501234567", "050123456", "05012345678", "05123 4567", "055-123-4567"]) {
    assert.throws(() => validateSaudiLocalPhone(invalid), ValidationError);
  }
});

test("validates a complete registration against the published form", () => {
  const form = DEFAULT_FORMS.find(item => item.id === "remote");
  const answers = Object.fromEntries(form.questions.map(question => {
    if (question.id === "name") return [question.id, "سامي محمد"];
    if (question.id === "phone") return [question.id, "0501234567"];
    if (question.type === "checkbox") return [question.id, []];
    if (["radio", "select"].includes(question.type)) return [question.id, question.options[0]];
    if (question.type === "number") return [question.id, String(question.min || 20)];
    return [question.id, question.required ? "إجابة" : ""];
  }));
  const result = validateRegistrationInput({ formId: form.id, answers, clientRequestId: "12345678-1234-1234-1234-123456789012" }, form);
  assert.equal(result.answers.phone, "0501234567");
  assert.equal(result.source, "website");
});

test("rejects unexpected answer fields and closed forms", () => {
  const form = DEFAULT_FORMS.find(item => item.id === "remote");
  assert.throws(() => validateRegistrationInput({
    formId: form.id,
    clientRequestId: "12345678-1234-1234-1234-123456789012",
    answers: { name: "سامي محمد", phone: "0501234567", injected: "no" }
  }, form), /غير مسموح/);
  assert.throws(() => validateRegistrationInput({ formId: "closed", answers: {}, clientRequestId: "12345678-1234-1234-1234-123456789012" }, { ...form, id: "closed", status: "upcoming" }), /غير متاح/);
});

test("accepts Riyadh only for the in-person programming course", () => {
  const form = DEFAULT_FORMS.find(item => item.id === "in-person");
  const cityQuestion = form.questions.find(question => question.id === "city");
  assert.deepEqual(cityQuestion.unavailableOptions, ["جدة", "أبها", "القصيم", "المدينة المنورة"]);
  const saved = validateFormInput(form.id, form);
  assert.deepEqual(saved.questions.find(question => question.id === "city").unavailableOptions, cityQuestion.unavailableOptions);
  const answers = Object.fromEntries(form.questions.map(question => {
    if (question.id === "name") return [question.id, "سامي محمد"];
    if (question.id === "phone") return [question.id, "0501234567"];
    if (question.id === "city") return [question.id, "الرياض"];
    if (question.type === "checkbox") return [question.id, []];
    if (["radio", "select"].includes(question.type)) return [question.id, question.options[0]];
    if (question.type === "number") return [question.id, String(question.min || 20)];
    return [question.id, question.required ? "إجابة" : ""];
  }));
  const request = { formId: form.id, answers, clientRequestId: "12345678-1234-1234-1234-123456789012" };
  assert.equal(validateRegistrationInput(request, form).answers.city, "الرياض");
  assert.throws(() => validateRegistrationInput({ ...request, answers: { ...answers, city: "جدة" } }, form), /غير متاح حاليًا/);
});

test("validates every child in one junior family request and allows a shared phone", () => {
  const form = DEFAULT_FORMS.find(item => item.id === "junior");
  const makeAnswers = name => Object.fromEntries(form.questions.map(question => {
    if (question.id === "name") return [question.id, name];
    if (question.id === "phone") return [question.id, "0501234567"];
    if (question.id === "guardian") return [question.id, "ولي الأمر"];
    if (question.type === "checkbox") return [question.id, []];
    if (["radio", "select"].includes(question.type)) return [question.id, question.options[0]];
    if (question.type === "number") return [question.id, String(question.min || 12)];
    return [question.id, question.required ? "إجابة" : ""];
  }));
  const request = { formId: "junior", clientRequestId: "12345678-1234-1234-1234-123456789012", children: [makeAnswers("أحمد"), makeAnswers("محمد")] };
  assert.equal(validateFamilyRegistrationInput(request, form).children.length, 2);
  assert.throws(() => validateFamilyRegistrationInput({ ...request, children: [request.children[0], { ...request.children[1], age: "7" }] }, form), /الابن 2:/);
  assert.throws(() => validateFamilyRegistrationInput({ ...request, children: [] }, form), /ابن واحد/);
});

test("validates and shortens the official WhatsApp group link", () => {
  assert.equal(
    normalizeWhatsAppGroupUrl("https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv?mode=gi_t"),
    "https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv"
  );
  assert.throws(() => normalizeWhatsAppGroupUrl("https://example.com/group"), ValidationError);
});

test("keeps the SMS group-link switch enabled by default and allows disabling it", () => {
  const base = {
    title: "عن بُعد",
    groupUrl: "https://chat.whatsapp.com/AbCdEfGhIjKlMnOpQrStUv?mode=gi_t",
    inviteTitle: "دعوة",
    inviteBody: "مرحبًا {name}",
    reminderTitle: "تذكير",
    reminderBody: "نذكرك بالانضمام"
  };
  assert.equal(validateMessageTemplate("remote", base).smsGroupLinkEnabled, true);
  assert.equal(validateMessageTemplate("remote", { ...base, smsGroupLinkEnabled: false }).smsGroupLinkEnabled, false);
});
