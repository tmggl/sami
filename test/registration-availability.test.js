import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_FORMS } from "../assets/forms-config.js";
import { applyRegistrationAvailability, FULL_REGISTRATION_MESSAGE } from "../assets/registration-availability.js";
import { validateRegistrationInput, validateFamilyRegistrationInput } from "../server/validation.js";

test("fully booked programs reject submissions even when saved as published", () => {
  for (const id of ["in-person", "junior"]) {
    const savedForm = { ...DEFAULT_FORMS.find(form => form.id === id), status: "published" };
    const form = applyRegistrationAvailability(savedForm);
    assert.equal(form.status, "closed");
    assert.equal(form.registrationMessage, FULL_REGISTRATION_MESSAGE);
    assert.throws(() => validateRegistrationInput({ formId: id, answers: {} }, form), {
      message: FULL_REGISTRATION_MESSAGE
    });
    if (id === "junior") {
      assert.throws(() => validateFamilyRegistrationInput({ formId: id, children: [{}] }, form), {
        message: `الابن 1: ${FULL_REGISTRATION_MESSAGE}`
      });
    }
    assert.equal(savedForm.status, "published");
  }
});

test("availability preserves remote, upcoming, and deleted programs", () => {
  for (const form of [
    DEFAULT_FORMS.find(form => form.id === "remote"),
    DEFAULT_FORMS.find(form => form.id === "in-person-project"),
    { id: "junior", status: "deleted" }
  ]) {
    assert.equal(applyRegistrationAvailability(form), form);
  }
});
