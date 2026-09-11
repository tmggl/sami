import { createRemoteJWKSet, jwtVerify } from "jose";

const projectId = process.env.FIREBASE_PROJECT_ID || "tmggal";
const firebaseKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const primaryEmail = process.env.PRIMARY_ADMIN_EMAIL || "966501424219@admin.sami.local";
const juniorEmail = process.env.JUNIOR_ADMIN_EMAIL || "966555967209@admin.sami.local";

export async function requireAdmin(req, res, next) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return res.status(401).json({ error: "يلزم تسجيل الدخول." });
  try {
    const { payload } = await jwtVerify(token, firebaseKeys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"]
    });
    const role = payload.email === primaryEmail ? "primary" : payload.email === juniorEmail ? "junior" : "";
    if (!role) return res.status(403).json({ error: "لا توجد صلاحية لهذا الحساب." });
    req.admin = { uid: payload.sub, email: payload.email, role };
    next();
  } catch {
    return res.status(401).json({ error: "انتهت جلسة الدخول. سجّل الدخول مجددًا." });
  }
}

export function requirePrimary(req, res, next) {
  if (req.admin?.role !== "primary") return res.status(403).json({ error: "هذه العملية متاحة للمسؤول الرئيسي فقط." });
  next();
}

export function canAccessForm(admin, formId) {
  return admin.role === "primary" || formId === "junior";
}
