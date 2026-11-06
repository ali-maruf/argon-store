import "server-only";
import { generateSecret, generateURI, verifySync } from "otplib";
import { revalidatePath, revalidateTag } from "next/cache";
import { audit, requireAdmin, type AdminCtx, type Permission } from "./auth";

export const totp = {
  secret: () => generateSecret(),
  uri: (email: string, secret: string) => generateURI({ issuer: "ARGON Admin", label: email, secret }),
  verify: (secret: string, token: string) => {
    try { return verifySync({ secret, token: token.replace(/\s/g, ""), epochTolerance: 30 }).valid; } catch { return false; }
  },
};

/** Wraps an admin mutation: permission check + audit log entry + cache revalidation. */
export async function adminMutation<T>(perm: Permission, action: string, entity: string, entityId: string | null, fn: (admin: AdminCtx) => Promise<T>, opts: { details?: unknown; tags?: string[]; paths?: string[] } = {}): Promise<T> {
  const admin = await requireAdmin(perm);
  const result = await fn(admin);
  await audit(admin, action, entity, entityId, opts.details);
  for (const t of opts.tags ?? []) revalidateTag(t);
  for (const p of opts.paths ?? []) revalidatePath(p);
  return result;
}

export const fdStr = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const fdInt = (fd: FormData, k: string, d = 0) => { const n = parseInt(String(fd.get(k) ?? ""), 10); return Number.isFinite(n) ? n : d; };
export const fdIntOrNull = (fd: FormData, k: string) => { const s = String(fd.get(k) ?? "").trim(); if (!s) return null; const n = parseInt(s, 10); return Number.isFinite(n) ? n : null; };
export const fdBool = (fd: FormData, k: string) => fd.get(k) === "on" || fd.get(k) === "true";
export const fdList = (fd: FormData, k: string) => fdStr(fd, k).split(",").map((s) => s.trim()).filter(Boolean);
