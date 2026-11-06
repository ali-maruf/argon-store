"use server";
import { db } from "@/lib/db";
import { isBdPhone, normalizePhone } from "@/lib/format";
import { sendOtp, verifyOtp } from "@/lib/security";
import { clearCustomerSession, setCustomerSession } from "@/lib/auth";

export async function requestLoginOtp(raw: string) {
  const phone = normalizePhone(raw);
  if (!isBdPhone(phone)) return { ok: false, error: "Enter a valid BD mobile number" };
  return sendOtp(phone, "login");
}
export async function verifyLoginOtp(raw: string, code: string) {
  const phone = normalizePhone(raw);
  if (!(await verifyOtp(phone, "login", code))) return { ok: false, error: "That code is incorrect or expired" };
  await setCustomerSession(phone);
  return { ok: true };
}
export async function signOutCustomer() { await clearCustomerSession(); }

export async function reorderLines(lines: { variantId: string; qty: number }[]) {
  const vs = await db.productVariant.findMany({ where: { id: { in: lines.slice(0, 30).map((l) => l.variantId) }, stock: { gt: 0 }, product: { status: "active" } }, include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } } } });
  return vs.map((v) => ({ variantId: v.id, productId: v.productId, slug: v.product.slug, title: v.product.title, variantTitle: v.title, price: v.price, image: v.product.images[0]?.url ?? "", maxQty: v.stock, qty: Math.min(v.stock, lines.find((l) => l.variantId === v.id)?.qty ?? 1) }));
}
