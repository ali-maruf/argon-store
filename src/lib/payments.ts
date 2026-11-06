import "server-only";
import { constants, createSign, privateDecrypt, publicEncrypt, randomBytes } from "node:crypto";
import type { Order, Prisma } from "@prisma/client";
import { db } from "./db";
import { getSettings } from "./settings";
import { afterOrderPlaced, appendTimeline, tl } from "./orders";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export type StartResult = { redirectUrl: string } | { error: string };
export type Purpose = "full" | "advance";
const amountFor = (o: Order, purpose: Purpose) => (purpose === "advance" ? o.shippingTotal : o.total - o.amountPaid);

/** Records a verified payment and updates the order. Only ever called after server-side verification. */
export async function markPaid(paymentId: string, opts: { transactionId?: string; amount: number; raw: unknown }) {
  const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { order: true } });
  if (p.status === "completed") return p.order;
  await db.payment.update({ where: { id: p.id }, data: { status: "completed", transactionId: opts.transactionId, rawPayload: opts.raw as Prisma.InputJsonValue } });
  const paid = p.order.amountPaid + opts.amount;
  const order = await appendTimeline(p.orderId, tl("payment", `${p.provider} payment ৳${opts.amount} verified · trx ${opts.transactionId ?? "-"}`), {
    amountPaid: paid, paymentStatus: paid >= p.order.total ? "paid" : "partially_paid", orderStatus: p.order.orderStatus === "on_hold" ? "new" : p.order.orderStatus,
  });
  void afterOrderPlaced(order);
  return order;
}
export async function markFailed(paymentId: string, raw: unknown, reason = "failed") {
  const p = await db.payment.update({ where: { id: paymentId }, data: { status: "failed", rawPayload: raw as Prisma.InputJsonValue } });
  const o = await db.order.findUniqueOrThrow({ where: { id: p.orderId } });
  if (o.paymentStatus !== "paid") await appendTimeline(o.id, tl("payment", `${p.provider} payment ${reason}`), { paymentStatus: o.amountPaid > 0 ? "partially_paid" : "failed" });
}

/* ============================ bKash Tokenized Checkout ============================ */
const bkashBase = (sandbox: boolean) => (sandbox ? "https://tokenized.sandbox.bka.sh/v1.2.0-beta" : "https://tokenized.pay.bka.sh/v1.2.0-beta");
let bkashToken: { token: string; exp: number } | null = null;

