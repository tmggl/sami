import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js";
import { FIREBASE_CONFIG, FIRESTORE_DATABASE, DEFAULT_FORMS, DEFAULT_MESSAGES, FIELD_LABELS, normalizePhone, escapeHTML, createId } from "./forms-config.js?v=20260909-message-categories-1";

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp, FIRESTORE_DATABASE);
const clone = value => JSON.parse(JSON.stringify(value));

let forms = clone(DEFAULT_FORMS);
let responses = [];
let messages = clone(DEFAULT_MESSAGES);
let selectedFormId = forms[0].id;
let whatsappResponse = null;
let whatsappMode = "invite";
let isJuniorAdmin = false;

const $ = selector => document.querySelector(selector);
const loginScreen = $("#loginScreen");
const adminApp = $("#adminApp");
const statusLabels = { new: "جديد", contacted: "تمت الدعوة", accepted: "مقبول", declined: "مرفوض" };
const viewTitles = { overview: "نظرة عامة", forms: "إدارة النماذج", responses: "ردود المتدربين", messages: "رسائل واتساب" };

$("#todayLabel").textContent = new Intl.DateTimeFormat("ar-SA-u-nu-latn", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

$("#loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("#loginButton");
  const errorBox = $("#loginError");
  button.disabled = true;
  button.textContent = "جاري الدخول…";
  errorBox.textContent = "";
  try {
    const phone = normalizePhone($("#phoneInput").value);
    if (!/^9665\d{8}$/.test(phone)) throw { code: "auth/invalid-phone" };
    const adminEmail = `${phone}@admin.sami.local`;
    await signInWithEmailAndPassword(auth, adminEmail, $("#passwordInput").value);
  } catch (error) {
    errorBox.textContent = friendlyAuthError(error.code);
  } finally {
    button.disabled = false;
    button.textContent = "دخول لوحة الإدارة";
  }
});

$("#logoutButton").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async user => {
  if (!user) {
    loginScreen.classList.remove("hidden");
    adminApp.classList.add("hidden");
    return;
  }
  loginScreen.classList.add("hidden");
  adminApp.classList.remove("hidden");
  isJuniorAdmin = user.email === "966555967209@admin.sami.local";
  configureRoleView();
  await loadDashboard();
});

function configureRoleView() {
  const createTopButton = document.querySelector('.top-actions [data-go="forms"]');
  const previewTopLink = document.querySelector(".top-actions a");
  const sidebarFormLink = document.querySelector(".sidebar-footer a");
  createTopButton?.classList.toggle("hidden", isJuniorAdmin);
  if (previewTopLink) previewTopLink.href = isJuniorAdmin ? "form.html?form=junior" : "form.html?form=in-person";
  if (sidebarFormLink) {
    sidebarFormLink.href = isJuniorAdmin ? "form.html?form=junior" : "form.html?form=in-person";
    sidebarFormLink.textContent = isJuniorAdmin ? "فتح نموذج الأشبال ↗" : "فتح نموذج التسجيل ↗";
  }
}

function friendlyAuthError(code = "") {
  if (code.includes("invalid-phone")) return "رقم الجوال غير صحيح. اكتبه بصيغة 05XXXXXXXX.";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "رقم الجوال أو كلمة المرور غير صحيحة.";
  if (code.includes("too-many-requests")) return "محاولات كثيرة. انتظر قليلًا ثم حاول مجددًا.";
  if (code.includes("network")) return "تعذر الاتصال. تحقق من الإنترنت وحاول مرة أخرى.";
  return "تعذر تسجيل الدخول. تحقق من البيانات وحاول مرة أخرى.";
}

async function loadDashboard() {
  try {
    const registrationsSource = isJuniorAdmin
      ? query(collection(db, "registrations"), where("formId", "==", "junior"))
      : collection(db, "registrations");
    const templatesRequest = isJuniorAdmin
      ? getDoc(doc(db, "messageTemplates", "junior")).then(snapshot => snapshot.exists() ? [{ id: snapshot.id, ...snapshot.data() }] : [])
      : getDocs(collection(db, "messageTemplates")).then(snapshot => snapshot.docs.map(item => ({ id: item.id, ...item.data() })));
    const [formsSnapshot, registrationsSnapshot, remoteMessages, legacyMessagesSnapshot, systemSnapshot] = await Promise.all([
      getDocs(collection(db, "forms")),
      getDocs(registrationsSource),
      templatesRequest,
      getDoc(doc(db, "settings", "whatsappMessages")),
      getDoc(doc(db, "settings", "formSystem"))
    ]);

    const remoteForms = formsSnapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    if (!systemSnapshot.exists() && remoteForms.length === 0) {
      forms = clone(DEFAULT_FORMS);
      Promise.all([
        ...forms.map(({ id, ...data }) => setDoc(doc(db, "forms", id), data)),
        setDoc(doc(db, "settings", "formSystem"), { initialized: true, initializedAt: serverTimestamp() })
      ]).catch(error => console.warn("تعذر إنشاء النماذج الافتراضية سحابيًا", error));
    } else {
      forms = mergeFormsWithDefaults(remoteForms);
    }
    if (isJuniorAdmin) forms = forms.filter(item => item.id === "junior");
    responses = registrationsSnapshot.docs.map(item => normalizeResponse(item.id, item.data()));
    const legacyMessages = legacyMessagesSnapshot.exists() && Array.isArray(legacyMessagesSnapshot.data().items)
      ? legacyMessagesSnapshot.data().items
      : [];
    messages = mergeMessageTemplates(remoteMessages, legacyMessages);
    if (!isJuniorAdmin) {
      const remoteIds = new Set(remoteMessages.map(item => item.id));
      const missingTemplates = messages.filter(item => !remoteIds.has(item.id));
      if (missingTemplates.length) {
        Promise.all(missingTemplates.map(template => saveMessageTemplate(template)))
          .catch(error => console.warn("تعذر إنشاء قوالب رسائل واتساب سحابيًا", error));
      }
    }
  } catch (error) {
    console.error(error);
    showToast("تعذر تحميل بعض البيانات السحابية؛ تُعرض النسخة المتاحة.");
  }

  const localResponses = JSON.parse(localStorage.getItem("sami_responses_v1") || "[]");
  const knownIds = new Set(responses.map(item => item.id));
  responses.push(...localResponses
    .filter(item => !knownIds.has(item.id) && (!isJuniorAdmin || item.formId === "junior"))
    .map(item => normalizeResponse(item.id, item)));
  responses.sort((a, b) => responseDate(b) - responseDate(a));
  selectedFormId = forms.some(item => item.id === selectedFormId) ? selectedFormId : forms[0]?.id;
  renderAll();
}

