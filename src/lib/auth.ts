import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET || "dev-only-secret-change-me-0123456789abcdef");
const ADMIN_COOKIE = "argon_admin";
const PENDING_COOKIE = "argon_2fa";
const CUSTOMER_COOKIE = "argon_customer";
const secure = process.env.NODE_ENV === "production";

/* ---------------- Permissions ---------------- */
export const PERMISSIONS = [
  "orders.view", "orders.edit", "orders.create", "orders.export",
  "products.view", "products.edit", "inventory.edit", "collections.edit",
  "customers.view", "customers.edit", "discounts.edit", "content.edit", "reviews.edit",
  "shipping.edit", "payments.edit", "notifications.edit", "reports.view", "marketing.edit",
  "staff.manage", "settings.edit", "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];
export const DEFAULT_ROLES: Record<string, Permission[]> = {
  Owner: [...PERMISSIONS],
  Admin: PERMISSIONS.filter((p) => p !== "staff.manage"),
  "Order Manager": ["orders.view", "orders.edit", "orders.create", "orders.export", "customers.view", "customers.edit", "products.view"],
  "Inventory Manager": ["products.view", "products.edit", "inventory.edit", "collections.edit", "orders.view"],
  "Content Editor": ["content.edit", "reviews.edit", "products.view", "collections.edit"],
  Viewer: ["orders.view", "products.view", "customers.view", "reports.view"],
};

export type AdminCtx = { id: string; name: string; email: string; role: string; permissions: string[]; sessionId: string };

/* ---------------- Admin sessions ---------------- */
export async function createAdminSession(userId: string) {
  const h = await headers();
  const session = await db.adminSession.create({
    data: { userId, ip: h.get("x-forwarded-for")?.split(",")[0] ?? null, userAgent: h.get("user-agent")?.slice(0, 200), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 12) },
  });
  const token = await new SignJWT({ sid: session.id }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("12h").sign(secret());
  (await cookies()).set(ADMIN_COOKIE, token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 12 });
  await db.adminUser.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}
export async function setPending2fa(userId: string) {
  const token = await new SignJWT({ uid: userId, p: "2fa" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("10m").sign(secret());
  (await cookies()).set(PENDING_COOKIE, token, { httpOnly: true, secure, sameSite: "lax", path: "/admin", maxAge: 600 });
}
export async function getPending2fa(): Promise<string | null> {
  const c = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!c) return null;
  try { const { payload } = await jwtVerify(c, secret()); return payload.p === "2fa" ? String(payload.uid) : null; } catch { return null; }
}
export async function clearPending2fa() { (await cookies()).delete({ name: PENDING_COOKIE, path: "/admin" }); }

export async function getAdmin(): Promise<AdminCtx | null> {
  const c = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!c) return null;
  try {
    const { payload } = await jwtVerify(c, secret());
    const s = await db.adminSession.findUnique({ where: { id: String(payload.sid) }, include: { user: { include: { role: true } } } });
    if (!s || s.revoked || s.expiresAt < new Date() || !s.user.active) return null;
    return { id: s.user.id, name: s.user.name, email: s.user.email, role: s.user.role.name, permissions: s.user.role.permissions, sessionId: s.id };
  } catch { return null; }
}
export async function requireAdmin(perm?: Permission): Promise<AdminCtx> {
  const a = await getAdmin();
  if (!a) redirect("/admin/login");
  if (perm && !a.permissions.includes(perm)) throw new Error(`Forbidden: you need the "${perm}" permission`);
  return a;
}
export const can = (a: AdminCtx, p: Permission) => a.permissions.includes(p);
export async function logoutAdmin() {
  const a = await getAdmin();
  if (a) await db.adminSession.update({ where: { id: a.sessionId }, data: { revoked: true } });
  (await cookies()).delete(ADMIN_COOKIE);
}

/* ---------------- Audit ---------------- */
export async function audit(admin: AdminCtx | null, action: string, entity: string, entityId?: string | null, details?: unknown) {
  const h = await headers();
  await db.auditLog.create({
    data: { adminId: admin?.id, adminName: admin?.name, action, entity, entityId: entityId ?? null, details: details === undefined ? undefined : JSON.parse(JSON.stringify(details)), ip: h.get("x-forwarded-for")?.split(",")[0] ?? null },
  }).catch((e) => console.error("audit failed", e));
}

/* ---------------- Customers (phone OTP) ---------------- */
export async function setCustomerSession(phone: string) {
  const token = await new SignJWT({ phone }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("30d").sign(secret());
  (await cookies()).set(CUSTOMER_COOKIE, token, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export async function getCustomerPhone(): Promise<string | null> {
  const c = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!c) return null;
  try { const { payload } = await jwtVerify(c, secret()); return String(payload.phone); } catch { return null; }
}
export async function clearCustomerSession() { (await cookies()).delete(CUSTOMER_COOKIE); }

/* ---------------- Signed tokens (payment callbacks etc.) ---------------- */
export async function signToken(data: Record<string, unknown>, exp = "2h") {
  return new SignJWT(data).setProtectedHeader({ alg: "HS256" }).setExpirationTime(exp).sign(secret());
}
export async function verifyToken<T>(token: string): Promise<T | null> {
  try { const { payload } = await jwtVerify(token, secret()); return payload as T; } catch { return null; }
}
