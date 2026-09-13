import { DEFAULT_FORMS, escapeHTML } from "./forms-config.js?v=20260913-riyadh-only-1";
import { fetchWithTimeout } from "./firestore-rest.js?v=20260911-api-1";

const params = new URLSearchParams(location.search);
const requestedId = params.get("form") || "in-person";
const hero = document.getElementById("formHero");
const container = document.getElementById("formContainer");
const detailsCard = document.getElementById("detailsCard");
let activeForm;
let formTouched = false;
let submittedAnswers = {};

const publicFormOverrides = {
  "in-person": {
    cardTitle: "دورة برمجة المواقع والأنظمة (حضوري)",
    title: "طلب الالتحاق بدورة برمجة المواقع والأنظمة (حضوري)",
    price: 2600,
    oldPrice: 2800
  },
  remote: {
    cardTitle: "دورة برمجة المواقع والأنظمة (عن بُعد)",
    title: "طلب الالتحاق بدورة برمجة المواقع والأنظمة (عن بُعد)"
  },
  junior: {
    cardTitle: "معسكر الأشبال",
    title: "طلب الالتحاق بمعسكر الأشبال"
  },
  "in-person-project": { status: "upcoming" }
};

function applyPublicOverrides(form) {
  return { ...form, ...(publicFormOverrides[form.id] || {}) };
}

function localForm() {
  return applyPublicOverrides(DEFAULT_FORMS.find(item => item.id === requestedId) || DEFAULT_FORMS[0]);
}