function mergeMessageTemplates(remoteMessages, legacyMessages = []) {
  const allowedIds = isJuniorAdmin ? new Set(["junior"]) : new Set(DEFAULT_MESSAGES.map(item => item.id));
  const legacyInvite = legacyMessages.find(item => item.id === "group-invite")?.body;
  const legacyReminder = legacyMessages.find(item => item.id === "reminder")?.body;
  return DEFAULT_MESSAGES
    .filter(item => allowedIds.has(item.id))
    .map(defaultTemplate => {
      const remote = remoteMessages.find(item => item.id === defaultTemplate.id);
      const migrated = clone(defaultTemplate);
      if (!remote && defaultTemplate.id === "in-person" && legacyInvite) migrated.inviteBody = legacyInvite;
      if (!remote && defaultTemplate.id === "in-person" && legacyReminder) migrated.reminderBody = legacyReminder;
      return remote ? { ...migrated, ...remote, id: defaultTemplate.id } : migrated;
    });
}

function messageTemplateData(template) {
  return {
    title: String(template.title || ""),
    inviteTitle: String(template.inviteTitle || ""),
    inviteBody: String(template.inviteBody || ""),
    reminderTitle: String(template.reminderTitle || ""),
    reminderBody: String(template.reminderBody || ""),
    updatedAt: serverTimestamp(),
    updatedBy: auth.currentUser?.uid || "admin"
  };
}

function saveMessageTemplate(template) {
  return setDoc(doc(db, "messageTemplates", template.id), messageTemplateData(template));
}

function mergeFormsWithDefaults(remoteForms) {
  const result = clone(DEFAULT_FORMS);
  for (const remote of remoteForms) {
    const index = result.findIndex(item => item.id === remote.id);
    if (index >= 0) result[index] = { ...result[index], ...remote };
    else result.push(remote);
  }
  return result.filter(item => item.status !== "deleted");
}

function normalizeResponse(id, data) {
  const answers = data.answers || {};
  const knownFields = ["name", "phone", "age", "degree", "city", "time", "computer", "english", "laptop", "riyadh", "project", "guardian", "experience", "interest", "notes"];
  for (const key of knownFields) if (answers[key] === undefined && data[key] !== undefined) answers[key] = data[key];
  const inferredForm = data.formId || ((String(data.riyadh || "").includes("نعم") || data.time) ? "in-person" : "remote");
  return { ...data, id, answers, formId: inferredForm, formTitle: data.formTitle || forms.find(item => item.id === inferredForm)?.title || "تسجيل سابق", status: data.status || "new" };
}

function renderAll() {
  $("#navResponseCount").textContent = responses.length;
  $("#mobileResponseCount").textContent = responses.length;
  renderOverview();
  renderFormsList();
  renderFormEditor();
  renderFormFilter();
  renderCityFilter();
  renderResponses();
  renderMessages();
  document.getElementById("addFormButton")?.classList.toggle("hidden", isJuniorAdmin);
}

document.addEventListener("click", event => {
  const viewButton = event.target.closest("[data-view]");
  const goButton = event.target.closest("[data-go]");
  if (viewButton) switchView(viewButton.dataset.view);
  if (goButton) switchView(goButton.dataset.go);
});