async function bkashGrant(sandbox: boolean) {
  if (bkashToken && bkashToken.exp > Date.now()) return bkashToken.token;
  const r = await fetch(`${bkashBase(sandbox)}/tokenized/checkout/token/grant`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", username: process.env.BKASH_USERNAME ?? "", password: process.env.BKASH_PASSWORD ?? "" },
    body: JSON.stringify({ app_key: process.env.BKASH_APP_KEY, app_secret: process.env.BKASH_APP_SECRET }),
  });
  const j = await r.json();
  if (!j.id_token) throw new Error(`bKash grant failed: ${j.statusMessage ?? r.status}`);
  bkashToken = { token: j.id_token, exp: Date.now() + 50 * 60 * 1000 };
  return j.id_token as string;
}
async function bkashCall(path: string, body: unknown, sandbox: boolean) {
  const token = await bkashGrant(sandbox);
  const r = await fetch(`${bkashBase(sandbox)}/tokenized/checkout/${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: token, "X-APP-Key": process.env.BKASH_APP_KEY ?? "" },
    body: JSON.stringify(body),
  });
  return r.json();
}
export const bkash = {
  async start(order: Order, purpose: Purpose): Promise<StartResult> {
    const { payments } = await getSettings();
    const amount = amountFor(order, purpose);
    const pay = await db.payment.create({ data: { orderId: order.id, provider: "bkash", amount, status: "initiated" } });
    const j = await bkashCall("create", {
      mode: "0011", payerReference: order.customerPhone, callbackURL: `${site()}/api/payments/bkash/callback?pid=${pay.id}`,
      amount: amount.toFixed(2), currency: "BDT", intent: "sale", merchantInvoiceNumber: `${order.orderNumber}-${pay.id.slice(-6)}`,
    }, payments.bkash.sandbox);
    if (!j.bkashURL) { await markFailed(pay.id, j, "could not start"); return { error: j.statusMessage ?? "bKash is unavailable right now" }; }
    await db.payment.update({ where: { id: pay.id }, data: { paymentRef: j.paymentID, rawPayload: j } });
    return { redirectUrl: j.bkashURL };
  },
  /** Called from the callback route; executes and then queries to be sure. */
  async verify(paymentId: string, paymentID: string, status: string) {
    const { payments } = await getSettings();
    const pay = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (pay.paymentRef !== paymentID) throw new Error("bKash paymentID mismatch");
    if (status !== "success") { await markFailed(pay.id, { status }, status); return { ok: false, orderId: pay.orderId }; }
    let j = await bkashCall("execute", { paymentID }, payments.bkash.sandbox);
    if (!j.transactionStatus) j = await bkashCall("payment/status", { paymentID }, payments.bkash.sandbox);
    if (j.transactionStatus === "Completed" && Math.round(Number(j.amount)) >= pay.amount) {
      await markPaid(pay.id, { transactionId: j.trxID, amount: pay.amount, raw: j });
      return { ok: true, orderId: pay.orderId };
    }
    await markFailed(pay.id, j);
    return { ok: false, orderId: pay.orderId };
  },
  async refund(paymentId: string, amount: number, reason = "Refund") {
    const { payments } = await getSettings();
    const pay = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
    return bkashCall("payment/refund", { paymentID: pay.paymentRef, amount: amount.toFixed(2), trxID: pay.transactionId, sku: "refund", reason }, payments.bkash.sandbox);
  },
};

/* ============================ Nagad Payment Gateway ============================ */
const nagadBase = (sandbox: boolean) => (sandbox ? "http://sandbox.mynagad.com:10080/remote-payment-gateway-1.0/api/dfs" : "https://api.mynagad.com/api/dfs");
const pem = (k: string | undefined, type: "PUBLIC" | "PRIVATE") => {
  const body = (k ?? "").replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  return `-----BEGIN ${type} KEY-----\n${body.match(/.{1,64}/g)?.join("\n")}\n-----END ${type} KEY-----`;
};
const nagadEncrypt = (data: object) => publicEncrypt({ key: pem(process.env.NAGAD_PG_PUBLIC_KEY, "PUBLIC"), padding: constants.RSA_PKCS1_PADDING }, Buffer.from(JSON.stringify(data))).toString("base64");
const nagadDecrypt = (b64: string) => JSON.parse(privateDecrypt({ key: pem(process.env.NAGAD_MERCHANT_PRIVATE_KEY, "PRIVATE"), padding: constants.RSA_PKCS1_PADDING }, Buffer.from(b64, "base64")).toString());
const nagadSign = (data: object) => createSign("SHA256").update(JSON.stringify(data)).sign(pem(process.env.NAGAD_MERCHANT_PRIVATE_KEY, "PRIVATE"), "base64");
const dhakaStamp = () => {
  const d = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
  return d.slice(0, 19).replace(/[-T:]/g, "");
};
export const nagad = {
  async start(order: Order, purpose: Purpose, ip: string): Promise<StartResult> {
    const { payments } = await getSettings();
    const sandbox = payments.nagad.sandbox; const merchantId = process.env.NAGAD_MERCHANT_ID ?? "";
    const amount = amountFor(order, purpose);
    const pay = await db.payment.create({ data: { orderId: order.id, provider: "nagad", amount, status: "initiated" } });
    const nagadOrderId = `${order.orderNumber.replace(/\W/g, "")}${Date.now().toString().slice(-6)}`;
    const headers = { "Content-Type": "application/json", "X-KM-Api-Version": "v-0.2.0", "X-KM-IP-V4": ip, "X-KM-Client-Type": "PC_WEB" };
    const sensitive = { merchantId, datetime: dhakaStamp(), orderId: nagadOrderId, challenge: randomBytes(20).toString("hex") };
    const init = await fetch(`${nagadBase(sandbox)}/check-out/initialize/${merchantId}/${nagadOrderId}`, {
      method: "POST", headers, body: JSON.stringify({ dateTime: sensitive.datetime, sensitiveData: nagadEncrypt(sensitive), signature: nagadSign(sensitive) }),
    }).then((r) => r.json());
    if (!init.sensitiveData) { await markFailed(pay.id, init, "could not start"); return { error: init.message ?? "Nagad is unavailable right now" }; }
    const dec = nagadDecrypt(init.sensitiveData);
    const order2 = { merchantId, orderId: nagadOrderId, currencyCode: "050", amount: amount.toFixed(2), challenge: dec.challenge };
    const done = await fetch(`${nagadBase(sandbox)}/check-out/complete/${dec.paymentReferenceId}`, {
      method: "POST", headers, body: JSON.stringify({ sensitiveData: nagadEncrypt(order2), signature: nagadSign(order2), merchantCallbackURL: `${site()}/api/payments/nagad/callback?pid=${pay.id}`, additionalMerchantInfo: { order: order.orderNumber } }),
    }).then((r) => r.json());
    if (done.status !== "Success" || !done.callBackUrl) { await markFailed(pay.id, done, "could not start"); return { error: done.message ?? "Nagad is unavailable right now" }; }
    await db.payment.update({ where: { id: pay.id }, data: { paymentRef: dec.paymentReferenceId, rawPayload: { init: dec, complete: done } } });
    return { redirectUrl: done.callBackUrl };
  },
  async verify(paymentId: string, paymentRefId: string) {
    const { payments } = await getSettings();
    const pay = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
    const j = await fetch(`${nagadBase(payments.nagad.sandbox)}/verify/payment/${encodeURIComponent(paymentRefId)}`, { headers: { "X-KM-Api-Version": "v-0.2.0", "X-KM-Client-Type": "PC_WEB" } }).then((r) => r.json());
    if (j.status === "Success" && Math.round(Number(j.amount)) >= pay.amount && (!pay.paymentRef || pay.paymentRef === j.paymentRefId)) {
      await markPaid(pay.id, { transactionId: j.issuerPaymentRefNo ?? j.paymentRefId, amount: pay.amount, raw: j });
      return { ok: true, orderId: pay.orderId };
    }
    await markFailed(pay.id, j);
    return { ok: false, orderId: pay.orderId };
  },
};

/* ============================ SSLCommerz ============================ */
const sslBase = (sandbox: boolean) => (sandbox ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com");
export const sslcommerz = {
  async start(order: Order, purpose: Purpose): Promise<StartResult> {
    const { payments } = await getSettings();
    const amount = amountFor(order, purpose);
    const pay = await db.payment.create({ data: { orderId: order.id, provider: "sslcommerz", amount, status: "initiated" } });
    const addr = order.shippingAddress as { address: string; district: string };
    const back = (s: string) => `${site()}/api/payments/sslcommerz/${s}?pid=${pay.id}`;
    const form = new URLSearchParams({
      store_id: process.env.SSLCOMMERZ_STORE_ID ?? "", store_passwd: process.env.SSLCOMMERZ_STORE_PASSWORD ?? "",
      total_amount: amount.toFixed(2), currency: "BDT", tran_id: pay.id,
      success_url: back("return"), fail_url: back("return"), cancel_url: back("return"), ipn_url: `${site()}/api/payments/sslcommerz/ipn`,
      cus_name: order.customerName, cus_email: order.customerEmail || "customer@argon.com.bd", cus_add1: addr.address.slice(0, 100), cus_city: addr.district,
      cus_country: "Bangladesh", cus_phone: order.customerPhone, shipping_method: "NO", num_of_item: "1",
      product_name: `ARGON ${order.orderNumber}`, product_category: "Jewelry", product_profile: "physical-goods", value_a: order.id,
    });
    const j = await fetch(`${sslBase(payments.sslcommerz.sandbox)}/gwprocess/v4/api.php`, { method: "POST", body: form }).then((r) => r.json());
    if (j.status !== "SUCCESS" || !j.GatewayPageURL) { await markFailed(pay.id, j, "could not start"); return { error: j.failedreason ?? "Card payment is unavailable right now" }; }
    await db.payment.update({ where: { id: pay.id }, data: { paymentRef: j.sessionkey, rawPayload: { sessionkey: j.sessionkey } } });
    return { redirectUrl: j.GatewayPageURL };
  },
  /** Validates a val_id against the SSLCommerz validation API (used by both IPN and browser return). */
  async validate(tranId: string, valId: string | null, status?: string) {
    const { payments } = await getSettings();
    const pay = await db.payment.findUnique({ where: { id: tranId } });
    if (!pay) return { ok: false, orderId: null };
    if (pay.status === "completed") return { ok: true, orderId: pay.orderId };
    if (!valId || (status && status !== "VALID" && status !== "VALIDATED")) { await markFailed(pay.id, { status }, (status ?? "failed").toLowerCase()); return { ok: false, orderId: pay.orderId }; }
    const u = new URL(`${sslBase(payments.sslcommerz.sandbox)}/validator/api/validationserverAPI.php`);
    u.searchParams.set("val_id", valId); u.searchParams.set("store_id", process.env.SSLCOMMERZ_STORE_ID ?? "");
    u.searchParams.set("store_passwd", process.env.SSLCOMMERZ_STORE_PASSWORD ?? ""); u.searchParams.set("format", "json");
    const j = await fetch(u).then((r) => r.json());
    if ((j.status === "VALID" || j.status === "VALIDATED") && j.tran_id === pay.id && j.currency_type === "BDT" && Math.round(Number(j.currency_amount ?? j.amount)) >= pay.amount) {
      await markPaid(pay.id, { transactionId: j.bank_tran_id, amount: pay.amount, raw: j });
      return { ok: true, orderId: pay.orderId };
    }
    await markFailed(pay.id, j);
    return { ok: false, orderId: pay.orderId };
  },
};

export async function startPayment(order: Order, method: "bkash" | "nagad" | "sslcommerz", purpose: Purpose, ip: string): Promise<StartResult> {
  try {
    if (method === "bkash") return await bkash.start(order, purpose);
    if (method === "nagad") return await nagad.start(order, purpose, ip);
    return await sslcommerz.start(order, purpose);
  } catch (e) {
    console.error(`${method} start error`, e);
    return { error: "Payment gateway is not configured or unavailable. Please choose Cash on Delivery." };
  }
}
