import { FIREBASE_CONFIG, FIRESTORE_DATABASE, DEFAULT_FORMS, escapeHTML } from "./forms-config.js?v=20260827-project-title-2";
import { decodeFirestoreDocument, encodeFirestoreFields, fetchWithTimeout } from "./firestore-rest.js?v=20260827-mobile-success-1";

const params = new URLSearchParams(location.search);
const requestedId = params.get("form") || "in-person";
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/${FIRESTORE_DATABASE}/documents`;
const apiKey = encodeURIComponent(FIREBASE_CONFIG.apiKey);

const hero = document.getElementById("formHero");
const container = document.getElementById("formContainer");
const detailsCard = document.getElementById("detailsCard");
let activeForm;
let formTouched = false;
let submittedAnswers = {};

function localForm() {
  return DEFAULT_FORMS.find(item => item.id === requestedId) || DEFAULT_FORMS[0];
}

async function refreshFormFromCloud() {
  try {
    const response = await fetchWithTimeout(`${firestoreBase}/forms/${encodeURIComponent(requestedId)}?key=${apiKey}`, { cache: "no-store" }, 3000);
    if (!response.ok) throw new Error(`Firestore ${response.status}`);
    const cloudForm = { id: requestedId, ...decodeFirestoreDocument(await response.json()) };
    if (!formTouched) {
      activeForm = cloudForm;
      renderForm();
    }
  } catch (error) {
    console.warn("تم عرض النسخة السريعة المضمّنة من النموذج.", error);
  }
}

function renderForm() {
  const details = Array.isArray(activeForm.details) ? activeForm.details : [];
  const deviceRequirement = details.find(item => item.label === "الجهاز المطلوب")?.value || "لابتوب SSD بمعالج i5 أو أعلى";
  const internetRequirement = details.find(item => item.label === "الإنترنت")?.value || "اتصال إنترنت مناسب";
  document.title = `${activeForm.title} | سامي الزمزمي`;
  hero.innerHTML = `
    <span class="eyebrow">${escapeHTML(activeForm.eyebrow || "برنامج تدريبي")}</span>
    <h1>${escapeHTML(activeForm.title)}</h1>
    <p>${escapeHTML(activeForm.description || "")}</p>
    <div class="no-payment">✓ لا يوجد دفع الآن — سنتواصل معك أولًا</div>
    <div class="key-requirements" aria-label="متطلبات مهمة">
      <div><span aria-hidden="true">▣</span><p><b>الجهاز شرط أساسي</b><small>${escapeHTML(deviceRequirement)}</small></p></div>
      <div><span aria-hidden="true">⌁</span><p><b>الإنترنت</b><small>${escapeHTML(internetRequirement)}</small></p></div>
      <div><span aria-hidden="true">✦</span><p><b>مساعد الذكاء الاصطناعي</b><small><span class="tiny-price" dir="ltr"><img src="assets/saudi-riyal-symbol.svg" alt="ريال سعودي">90</span> اشتراك شخصي يُلغى في أي وقت</small></p></div>
    </div>
  `;

  detailsCard.innerHTML = `
    <h2>تفاصيل البرنامج</h2>
    <dl class="detail-list">
      ${details.map(item => `<div class="detail-item"><dt>${escapeHTML(item.label)}</dt><dd>${renderDetailValue(item)}</dd></div>`).join("")}
    </dl>
  `;

  if (activeForm.status !== "published") {
    container.innerHTML = `
      <div class="success-view">
        <div class="success-icon">⏳</div>
        <h2>التسجيل غير متاح حاليًا</h2>
        <p>سيُفتح النموذج عند بدء استقبال الطلبات. يمكنك العودة لاحقًا.</p>
        <a class="ghost-btn" href="index.html">العودة للموقع</a>
      </div>`;
    return;
  }

  container.innerHTML = `
    <form id="dynamicForm" novalidate>
      ${(activeForm.questions || []).map(renderQuestion).join("")}
      <div id="formAlert" role="alert"></div>
      <div class="submit-row">
        <button class="primary-btn" id="submitButton" type="submit">${escapeHTML(activeForm.submitLabel || "إرسال الطلب")} <span aria-hidden="true">←</span></button>
        <span class="submit-note">بياناتك خاصة وتستخدم للتواصل بشأن البرنامج فقط.</span>
      </div>
    </form>`;

  document.getElementById("dynamicForm").addEventListener("submit", submitForm);
}

function renderDetailValue(item) {
  const rawValue = item.label === "السعر" && activeForm.price ? `${activeForm.price} ريال` : String(item.value || "");
  const cost = rawValue.match(/^(\d+(?:\.\d+)?)\s*ريال(?:\s*[—-]\s*)?(.*)$/);
  if (!cost) return escapeHTML(rawValue);
  return `<span class="detail-cost"><span class="inline-price"><img src="assets/saudi-riyal-symbol.svg" alt="ريال سعودي"><span>${escapeHTML(cost[1])}</span></span>${cost[2] ? `<small>${escapeHTML(cost[2])}</small>` : ""}</span>`;
}

function renderQuestion(question, index) {
  const required = question.required ? "required" : "";
  const requiredMark = question.required ? `<span class="required" aria-label="مطلوب"> *</span>` : "";
  const id = escapeHTML(question.id || `question-${index + 1}`);
  const label = `<div class="question-head"><label class="question-label" for="${id}">${escapeHTML(question.label)}${requiredMark}</label></div>`;
  const help = question.help ? `<p class="help">${escapeHTML(question.help)}</p>` : "";
  const placeholder = escapeHTML(question.placeholder || "");
  let input = "";

  if (["radio", "checkbox"].includes(question.type)) {
    input = `<div class="choices">${(question.options || []).map((option, optionIndex) => `
      <label class="choice">
        <input type="${question.type}" name="${id}" value="${escapeHTML(option)}" ${required && optionIndex === 0 ? required : ""}>
        <span>${escapeHTML(option)}</span>
      </label>`).join("")}</div>`;
  } else if (question.type === "select") {
    input = `<select class="field" id="${id}" name="${id}" ${required}><option value="">اختر إجابة</option>${(question.options || []).map(option => `<option>${escapeHTML(option)}</option>`).join("")}</select>`;
  } else if (question.type === "textarea") {
    input = `<textarea class="field" id="${id}" name="${id}" placeholder="${placeholder}" ${required}></textarea>`;
  } else {
    const type = ["text", "tel", "number", "email", "date"].includes(question.type) ? question.type : "text";
    const phoneAttrs = type === "tel" ? `inputmode="tel" pattern="(?:\\+?966|0)?5[0-9]{8}"` : "";
    const min = question.min !== undefined ? `min="${Number(question.min)}"` : "";
    const max = question.max !== undefined ? `max="${Number(question.max)}"` : "";
    input = `<input class="field" id="${id}" name="${id}" type="${type}" placeholder="${placeholder}" ${phoneAttrs} ${min} ${max} ${required}>`;
  }

  return `<div class="question" data-question="${id}">${label}${help}${input}</div>`;
}

async function submitForm(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const alertBox = document.getElementById("formAlert");
  const button = document.getElementById("submitButton");

  if (!formElement.checkValidity()) {
    formElement.reportValidity();
    alertBox.className = "form-alert error";
    alertBox.textContent = "يرجى إكمال الحقول المطلوبة والتأكد من صحة رقم الجوال.";
    return;
  }

  button.disabled = true;
  button.textContent = "جاري الإرسال…";
  alertBox.className = "";
  alertBox.textContent = "";

  const formData = new FormData(formElement);
  const answers = {};
  for (const question of activeForm.questions || []) {
    answers[question.id] = question.type === "checkbox" ? formData.getAll(question.id) : (formData.get(question.id) || "");
  }
  submittedAnswers = answers;

  const payload = {
    formId: activeForm.id,
    formTitle: activeForm.title,
    answers,
    ...answers,
    status: "new",
    source: "website",
    createdAt: new Date(),
    createdAtISO: new Date().toISOString()
  };

  try {
    await createRegistration(payload);
    showSuccess();
  } catch (error) {
    console.error("تعذر الحفظ السحابي", error);
    const stored = JSON.parse(localStorage.getItem("sami_responses_v1") || "[]");
    stored.push({ ...payload, createdAt: null, id: `local-${Date.now()}` });
    localStorage.setItem("sami_responses_v1", JSON.stringify(stored));
    showSuccess("تم حفظ طلبك على هذا الجهاز، وسنحاول مزامنته عند توفر الاتصال.");
  }
}

function showSuccess(overrideMessage = "") {
  const summary = [
    ["البرنامج", activeForm.cardTitle || activeForm.title],
    ["اسم المتدرب", submittedAnswers.name],
    ["ولي الأمر", submittedAnswers.guardian],
    ["الجوال", submittedAnswers.phone],
    ["المدينة", submittedAnswers.city],
    ["الفترة", submittedAnswers.time]
  ].filter(([, value]) => value && (!Array.isArray(value) || value.length));
  document.body.classList.add("submission-complete");
  container.innerHTML = `
    <div class="success-view submission-success">
      <div class="success-icon">✓</div>
      <span class="success-kicker">تم الإرسال بنجاح</span>
      <h2>${escapeHTML(activeForm.successTitle || "تم استلام طلبك")}</h2>
      <p>${escapeHTML(overrideMessage || activeForm.successMessage || "سنتواصل معك قريبًا عبر واتساب.")}</p>
      <div class="success-summary">${summary.map(([label, value]) => `<div class="success-summary-item"><small>${escapeHTML(label)}</small><b ${label === "الجوال" ? 'dir="ltr"' : ""}>${escapeHTML(Array.isArray(value) ? value.join("، ") : value)}</b></div>`).join("")}</div>
      <div class="success-next"><span aria-hidden="true">◉</span><div><b>الخطوة التالية</b><small>سنراجع الطلب ونتواصل معكم قريبًا عبر واتساب.</small></div></div>
      <a class="primary-btn" href="index.html">العودة للموقع</a>
    </div>`;
  window.scrollTo({ top: 0, behavior: "auto" });
}

async function syncLocalResponses() {
  const pending = JSON.parse(localStorage.getItem("sami_responses_v1") || "[]");
  if (!pending.length) return;
  const remaining = [];
  for (const item of pending) {
    try {
      const { id, createdAt, ...data } = item;
      await createRegistration({ ...data, createdAt: new Date(data.createdAtISO || Date.now()) }, 5000);
    } catch (error) {
      remaining.push(item);
    }
  }
  localStorage.setItem("sami_responses_v1", JSON.stringify(remaining));
}

async function createRegistration(payload, timeout = 9000) {
  const response = await fetchWithTimeout(`${firestoreBase}/registrations?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fields: encodeFirestoreFields(payload) }),
    keepalive: true
  }, timeout);
  if (!response.ok) throw new Error(`Firestore ${response.status}: ${await response.text()}`);
  return response.json();
}

container.addEventListener("input", () => { formTouched = true; }, { once: true });
activeForm = localForm();
renderForm();
setTimeout(refreshFormFromCloud, 0);
setTimeout(syncLocalResponses, 1200);