function switchView(view) {
  document.querySelectorAll(".admin-view").forEach(section => section.classList.add("hidden"));
  $(`#view-${view}`)?.classList.remove("hidden");
  document.querySelectorAll("[data-view]").forEach(item => {
    const active = item.dataset.view === view;
    item.classList.toggle("active", active);
    if (active) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  $("#pageTitle").textContent = viewTitles[view] || "لوحة الإدارة";
  $("#adminSidebar").classList.remove("open");
}

$("#menuButton").addEventListener("click", () => $("#adminSidebar").classList.toggle("open"));

function renderOverview() {
  const todayKey = new Date().toLocaleDateString("en-CA");
  const todayCount = responses.filter(item => new Date(responseDate(item)).toLocaleDateString("en-CA") === todayKey).length;
  const contacted = responses.filter(item => ["contacted", "accepted"].includes(item.status)).length;
  const accepted = responses.filter(item => item.status === "accepted").length;
  const stats = [
    ["إجمالي الطلبات", responses.length, "كل الردود المسجلة", "#eaf2ff"],
    ["طلبات اليوم", todayCount, "منذ بداية اليوم", "#e8f8f2"],
    ["تمت دعوتهم", contacted, "يشمل المقبولين سابقًا", "#fff3dd"],
    ["طلبات مقبولة", accepted, responses.length ? `${Math.round(accepted / responses.length * 100)}٪ من الإجمالي` : "لا توجد بيانات بعد", "#f1eefe"]
  ];
  $("#metrics").innerHTML = stats.map(item => `<article class="metric" style="--metric-color:${item[3]}"><span class="metric-label">${item[0]}</span><b class="metric-value">${item[1]}</b><small>${item[2]}</small></article>`).join("");

  const byForm = forms.map(form => ({ label: form.title, count: responses.filter(item => item.formId === form.id).length }));
  renderBars($("#formsChart"), byForm, "#1f6feb");
  const byStatus = Object.entries(statusLabels).map(([key, label]) => ({ label, count: responses.filter(item => item.status === key).length }));
  renderBars($("#statusChart"), byStatus, "#0f9d85");
  $("#recentRows").innerHTML = responses.slice(0, 6).map(item => recentRow(item)).join("") || emptyRow(6, "لا توجد طلبات حتى الآن");
}

function renderBars(element, items, color) {
  const max = Math.max(1, ...items.map(item => item.count));
  element.innerHTML = items.map(item => `<div class="bar-row"><span class="bar-label" title="${escapeHTML(item.label)}">${escapeHTML(item.label)}</span><div class="bar-track"><div class="bar-fill" style="width:${item.count / max * 100}%;background:${color}"></div></div><b class="bar-count">${item.count}</b></div>`).join("") || `<p class="empty-state">لا توجد بيانات.</p>`;
}

function recentRow(item) {
  return `<tr><td data-label="المتدرب">${personCell(item)}</td><td data-label="النموذج">${escapeHTML(shortFormTitle(item.formTitle))}</td><td data-label="المدينة">${escapeHTML(responseCity(item) || "—")}</td><td data-label="الحالة">${statusMenu(item)}</td><td data-label="التاريخ">${formatDate(item)}</td><td data-label="الإجراءات" class="response-actions-cell"><div class="quick-row-actions"><button class="compact-view-action" data-details="${item.id}" title="عرض نموذج التسجيل">عرض التسجيل</button><button class="compact-whatsapp-action" data-whatsapp="${item.id}" title="إرسال دعوة مجموعة واتساب">إرسال دعوة</button><button class="compact-reminder-action" data-reminder="${item.id}" title="كتابة وإرسال رسالة تذكير">تذكير</button></div></td></tr>`;
}

function renderFormsList() {
  $("#formsList").innerHTML = forms.map(form => `<button class="form-list-item ${form.id === selectedFormId ? "active" : ""}" data-select-form="${escapeHTML(form.id)}"><b><i class="publish-dot ${form.status === "published" ? "" : "draft"}"></i>${escapeHTML(form.title)}</b><small>${form.questions?.length || 0} أسئلة · ${form.status === "published" ? "منشور" : "مسودة"}</small></button>`).join("") || `<div class="empty-state">أنشئ نموذجك الأول.</div>`;
}

$("#formsList").addEventListener("click", event => {
  const button = event.target.closest("[data-select-form]");
  if (!button) return;
  selectedFormId = button.dataset.selectForm;
  renderFormsList();
  renderFormEditor();
});

function renderFormEditor() {
  const editor = $("#formEditor");
  const form = selectedForm();
  if (!form) {
    editor.innerHTML = `<div class="empty-state">اختر نموذجًا أو أنشئ نموذجًا جديدًا.</div>`;
    return;
  }
  const detailsText = (form.details || []).map(item => `${item.label} | ${item.value}`).join("\n");
  editor.innerHTML = `
    <div class="editor-head"><div><h2>${escapeHTML(form.title)}</h2><small>المعرّف: ${escapeHTML(form.id)}</small></div><div class="editor-actions"><a class="ghost-btn" href="form.html?form=${encodeURIComponent(form.id)}" target="_blank">معاينة ↗</a><button class="danger-btn" id="deleteFormButton">حذف النموذج</button></div></div>
    <div class="editor-grid">
      ${editorField("عنوان النموذج", "title", form.title, true)}
      <label><span class="field-label">حالة النموذج</span><select class="field" data-form-field="status"><option value="published" ${form.status === "published" ? "selected" : ""}>منشور — يستقبل الردود</option><option value="draft" ${form.status !== "published" ? "selected" : ""}>مسودة — مغلق</option></select></label>
      <label><span class="field-label">السعر الظاهر في الرئيسية <img src="assets/saudi-riyal-symbol.svg" alt="ريال سعودي"></span><input class="field" type="number" min="0" data-form-field="price" value="${escapeHTML(form.price || 0)}"></label>
      ${editorField("اسم البطاقة في الرئيسية", "cardTitle", form.cardTitle || form.title)}
      ${editorTextarea("وصف البطاقة في الرئيسية", "cardDescription", form.cardDescription || form.description)}
      ${editorField("العبارة العلوية", "eyebrow", form.eyebrow)}
      ${editorField("نص زر الإرسال", "submitLabel", form.submitLabel)}
      ${editorTextarea("وصف البرنامج", "description", form.description, "wide")}
      ${editorField("عنوان رسالة النجاح", "successTitle", form.successTitle)}
      ${editorTextarea("رسالة ما بعد الإرسال", "successMessage", form.successMessage)}
      ${editorTextarea("تفاصيل البرنامج — كل سطر: العنوان | القيمة", "detailsText", detailsText, "wide")}
    </div>
    <div class="questions-heading"><h3>أسئلة النموذج (${form.questions?.length || 0})</h3><button class="ghost-btn" id="addQuestionButton">+ إضافة سؤال</button></div>
    <div id="questionEditors">${(form.questions || []).map(questionEditor).join("")}</div>
    <div class="save-row"><span class="save-status" id="formSaveStatus">تظهر التعديلات للمتدربين بعد الحفظ.</span><button class="primary-btn" id="saveFormButton">حفظ النموذج</button></div>`;
}

function editorField(label, field, value = "", wide = false) {
  return `<label class="${wide ? "wide" : ""}"><span class="field-label">${label}</span><input class="field" data-form-field="${field}" value="${escapeHTML(value)}"></label>`;
}
function editorTextarea(label, field, value = "", className = "") {
  return `<label class="${className}"><span class="field-label">${label}</span><textarea class="field" data-form-field="${field}">${escapeHTML(value || "")}</textarea></label>`;
}

function questionEditor(question, index) {
  const types = { text: "نص قصير", tel: "رقم جوال", number: "رقم", textarea: "نص طويل", radio: "اختيار واحد", checkbox: "اختيارات متعددة", select: "قائمة منسدلة", email: "بريد إلكتروني", date: "تاريخ" };
  return `<article class="question-editor" data-question-index="${index}">
    <div class="question-editor-head"><b><span class="question-number">${index + 1}</span>${escapeHTML(question.label || "سؤال جديد")}</b><div class="question-tools"><button class="mini-btn" data-move="up" title="لأعلى">↑</button><button class="mini-btn" data-move="down" title="لأسفل">↓</button><button class="mini-btn" data-delete-question title="حذف">×</button></div></div>
    <div class="question-editor-body">
      <label><span class="field-label">نص السؤال</span><input class="field" data-q-field="label" value="${escapeHTML(question.label || "")}"></label>
      <label><span class="field-label">نوع الإجابة</span><select class="field" data-q-field="type">${Object.entries(types).map(([value, label]) => `<option value="${value}" ${question.type === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
      <label><span class="field-label">معرّف الحقل</span><input class="field" data-q-field="id" value="${escapeHTML(question.id || "")}"></label>
      <label><span class="field-label">النص الإرشادي داخل الحقل</span><input class="field" data-q-field="placeholder" value="${escapeHTML(question.placeholder || "")}"></label>
      <label><span class="field-label">أقل قيمة (للأرقام)</span><input class="field" type="number" data-q-field="min" value="${escapeHTML(question.min ?? "")}"></label>
      <label><span class="field-label">أعلى قيمة (للأرقام)</span><input class="field" type="number" data-q-field="max" value="${escapeHTML(question.max ?? "")}"></label>
      <label class="wide"><span class="field-label">شرح إضافي</span><input class="field" data-q-field="help" value="${escapeHTML(question.help || "")}"></label>
      <label class="wide"><span class="field-label">الخيارات — كل خيار في سطر</span><textarea class="field" data-q-field="options">${escapeHTML((question.options || []).join("\n"))}</textarea></label>
      <label class="check-line"><input type="checkbox" data-q-field="required" ${question.required ? "checked" : ""}> سؤال مطلوب</label>
    </div>
  </article>`;
}

function selectedForm() { return forms.find(item => item.id === selectedFormId); }

$("#formEditor").addEventListener("input", event => {
  const form = selectedForm();
  if (!form) return;
  const formField = event.target.dataset.formField;
  if (formField) {
    if (formField === "detailsText") form.details = event.target.value.split("\n").filter(Boolean).map(line => { const [label, ...value] = line.split("|"); return { label: label.trim(), value: value.join("|").trim() }; });
    else if (formField === "price") {
      form.price = Math.max(0, Number(event.target.value) || 0);
      const priceDetail = (form.details || []).find(item => item.label === "السعر");
      if (priceDetail) priceDetail.value = `${form.price} ريال`;
    } else form[formField] = event.target.value;
  }
  const questionElement = event.target.closest("[data-question-index]");
  const qField = event.target.dataset.qField;
  if (questionElement && qField) {
    const question = form.questions[Number(questionElement.dataset.questionIndex)];
    if (qField === "options") question.options = event.target.value.split("\n").map(value => value.trim()).filter(Boolean);
    else if (qField === "required") question.required = event.target.checked;
    else if (["min", "max"].includes(qField)) question[qField] = event.target.value === "" ? undefined : Number(event.target.value);
    else question[qField] = event.target.value;
    questionElement.querySelector(".question-editor-head b").innerHTML = `<span class="question-number">${Number(questionElement.dataset.questionIndex) + 1}</span>${escapeHTML(question.label || "سؤال جديد")}`;
  }
  const saveStatus = $("#formSaveStatus");
  if (saveStatus) saveStatus.textContent = "لديك تعديلات غير محفوظة.";
});

$("#formEditor").addEventListener("change", event => event.target.dispatchEvent(new Event("input", { bubbles: true })));

$("#formEditor").addEventListener("click", async event => {
  const form = selectedForm();
  if (!form) return;
  if (event.target.closest("#addQuestionButton")) {
    form.questions ||= [];
    form.questions.push({ id: createId("question"), label: "سؤال جديد", type: "text", required: false });
    renderFormEditor();
  }
  const questionElement = event.target.closest("[data-question-index]");
  if (questionElement && event.target.closest("[data-delete-question]")) {
    form.questions.splice(Number(questionElement.dataset.questionIndex), 1);
    renderFormEditor();
  }
  const moveButton = event.target.closest("[data-move]");
  if (questionElement && moveButton) {
    const index = Number(questionElement.dataset.questionIndex);
    const target = moveButton.dataset.move === "up" ? index - 1 : index + 1;
    if (target >= 0 && target < form.questions.length) [form.questions[index], form.questions[target]] = [form.questions[target], form.questions[index]];
    renderFormEditor();
  }
  if (event.target.closest("#saveFormButton")) await saveSelectedForm();
  if (event.target.closest("#deleteFormButton")) await removeSelectedForm();
});

$("#addFormButton").addEventListener("click", createNewForm);
document.querySelector(".top-actions [data-go='forms']").addEventListener("click", () => {
  createNewForm();
});

function createNewForm() {
  const id = createId("form");
  forms.push({ id, title: "نموذج جديد", cardTitle: "برنامج تدريبي جديد", cardDescription: "وصف مختصر يظهر في الصفحة الرئيسية.", price: 0, eyebrow: "برنامج تدريبي", description: "اكتب وصف البرنامج هنا.", status: "draft", submitLabel: "إرسال الطلب", successTitle: "تم استلام طلبك", successMessage: "سنتواصل معك قريبًا عبر واتساب.", details: [], questions: [{ id: "name", label: "الاسم الكامل", type: "text", required: true }, { id: "phone", label: "رقم التواصل واتساب", type: "tel", required: true }] });
  selectedFormId = id;
  renderFormsList();
  renderFormEditor();
  switchView("forms");
  showToast("تم إنشاء مسودة جديدة. عدّلها ثم احفظها.");
}

async function saveSelectedForm() {
  const form = selectedForm();
  if (!form.title.trim()) return showToast("اكتب عنوان النموذج أولًا.");
  if (new Set(form.questions.map(item => item.id)).size !== form.questions.length) return showToast("يجب أن يكون معرّف كل سؤال مختلفًا.");
  const button = $("#saveFormButton");
  button.disabled = true;
  button.textContent = "جاري الحفظ…";
  try {
    const { id, ...data } = form;
    await setDoc(doc(db, "forms", id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
    $("#formSaveStatus").textContent = "تم الحفظ والنشر بنجاح.";
    showToast("تم حفظ النموذج.");
    renderFormsList();
    renderFormFilter();
  } catch (error) {
    console.error(error);
    showToast("تعذر حفظ النموذج. تحقق من صلاحيات Firebase.");
  } finally {
    button.disabled = false;
    button.textContent = "حفظ النموذج";
  }
}

async function removeSelectedForm() {
  const form = selectedForm();
  if (!confirm(`حذف نموذج «${form.title}»؟ لن تُحذف الردود السابقة.`)) return;
  try {
    await setDoc(doc(db, "forms", form.id), { status: "deleted", deletedAt: serverTimestamp() }, { merge: true });
    forms = forms.filter(item => item.id !== form.id);
    selectedFormId = forms[0]?.id || "";
    renderFormsList(); renderFormEditor(); renderFormFilter();
    showToast("تم حذف النموذج. الردود السابقة محفوظة.");
  } catch (error) { showToast("تعذر حذف النموذج."); }
}

function renderFormFilter() {
  const current = $("#formFilter").value;
  $("#formFilter").innerHTML = `<option value="all">كل الدورات</option>${forms.map(form => `<option value="${escapeHTML(form.id)}">${escapeHTML(form.title)}</option>`).join("")}`;
  $("#formFilter").value = forms.some(item => item.id === current) ? current : "all";
}

function responseCity(item) {
  return String(answer(item, "city") || answer(item, "region") || "").trim();
}

function renderCityFilter() {
  const select = $("#cityFilter");
  const current = select.value;
  const cities = [...new Set(responses.map(responseCity).filter(Boolean))].sort((first, second) => first.localeCompare(second, "ar"));
  select.innerHTML = `<option value="all">كل المدن والمناطق</option>${cities.map(city => `<option value="${escapeHTML(city)}">${escapeHTML(city)}</option>`).join("")}`;
  select.value = cities.includes(current) ? current : "all";
}

function renderResponses() {
  const search = $("#responseSearch").value.trim().toLowerCase();
  const formId = $("#formFilter").value;
  const status = $("#statusFilter").value;
  const city = $("#cityFilter").value;
  const filtered = responses.filter(item => {
    const itemCity = responseCity(item);
    const haystack = [answer(item, "name"), answer(item, "phone"), itemCity, item.formTitle].join(" ").toLowerCase();
    return (!search || haystack.includes(search))
      && (formId === "all" || item.formId === formId)
      && (status === "all" || item.status === status)
      && (city === "all" || itemCity === city);
  });
  $("#responseRows").innerHTML = filtered.map(responseRow).join("");
  $("#responsesEmpty").classList.toggle("hidden", filtered.length > 0);
}

function responseRow(item) {
  const phone = normalizePhone(answer(item, "phone"));
  const age = String(answer(item, "age") || "").trim();
  const callAction = /^9665\d{8}$/.test(phone)
    ? `<a class="record-action call-action" href="tel:+${phone}" title="الاتصال بالمتدرب"><span aria-hidden="true">☎</span><span>اتصال</span></a>`
    : `<button class="record-action call-action" type="button" disabled title="لا يوجد رقم صالح"><span aria-hidden="true">☎</span><span>اتصال</span></button>`;
  const quickFields = item.formId === "junior"
    ? [["العمر", age ? `${age} سنة` : "—"], ["توفر اللابتوب", answer(item, "laptop") || "—"], ["خبرة البرمجة", answer(item, "experience") || "—"]]
    : [["العمر", age ? `${age} سنة` : "—"], ["إجادة الكمبيوتر", answer(item, "computer") || "—"], ["اللغة الإنجليزية", answer(item, "english") || "—"]];
  const quickInfo = `<div class="quick-facts">${quickFields.map(([label, value]) => `<span title="${escapeHTML(`${label}: ${value}`)}"><small>${escapeHTML(label)}</small><b>${escapeHTML(value)}</b></span>`).join("")}</div>`;
  return `<tr class="response-record"><td data-label="المتدرب">${personCell(item)}</td><td data-label="الجوال" dir="ltr">${escapeHTML(answer(item, "phone") || "—")}</td><td data-label="النموذج">${escapeHTML(shortFormTitle(item.formTitle))}</td><td data-label="المدينة">${escapeHTML(responseCity(item) || "—")}</td><td data-label="معلومات سريعة" class="response-quick-info">${quickInfo}</td><td data-label="الحالة">${statusMenu(item)}</td><td data-label="التاريخ">${formatDate(item)}</td><td data-label="الإجراءات" class="response-actions-cell"><div class="row-actions"><button class="record-action details-action" data-details="${item.id}" title="عرض نموذج التسجيل كاملًا"><span aria-hidden="true">▤</span><span>عرض التسجيل</span></button><button class="record-action whatsapp-action" data-whatsapp="${item.id}" title="إرسال دعوة مجموعة واتساب"><span aria-hidden="true">◉</span><span>إرسال دعوة</span></button><button class="record-action reminder-action" data-reminder="${item.id}" title="كتابة وإرسال رسالة تذكير"><span aria-hidden="true">⏱</span><span>رسالة تذكير</span></button>${callAction}<button class="record-action delete-action" data-delete-response="${item.id}" title="حذف التسجيل"><span aria-hidden="true">⌫</span><span>حذف</span></button></div></td></tr>`;
}

function personCell(item) {
  const name = String(answer(item, "name") || "بدون اسم");
  return `<div class="person"><span class="avatar">${escapeHTML(name.trim().charAt(0) || "؟")}</span><div><b>${escapeHTML(name)}</b><small>${escapeHTML(answer(item, "degree") || "متدرب")}</small></div></div>`;
}
function statusMenu(item) {
  const current = statusLabels[item.status] ? item.status : "new";
  return `<label class="status-menu-wrap"><span class="sr-only">تعديل حالة ${escapeHTML(answer(item, "name") || "المتدرب")}</span><select class="status-menu status-${current}" data-status-select="${item.id}" aria-label="تعديل حالة المتدرب">${Object.entries(statusLabels).map(([value, label]) => `<option value="${value}" ${value === current ? "selected" : ""}>${label}</option>`).join("")}</select></label>`;
}

["#responseSearch", "#formFilter", "#statusFilter", "#cityFilter"].forEach(selector => $(selector).addEventListener("input", renderResponses));

document.addEventListener("click", async event => {
  const whatsapp = event.target.closest("[data-whatsapp]");
  const reminder = event.target.closest("[data-reminder]");
  const details = event.target.closest("[data-details]");
  const remove = event.target.closest("[data-delete-response]");
  if (whatsapp) openWhatsapp(whatsapp.dataset.whatsapp, "invite");
  if (reminder) openWhatsapp(reminder.dataset.reminder, "reminder");
  if (details) openDetails(details.dataset.details);
  if (remove) await removeResponse(remove.dataset.deleteResponse);
});

document.addEventListener("change", async event => {
  const select = event.target.closest("[data-status-select]");
  if (!select) return;
  select.disabled = true;
  const saved = await changeResponseStatus(select.dataset.statusSelect, select.value);
  renderResponses();
  select.disabled = false;
  if (saved) showToast(`تم تغيير الحالة إلى «${statusLabels[select.value]}».`);
});

async function changeResponseStatus(id, status) {
  const item = responses.find(response => response.id === id);
  if (!item) return false;
  const previousStatus = item.status;
  item.status = status;
  try {
    if (!id.startsWith("local-")) {
      await updateDoc(doc(db, "registrations", id), { status, statusUpdatedAt: serverTimestamp() });
    } else {
      const localItems = JSON.parse(localStorage.getItem("sami_responses_v1") || "[]");
      const localItem = localItems.find(response => response.id === id);
      if (localItem) localItem.status = status;
      localStorage.setItem("sami_responses_v1", JSON.stringify(localItems));
    }
  } catch (error) {
    item.status = previousStatus;
    renderOverview();
    showToast("تعذر حفظ الحالة. حاول مرة أخرى.");
    return false;
  }
  renderOverview();
  return true;
}

async function removeResponse(id) {
  if (!confirm("هل تريد حذف هذا الرد نهائيًا؟")) return;
  try {
    if (!id.startsWith("local-")) await deleteDoc(doc(db, "registrations", id));
    else localStorage.setItem("sami_responses_v1", JSON.stringify(JSON.parse(localStorage.getItem("sami_responses_v1") || "[]").filter(item => item.id !== id)));
    responses = responses.filter(item => item.id !== id);
    renderOverview(); renderCityFilter(); renderResponses(); $("#navResponseCount").textContent = responses.length; $("#mobileResponseCount").textContent = responses.length;
    showToast("تم حذف الرد.");
  } catch (error) { showToast("تعذر حذف الرد."); }
}

function openDetails(id) {
  const item = responses.find(response => response.id === id);
  if (!item) return;
  $("#detailsTitle").textContent = answer(item, "name") || "بيانات المتدرب";
  const form = forms.find(entry => entry.id === item.formId);
  const labels = Object.fromEntries((form?.questions || []).map(question => [question.id, question.label]));
  const answers = item.answers || {};
  const questionKeys = (form?.questions || []).map(question => question.id);
  const extraKeys = Object.keys(answers).filter(key => !questionKeys.includes(key));
  const orderedKeys = [...questionKeys, ...extraKeys];
  $("#detailsSummary").innerHTML = `
    <div><small>البرنامج</small><b>${escapeHTML(item.formTitle || "—")}</b></div>
    <div><small>تاريخ التسجيل</small><b>${escapeHTML(formatDate(item))}</b></div>
    <div><small>حالة المتابعة</small>${statusMenu(item)}</div>`;
  $("#responseDetails").innerHTML = orderedKeys.map((key, index) => {
    const rawValue = answers[key];
    const hasValue = rawValue !== "" && rawValue != null && (!Array.isArray(rawValue) || rawValue.length > 0);
    const value = hasValue ? (Array.isArray(rawValue) ? rawValue.join("، ") : rawValue) : "لم تتم الإجابة";
    return `<div class="answer-card ${hasValue ? "" : "unanswered"}"><span class="answer-number">${index + 1}</span><div><small>${escapeHTML(labels[key] || FIELD_LABELS[key] || key)}</small><b>${escapeHTML(value)}</b></div></div>`;
  }).join("") || `<div class="empty-state">لا توجد إجابات محفوظة في هذا التسجيل.</div>`;
  $("#detailsWhatsappButton").dataset.responseId = item.id;
  $("#detailsReminderButton").dataset.responseId = item.id;
  $("#detailsModal").classList.remove("hidden");
}

document.querySelectorAll("[data-close-details]").forEach(button => button.addEventListener("click", () => $("#detailsModal").classList.add("hidden")));
$("#detailsModal").addEventListener("click", event => { if (event.target === event.currentTarget) event.currentTarget.classList.add("hidden"); });
$("#detailsWhatsappButton").addEventListener("click", event => {
  const id = event.currentTarget.dataset.responseId;
  $("#detailsModal").classList.add("hidden");
  openWhatsapp(id, "invite");
});
$("#detailsReminderButton").addEventListener("click", event => {
  const id = event.currentTarget.dataset.responseId;
  $("#detailsModal").classList.add("hidden");
  openWhatsapp(id, "reminder");
});

function openWhatsapp(id, mode = "invite") {
  whatsappResponse = responses.find(response => response.id === id);
  if (!whatsappResponse) return;
  whatsappMode = mode;
  const isReminder = mode === "reminder";
  const template = messageTemplateForResponse(whatsappResponse);
  $("#whatsappModal .modal-kicker").textContent = `${template?.title || "الدورة"} — ${isReminder ? "تذكير عبر واتساب" : "دعوة المجموعة"}`;
  $("#whatsappTitle").textContent = isReminder ? (template?.reminderTitle || "إرسال رسالة تذكير") : (template?.inviteTitle || "إرسال دعوة الانضمام");
  $(".message-editor-heading label").textContent = isReminder ? "نص التذكير" : "نص الدعوة كاملًا";
  $("#messageEditHint").textContent = isReminder ? "اكتب أو عدّل نص التذكير بحرية قبل الإرسال." : "يمكنك تعديل النص أو إضافة رابط المجموعة قبل النسخ أو الإرسال.";
  $("#sendWhatsappButton").textContent = isReminder ? "إرسال التذكير عبر واتساب" : "إرسال الدعوة عبر واتساب";
  $(".manual-status-note").classList.toggle("hidden", isReminder);
  $("#whatsappRecipient").textContent = `إلى ${answer(whatsappResponse, "name") || "المتدرب"} — ${answer(whatsappResponse, "phone") || "بدون رقم"}`;
  applyMessageTemplate();
  $("#whatsappModal").classList.remove("hidden");
}

function applyMessageTemplate() {
  const template = messageTemplateForResponse(whatsappResponse);
  if (!template || !whatsappResponse) return;
  const formName = String(whatsappResponse.formTitle || "البرنامج التدريبي").replace(/^طلب الالتحاق ب/, "");
  const replacements = {
    name: answer(whatsappResponse, "name") || "المتدرب",
    guardian: answer(whatsappResponse, "guardian") || "ولي الأمر",
    form: formName,
    city: answer(whatsappResponse, "city") || "مدينتك"
  };
  const body = whatsappMode === "reminder" ? template.reminderBody : template.inviteBody;
  $("#messagePreview").value = String(body || "").replace(/\{(name|guardian|form|city)\}/g, (_, key) => replacements[key]);
}

function messageCategoryForResponse(response) {
  if (response?.formId === "junior") return "junior";
  if (response?.formId === "remote") return "remote";
  return "in-person";
}

function messageTemplateForResponse(response) {
  const categoryId = messageCategoryForResponse(response);
  return messages.find(item => item.id === categoryId)
    || DEFAULT_MESSAGES.find(item => item.id === categoryId)
    || DEFAULT_MESSAGES[0];
}

function whatsappUrl() {
  if (!whatsappResponse) return "";
  const phone = normalizePhone(answer(whatsappResponse, "phone"));
  if (!/^9665\d{8}$/.test(phone)) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent($("#messagePreview").value.trim())}`;
}

function closeWhatsappModal() {
  $("#whatsappModal").classList.add("hidden");
}

document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", closeWhatsappModal));
$("#whatsappModal").addEventListener("click", event => { if (event.target === event.currentTarget) closeWhatsappModal(); });
$("#copyWhatsappMessageButton").addEventListener("click", async event => {
  const text = $("#messagePreview").value.trim();
  if (!text) return showToast("اكتب نص الرسالة أولًا.");
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    $("#messagePreview").focus();
    $("#messagePreview").select();
    document.execCommand("copy");
  }
  const button = event.currentTarget;
  button.textContent = "تم النسخ ✓";
  showToast("تم نسخ الرسالة كاملة.");
  setTimeout(() => { button.textContent = "نسخ كامل"; }, 1800);
});
$("#sendWhatsappButton").addEventListener("click", () => {
  const url = whatsappUrl();
  if (!url) return showToast("لا يوجد رقم واتساب صالح لهذا المتدرب.");
  window.open(url, "_blank", "noopener");
  closeWhatsappModal();
});

function renderMessages() {
  $("#messagesList").classList.toggle("single-template-grid", messages.length === 1);
  $("#messagesList").innerHTML = messages.map(message => {
    return `<article class="admin-card message-card category-message-card" data-message-id="${escapeHTML(message.id)}"><div class="message-card-head"><div><b>قالب مستقل</b><h3>${escapeHTML(message.title)}</h3></div><span>${message.id === "junior" ? "الأشبال" : message.id === "remote" ? "عن بُعد" : "حضوري"}</span></div><label><span class="field-label">اسم رسالة الدعوة</span><input class="field" data-message-field="inviteTitle" value="${escapeHTML(message.inviteTitle)}"></label><label><span class="field-label">نص دعوة مجموعة واتساب</span><textarea class="field" data-message-field="inviteBody">${escapeHTML(message.inviteBody)}</textarea></label><label><span class="field-label">اسم رسالة التذكير</span><input class="field" data-message-field="reminderTitle" value="${escapeHTML(message.reminderTitle)}"></label><label><span class="field-label">نص التذكير</span><textarea class="field" data-message-field="reminderBody">${escapeHTML(message.reminderBody)}</textarea></label><p class="message-help">المتغيرات المتاحة: <code>{name}</code> اسم المتدرب، <code>{guardian}</code> ولي الأمر، <code>{form}</code> البرنامج، <code>{city}</code> المدينة. ويمكن تعديل النص أيضًا قبل كل إرسال.</p></article>`;
  }).join("");
}

$("#messagesList").addEventListener("input", event => {
  const card = event.target.closest("[data-message-id]");
  if (!card || !event.target.dataset.messageField) return;
  const message = messages.find(item => item.id === card.dataset.messageId);
  if (!message) return;
  message[event.target.dataset.messageField] = event.target.value;
  $("#messageSaveStatus").textContent = "لديك تعديلات غير محفوظة.";
});
$("#saveMessagesButton").addEventListener("click", async () => {
  const button = $("#saveMessagesButton"); button.disabled = true; button.textContent = "جاري الحفظ…";
  try { await Promise.all(messages.map(saveMessageTemplate)); $("#messageSaveStatus").textContent = "تم الحفظ."; showToast("تم حفظ رسائل واتساب المتاحة لك."); }
  catch (error) { showToast("تعذر حفظ الرسائل."); }
  finally { button.disabled = false; button.textContent = "حفظ الرسائل"; }
});

$("#exportButton").addEventListener("click", () => {
  if (!responses.length) return showToast("لا توجد ردود لتصديرها.");
  const fields = ["name", "phone", "age", "degree", "city", "time", "computer", "english", "laptop", "riyadh", "project", "notes"];
  const rows = [["النموذج", ...fields.map(key => FIELD_LABELS[key]), "الحالة", "التاريخ"], ...responses.map(item => [item.formTitle, ...fields.map(key => answer(item, key)), statusLabels[item.status], formatDate(item)])];
  const safeCsvCell = value => {
    let text = String(value || "");
    if (/^[\s]*[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  const csv = "\ufeff" + rows.map(row => row.map(safeCsvCell).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a"); link.href = url; link.download = `training-responses-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
});

function answer(item, key) { return item.answers?.[key] ?? item[key] ?? ""; }
function responseDate(item) { return item.createdAt?.toDate?.() || new Date(item.createdAtISO || item.createdAt || 0); }
function formatDate(item) {
  const date = responseDate(item);
  if (!date || Number.isNaN(date.getTime()) || date.getTime() === 0) return "—";
  return new Intl.DateTimeFormat("ar-SA-u-nu-latn", { day: "numeric", month: "short", year: "numeric" }).format(date);
}
function shortFormTitle(title = "") { return title.replace("طلب الالتحاق ب", "").slice(0, 38) || "تسجيل سابق"; }
function emptyRow(columns, text) { return `<tr><td colspan="${columns}" class="empty-state">${text}</td></tr>`; }
function showToast(message) { const toast = $("#toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2800); }
