"use server";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { audit, clearPending2fa, createAdminSession, getPending2fa, logoutAdmin, setPending2fa } from "@/lib/auth";
import { totp } from "@/lib/admin";
import { clientIp, rateLimit } from "@/lib/security";

const fail = (msg: string, step = false): never => redirect(`/admin/login?${step ? "step=2fa&" : ""}e=${encodeURIComponent(msg)}`);

export async function loginPassword(fd: FormData) {
  const ip = await clientIp();
  if (!(await rateLimit(`admin-login:${ip}`, 10, 900)).ok) fail("Too many attempts. Try again in 15 minutes.");
  const email = String(fd.get("email") ?? "").toLowerCase().trim();
  const password = String(fd.get("password") ?? "");
  const u = await db.adminUser.findUnique({ where: { email } });
  // Constant-ish time: always run bcrypt.
  const ok = await bcrypt.compare(password, u?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
  if (!u || !ok || !u.active) { await audit(null, "login_failed", "admin", null, { email }); fail("Wrong email or password"); }
  await setPending2fa(u!.id);
  redirect("/admin/login?step=2fa");
}

export async function loginTotp(fd: FormData) {
  const uid = await getPending2fa();
  if (!uid) fail("Session expired — sign in again");
  const ip = await clientIp();
  if (!(await rateLimit(`admin-2fa:${uid}:${ip}`, 8, 900)).ok) fail("Too many attempts", true);
  const u = await db.adminUser.findUniqueOrThrow({ where: { id: uid! }, include: { role: true } });
  if (!u.totpSecret || !totp.verify(u.totpSecret, String(fd.get("code") ?? ""))) fail("Invalid code", true);
  if (!u.totpEnabled) await db.adminUser.update({ where: { id: u.id }, data: { totpEnabled: true } });
  await clearPending2fa();
  await createAdminSession(u.id);
  await audit({ id: u.id, name: u.name, email: u.email, role: u.role.name, permissions: u.role.permissions, sessionId: "" }, "login", "admin", u.id);
  redirect("/admin");
}

export async function logout() {
  await logoutAdmin();
  redirect("/admin/login");
}
