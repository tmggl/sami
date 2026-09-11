export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAg9UGX1Q0q6lQ5uEL8XkR9AuIujmgTKgw",
  authDomain: "tmggal.firebaseapp.com",
  projectId: "tmggal",
  storageBucket: "tmggal.firebasestorage.app",
  messagingSenderId: "71787045957",
  appId: "1:71787045957:web:7afa311f30f2d3b30fef2c",
  measurementId: "G-7K11X4LKKC"
};

export const FIRESTORE_DATABASE = "sami-training";

export const DEFAULT_FORMS = [
  {
    id: "in-person",
    cardTitle: "دورة برمجة المواقع والأنظمة (حضوري)",
    cardDescription: "مسار عملي مكثف لبناء المواقع والأنظمة من الصفر حتى النشر.",
    price: 2600,
    oldPrice: 2800,
    title: "طلب الالتحاق بدورة برمجة المواقع والأنظمة (حضوري)",
    eyebrow: "خطة بايثون والذكاء الاصطناعي",
    description: "دورة عملية للرجال والنساء تمكّنك من بناء موقع إلكتروني متكامل من الصفر حتى الإطلاق باستخدام أحدث أدوات الذكاء الاصطناعي.",
    status: "published",
    submitLabel: "إرسال طلب الالتحاق",
    successTitle: "وصلنا طلبك بنجاح",
    successMessage: "سنراجع بياناتك ونتواصل معك عبر واتساب للتأكيد ودعوتك إلى المجموعة. لا يوجد دفع في هذه المرحلة.",
    details: [
      { label: "النمط", value: "حضوري" },
      { label: "المدة", value: "أسبوعان — 60 ساعة" },
      { label: "الأيام", value: "يوميًا عدا الجمعة" },
      { label: "الوقت", value: "حسب الفترة المختارة" },
      { label: "الجهاز المطلوب", value: "لابتوب SSD بمعالج i5 أو أعلى" },
      { label: "الإنترنت", value: "متوفر في مقر التدريب" },
      { label: "مساعد الذكاء الاصطناعي", value: "90 ريال — اشتراك شخصي مساعد للبرمجة ويُلغى في أي وقت" },
      { label: "المقاعد", value: "محدودة" },
      { label: "السعر السابق", value: "2800 ريال" },
      { label: "السعر", value: "2600 ريال" },
      { label: "الدفع", value: "بعد التواصل والتأكيد" }
    ],
    questions: [
      { id: "city", label: "في أي مدينة ترغب بحضور الدورة؟", help: "سنتواصل معك قبل موعد الدورة في مدينتك بوقت كافٍ.", type: "radio", required: true, options: ["الرياض", "جدة", "أبها", "القصيم", "المدينة المنورة"] },
      { id: "name", label: "الاسم الكامل", placeholder: "اكتب اسمك الثلاثي", type: "text", required: true },
      { id: "phone", label: "رقم التواصل واتساب", help: "اكتب الرقم بصيغة 05XXXXXXXX", placeholder: "05XXXXXXXX", type: "tel", required: true },
      { id: "age", label: "العمر", help: "يجب ألا يقل العمر عن 18 عامًا.", placeholder: "مثال: 24", type: "number", min: 18, required: true },
      { id: "degree", label: "التخصص أو المؤهل العلمي", placeholder: "مثال: بكالوريوس إدارة أعمال", type: "text", required: true },
      { id: "time", label: "حدد الفترة المناسبة لك", help: "جميع الفترات مع المدرب سامي الزمزمي.", type: "radio", required: true, options: ["سيدات فقط — 1 ظهرًا حتى 5 عصرًا", "رجال فقط — 5 عصرًا حتى 10 مساءً", "سيدات ورجال — 5 عصرًا حتى 10 مساءً"] },
      { id: "computer", label: "هل يتوفر لديك لابتوب SSD بمعالج i5 أو أعلى؟", help: "وجود اللابتوب بهذا المستوى شرط أساسي للاستفادة من التدريب (ويندوز أو ماك).", type: "radio", required: true, options: ["نعم", "لا"] },
      { id: "english", label: "هل تستطيع قراءة وتمييز كلمات إنجليزية بسيطة مثل views و forms؟", help: "المقصود تمييز الكلمة فقط، وليس معرفة معناها.", type: "radio", required: true, options: ["نعم أميزها", "لا"] },
      { id: "notes", label: "هل لديك ملاحظة أو سؤال؟", placeholder: "اختياري", type: "textarea", required: false }
    ]
  },
  {
    id: "remote",
    cardTitle: "دورة برمجة المواقع والأنظمة (عن بُعد)",
    cardDescription: "تعلم مباشر وتفاعلي من أي مكان مع تطبيقات ومتابعة عملية.",
    price: 2200,
    title: "طلب الالتحاق بدورة برمجة المواقع والأنظمة (عن بُعد)",
    eyebrow: "تدريب مباشر عبر الإنترنت",
    description: "تدريب تفاعلي مباشر لبناء المواقع والأنظمة باستخدام بايثون والذكاء الاصطناعي، مع تطبيق عملي ودعم أثناء البرنامج.",
    status: "published",
    submitLabel: "إرسال طلب الالتحاق",
    successTitle: "تم استلام طلبك",
    successMessage: "سنتواصل معك عبر واتساب لتأكيد الموعد ودعوتك إلى المجموعة. الدفع يكون لاحقًا بعد التواصل.",
    details: [
      { label: "النمط", value: "عن بُعد — مباشر" },
      { label: "المدة", value: "10 أيام" },
      { label: "الوقت", value: "من 5 م حتى 10 م" },
      { label: "الجهاز المطلوب", value: "لابتوب SSD بمعالج i5 أو أعلى" },
      { label: "الإنترنت", value: "اتصال ثابت لدى المتدرب" },
      { label: "مساعد الذكاء الاصطناعي", value: "90 ريال — اشتراك شخصي مساعد للبرمجة ويُلغى في أي وقت" },
      { label: "المقاعد", value: "10 مقاعد" },
      { label: "الشهادة", value: "معتمدة — 60 ساعة" },
      { label: "السعر", value: "2200 ريال" },
      { label: "الدفع", value: "بعد التواصل والتأكيد" }
    ],
    questions: [
      { id: "name", label: "الاسم الكامل", placeholder: "اكتب اسمك الثلاثي", type: "text", required: true },
      { id: "phone", label: "رقم التواصل واتساب", help: "اكتب الرقم بصيغة 05XXXXXXXX", placeholder: "05XXXXXXXX", type: "tel", required: true },
      { id: "age", label: "العمر", placeholder: "مثال: 24", type: "number", min: 18, required: true },
      { id: "degree", label: "التخصص أو المؤهل العلمي", type: "text", required: true },
      { id: "city", label: "المدينة", type: "text", required: true },
      { id: "computer", label: "هل تتعامل مع الكمبيوتر بشكل جيد؟", type: "radio", required: true, options: ["نعم", "إلى حد ما", "لا"] },
      { id: "english", label: "ما مدى قدرتك على قراءة كلمات إنجليزية بسيطة؟", type: "radio", required: true, options: ["جيدة", "متوسطة", "ضعيفة"] },
      { id: "laptop", label: "هل لديك لابتوب SSD بمعالج i5 أو أعلى؟", help: "وجود اللابتوب بهذا المستوى شرط أساسي للاستفادة من التدريب (ويندوز أو ماك).", type: "radio", required: true, options: ["نعم", "لا"] },
      { id: "notes", label: "ما الذي تتطلع إلى تعلمه؟", placeholder: "اكتب هدفك باختصار (اختياري)", type: "textarea", required: false }
    ]
  },
  {
    id: "in-person-project",
    cardTitle: "معسكر التمكين",
    cardDescription: "شهر من التدريب والتطبيق لبناء مشروعك الشخصي وتجهيزه للإنتاج والنشر.",
    price: 4500,
    title: "طلب الالتحاق بمعسكر التمكين",
    eyebrow: "حضوري في الرياض — من الفكرة إلى النشر",
    description: "دورة حضورية مدمجة تبدأ بالتدريب العملي، ثم ينتقل كل متدرب لبناء مشروعه الشخصي مع المتابعة حتى يصبح جاهزًا للإنتاج والنشر.",
    status: "upcoming",
    submitLabel: "إرسال طلب الالتحاق",
    successTitle: "وصلنا طلبك بنجاح",
    successMessage: "سنراجع بياناتك ونتواصل معك عبر واتساب لتأكيد التفاصيل ودعوتك إلى المجموعة. لا يوجد دفع في هذه المرحلة.",
    details: [
      { label: "المكان", value: "الرياض — حضوري" },
      { label: "النظام", value: "مدمج" },
      { label: "المدة", value: "شهر" },
      { label: "الراحة", value: "الخميس والجمعة والسبت" },
      { label: "المرحلة الأولى", value: "أسبوع إلى أسبوعين تدريب عملي" },
      { label: "المرحلة الثانية", value: "بناء المشروع الشخصي وتجهيزه للنشر" },
      { label: "الدعم", value: "متابعة عن بُعد حتى اكتمال المشروع" },
      { label: "الجهاز المطلوب", value: "لابتوب SSD بمعالج i5 أو أعلى" },
      { label: "الإنترنت", value: "متوفر في مقر التدريب" },
      { label: "مساعد الذكاء الاصطناعي", value: "90 ريال — اشتراك شخصي مساعد للبرمجة ويُلغى في أي وقت" },
      { label: "السعر", value: "4500 ريال" },
      { label: "الدفع", value: "بعد التواصل والتأكيد" }
    ],
    questions: [
      { id: "name", label: "الاسم الكامل", placeholder: "اكتب اسمك الثلاثي", type: "text", required: true },
      { id: "phone", label: "رقم التواصل واتساب", help: "اكتب الرقم بصيغة 05XXXXXXXX", placeholder: "05XXXXXXXX", type: "tel", required: true },
      { id: "age", label: "العمر", help: "يجب ألا يقل العمر عن 18 عامًا.", placeholder: "مثال: 24", type: "number", min: 18, required: true },
      { id: "degree", label: "التخصص أو المؤهل العلمي", placeholder: "مثال: بكالوريوس إدارة أعمال", type: "text", required: true },
      { id: "city", label: "المدينة", placeholder: "اكتب مدينتك", type: "text", required: true },
      { id: "riyadh", label: "هل يمكنك الالتزام بالحضور في الرياض؟", type: "radio", required: true, options: ["نعم", "لا"] },
      { id: "time", label: "حدد الفترة المناسبة لك", type: "radio", required: true, options: ["1 ظهرًا حتى 5 عصرًا", "5 عصرًا حتى 10 مساءً"] },
      { id: "computer", label: "هل يتوفر لديك لابتوب SSD بمعالج i5 أو أعلى؟", help: "وجود اللابتوب بهذا المستوى شرط أساسي للاستفادة من التدريب (ويندوز أو ماك).", type: "radio", required: true, options: ["نعم", "لا"] },
      { id: "english", label: "هل تستطيع قراءة وتمييز كلمات إنجليزية بسيطة مثل views و forms؟", help: "المقصود تمييز الكلمة فقط، وليس معرفة معناها.", type: "radio", required: true, options: ["نعم أميزها", "لا"] },
      { id: "project", label: "هل لديك فكرة لمشروعك الشخصي؟", placeholder: "اكتب الفكرة باختصار، ويمكنك تركها فارغة إذا لم تحددها بعد", type: "textarea", required: false },
      { id: "notes", label: "هل لديك ملاحظة أو سؤال؟", placeholder: "اختياري", type: "textarea", required: false }
    ]
  },
  {
    id: "junior",
    cardTitle: "معسكر الأشبال",
    cardDescription: "رحلة تقنية ممتعة للصغار لبناء أول واجهة أو لعبة ونشرها على الإنترنت.",
    price: 800,
    title: "طلب الالتحاق بمعسكر الأشبال",
    eyebrow: "صُنّاع التقنية الصغار",
    description: "برنامج ممتع ومبسّط للأعمار من 12 إلى 17 عامًا، تتخلله فترات راحة وفعاليات وتحديات تؤنس الطفل وتنمّي موهبته.",
    status: "published",
    submitLabel: "إرسال طلب تسجيل الشبل",
    successTitle: "تم استلام طلب التسجيل",
    successMessage: "سنتواصل مع ولي الأمر عبر واتساب لتأكيد المقعد وإرسال تفاصيل البرنامج. لا يوجد دفع في هذه المرحلة.",
    details: [
      { label: "الفئة العمرية", value: "12–17 عامًا" },
      { label: "المدينة", value: "الرياض أو أبها" },
      { label: "المدة", value: "6 أيام — 4 ساعات يوميًا" },
      { label: "الوقت", value: "من 5 م حتى 9 م" },
      { label: "التجربة", value: "بريك وفعاليات وتحديات تنمّي الموهبة" },
      { label: "المحتوى", value: "واجهات وألعاب مبسطة" },
      { label: "الأدوات", value: "VS Code وGitHub" },
      { label: "الجهاز المطلوب", value: "لابتوب SSD بمعالج i5 أو أعلى" },
      { label: "الإنترنت", value: "متوفر في مقر التدريب" },
      { label: "مساعد الذكاء الاصطناعي", value: "90 ريال — اشتراك شخصي مساعد للبرمجة ويُلغى في أي وقت" },
      { label: "المشروع", value: "صفحة هبوط أو لعبة ويب" },
      { label: "السعر", value: "800 ريال" },
      { label: "الدفع", value: "بعد التواصل والتأكيد" }
    ],
    questions: [
      { id: "name", label: "اسم المتدرب", placeholder: "اسم الشبل الثلاثي", type: "text", required: true },
      { id: "age", label: "عمر المتدرب", help: "المسار مخصص للأعمار من 12 إلى 17 عامًا.", placeholder: "من 12 إلى 17", type: "number", min: 12, max: 17, required: true },
      { id: "guardian", label: "اسم ولي الأمر", placeholder: "الاسم الكامل", type: "text", required: true },
      { id: "phone", label: "رقم واتساب ولي الأمر", help: "اكتب الرقم بصيغة 05XXXXXXXX", placeholder: "05XXXXXXXX", type: "tel", required: true },
      { id: "city", label: "اختر مدينة إقامة تدريب الأشبال", type: "radio", required: true, options: ["الرياض", "أبها"] },
      { id: "laptop", label: "هل يتوفر للمتدرب لابتوب SSD بمعالج i5 أو أعلى؟", help: "وجود اللابتوب بهذا المستوى شرط أساسي للاستفادة من التدريب (ويندوز أو ماك).", type: "radio", required: true, options: ["نعم", "لا"] },
      { id: "experience", label: "هل سبق له تجربة البرمجة؟", help: "لا يشترط وجود خبرة سابقة.", type: "radio", required: true, options: ["هذه أول تجربة", "تجربة بسيطة", "لديه معرفة جيدة"] },
      { id: "interest", label: "ما أكثر شيء يحبه؟", type: "checkbox", required: false, options: ["تصميم الواجهات", "الألعاب", "حل التحديات", "الذكاء الاصطناعي"] },
      { id: "notes", label: "ملاحظات ولي الأمر", placeholder: "أي معلومات تساعدنا على تقديم تجربة أفضل (اختياري)", type: "textarea", required: false }
    ]
  }
];

