import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { FIREBASE_CONFIG, FIRESTORE_DATABASE, DEFAULT_FORMS, escapeHTML } from "./forms-config.js?v=20260827-junior-schedule-1";

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app, FIRESTORE_DATABASE);
const params = new URLSearchParams(location.search);
const requestedId = params.get("form") || "in-person";

const hero = document.getElementById("formHero");
const container = document.getElementById("formContainer");
const detailsCard = document.getElementById("detailsCard");
let activeForm;

function localForm() {
  return DEFAULT_FORMS.find(item => item.id === requestedId) || DEFAULT_FORMS[0];
}

async function loadForm() {
  const fallback = localForm();
  try {
    const snapshot = await getDoc(doc(db, "forms", requestedId));
    activeForm = snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : fallback;
  } catch (error) {
    console.warn("تعذر تحميل إعدادات النموذج، تم استخدام النسخة الافتراضية.", error);
    activeForm = fallback;
  }
  renderForm();
  syncLocalResponses();
}

function renderForm() {
  document.title = `${activeForm.title} | سامي الزمزمي`;
  hero.innerHTML = `
    <span class="eyebrow">${escapeHTML(activeForm.eyebrow || "برنامج تدريبي")}</span>
    <h1>${escapeHTML(activeForm.title)}</h1>
    <p>${escapeHTML(activeForm.description || "")}</p>
    <div class="no-payment">✓ لا يوجد دفع الآن — سنتواصل معك أولًا</div>
  `;

  const details = Array.isArray(activeForm.details) ? activeForm.details : [];
  detailsCard.innerHTML = `
    <h2>تفاصيل البرنامج</h2>
    <dl class="detail-list">
      ${details.map(item => `<div class="detail-item"><dt>${escapeHTML(item.label)}</dt><dd>${item.label === "السعر" && activeForm.price ? `<span class="inline-price"><img src="assets/saudi-riyal-symbol.svg" alt="ريال سعودي"><span>${escapeHTML(activeForm.price)}</span></span>` : escapeHTML(item.value)}</dd></div>`).join("")}
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

  const payload = {
    formId: activeForm.id,
    formTitle: activeForm.title,
    answers,
    ...answers,
    status: "new",
    source: "website",
    createdAt: serverTimestamp(),
    createdAtISO: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, "registrations"), payload);
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
  container.innerHTML = `
    <div class="success-view">
      <div class="success-icon">✓</div>
      <h2>${escapeHTML(activeForm.successTitle || "تم استلام طلبك")}</h2>
      <p>${escapeHTML(overrideMessage || activeForm.successMessage || "سنتواصل معك قريبًا عبر واتساب.")}</p>
      <a class="primary-btn" href="index.html">العودة للموقع</a>
    </div>`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function syncLocalResponses() {
  const pending = JSON.parse(localStorage.getItem("sami_responses_v1") || "[]");
  if (!pending.length) return;
  const remaining = [];
  for (const item of pending) {
    try {
      const { id, createdAt, ...data } = item;
      await addDoc(collection(db, "registrations"), { ...data, createdAt: serverTimestamp() });
    } catch (error) {
      remaining.push(item);
    }
  }
  localStorage.setItem("sami_responses_v1", JSON.stringify(remaining));
}

loadForm();
