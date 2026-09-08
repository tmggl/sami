import assert from "node:assert/strict";

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) throw new Error("FIRESTORE_EMULATOR_HOST is required");

const base = `http://${host}/v1/projects/tmggal/databases/sami-training/documents`;
const adminHeaders = { Authorization: "Bearer owner", "Content-Type": "application/json" };
const publicHeaders = { "Content-Type": "application/json" };

function mockAuthToken(email, userId) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: "none", typ: "JWT" })}.${encode({
    aud: "tmggal",
    auth_time: now,
    email,
    exp: now + 3600,
    firebase: { sign_in_provider: "password" },
    iat: now,
    iss: "https://securetoken.google.com/tmggal",
    sub: userId,
    user_id: userId,
  })}.`;
}

const primaryToken = mockAuthToken("966501424219@admin.sami.local", "primary-admin-test");
const juniorToken = mockAuthToken("966555967209@admin.sami.local", "junior-admin-test");

const stringValue = value => ({ stringValue: value });
const registration = (overrides = {}) => ({
  fields: {
    formId: stringValue("junior"),
    formTitle: stringValue("دورة برمجة الأشبال"),
    answers: { mapValue: { fields: {
      name: stringValue("اختبار قواعد الأمان"),
      phone: stringValue("0555555555"),
      city: stringValue("الرياض"),
      interest: { arrayValue: { values: [stringValue("الألعاب")] } },
    } } },
    status: stringValue("new"),
    source: stringValue("website"),
    createdAt: { timestampValue: new Date().toISOString() },
    createdAtISO: stringValue(new Date().toISOString()),
    ...overrides,
  },
});

async function call(path, { method = "GET", body, admin = false, token } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: admin ? adminHeaders : token ? { ...publicHeaders, Authorization: `Bearer ${token}` } : publicHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
}

await call("/forms/junior", {
  method: "PATCH",
  admin: true,
  body: { fields: { status: stringValue("published"), title: stringValue("دورة برمجة الأشبال") } },
});
await call("/forms/remote", {
  method: "PATCH",
  admin: true,
  body: { fields: { status: stringValue("published"), title: stringValue("الدورة عن بُعد") } },
});

const valid = await call("/registrations?documentId=valid-registration", { method: "POST", body: registration() });
assert.equal(valid.status, 200, `valid registration should be accepted (${valid.status})`);

const legacyBody = registration();
for (const [key, value] of Object.entries(legacyBody.fields.answers.mapValue.fields)) legacyBody.fields[key] = value;
const validLegacy = await call("/registrations?documentId=valid-legacy-registration", { method: "POST", body: legacyBody });
assert.equal(validLegacy.status, 200, `legacy mirrored answers should be accepted (${validLegacy.status})`);

const mismatchedLegacyBody = registration();
mismatchedLegacyBody.fields.name = stringValue("اسم مختلف عن الإجابات");
const mismatchedLegacy = await call("/registrations?documentId=mismatched-legacy", { method: "POST", body: mismatchedLegacyBody });
assert.equal(mismatchedLegacy.status, 403, "legacy root fields must exactly match their answer values");

const publicRead = await call("/registrations/valid-registration");
assert.equal(publicRead.status, 403, "public registration reads must be denied");

const publicUpdate = await call("/registrations/valid-registration?updateMask.fieldPaths=status", {
  method: "PATCH",
  body: { fields: { status: stringValue("accepted") } },
});
assert.equal(publicUpdate.status, 403, "public status updates must be denied");

const publicDelete = await call("/registrations/valid-registration", { method: "DELETE" });
assert.equal(publicDelete.status, 403, "public registration deletes must be denied");

const juniorRead = await call("/registrations/valid-registration", { token: juniorToken });
assert.equal(juniorRead.status, 200, "junior admin must read junior registrations");

const remoteBody = registration();
remoteBody.fields.formId = stringValue("remote");
remoteBody.fields.formTitle = stringValue("الدورة عن بُعد");
await call("/registrations/remote-registration", { method: "PATCH", admin: true, body: remoteBody });

const juniorRemoteRead = await call("/registrations/remote-registration", { token: juniorToken });
assert.equal(juniorRemoteRead.status, 403, "junior admin must not read other registrations");

const primaryRemoteRead = await call("/registrations/remote-registration", { token: primaryToken });
assert.equal(primaryRemoteRead.status, 200, "primary admin must read registrations");

const juniorStatusUpdate = await call("/registrations/valid-registration?updateMask.fieldPaths=status&updateMask.fieldPaths=statusUpdatedAt", {
  method: "PATCH",
  token: juniorToken,
  body: { fields: { status: stringValue("contacted"), statusUpdatedAt: { timestampValue: new Date().toISOString() } } },
});
assert.equal(juniorStatusUpdate.status, 200, "junior admin must update junior status");

const tamperedAnswers = registration().fields.answers;
tamperedAnswers.mapValue.fields.name = stringValue("محاولة تغيير الإجابات");
const juniorAnswerTamper = await call("/registrations/valid-registration?updateMask.fieldPaths=answers", {
  method: "PATCH",
  token: juniorToken,
  body: { fields: { answers: tamperedAnswers } },
});
assert.equal(juniorAnswerTamper.status, 403, "admins must not overwrite submitted answers");

const extraRoot = await call("/registrations?documentId=extra-root", {
  method: "POST",
  body: registration({ injected: stringValue("not allowed") }),
});
assert.equal(extraRoot.status, 403, "unexpected root fields must be denied");

const unknownAnswerBody = registration();
unknownAnswerBody.fields.answers.mapValue.fields.unknown = stringValue("not allowed");
const unknownAnswer = await call("/registrations?documentId=unknown-answer", { method: "POST", body: unknownAnswerBody });
assert.equal(unknownAnswer.status, 403, "unexpected answer fields must be denied");

const longTextBody = registration();
longTextBody.fields.answers.mapValue.fields.notes = stringValue("x".repeat(1001));
const longText = await call("/registrations?documentId=long-text", { method: "POST", body: longTextBody });
assert.equal(longText.status, 403, "oversized answers must be denied");

await call("/forms/junior?updateMask.fieldPaths=status", {
  method: "PATCH",
  admin: true,
  body: { fields: { status: stringValue("draft") } },
});
const closedForm = await call("/registrations?documentId=closed-form", { method: "POST", body: registration() });
assert.equal(closedForm.status, 403, "closed forms must reject registrations");

console.log("Firestore security rules: all access-control tests passed");
