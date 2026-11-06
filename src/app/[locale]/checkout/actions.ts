"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { createOrder, OrderError } from "@/lib/orders";
import { isBdPhone, normalizePhone } from "@/lib/format";
import { DISTRICTS } from "@/lib/districts";
import { getSettings } from "@/lib/settings";
import { clientIp, phoneRisk, rateLimit, sendOtp, verifyOtp } from "@/lib/security";
import { startPayment } from "@/lib/payments";
import { signToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { detectZone } from "@/lib/pricing";
import { getShippingZones } from "@/lib/catalog";

const Schema = z.object({
  items: z.array(z.object({ variantId: z.string().min(1).max(40), qty: z.number().int().min(1).max(20) })).min(1).max(30),
  name: z.string().trim().min(2, "Please enter your name").max(80),
  phone: z.string().transform(normalizePhone).refine(isBdPhone, "Enter a valid BD mobile number (01XXXXXXXXX)"),
  email: z.string().trim().email("Invalid email").max(120).optional().or(z.literal("")),
  address: z.string().trim().min(8, "Please enter your full address").max(300),
  district: z.string().refine((d) => DISTRICTS.includes(d), "Choose your district"),
  area: z.string().trim().max(80).default(""),
  note: z.string().trim().max(300).optional(),
  paymentMethod: z.enum(["cod", "bkash", "nagad", "sslcommerz"]),
  code: z.string().trim().max(40).optional(),
  idempotencyKey: z.string().min(8).max(80),
  abandonedToken: z.string().max(80).optional(),
  otp: z.string().max(8).optional(),
});
export type PlaceOrderInput = z.input<typeof Schema>;
export type PlaceOrderResult =
  | { ok: true; redirect: string; external?: boolean; orderId: string; orderNumber: string; total: number }
  | { ok: false; error: string; field?: string; needOtp?: boolean; devCode?: string };

export async function placeOrder(raw: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: i.message, field: String(i.path[0]) };
  }
  const input = parsed.data;
  const ip = await clientIp();
  const rl = await rateLimit(`checkout:${ip}`, 12, 600);
  if (!rl.ok) return { ok: false, error: "Too many attempts — please wait a few minutes or WhatsApp us." };

  const settings = await getSettings();
  const pm = settings.payments;
  if (!pm[input.paymentMethod].enabled) return { ok: false, error: "That payment method is unavailable right now", field: "paymentMethod" };

  // Optional COD OTP gate (off / always / only for flagged numbers).
  let otpVerified = false;
  if (input.paymentMethod === "cod" && pm.cod.otp !== "off") {
    const need = pm.cod.otp === "always" || (await phoneRisk(input.phone)).flagged;
    if (need) {
      if (!input.otp) { const s = await sendOtp(input.phone, "cod_verify"); return { ok: false, needOtp: true, error: s.ok ? "We sent a 6‑digit code to your phone" : s.error!, devCode: s.devCode }; }
      if (!(await verifyOtp(input.phone, "cod_verify", input.otp))) return { ok: false, needOtp: true, error: "That code is incorrect or expired", field: "otp" };
      otpVerified = true;
    }
  }

  let utm: { source?: string; medium?: string; campaign?: string } | undefined;
  try { utm = JSON.parse((await cookies()).get("argon_utm")?.value ?? "null") ?? undefined; } catch {}

  try {
    const order = await createOrder({ ...input, email: input.email || null, source: "web", ip, utm, otpVerified });
    const prefix = "";
    const thanks = `${prefix}/order/${order.id}/thank-you?k=${encodeURIComponent(await signToken({ oid: order.id }, "30d"))}`;
    // Prepaid or COD-with-advance → hand off to the gateway; the order stays "pending" until server-side verification.
    const zone = detectZone(await getShippingZones(), input.district, input.area);
    const needsAdvance = input.paymentMethod === "cod" && pm.cod.advanceOutsideDhaka && zone?.key === "outside_dhaka" && order.shippingTotal > 0;
    if (input.paymentMethod !== "cod" || needsAdvance) {
      if (order.paymentStatus === "paid") return { ok: true, redirect: thanks, orderId: order.id, orderNumber: order.orderNumber, total: order.total };
      const method = input.paymentMethod === "cod" ? "bkash" : input.paymentMethod;
      const r = await startPayment(order, method, needsAdvance ? "advance" : "full", ip);
      if ("error" in r) {
        await db.order.update({ where: { id: order.id }, data: { orderStatus: "on_hold" } });
        return { ok: true, redirect: `${thanks}&payerr=1`, orderId: order.id, orderNumber: order.orderNumber, total: order.total };
      }
      return { ok: true, redirect: r.redirectUrl, external: true, orderId: order.id, orderNumber: order.orderNumber, total: order.total };
    }
    return { ok: true, redirect: thanks, orderId: order.id, orderNumber: order.orderNumber, total: order.total };
  } catch (e) {
    if (e instanceof OrderError) return { ok: false, error: e.message, field: e.code === "discount" ? "code" : undefined };
    console.error("placeOrder", e);
    return { ok: false, error: "Something went wrong placing your order. Please try again or WhatsApp us." };
  }
}

/** Saves checkout progress once a valid phone is entered (abandoned-checkout recovery). */
export async function saveCheckoutProgress(data: { token: string; phone: string; name?: string; email?: string; district?: string; items: { variantId: string; qty: number }[]; subtotal: number }) {
  const phone = normalizePhone(data.phone);
  if (!isBdPhone(phone) || !data.token || data.token.length > 80 || !Array.isArray(data.items) || data.items.length > 30) return;
  const ip = await clientIp();
  if (!(await rateLimit(`abandon:${ip}`, 30, 600)).ok) return;
  const cart = data.items.slice(0, 30).map((i) => ({ variantId: String(i.variantId).slice(0, 40), qty: Math.min(20, Math.max(1, Number(i.qty) || 1)) }));
  await db.abandonedCheckout.upsert({
    where: { token: data.token },
    create: { token: data.token, phone, name: data.name?.slice(0, 80), email: data.email?.slice(0, 120), district: data.district?.slice(0, 40), cart, subtotal: Math.max(0, Math.round(data.subtotal)) },
    update: { phone, name: data.name?.slice(0, 80), email: data.email?.slice(0, 120), district: data.district?.slice(0, 40), cart, subtotal: Math.max(0, Math.round(data.subtotal)) },
  });
}
