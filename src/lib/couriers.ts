import "server-only";
import type { Order } from "@prisma/client";
import { db } from "./db";
import { appendTimeline, markDelivered, tl, type LineSnapshot } from "./orders";
import { notifyCustomer } from "./notify";

export type Normalized = "in_transit" | "delivered" | "returned" | "cancelled" | "pending";
export interface CourierProvider {
  key: string; name: string;
  configured(): boolean;
  createConsignment(o: Order): Promise<{ consignmentId: string; trackingNumber: string; status?: string }>;
  status(o: Order): Promise<{ raw: string; normalized: Normalized; codCollected?: number }>;
  trackingUrl(trackingNumber: string): string;
}

const addr = (o: Order) => o.shippingAddress as { name: string; phone: string; address: string; district: string; area: string };
const codDue = (o: Order) => Math.max(0, o.total - o.amountPaid);
const qty = (o: Order) => (o.lineItems as LineSnapshot[]).reduce((s, l) => s + l.qty, 0);

/* ---------------- Steadfast ---------------- */
const SF = "https://portal.packzy.com/api/v1";
const sfHeaders = () => ({ "Api-Key": process.env.STEADFAST_API_KEY ?? "", "Secret-Key": process.env.STEADFAST_SECRET_KEY ?? "", "Content-Type": "application/json" });
const steadfast: CourierProvider = {
  key: "steadfast", name: "Steadfast",
  configured: () => !!process.env.STEADFAST_API_KEY,
  async createConsignment(o) {
    const a = addr(o);
    const j = await fetch(`${SF}/create_order`, { method: "POST", headers: sfHeaders(), body: JSON.stringify({
      invoice: o.orderNumber, recipient_name: a.name, recipient_phone: a.phone, recipient_address: `${a.address}, ${a.area}, ${a.district}`.slice(0, 250),
      cod_amount: codDue(o), note: o.note ?? "",
    }) }).then((r) => r.json());
    if (!j.consignment) throw new Error(j.message ?? "Steadfast rejected the order");
    return { consignmentId: String(j.consignment.consignment_id), trackingNumber: j.consignment.tracking_code, status: j.consignment.status };
  },
  async status(o) {
    const j = await fetch(`${SF}/status_by_cid/${o.consignmentId}`, { headers: sfHeaders() }).then((r) => r.json());
    const s = String(j.delivery_status ?? "unknown");
    const normalized: Normalized = s === "delivered" || s === "partial_delivered" ? "delivered" : s === "cancelled" ? "returned" : s === "pending" || s === "in_review" ? "pending" : "in_transit";
    return { raw: s, normalized };
  },
  trackingUrl: (t) => `https://steadfast.com.bd/t/${t}`,
};

/* ---------------- Pathao ---------------- */
const PA = () => (process.env.PATHAO_SANDBOX === "false" ? "https://api-hermes.pathao.com" : "https://courier-api-sandbox.pathao.com");
let pathaoToken: { t: string; exp: number } | null = null;
async function pathaoAuth() {
  if (pathaoToken && pathaoToken.exp > Date.now()) return pathaoToken.t;
  const j = await fetch(`${PA()}/aladdin/api/v1/issue-token`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    client_id: process.env.PATHAO_CLIENT_ID, client_secret: process.env.PATHAO_CLIENT_SECRET, username: process.env.PATHAO_USERNAME, password: process.env.PATHAO_PASSWORD, grant_type: "password",
  }) }).then((r) => r.json());
  if (!j.access_token) throw new Error("Pathao auth failed");
  pathaoToken = { t: j.access_token, exp: Date.now() + (Number(j.expires_in ?? 3600) - 60) * 1000 };
  return pathaoToken.t;
}
const pathao: CourierProvider = {
  key: "pathao", name: "Pathao Courier",
  configured: () => !!process.env.PATHAO_CLIENT_ID,
  async createConsignment(o) {
    const a = addr(o); const token = await pathaoAuth();
    const j = await fetch(`${PA()}/aladdin/api/v1/orders`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({
      store_id: Number(process.env.PATHAO_STORE_ID), merchant_order_id: o.orderNumber, recipient_name: a.name, recipient_phone: a.phone,
      recipient_address: `${a.address}, ${a.area}, ${a.district}`.slice(0, 220), delivery_type: 48, item_type: 2, special_instruction: o.note ?? "",
      item_quantity: qty(o), item_weight: 0.5, amount_to_collect: codDue(o), item_description: "Stainless steel jewelry",
    }) }).then((r) => r.json());
    if (!j.data?.consignment_id) throw new Error(j.message ?? "Pathao rejected the order");
    return { consignmentId: j.data.consignment_id, trackingNumber: j.data.consignment_id, status: j.data.order_status };
  },
  async status(o) {
    const token = await pathaoAuth();
    const j = await fetch(`${PA()}/aladdin/api/v1/orders/${o.consignmentId}/info`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
    const s = String(j.data?.order_status ?? "unknown"); const l = s.toLowerCase();
    const normalized: Normalized = l.includes("deliver") && !l.includes("fail") ? "delivered" : l.includes("return") ? "returned" : l.includes("cancel") ? "cancelled" : l.includes("pending") ? "pending" : "in_transit";
    return { raw: s, normalized };
  },
  trackingUrl: (t) => `https://merchant.pathao.com/tracking?consignment_id=${t}`,
};

