import { DEFAULT_FORMS, escapeHTML } from "./forms-config.js?v=20260913-riyadh-only-1";
import { fetchWithTimeout } from "./firestore-rest.js?v=20260911-api-1";

const programsGrid = document.getElementById("programsGrid");
const formsEndpoint = "/api/forms";
const programOrder = ["in-person", "remote", "junior", "in-person-project"];
let hasUserInteraction = false;
let displayedPrograms = [];

const homepageOverrides = {
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

const presentation = {
  "in-person": {
    icon: "⌘", tag: "حضوري الرياض (عرض خاص)", className: "in-person",
    image: "assets/programs/in-person-course.jpg", imageAlt: "متدربون ومتدربات سعوديون في قاعة تدريب برمجية",
    certification: "شهادة معتمدة من المؤسسة العامة للتدريب التقني والمهني (60 ساعة تدريبية)",
    features: ["حضوري في الرياض فقط", "60 ساعة خلال أسبوعين", "مشروع ويب متكامل", "شهادة تدريبية معتمدة"]
  },
  remote: {
    icon: "◫", tag: "عن بُعد (مباشر)", className: "remote",
    image: "assets/programs/remote-course.jpg", imageAlt: "متدرب سعودي يتابع دورة برمجية مباشرة عن بعد",
    certification: "شهادة معتمدة من المؤسسة العامة للتدريب التقني والمهني (60 ساعة تدريبية)",
    features: ["تدريب مباشر وتفاعلي", "60 ساعة خلال أسبوعين", "من 5 م حتى 10 م", "متابعة أثناء التطبيق"]
  },
  "in-person-project": {
    icon: "◇", tag: "قريبًا", className: "project-track",
    image: "assets/programs/project-course.jpg", imageAlt: "متدرب سعودي يبني مشروعه البرمجي بإشراف مدرب",
    features: ["شهر كامل بنظام مدمج", "الراحة الخميس والجمعة والسبت", "مشروع جاهز للإنتاج", "متابعة عن بُعد حتى النشر"]
  },
  junior: {
    icon: "✦", tag: "من 12 إلى 17 عامًا", className: "junior",
    image: "assets/programs/junior-course.jpg?v=20260827-young-juniors-1", imageAlt: "أطفال سعوديون من الأشبال يتعلمون البرمجة وصناعة الألعاب",
    features: ["6 أيام — 4 ساعات يوميًا", "من 5 م حتى 9 م", "بريك وفعاليات وتحديات", "VS Code ونشر مشروع بسيط"]
  }
};

function normalizeProgram(program) {
  if (program.status === "deleted") return program;
  return { ...program, ...(homepageOverrides[program.id] || {}) };
}

function mergePrograms(remote) {
  const result = DEFAULT_FORMS.map(form => ({ ...form, questions: [...form.questions], details: [...form.details] }));
  for (const item of remote) {
    const index = result.findIndex(form => form.id === item.id);
    if (index >= 0) result[index] = { ...result[index], ...item };
    else result.push(item);
  }
  return result
    .map(normalizeProgram)
    .filter(item => item.status !== "deleted")
    .sort((a, b) => {
      const aIndex = programOrder.indexOf(a.id);
      const bIndex = programOrder.indexOf(b.id);
      return (aIndex < 0 ? 999 : aIndex) - (bIndex < 0 ? 999 : bIndex);
    });
}

function renderPrograms(programs) {
  displayedPrograms = programs;
  programsGrid.innerHTML = programs.map(renderProgram).join("");
}

async function loadPrograms() {
  renderPrograms(mergePrograms([]));
  try {
    const response = await fetchWithTimeout(formsEndpoint, { cache: "no-store" }, 3000);
    if (!response.ok) throw new Error(`API ${response.status}`);
    const result = await response.json();
    const remote = Array.isArray(result.items) ? result.items : [];
    if (!hasUserInteraction) renderPrograms(mergePrograms(remote));
  } catch (error) {
    console.warn("تم عرض بيانات البرامج السريعة المضمّنة.", error);
  }
  if (new URLSearchParams(location.search).get("open") === "remote" && !hasUserInteraction) toggleProgram("remote", true);
}

function renderProgram(program) {
  const visual = presentation[program.id] || {
    icon: "◇", tag: "برنامج تدريبي", className: "",
    features: (program.details || []).slice(0, 4).map(item => `${item.label}: ${item.value}`)
  };
  const isOpen = program.status === "published";
  const price = String(Math.round(Number(program.price) || 0));
  const oldPrice = Number(program.oldPrice) > Number(program.price) ? String(Math.round(Number(program.oldPrice))) : "";
  const image = visual.image
    ? `<img src="${visual.image}" alt="${escapeHTML(visual.imageAlt)}" width="1400" height="788" loading="lazy" decoding="async">`
    : `<div class="program-visual-placeholder" aria-hidden="true">${visual.icon}</div>`;
  const panelId = `program-panel-${program.id}`;

  return `<article class="program-card ${visual.className} ${isOpen ? "" : "program-upcoming"}" data-program-card="${escapeHTML(program.id)}">
    <div class="program-card-summary" ${isOpen ? `role="button" tabindex="0" aria-expanded="false" aria-controls="${panelId}"` : 'aria-disabled="true"'} data-program-toggle="${escapeHTML(program.id)}">
      <div class="program-visual">
        ${image}
        <span class="program-tag">${escapeHTML(visual.tag)}</span>
        <span class="program-wave" aria-hidden="true"></span>
      </div>
      <div class="program-content">
        <div class="program-heading"><div class="program-icon" aria-hidden="true">${visual.icon}</div><h3>${escapeHTML(program.cardTitle || program.title)}</h3></div>
        <p class="program-description">${escapeHTML(program.cardDescription || program.description || "")}</p>
        ${visual.certification ? `<div class="certification-badge"><span aria-hidden="true">✓</span><strong>${escapeHTML(visual.certification)}</strong></div>` : ""}
        <div class="program-price" dir="ltr"><span class="price-currency"><img src="assets/saudi-riyal-symbol.svg" alt="ريال سعودي"></span><strong class="price-number">${price}</strong>${oldPrice ? `<span class="previous-price" dir="rtl"><small>سابقًا</small><del dir="ltr">${oldPrice}</del></span>` : ""}<small class="price-note" dir="rtl">${oldPrice ? "سعر العرض" : (isOpen ? "الدفع بعد التأكيد" : "يفتح التسجيل قريبًا")}</small></div>
        <ul class="program-features">${visual.features.map(feature => `<li>${escapeHTML(feature)}</li>`).join("")}</ul>
        <div class="program-actions">
          <span class="register-button">${isOpen ? "افتح نموذج التسجيل" : "قريبًا"}</span>
          <span class="details-button">${isOpen ? "التفاصيل والتسجيل" : "لا يوجد تقديم حاليًا"}</span>
        </div>
      </div>
    </div>
    ${isOpen ? `<div class="program-inline-panel" id="${panelId}" hidden>${renderInlineForm(program)}</div>` : ""}
  </article>`;
}

function renderInlineForm(program) {
  return `<div class="inline-form-head">
      <div><small>التسجيل داخل الصفحة</small><h4>${escapeHTML(program.title)}</h4><p>${escapeHTML(program.description || "")}</p></div>
      <button class="inline-close" type="button" data-program-close="${escapeHTML(program.id)}" aria-label="إغلاق نموذج التسجيل">×</button>
    </div>
    <div class="inline-no-payment">✓ لا يوجد دفع الآن — سنتواصل معك أولًا</div>
    <form class="inline-registration-form" data-program-id="${escapeHTML(program.id)}" novalidate>
      ${(program.questions || []).map((question, index) => renderQuestion(program.id, question, index)).join("")}
      <div class="inline-form-alert" role="alert"></div>
      <div class="inline-submit-row">
        <button class="inline-submit" type="submit">${escapeHTML(program.submitLabel || "إرسال الطلب")} <span aria-hidden="true">←</span></button>
        <span>بياناتك خاصة وتستخدم للتواصل بشأن البرنامج فقط.</span>
      </div>
    </form>`;
}

function renderQuestion(programId, question, index) {
  const required = question.required ? "required" : "";
  const requiredMark = question.required ? `<span class="inline-required" aria-label="مطلوب"> *</span>` : "";
  const name = escapeHTML(question.id || `question-${index + 1}`);
  const inputId = `inline-${escapeHTML(programId)}-${name}`;
  const label = `<label class="inline-question-label" for="${inputId}">${escapeHTML(question.label)}${requiredMark}</label>`;
  const helpText = question.type === "tel" ? "يجب أن يبدأ الرقم بـ 05 ويتكون من 10 أرقام." : question.help;
  const help = helpText ? `<p class="inline-help">${escapeHTML(helpText)}</p>` : "";
  const placeholder = escapeHTML(question.placeholder || "");
  let input = "";

  if (["radio", "checkbox"].includes(question.type)) {
    input = `<div class="inline-choices">${(question.options || []).map((option, optionIndex) => {
      const optionId = `${inputId}-${optionIndex}`;
      const unavailable = (question.unavailableOptions || []).includes(option);
      return `<label class="inline-choice ${unavailable ? "is-unavailable" : ""}" for="${optionId}">
        <input id="${optionId}" type="${question.type}" name="${name}" value="${escapeHTML(option)}" ${unavailable ? "disabled" : ""} ${required && optionIndex === 0 ? required : ""}>
        <span>${escapeHTML(option)}${unavailable ? '<small>غير متاح حضوريًا حاليًا</small>' : ""}</span>
      </label>`;
    }).join("")}</div>`;
  } else if (question.type === "select") {
    input = `<select class="inline-field" id="${inputId}" name="${name}" ${required}><option value="">اختر إجابة</option>${(question.options || []).map(option => `<option value="${escapeHTML(option)}" ${(question.unavailableOptions || []).includes(option) ? "disabled" : ""}>${escapeHTML(option)}${(question.unavailableOptions || []).includes(option) ? " — غير متاح حضوريًا حاليًا" : ""}</option>`).join("")}</select>`;
  } else if (question.type === "textarea") {
    input = `<textarea class="inline-field" id="${inputId}" name="${name}" placeholder="${placeholder}" maxlength="1000" ${required}></textarea>`;
  } else {
    const type = ["text", "tel", "number", "email", "date"].includes(question.type) ? question.type : "text";
    const phoneAttrs = type === "tel" ? 'inputmode="numeric" autocomplete="tel" pattern="05[0-9]{8}" minlength="10" maxlength="10"' : "";
    const lengthAttrs = ["text", "email"].includes(type) ? 'maxlength="200"' : "";
    const nameAttrs = question.id === "name" ? 'autocomplete="name"' : "";
    const min = question.min !== undefined ? `min="${Number(question.min)}"` : "";
    const max = question.max !== undefined ? `max="${Number(question.max)}"` : "";
    input = `<input class="inline-field" id="${inputId}" name="${name}" type="${type}" placeholder="${placeholder}" ${phoneAttrs} ${lengthAttrs} ${nameAttrs} ${min} ${max} ${required}>`;
  }

  const remoteCta = programId === "in-person" && question.id === "city" && question.unavailableOptions?.length
    ? '<button class="city-remote-cta" type="button" data-open-program="remote">خارج الرياض؟ سجّل في دورة البرمجة المباشرة عن بُعد <span aria-hidden="true">←</span></button>'
    : "";
  return `<div class="inline-question">${label}${help}${input}${remoteCta}</div>`;
}

function toggleProgram(programId, forceOpen) {
  const card = [...programsGrid.querySelectorAll("[data-program-card]")]
    .find(item => item.dataset.programCard === programId);
  if (!card || card.classList.contains("program-upcoming")) return;
  const summary = card.querySelector(".program-card-summary");
  const panel = card.querySelector(".program-inline-panel");
  const shouldOpen = forceOpen ?? panel.hidden;

  programsGrid.querySelectorAll(".program-card.is-expanded").forEach(openCard => {
    if (openCard === card) return;
    openCard.classList.remove("is-expanded");
    openCard.querySelector(".program-card-summary")?.setAttribute("aria-expanded", "false");
    const openPanel = openCard.querySelector(".program-inline-panel");
    if (openPanel) openPanel.hidden = true;
  });

  card.classList.toggle("is-expanded", shouldOpen);
  summary.setAttribute("aria-expanded", String(shouldOpen));
  panel.hidden = !shouldOpen;
  hasUserInteraction = true;

  if (shouldOpen) {
    requestAnimationFrame(() => panel.scrollIntoView({ behavior: "smooth", block: "start" }));
  } else {
    summary.focus({ preventScroll: true });
  }
}

programsGrid.addEventListener("click", event => {
  const openProgram = event.target.closest("[data-open-program]");
  if (openProgram) {
    toggleProgram(openProgram.dataset.openProgram, true);
    return;
  }
  const resetButton = event.target.closest("[data-program-reset]");
  if (resetButton) {
    resetInlineForm(resetButton.dataset.programReset);
    return;
  }
  const closeButton = event.target.closest("[data-program-close]");
  if (closeButton) {
    toggleProgram(closeButton.dataset.programClose, false);
    return;
  }
  const summary = event.target.closest("[data-program-toggle]");
  if (summary) toggleProgram(summary.dataset.programToggle);
});

programsGrid.addEventListener("keydown", event => {
  const summary = event.target.closest("[data-program-toggle]");
  if (!summary || !["Enter", " "].includes(event.key)) return;
  event.preventDefault();
  toggleProgram(summary.dataset.programToggle);
});

programsGrid.addEventListener("input", event => {
  if (event.target.closest(".inline-registration-form")) hasUserInteraction = true;
  if (event.target.matches('input[type="tel"]')) enforceLocalPhone(event.target);
});

programsGrid.addEventListener("submit", submitInlineForm);

async function submitInlineForm(event) {
  if (!event.target.matches(".inline-registration-form")) return;
  event.preventDefault();
  const formElement = event.target;
  const programId = formElement.dataset.programId;
  const program = displayedPrograms.find(item => item.id === programId);
  const alertBox = formElement.querySelector(".inline-form-alert");
  const button = formElement.querySelector(".inline-submit");
  if (!program) return;

  const phoneInput = formElement.querySelector('input[type="tel"]');
  if (phoneInput) enforceLocalPhone(phoneInput);

  if (!formElement.checkValidity()) {
    formElement.reportValidity();
    alertBox.className = "inline-form-alert error";
    alertBox.textContent = phoneInput && !/^05[0-9]{8}$/.test(phoneInput.value)
      ? "رقم الجوال يجب أن يبدأ بـ 05 ويتكون من 10 أرقام."
      : "يرجى إكمال جميع الحقول المطلوبة.";
    return;
  }

  button.disabled = true;
  button.textContent = "جاري الإرسال…";
  alertBox.className = "inline-form-alert";
  alertBox.textContent = "";

  const formData = new FormData(formElement);
  const answers = {};
  for (const question of program.questions || []) {
    answers[question.id] = question.type === "checkbox" ? formData.getAll(question.id) : (formData.get(question.id) || "");
  }
  const payload = {
    formId: program.id,
    answers,
    clientRequestId: createRequestId()
  };

  try {
    await createRegistration(payload);
    showInlineSuccess(formElement, program, answers);
  } catch (error) {
    console.error("تعذر حفظ التسجيل", error);
    saveResponseLocally(payload);
    button.disabled = false;
    button.innerHTML = `${escapeHTML(program.submitLabel || "إرسال الطلب")} <span aria-hidden="true">←</span>`;
    alertBox.className = "inline-form-alert error";
    alertBox.textContent = error.userMessage || "تعذر تأكيد وصول الطلب الآن. احتفظنا بالبيانات مؤقتًا وسنعيد المحاولة، لكن لا تعتبر التسجيل مكتملًا حتى تظهر رسالة النجاح.";
  }
}

function showInlineSuccess(formElement, program, answers, overrideMessage = "") {
  const panel = formElement.closest(".program-inline-panel");
  panel.innerHTML = `<div class="inline-success" role="status">
    <div class="inline-success-icon">✓</div>
    <small>تم الإرسال بنجاح</small>
    <h4>${escapeHTML(program.successTitle || "تم استلام طلبك")}</h4>
    <p>${escapeHTML(overrideMessage || program.successMessage || "سنتواصل معك قريبًا عبر واتساب.")}</p>
    ${answers.name ? `<div class="inline-success-name">الطلب باسم: <b>${escapeHTML(answers.name)}</b></div>` : ""}
    <div class="inline-success-actions">
      <button class="inline-again" type="button" data-program-reset="${escapeHTML(program.id)}">تقديم طلب آخر</button>
      <button class="inline-done" type="button" data-program-close="${escapeHTML(program.id)}">إغلاق</button>
    </div>
  </div>`;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetInlineForm(programId) {
  const program = displayedPrograms.find(item => item.id === programId);
  const card = [...programsGrid.querySelectorAll("[data-program-card]")]
    .find(item => item.dataset.programCard === programId);
  const panel = card?.querySelector(".program-inline-panel");
  if (!program || !panel) return;
  panel.innerHTML = renderInlineForm(program);
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function saveResponseLocally(payload) {
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem("sami_responses_v1") || "[]"); } catch { stored = []; }
  stored.push({ ...payload, id: `local-${Date.now()}` });
  localStorage.setItem("sami_responses_v1", JSON.stringify(stored));
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

async function syncLocalResponses() {
  let pending = [];
  try { pending = JSON.parse(localStorage.getItem("sami_responses_v1") || "[]"); } catch { pending = []; }
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

loadPrograms();
setTimeout(syncLocalResponses, 1200);