export const DEFAULT_MESSAGES = [
  {
    id: "in-person",
    title: "الدورات الحضورية",
    groupUrl: "https://chat.whatsapp.com/C3in5eBKC6sJ5MnISuwxck",
    smsGroupLinkEnabled: true,
    inviteTitle: "دعوة مجموعة الدورة الحضورية",
    inviteBody: "السلام عليكم {name}،\n\nيسعدنا دعوتك للانضمام إلى مجموعة {form}، وستجد داخلها تفاصيل الدورة الحضورية والتعليمات والتحديثات.\n\nنرحب بك معنا.",
    reminderTitle: "تذكير بالدورة الحضورية",
    reminderBody: "السلام عليكم {name}،\n\nنود تذكيرك بالانضمام إلى مجموعة {form}، نظرًا لقرب اكتمال المقاعد المتاحة.\n\nونود التنويه بأن تثبيت المقعد واعتماده يكون بعد إتمام الدفع فعليًا، كما ستُرسل جميع تعليمات الدورة وتحديثاتها داخل المجموعة.\n\nإذا لم تكن قد انضممت بعد، فنأمل الانضمام في أقرب وقت. ويسعدنا وجودك معنا."
  },
  {
    id: "remote",
    title: "الدورات عن بُعد",
    groupUrl: "https://chat.whatsapp.com/IrubrVrAyoQHHLhAc51diu",
    smsGroupLinkEnabled: true,
    inviteTitle: "دعوة مجموعة الدورة عن بُعد",
    inviteBody: "السلام عليكم {name}،\n\nشكرًا لتسجيلك في {form}. هذه دعوة الانضمام إلى مجموعة الدورة عن بُعد، وستصلك من خلالها مواعيد اللقاءات وروابطها وجميع التعليمات.\n\nنرحب بك معنا.",
    reminderTitle: "تذكير بالدورة عن بُعد",
    reminderBody: "السلام عليكم {name}،\n\nنذكّرك بالانضمام إلى مجموعة {form} عن بُعد لمتابعة مواعيد اللقاءات وروابطها والتعليمات.\n\nيُعتمد المقعد بعد إتمام الدفع فعليًا. إذا لم تنضم بعد، فنأمل الانضمام في أقرب وقت."
  },
  {
    id: "junior",
    title: "معسكر الأشبال",
    groupUrl: "https://chat.whatsapp.com/FpLB6lJn9KVCCwzy8UPU0f",
    smsGroupLinkEnabled: true,
    inviteTitle: "دعوة دورة البرمجة للأشبال",
    inviteBody: "أهلًا {name}،\nالسلام عليكم ورحمة الله وبركاته،\n\nبناءً على طلبكم الانضمام إلى دورتنا التدريبية الحضورية في *مدينة {city}*:\n\n*دورة البرمجة للأشبال ({city}) للأعمار من 12 حتى 16 عامًا*\n\n👨‍🏫 *المدرب:* منصور الغامدي\n📅 *بداية الدورة:* 4-10-2026\n⏳ *مدة الدورة:* 6 أيام\n\n🕐 *الفترة المتاحة:*\n• من *4:00 مساءً إلى 8:00 مساءً*\n\n🎟️ *المقاعد محدودة*\nالحد الأقصى *15 متدربًا لكل فترة*، ويتم تأكيد واعتماد المقعد بعد إتمام عملية السداد.\n\n🤖 *ChatGPT Plus*\nسيتم توفير اشتراك ChatGPT Plus للمتدرب للاستفادة منه في التطبيقات العملية خلال الدورة.\n\n💻 *أجهزة التدريب*\nتتوفر لدينا أجهزة كمبيوتر للتدريب، ومع ذلك نفضّل أن يحضر الابن جهازه الشخصي؛ حتى يحتفظ بأعماله وأدواته ويواصل التطبيق وما تعلّمه بسهولة في المنزل.\n\n💳 *طرق السداد:*\nعبر الموقع: تمارا - مدى - فيزا\nhttps://sami-link.com\n\nأو عبر التواصل معنا على الخاص للسداد عن طريق *تابي*.\n\n*طريقة التسجيل:*\nادخل إلى الموقع، ثم اختر المنتج *«حضوري الرياض»*، وحدد الفترة المناسبة، ثم أكمل عملية الدفع.\n\nبعد إتمام الدفع، سيصلك *سند تأكيد حجز المقعد* على بريدك الإلكتروني.\n\n📱 *سيُضاف رابط الانضمام إلى مجموعة الدورة تلقائيًا عند الإرسال.*",
    reminderTitle: "تذكير بمعسكر الأشبال",
    reminderBody: "السلام عليكم {guardian}،\n\nنذكّركم بالانضمام إلى مجموعة أولياء أمور {form} الخاصة بتسجيل الشبل {name}، لمتابعة تفاصيل البرنامج والتعليمات.\n\nيُعتمد مقعد الشبل بعد إتمام الدفع فعليًا. وإذا لم تنضموا بعد، فنأمل الانضمام في أقرب وقت."
  }
];

export const FIELD_LABELS = {
  name: "الاسم",
  phone: "الجوال",
  age: "العمر",
  degree: "التخصص / المؤهل",
  city: "المدينة",
  time: "الفترة",
  computer: "معرفة الكمبيوتر",
  english: "اللغة الإنجليزية",
  laptop: "اللابتوب",
  riyadh: "الالتزام بالحضور في الرياض",
  project: "فكرة المشروع الشخصي",
  guardian: "ولي الأمر",
  experience: "الخبرة السابقة",
  interest: "الاهتمامات",
  notes: "الملاحظات"
};

export function normalizePhone(value = "") {
  let digits = String(value).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("9660")) return `966${digits.slice(4)}`;
  if (digits.startsWith("0")) return `966${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `966${digits}`;
  return digits;
}

export function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function createId(prefix = "item") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