async function refreshFormFromCloud() {
  try {
    const response = await fetchWithTimeout(`/api/forms/${encodeURIComponent(requestedId)}`, { cache: "no-store" }, 3000);
    if (!response.ok) throw new Error(`API ${response.status}`);
    const result = await response.json();
    const cloudForm = applyPublicOverrides(result.item);
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
  const helpText = question.type === "tel" ? "يجب أن يبدأ الرقم بـ 05 ويتكون من 10 أرقام." : question.help;
  const help = helpText ? `<p class="help">${escapeHTML(helpText)}</p>` : "";
  const placeholder = escapeHTML(question.placeholder || "");
  let input = "";

  if (["radio", "checkbox"].includes(question.type)) {
    input = `<div class="choices">${(question.options || []).map((option, optionIndex) => {
      const unavailable = (question.unavailableOptions || []).includes(option);
      return `<label class="choice ${unavailable ? "is-unavailable" : ""}">
        <input type="${question.type}" name="${id}" value="${escapeHTML(option)}" ${unavailable ? "disabled" : ""} ${required && optionIndex === 0 ? required : ""}>
        <span>${escapeHTML(option)}${unavailable ? '<small>غير متاح حضوريًا حاليًا</small>' : ""}</span>
      </label>`;
    }).join("")}</div>`;
  } else if (question.type === "select") {
    input = `<select class="field" id="${id}" name="${id}" ${required}><option value="">اختر إجابة</option>${(question.options || []).map(option => `<option value="${escapeHTML(option)}" ${(question.unavailableOptions || []).includes(option) ? "disabled" : ""}>${escapeHTML(option)}${(question.unavailableOptions || []).includes(option) ? " — غير متاح حضوريًا حاليًا" : ""}</option>`).join("")}</select>`;
  } else if (question.type === "textarea") {
    input = `<textarea class="field" id="${id}" name="${id}" placeholder="${placeholder}" maxlength="1000" ${required}></textarea>`;
  } else {
    const type = ["text", "tel", "number", "email", "date"].includes(question.type) ? question.type : "text";
    const phoneAttrs = type === "tel" ? `inputmode="numeric" autocomplete="tel" pattern="05[0-9]{8}" minlength="10" maxlength="10"` : "";
    const lengthAttrs = ["text", "email"].includes(type) ? `maxlength="200"` : "";
    const min = question.min !== undefined ? `min="${Number(question.min)}"` : "";
    const max = question.max !== undefined ? `max="${Number(question.max)}"` : "";
    input = `<input class="field" id="${id}" name="${id}" type="${type}" placeholder="${placeholder}" ${phoneAttrs} ${lengthAttrs} ${min} ${max} ${required}>`;
  }

  const remoteCta = activeForm.id === "in-person" && question.id === "city" && question.unavailableOptions?.length
    ? '<a class="city-remote-cta" href="index.html?open=remote#programs">خارج الرياض؟ سجّل في دورة البرمجة المباشرة عن بُعد <span aria-hidden="true">←</span></a>'
    : "";
  return `<div class="question" data-question="${id}">${label}${help}${input}${remoteCta}</div>`;
}

async function submitForm(event) {
  event.preventDefault();
  const formElement = event.currentTarget;
  const alertBox = document.getElementById("formAlert");
  const button = document.getElementById("submitButton");

  const phoneInput = formElement.querySelector('input[type="tel"]');
  if (phoneInput) enforceLocalPhone(phoneInput);

  if (!formElement.checkValidity()) {
    formElement.reportValidity();
    alertBox.className = "form-alert error";
    alertBox.textContent = phoneInput && !/^05[0-9]{8}$/.test(phoneInput.value)
      ? "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام."
      : "يرجى إكمال جميع الحقول المطلوبة.";
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
    answers,
    clientRequestId: createRequestId()
  };

  try {
    await createRegistration(payload);
    showSuccess();
  } catch (error) {
    console.error("تعذر حفظ التسجيل", error);
    const stored = JSON.parse(localStorage.getItem("sami_responses_v1") || "[]");
    stored.push({ ...payload, id: `local-${Date.now()}` });
    localStorage.setItem("sami_responses_v1", JSON.stringify(stored));
    button.disabled = false;
    button.innerHTML = `${escapeHTML(activeForm.submitLabel || "إرسال الطلب")} <span aria-hidden="true">←</span>`;
    alertBox.className = "form-alert error";
    alertBox.textContent = error.userMessage || "تعذر تأكيد وصول الطلب الآن. احتفظنا بالبيانات مؤقتًا وسنعيد المحاولة، لكن لا تعتبر التسجيل مكتملًا حتى تظهر رسالة النجاح.";
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
      <button class="primary-btn" id="submitAnotherButton" type="button">تقديم طلب آخر</button>
      <a class="ghost-btn" href="index.html">العودة للموقع</a>
    </div>`;
  document.getElementById("submitAnotherButton").addEventListener("click", () => {
    document.body.classList.remove("submission-complete");
    submittedAnswers = {};
    formTouched = false;
    renderForm();
    window.scrollTo({ top: 0, behavior: "auto" });
  });
  window.scrollTo({ top: 0, behavior: "auto" });
}

async function syncLocalResponses() {
  const pending = JSON.parse(localStorage.getItem("sami_responses_v1") || "[]");
  if (!pending.length) return;
  const remaining = [];
  for (const item of pending) {
    item.clientRequestId ||= createRequestId();
    const answers = { ...(item.answers || {}) };
    answers.phone = toLocalPhone(answers.phone);
    try {
      await createRegistration({
        formId: item.formId,
        answers,
        clientRequestId: item.clientRequestId
      }, 5000);
    } catch (error) {
      remaining.push(item);
    }
  }
  localStorage.setItem("sami_responses_v1", JSON.stringify(remaining));
}

async function createRegistration(payload, timeout = 9000) {
  const response = await fetchWithTimeout("/api/registrations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true
  }, timeout);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`API ${response.status}`);
    error.userMessage = result.error || "تعذر حفظ الطلب. حاول مرة أخرى.";
    throw error;
  }
  return result;
}

function createRequestId() {
  return globalThis.crypto?.randomUUID?.() || `request-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

function enforceLocalPhone(input) {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const easternDigits = "۰۱۲۳۴۵۶۷۸۹";
  const normalized = String(input.value)
    .replace(/[٠-٩]/g, digit => String(arabicDigits.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String(easternDigits.indexOf(digit)))
    .replace(/\D/g, "")
    .slice(0, 10);
  input.value = normalized;
  input.setCustomValidity(!normalized || /^05[0-9]{8}$/.test(normalized) ? "" : "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام.");
}

function toLocalPhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00966")) digits = digits.slice(2);
  if (/^9665[0-9]{8}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^5[0-9]{8}$/.test(digits)) return `0${digits}`;
  return digits;
}

container.addEventListener("input", event => {
  formTouched = true;
  if (event.target.matches('input[type="tel"]')) enforceLocalPhone(event.target);
});
activeForm = localForm();
renderForm();
setTimeout(refreshFormFromCloud, 0);
setTimeout(syncLocalResponses, 1200);