/* ---------------- RedX ---------------- */
const RX = () => (process.env.REDX_SANDBOX === "false" ? "https://openapi.redx.com.bd/v1.0.0-beta" : "https://sandbox.redx.com.bd/v1.0.0-beta");
const rxHeaders = () => ({ "API-ACCESS-TOKEN": `Bearer ${process.env.REDX_API_TOKEN ?? ""}`, "Content-Type": "application/json" });
const redx: CourierProvider = {
  key: "redx", name: "RedX",
  configured: () => !!process.env.REDX_API_TOKEN,
  async createConsignment(o) {
    const a = addr(o);
    const j = await fetch(`${RX()}/parcel`, { method: "POST", headers: rxHeaders(), body: JSON.stringify({
      customer_name: a.name, customer_phone: a.phone, delivery_area: a.area || a.district, delivery_area_id: Number(process.env.REDX_DEFAULT_AREA_ID ?? 1),
      customer_address: `${a.address}, ${a.area}, ${a.district}`, merchant_invoice_id: o.orderNumber, cash_collection_amount: String(codDue(o)),
      parcel_weight: 500, instruction: o.note ?? "", value: o.total,
    }) }).then((r) => r.json());
    if (!j.tracking_id) throw new Error(j.message ?? "RedX rejected the order");
    return { consignmentId: j.tracking_id, trackingNumber: j.tracking_id };
  },
  async status(o) {
    const j = await fetch(`${RX()}/parcel/info/${o.consignmentId}`, { headers: rxHeaders() }).then((r) => r.json());
    const s = String(j.parcel?.status ?? "unknown"); const l = s.toLowerCase();
    const normalized: Normalized = l === "delivered" ? "delivered" : l.includes("return") ? "returned" : l.includes("cancel") ? "cancelled" : l.includes("pickup-pending") ? "pending" : "in_transit";
    return { raw: s, normalized };
  },
  trackingUrl: (t) => `https://redx.com.bd/track-parcel/?trackingId=${t}`,
};

/* ---------------- Manual (no API: staff enters tracking) ---------------- */
const manual: CourierProvider = {
  key: "manual", name: "Manual / Other", configured: () => true,
  async createConsignment(o) { return { consignmentId: o.orderNumber, trackingNumber: o.orderNumber }; },
  async status(o) { return { raw: o.courierStatus ?? "manual", normalized: "in_transit" }; },
  trackingUrl: () => "",
};

export const COURIERS: Record<string, CourierProvider> = { steadfast, pathao, redx, manual };
export const courier = (key: string) => COURIERS[key] ?? manual;

export async function sendToCourier(orderId: string, key: string, by?: string) {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (o.consignmentId) return o;
  if (o.orderStatus === "cancelled") throw new Error(`${o.orderNumber} is cancelled`);
  const c = courier(key);
  if (!c.configured()) throw new Error(`${c.name} API credentials are not set (see .env.example)`);
  const r = await c.createConsignment(o);
  const updated = await appendTimeline(o.id, tl("courier", `Sent to ${c.name} · consignment ${r.consignmentId}`, by), {
    courier: c.key, consignmentId: r.consignmentId, trackingNumber: r.trackingNumber, courierStatus: r.status ?? "pending",
    fulfillmentStatus: "shipped", orderStatus: o.orderStatus === "new" ? "confirmed" : o.orderStatus,
  });
  void notifyCustomer("order_shipped", updated, { tracking_link: c.trackingUrl(r.trackingNumber) || undefined } as Record<string, string>).catch(() => {});
  return updated;
}

/** Polls the courier for every in-flight consignment. Run by cron every 30 minutes. */
export async function syncCourierStatuses() {
  const inflight = await db.order.findMany({ where: { fulfillmentStatus: "shipped", consignmentId: { not: null }, courier: { not: "manual" } }, take: 200 });
  let updated = 0;
  for (const o of inflight) {
    try {
      const c = courier(o.courier!);
      if (!c.configured()) continue;
      const s = await c.status(o);
      if (s.raw === o.courierStatus) continue;
      updated++;
      if (s.normalized === "delivered") { await db.order.update({ where: { id: o.id }, data: { courierStatus: s.raw } }); await markDelivered(o.id, `${c.name} sync`, s.codCollected); }
      else if (s.normalized === "returned" || s.normalized === "cancelled") {
        await appendTimeline(o.id, tl("courier", `${c.name}: ${s.raw}`, "courier sync"), { courierStatus: s.raw, fulfillmentStatus: "returned" });
        if (o.customerId) await db.customer.update({ where: { id: o.customerId }, data: { riskScore: { increment: 15 } } });
      } else await appendTimeline(o.id, tl("courier", `${c.name}: ${s.raw}`, "courier sync"), { courierStatus: s.raw });
    } catch (e) { console.error("courier sync", o.orderNumber, e); }
  }
  return { checked: inflight.length, updated };
}
