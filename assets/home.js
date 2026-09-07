import { FIREBASE_CONFIG, FIRESTORE_DATABASE, DEFAULT_FORMS, escapeHTML } from "./forms-config.js?v=20260907-inline-forms-3";
import { decodeFirestoreDocument, encodeFirestoreFields, fetchWithTimeout } from "./firestore-rest.js?v=20260827-mobile-success-1";

const programsGrid = document.getElementById("programsGrid");
const firestoreBase = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/${FIRESTORE_DATABASE}/documents`;
const apiKey = encodeURIComponent(FIREBASE_CONFIG.apiKey);
const formsEndpoint = `${firestoreBase}/forms?key=${apiKey}&pageSize=50`;
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
    icon: "⌘", tag: "حضوري (عرض خاص)", className: "in-person",
    image: "assets/programs/in-person-course.jpg", imageAlt: "متدربون ومتدربات سعوديون في قاعة تدريب برمجية",
    certification: "شهادة معتمدة من المؤسسة العامة للتدريب التقني والمهني (60 ساعة تدريبية)",
    features: ["60 ساعة خلال أسبوعين", "فترات للرجال والسيدات", "مشروع ويب متكامل", "شهادة تدريبية معتمدة"]
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
    if (!response.ok) throw new Error(`Firestore ${response.status}`);
    const result = await response.json();
    const remote = (result.documents || []).map(document => ({
      id: decodeURIComponent(document.name.split("/").pop()),
      ...decodeFirestoreDocument(document)
    }));
    if (!hasUserInteraction) renderPrograms(mergePrograms(remote));
  } catch (error) {
    console.warn("تم عرض بيانات البرامج السريعة المضمّنة.", error);
  }
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
  const help = question.help ? `<p class="inline-help">${escapeHTML(question.help)}</p>` : "";
  const placeholder = escapeHTML(question.placeholder || "");
  let input = "";

  if (["radio", "checkbox"].includes(question.type)) {
    input = `<div class="inline-choices">${(question.options || []).map((option, optionIndex) => {
      const optionId = `${inputId}-${optionIndex}`;
      return `<label class="inline-choice" for="${optionId}">
        <input id="${optionId}" type="${question.type}" name="${name}" value="${escapeHTML(option)}" ${required && optionIndex === 0 ? required : ""}>
        <span>${escapeHTML(option)}</span>
      </label>`;
    }).join("")}</div>`;
  } else if (question.type === "select") {
    input = `<select class="inline-field" id="${inputId}" name="${name}" ${required}><option value="">اختر إجابة</option>${(question.options || []).map(option => `<option>${escapeHTML(option)}</option>`).join("")}</select>`;
  } else if (question.type === "textarea") {
    input = `<textarea class="inline-field" id="${inputId}" name="${name}" placeholder="${placeholder}" ${required}></textarea>`;
  } else {
    const type = ["text", "tel", "number", "email", "date"].includes(question.type) ? question.type : "text";
    const phoneAttrs = type === "tel" ? 'inputmode="tel" autocomplete="tel" pattern="(?:\\+?966|0)?5[0-9]{8}"' : "";
    const nameAttrs = question.id === "name" ? 'autocomplete="name"' : "";
    const min = question.min !== undefined ? `min="${Number(question.min)}"` : "";
    const max = question.max !== undefined ? `max="${Number(question.max)}"` : "";
    input = `<input class="inline-field" id="${inputId}" name="${name}" type="${type}" placeholder="${placeholder}" ${phoneAttrs} ${nameAttrs} ${min} ${max} ${required}>`;
  }

  return `<div class="inline-question">${label}${help}${input}</div>`;
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

  if (!formElement.checkValidity()) {
    formElement.reportValidity();
    alertBox.className = "inline-form-alert error";
    alertBox.textContent = "يرجى إكمال الحقول المطلوبة والتأكد من صحة رقم الجوال.";
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
    formTitle: program.title,
    answers,
    ...answers,
    status: "new",
    source: "website",
    createdAt: new Date(),
    createdAtISO: new Date().toISOString()
  };

  try {
    await createRegistration(payload);
    showInlineSuccess(formElement, program, answers);
  } catch (error) {
    console.error("تعذر الحفظ السحابي", error);
    saveResponseLocally(payload);
    button.disabled = false;
    button.innerHTML = `${escapeHTML(program.submitLabel || "إرسال الطلب")} <span aria-hidden="true">←</span>`;
    alertBox.className = "inline-form-alert error";
    alertBox.textContent = "تعذر تأكيد وصول الطلب الآن. احتفظنا بالبيانات مؤقتًا وسنعيد المحاولة، لكن لا تعتبر التسجيل مكتملًا حتى تظهر رسالة النجاح أو تصلك الرسالة النصية.";
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
    <button class="inline-done" type="button" data-program-close="${escapeHTML(program.id)}">تم</button>
  </div>`;
  panel.scrollIntoView({ behavior: "smooth", block: "center" });
}

function saveResponseLocally(payload) {
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem("sami_responses_v1") || "[]"); } catch { stored = []; }
  stored.push({ ...payload, createdAt: null, id: `local-${Date.now()}` });
  localStorage.setItem("sami_responses_v1", JSON.stringify(stored));
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

async function syncLocalResponses() {
  let pending = [];
  try { pending = JSON.parse(localStorage.getItem("sami_responses_v1") || "[]"); } catch { pending = []; }
  if (!pending.length) return;
  const remaining = [];
  for (const item of pending) {
    try {
      const { id, createdAt, ...data } = item;
      await createRegistration({ ...data, source: "website", createdAt: new Date(data.createdAtISO || Date.now()) }, 5000);
    } catch (error) {
      remaining.push(item);
    }
  }
  localStorage.setItem("sami_responses_v1", JSON.stringify(remaining));
}

loadPrograms();
setTimeout(syncLocalResponses, 1200);
