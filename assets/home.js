import { FIREBASE_CONFIG, FIRESTORE_DATABASE, DEFAULT_FORMS, escapeHTML } from "./forms-config.js?v=20260827-project-title-2";
import { decodeFirestoreDocument, fetchWithTimeout } from "./firestore-rest.js?v=20260827-mobile-success-1";

const programsGrid = document.getElementById("programsGrid");
const formsEndpoint = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/${FIRESTORE_DATABASE}/documents/forms?key=${encodeURIComponent(FIREBASE_CONFIG.apiKey)}&pageSize=50`;

const presentation = {
  "in-person": {
    icon: "⌘", tag: "حضوري", className: "in-person",
    image: "assets/programs/in-person-course.jpg", imageAlt: "متدربون ومتدربات سعوديون في قاعة تدريب برمجية",
    features: ["60 ساعة خلال أسبوعين", "فترات للرجال والسيدات", "مشروع ويب متكامل", "شهادة تدريبية معتمدة"]
  },
  remote: {
    icon: "◫", tag: "مباشر أونلاين", className: "remote",
    image: "assets/programs/remote-course.jpg", imageAlt: "متدرب سعودي يتابع دورة برمجية مباشرة عن بعد",
    features: ["تدريب مباشر وتفاعلي", "60 ساعة خلال أسبوعين", "من 5 م حتى 10 م", "متابعة أثناء التطبيق"]
  },
  "in-person-project": {
    icon: "◇", tag: "حضوري — الرياض", className: "project-track",
    image: "assets/programs/project-course.jpg", imageAlt: "متدرب سعودي يبني مشروعه البرمجي بإشراف مدرب",
    features: ["شهر كامل بنظام مدمج", "الراحة الخميس والجمعة والسبت", "مشروع جاهز للإنتاج", "متابعة عن بُعد حتى النشر"]
  },
  junior: {
    icon: "✦", tag: "من 12 إلى 17 عامًا", className: "junior",
    image: "assets/programs/junior-course.jpg?v=20260827-young-juniors-1", imageAlt: "أطفال سعوديون من الأشبال يتعلمون البرمجة وصناعة الألعاب",
    features: ["6 أيام — 4 ساعات يوميًا", "من 5 م حتى 9 م", "بريك وفعاليات وتحديات", "VS Code ونشر مشروع بسيط"]
  }
};

async function loadPrograms() {
  programsGrid.innerHTML = mergePrograms([]).filter(item => item.status !== "deleted").map(renderProgram).join("");
  try {
    const response = await fetchWithTimeout(formsEndpoint, { cache: "no-store" }, 3000);
    if (!response.ok) throw new Error(`Firestore ${response.status}`);
    const result = await response.json();
    const remote = (result.documents || []).map(document => ({ id: decodeURIComponent(document.name.split("/").pop()), ...decodeFirestoreDocument(document) }));
    const programs = mergePrograms(remote).filter(item => item.status !== "deleted");
    programsGrid.innerHTML = programs.map(renderProgram).join("");
  } catch (error) {
    console.warn("تم عرض بيانات المسارات السريعة المضمّنة.", error);
  }
}

function mergePrograms(remote) {
  const result = DEFAULT_FORMS.map(form => ({ ...form, questions: [...form.questions], details: [...form.details] }));
  for (const item of remote) {
    const index = result.findIndex(form => form.id === item.id);
    if (index >= 0) result[index] = { ...result[index], ...item };
    else result.push(item);
  }
  return result;
}

function renderProgram(program) {
  const visual = presentation[program.id] || { icon: "◇", tag: "برنامج تدريبي", className: "", features: (program.details || []).slice(0, 4).map(item => `${item.label}: ${item.value}`) };
  const isOpen = program.status === "published";
  const price = String(Math.round(Number(program.price) || 0));
  const image = visual.image
    ? `<img src="${visual.image}" alt="${escapeHTML(visual.imageAlt)}" width="1400" height="788" loading="lazy" decoding="async">`
    : `<div class="program-visual-placeholder" aria-hidden="true">${visual.icon}</div>`;
  return `<article class="program-card ${visual.className} ${isOpen ? "" : "program-closed"}">
    <div class="program-visual">
      ${image}
      <span class="program-tag">${escapeHTML(visual.tag)}</span>
      <span class="program-wave" aria-hidden="true"></span>
    </div>
    <div class="program-content">
      <div class="program-heading"><div class="program-icon" aria-hidden="true">${visual.icon}</div><h3>${escapeHTML(program.cardTitle || program.title)}</h3></div>
      <p class="program-description">${escapeHTML(program.cardDescription || program.description || "")}</p>
      <div class="program-price" dir="ltr"><span class="price-currency"><img src="assets/saudi-riyal-symbol.svg" alt="ريال سعودي"></span><strong class="price-number">${price}</strong><small class="price-note" dir="rtl">الدفع بعد التأكيد</small></div>
      <ul class="program-features">${visual.features.map(feature => `<li>${escapeHTML(feature)}</li>`).join("")}</ul>
      <div class="program-actions">
        <a class="register-button" href="${isOpen ? `form.html?form=${encodeURIComponent(program.id)}` : "#"}">${isOpen ? "اطلب الانضمام" : "التسجيل مغلق"}</a>
        <a class="details-button" href="${["junior", "in-person-project"].includes(program.id) ? `form.html?form=${encodeURIComponent(program.id)}` : "learn.html"}">التفاصيل</a>
      </div>
    </div>
  </article>`;
}

loadPrograms();
