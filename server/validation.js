const ALLOWED_STATUSES = new Set(["new", "contacted", "accepted", "declined"]);
const ALLOWED_TYPES = new Set(["text", "tel", "number", "textarea", "radio", "checkbox", "select", "email", "date"]);

export class ValidationError extends Error {
  constructor(message, field = "") {
    super(message);
    this.name = "ValidationError";
    this.field = field;
    this.statusCode = 400;
  }
}

function text(value, maxLength, field, required = false) {
  if (typeof value !== "string") throw new ValidationError(`قيمة ${field} غير صحيحة.`, field);
  const clean = value.trim();
  if (required && !clean) throw new ValidationError(`حقل ${field} مطلوب.`, field);
  if (clean.length > maxLength) throw new ValidationError(`حقل ${field} أطول من الحد المسموح.`, field);
  return clean;
}

export function validateSaudiLocalPhone(value) {
  const phone = String(value ?? "").trim();
  if (!/^05[0-9]{8}$/.test(phone)) {
    throw new ValidationError("رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام.", "phone");
  }
  return phone;
}

function validateQuestionAnswer(question, rawValue) {
  const required = Boolean(question.required);
  const field = question.id;
  const unavailable = new Set(question.unavailableOptions || []);
  if (question.type === "checkbox") {
    if (!Array.isArray(rawValue)) throw new ValidationError("الإجابة المحددة غير صحيحة.", field);
    const allowed = new Set(question.options || []);
    if (rawValue.length > allowed.size || rawValue.some(value => typeof value !== "string" || !allowed.has(value))) {
      throw new ValidationError("أحد الخيارات المحددة غير صحيح.", field);
    }
    if (rawValue.some(value => unavailable.has(value))) throw new ValidationError("هذا الخيار غير متاح حاليًا.", field);
    if (required && rawValue.length === 0) throw new ValidationError("يرجى تحديد خيار واحد على الأقل.", field);
    return rawValue;
  }

  if (question.type === "tel") return validateSaudiLocalPhone(rawValue);
  const value = text(String(rawValue ?? ""), question.type === "textarea" ? 1000 : 200, field, required);
  if (!value) return "";

  if (["radio", "select"].includes(question.type) && !(question.options || []).includes(value)) {
    throw new ValidationError("الخيار المحدد غير صحيح.", field);
  }
  if (unavailable.has(value)) throw new ValidationError("التدريب الحضوري غير متاح حاليًا في هذه المدينة؛ اختر الرياض أو الدورة عن بُعد.", field);
  if (question.type === "number") {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new ValidationError("الرقم المدخل غير صحيح.", field);
    if (question.min !== undefined && number < Number(question.min)) throw new ValidationError(`القيمة يجب ألا تقل عن ${question.min}.`, field);
    if (question.max !== undefined && number > Number(question.max)) throw new ValidationError(`القيمة يجب ألا تزيد على ${question.max}.`, field);
  }
  if (question.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new ValidationError("البريد الإلكتروني غير صحيح.", field);
  }
  return value;
}

export function validateRegistrationInput(body, form) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("بيانات الطلب غير صحيحة.");
  if (form.status !== "published") throw new ValidationError("التسجيل غير متاح لهذا البرنامج حاليًا.");
  const formId = text(body.formId, 80, "formId", true);
  if (formId !== form.id) throw new ValidationError("البرنامج المحدد غير صحيح.", "formId");
  if (!body.answers || typeof body.answers !== "object" || Array.isArray(body.answers)) throw new ValidationError("إجابات النموذج غير صحيحة.");

  const questions = Array.isArray(form.questions) ? form.questions : [];
  const allowed = new Set(questions.map(question => question.id));
  const unexpected = Object.keys(body.answers).find(key => !allowed.has(key));
  if (unexpected) throw new ValidationError("يحتوي الطلب على حقل غير مسموح.", unexpected);

  const answers = {};
  for (const question of questions) answers[question.id] = validateQuestionAnswer(question, body.answers[question.id]);
  if (!answers.name || !answers.phone) throw new ValidationError("الاسم ورقم الجوال مطلوبان.");

  const clientRequestId = text(body.clientRequestId || "", 100, "clientRequestId", true);
  if (!/^[a-zA-Z0-9_-]{16,100}$/.test(clientRequestId)) throw new ValidationError("معرّف الطلب غير صحيح.", "clientRequestId");
  return { formId, answers, clientRequestId, source: "website" };
}

export function validateFamilyRegistrationInput(body, form) {
  if (form.id !== "junior") throw new ValidationError("التسجيل العائلي متاح لمعسكر الأشبال فقط.", "formId");
  if (!Array.isArray(body?.children) || body.children.length === 0) throw new ValidationError("أضف بيانات ابن واحد على الأقل.", "children");
  const children = body.children.map((answers, index) => {
    try {
      return validateRegistrationInput({ formId: body.formId, answers, clientRequestId: body.clientRequestId }, form).answers;
    } catch (error) {
      if (error instanceof ValidationError) error.message = `الابن ${index + 1}: ${error.message}`;
      throw error;
    }
  });
  return { formId: form.id, clientRequestId: body.clientRequestId, children };
}

