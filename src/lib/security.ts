import "server-only";
import { createHash, randomInt } from "node:crypto";
import { headers } from "next/headers";
import { db } from "./db";
import { sendSms, renderTemplate } from "./notify";

/** Fixed-window rate limiter stored in Postgres (swap for Upstash Redis at scale). */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  const now = new Date();
  const row = await db.rateLimit.findUnique({ where: { key } });
  if (!row || row.resetAt < now) {
    await db.rateLimit.upsert({ where: { key }, create: { key, count: 1, resetAt: new Date(now.getTime() + windowSec * 1000) }, update: { count: 1, resetAt: new Date(now.getTime() + windowSec * 1000) } });
    return { ok: true, remaining: limit - 1 };
  }
  if (row.count >= limit) return { ok: false, remaining: 0 };
  await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
  return { ok: true, remaining: limit - row.count - 1 };
}

export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "0.0.0.0";
}

const hash = (s: string) => createHash("sha256").update(s + (process.env.AUTH_SECRET ?? "")).digest("hex");

export async function sendOtp(phone: string, purpose: "login" | "cod_verify") {
  const ip = await clientIp();
  const rl1 = await rateLimit(`otp:phone:${phone}`, 3, 600);
  const rl2 = await rateLimit(`otp:ip:${ip}`, 10, 3600);
  if (!rl1.ok || !rl2.ok) return { ok: false, error: "Too many attempts. Try again in a few minutes." };
  const code = String(randomInt(100000, 1000000));
  await db.otpCode.create({ data: { phone, purpose, codeHash: hash(code), expiresAt: new Date(Date.now() + 5 * 60 * 1000) } });
  const t = await renderTemplate("otp", "sms", { code, store: "ARGON" });
  await sendSms(phone, t?.body ?? `Your ARGON code is ${code}. It expires in 5 minutes.`);
  return { ok: true, devCode: process.env.NODE_ENV !== "production" && process.env.SMS_PROVIDER === "console" ? code : undefined };
}

export async function verifyOtp(phone: string, purpose: "login" | "cod_verify", code: string) {
  const row = await db.otpCode.findFirst({ where: { phone, purpose, consumed: false, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!row || row.attempts >= 5) return false;
  if (row.codeHash !== hash(code.trim())) {
    await db.otpCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return false;
  }
  await db.otpCode.update({ where: { id: row.id }, data: { consumed: true } });
  return true;
}

/** Simple risk heuristic from this store's own history (courier fraud-check APIs are added on top in the order view). */
export async function phoneRisk(phone: string) {
  const orders = await db.order.groupBy({ by: ["fulfillmentStatus"], where: { customerPhone: phone }, _count: true });
  const count = (s: string) => orders.find((o) => o.fulfillmentStatus === s)?._count ?? 0;
  const delivered = count("delivered"); const returned = count("returned"); const cancelled = count("cancelled");
  const total = orders.reduce((s, o) => s + o._count, 0);
  const done = delivered + returned + cancelled;
  const successRatio = done ? delivered / done : null;
  const flagged = (cancelled + returned >= 2 && (successRatio ?? 1) < 0.5);
  return { total, delivered, returned, cancelled, successRatio, flagged };
}
