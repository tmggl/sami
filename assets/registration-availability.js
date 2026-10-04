export const FULL_REGISTRATION_MESSAGE = "اكتملت المقاعد، انتظر الإعلان القادم";

// Apply after saved form data so an older published status cannot reopen these cohorts.
const fullPrograms = new Set(["in-person", "junior"]);

export function applyRegistrationAvailability(form) {
  if (form.status === "deleted" || !fullPrograms.has(form.id)) return form;
  return { ...form, status: "closed", registrationMessage: FULL_REGISTRATION_MESSAGE };
}