export function validateStatus(value) {
  if (!ALLOWED_STATUSES.has(value)) throw new ValidationError("حالة الطلب غير صحيحة.", "status");
  return value;
}

export function validateFormInput(id, body) {
  if (!/^[a-zA-Z0-9_-]{2,80}$/.test(id)) throw new ValidationError("معرّف النموذج غير صحيح.", "id");
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ValidationError("بيانات النموذج غير صحيحة.");
  const status = ["published", "draft", "upcoming", "deleted"].includes(body.status) ? body.status : "draft";
  const questions = Array.isArray(body.questions) ? body.questions : [];
  if (questions.length > 50) throw new ValidationError("عدد الأسئلة أكبر من الحد المسموح.", "questions");
  const ids = new Set();
  const cleanQuestions = questions.map(question => {
    const questionId = text(String(question.id || ""), 80, "question.id", true);
    if (!/^[a-zA-Z0-9_-]+$/.test(questionId) || ids.has(questionId)) throw new ValidationError("معرّفات الأسئلة يجب أن تكون فريدة وآمنة.", "questions");
    ids.add(questionId);
    const type = ALLOWED_TYPES.has(question.type) ? question.type : "text";
    const options = Array.isArray(question.options) ? question.options.slice(0, 30).map(option => text(String(option), 200, "option", true)) : [];
    const unavailableOptions = Array.isArray(question.unavailableOptions)
      ? [...new Set(question.unavailableOptions.map(option => text(String(option), 200, "unavailableOption", true)))].filter(option => options.includes(option))
      : [];
    return {
      id: questionId,
      label: text(String(question.label || ""), 300, "question.label", true),
      type,
      required: Boolean(question.required),
      ...(question.help ? { help: text(String(question.help), 500, "question.help") } : {}),
      ...(question.placeholder ? { placeholder: text(String(question.placeholder), 300, "question.placeholder") } : {}),
      ...(options.length ? { options } : {}),
      ...(unavailableOptions.length ? { unavailableOptions } : {}),
      ...(Number.isFinite(Number(question.min)) ? { min: Number(question.min) } : {}),
      ...(Number.isFinite(Number(question.max)) ? { max: Number(question.max) } : {})
    };
  });
  if (!cleanQuestions.some(question => question.id === "name") || !cleanQuestions.some(question => question.id === "phone" && question.type === "tel")) {
    throw new ValidationError("يجب أن يحتوي النموذج على الاسم ورقم الجوال.", "questions");
  }
  const details = Array.isArray(body.details) ? body.details.slice(0, 40).map(item => ({
    label: text(String(item.label || ""), 160, "detail.label", true),
    value: text(String(item.value || ""), 500, "detail.value", true)
  })) : [];
  return {
    title: text(String(body.title || ""), 240, "title", true),
    cardTitle: text(String(body.cardTitle || body.title || ""), 240, "cardTitle", true),
    cardDescription: text(String(body.cardDescription || ""), 600, "cardDescription"),
    price: Math.max(0, Math.min(1_000_000, Number(body.price) || 0)),
    ...(Number(body.oldPrice) > 0 ? { oldPrice: Math.min(1_000_000, Number(body.oldPrice)) } : {}),
    eyebrow: text(String(body.eyebrow || ""), 200, "eyebrow"),
    description: text(String(body.description || ""), 2000, "description"),
    status,
    submitLabel: text(String(body.submitLabel || "إرسال الطلب"), 160, "submitLabel", true),
    successTitle: text(String(body.successTitle || "تم استلام طلبك"), 240, "successTitle", true),
    successMessage: text(String(body.successMessage || ""), 1000, "successMessage"),
    details,
    questions: cleanQuestions
  };
}

export function normalizeWhatsAppGroupUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new ValidationError("رابط مجموعة واتساب غير صحيح.", "groupUrl");
  }
  const inviteCode = url.pathname.match(/^\/([a-zA-Z0-9_-]{10,80})\/?$/)?.[1] || "";
  if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "chat.whatsapp.com" || !inviteCode) {
    throw new ValidationError("استخدم رابط دعوة رسمي يبدأ بـ https://chat.whatsapp.com/", "groupUrl");
  }
  return `https://chat.whatsapp.com/${inviteCode}`;
}

export function validateMessageTemplate(id, body) {
  if (!["in-person", "remote", "junior"].includes(id)) throw new ValidationError("تصنيف الرسالة غير صحيح.");
  return {
    title: text(String(body.title || ""), 120, "title", true),
    groupUrl: normalizeWhatsAppGroupUrl(body.groupUrl),
    smsGroupLinkEnabled: body.smsGroupLinkEnabled === undefined ? true : body.smsGroupLinkEnabled === true,
    inviteTitle: text(String(body.inviteTitle || ""), 160, "inviteTitle", true),
    inviteBody: text(String(body.inviteBody || ""), 5000, "inviteBody", true),
    reminderTitle: text(String(body.reminderTitle || ""), 160, "reminderTitle", true),
    reminderBody: text(String(body.reminderBody || ""), 5000, "reminderBody", true)
  };
}
