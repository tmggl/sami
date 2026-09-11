import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FORMS } from "../assets/forms-config.js";
import { validateRegistrationInput, validateSaudiLocalPhone, ValidationError } from "../server/validation.js";

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
