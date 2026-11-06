import "server-only";
import { Prisma, type Order, type PaymentMethod, type OrderSource } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { db } from "./db";
import { quote, type CartInput } from "./pricing";
import { getSettings } from "./settings";
import { notifyCustomer, notifyOwner } from "./notify";
import { sendPurchaseCapi } from "./capi";

export type TimelineEntry = { at: string; type: string; message: string; by?: string };
export type LineSnapshot = { variantId: string; productId: string; slug: string; title: string; variantTitle: string; sku: string; image: string; price: number; qty: number; costPrice?: number | null };
export type AddressSnapshot = { name: string; phone: string; address: string; district: string; area: string };

export class OrderError extends Error {
  constructor(message: string, public code: string = "invalid") { super(message); }
}

export const tl = (type: string, message: string, by?: string): TimelineEntry => ({ at: new Date().toISOString(), type, message, by });

async function nextOrderNumber(tx: Prisma.TransactionClient, prefix: string) {
  const c = await tx.counter.upsert({ where: { key: "order" }, create: { key: "order", value: 10001 }, update: { value: { increment: 1 } } });
  return `${prefix}${c.value}`;
}

export type CreateOrderInput = {
  items: CartInput; name: string; phone: string; email?: string | null; address: string; district: string; area: string;
  note?: string | null; paymentMethod: PaymentMethod; code?: string | null; idempotencyKey?: string | null; source?: OrderSource;
  utm?: { source?: string; medium?: string; campaign?: string }; ip?: string | null; adminName?: string; abandonedToken?: string | null;
  shippingOverride?: number | null; otpVerified?: boolean;
};

export async function createOrder(input: CreateOrderInput): Promise<Order> {
  if (input.idempotencyKey) {
    const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) return existing;
  }
  const settings = await getSettings();
  const blocked = await db.blocklist.findFirst({ where: { OR: [{ type: "phone", value: input.phone }, ...(input.ip ? [{ type: "ip", value: input.ip }] : [])] } });
  if (blocked && input.source !== "manual") throw new OrderError("We couldn't place this order. Please contact us on WhatsApp.", "blocked");

  const q = await quote({ items: input.items, district: input.district, area: input.area, code: input.code, phone: input.phone });
  if (!q.lines.length) throw new OrderError("Your cart is empty", "empty");
  const stockErr = q.errors.find((e) => /sold out|Only \d+ left|no longer/.test(e));
  if (stockErr) throw new OrderError(stockErr, "stock");
  if (input.code && !q.discountCode) throw new OrderError(q.errors[0] ?? "Invalid discount code", "discount");
  if (!q.zone) throw new OrderError("Please choose your district", "zone");
  const shippingTotal = input.shippingOverride ?? q.shippingTotal;
  const total = q.subtotal - q.discountTotal + shippingTotal;

  const lineItems: LineSnapshot[] = q.lines.map((l) => ({ variantId: l.variantId, productId: l.productId, slug: l.slug, title: l.title, variantTitle: l.variantTitle, sku: l.sku, image: l.image, price: l.price, qty: l.qty, costPrice: l.costPrice }));
  const address: AddressSnapshot = { name: input.name, phone: input.phone, address: input.address, district: input.district, area: input.area };

  try {
    const order = await db.$transaction(async (tx) => {
      // Atomic, oversell-proof stock decrement: the WHERE stock >= qty guard fails under contention.
      for (const l of q.lines) {
        const r = await tx.productVariant.updateMany({ where: { id: l.variantId, stock: { gte: l.qty } }, data: { stock: { decrement: l.qty } } });
        if (r.count !== 1) throw new OrderError(`Sorry — ${l.title} (${l.variantTitle}) just sold out`, "stock");
        await tx.product.update({ where: { id: l.productId }, data: { soldCount: { increment: l.qty } } });
      }
      const customer = await tx.customer.upsert({
        where: { phone: input.phone },
        create: { name: input.name, phone: input.phone, email: input.email || null, addresses: [address] as unknown as Prisma.InputJsonValue },
        update: { name: input.name, ...(input.email ? { email: input.email } : {}) },
      });
      const orderNumber = await nextOrderNumber(tx, settings.store.orderPrefix);
      const created = await tx.order.create({
        data: {
          orderNumber, customerId: customer.id, customerName: input.name, customerPhone: input.phone, customerEmail: input.email || null,
          shippingAddress: address as unknown as Prisma.InputJsonValue, district: input.district, zone: q.zone!.key,
          lineItems: lineItems as unknown as Prisma.InputJsonValue, subtotal: q.subtotal, discountTotal: q.discountTotal,
          shippingTotal, total, discountCode: q.discountCode, paymentMethod: input.paymentMethod, source: input.source ?? "web",
          note: input.note || null, idempotencyKey: input.idempotencyKey || null, ip: input.ip || null, otpVerified: !!input.otpVerified,
          utmSource: input.utm?.source, utmMedium: input.utm?.medium, utmCampaign: input.utm?.campaign,
          timeline: [tl("created", `Order placed via ${input.source ?? "web"} · ${input.paymentMethod.toUpperCase()}`, input.adminName)] as unknown as Prisma.InputJsonValue,
        },
      });
      for (const l of q.lines) {
        await tx.inventoryAdjustment.create({ data: { variantId: l.variantId, delta: -l.qty, reason: "order", orderId: created.id, note: orderNumber } });
      }
      if (q.discountCode) await tx.discount.update({ where: { code: q.discountCode }, data: { usageCount: { increment: 1 }, revenue: { increment: total } } });
      if (input.abandonedToken) await tx.abandonedCheckout.updateMany({ where: { token: input.abandonedToken }, data: { recovered: true, orderId: created.id } });
      await tx.abandonedCheckout.updateMany({ where: { phone: input.phone, recovered: false }, data: { recovered: true, orderId: created.id } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15000 });

    revalidateTag("catalog");
    await db.analyticsEvent.create({ data: { type: "order" } }).catch(() => {});
    if (input.paymentMethod === "cod") void afterOrderPlaced(order);
    return order;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" && input.idempotencyKey) {
      const existing = await db.order.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (existing) return existing;
    }
    throw e;
  }
}

/** Messages sent once an order is confirmed placed (COD immediately; prepaid after payment verification). */
export async function afterOrderPlaced(order: Order) {
  try {
    await Promise.allSettled([notifyCustomer("order_placed", order), sendPurchaseCapi(order)]);
    await notifyOwner(`🛒 New order ${order.orderNumber} — ৳${order.total} (${order.paymentMethod.toUpperCase()}) · ${order.customerName}, ${order.district}`);
  } catch (e) { console.error("notify failed", e); }
}

export async function appendTimeline(orderId: string, entry: TimelineEntry, data: Prisma.OrderUpdateInput = {}) {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId }, select: { timeline: true } });
  const timeline = [...((o.timeline as TimelineEntry[]) ?? []), entry];
  return db.order.update({ where: { id: orderId }, data: { ...data, timeline: timeline as unknown as Prisma.InputJsonValue } });
}

/** Cancels an order and puts its stock back. Safe to call twice. */
export async function cancelOrder(orderId: string, by?: string, reason = "Cancelled") {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.orderStatus === "cancelled") return order;
  const lines = order.lineItems as LineSnapshot[];
  const restock = !["shipped", "delivered"].includes(order.fulfillmentStatus);
  await db.$transaction(async (tx) => {
    if (restock) for (const l of lines) {
      await tx.productVariant.updateMany({ where: { id: l.variantId }, data: { stock: { increment: l.qty } } });
      await tx.product.updateMany({ where: { id: l.productId }, data: { soldCount: { decrement: l.qty } } });
      await tx.inventoryAdjustment.create({ data: { variantId: l.variantId, delta: l.qty, reason: "cancel", orderId, note: order.orderNumber } }).catch(() => {});
    }
  });
  const updated = await appendTimeline(orderId, tl("cancelled", `${reason}${restock ? " · stock restored" : ""}`, by), { orderStatus: "cancelled", fulfillmentStatus: "cancelled" });
  // Repeat cancellations raise the customer's risk score.
  if (order.customerId) await db.customer.update({ where: { id: order.customerId }, data: { riskScore: { increment: 10 } } }).catch(() => {});
  revalidateTag("catalog");
  void notifyCustomer("order_cancelled", updated).catch(() => {});
  return updated;
}

export async function markDelivered(orderId: string, by?: string, codCollected?: number) {
  const o = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  if (o.fulfillmentStatus === "delivered") return o;
  const paid = o.paymentMethod === "cod" ? (codCollected ?? o.total) : o.amountPaid;
  const updated = await appendTimeline(orderId, tl("delivered", `Delivered${o.paymentMethod === "cod" ? ` · COD ৳${paid} collected` : ""}`, by), {
    fulfillmentStatus: "delivered", orderStatus: "completed", paymentStatus: paid >= o.total ? "paid" : "partially_paid", amountPaid: paid,
  });
  if (o.customerId) await db.customer.update({ where: { id: o.customerId }, data: { totalSpent: { increment: o.total }, orderCount: { increment: 1 } } });
  void notifyCustomer("order_delivered", updated).catch(() => {});
  return updated;
}

export const ORDER_TABS = ["all", "new", "confirmed", "processing", "shipped", "delivered", "returned", "cancelled", "abandoned"] as const;
export function tabWhere(tab: string): Prisma.OrderWhereInput {
  switch (tab) {
    case "new": return { orderStatus: "new" };
    case "confirmed": return { orderStatus: "confirmed", fulfillmentStatus: "unfulfilled" };
    case "processing": return { fulfillmentStatus: "processing" };
    case "shipped": return { fulfillmentStatus: "shipped" };
    case "delivered": return { fulfillmentStatus: "delivered" };
    case "returned": return { fulfillmentStatus: "returned" };
    case "cancelled": return { orderStatus: "cancelled" };
    default: return {};
  }
}

export type OrderFilter = { tab?: string; q?: string; from?: string; to?: string; pm?: string; ps?: string; district?: string; courier?: string; tag?: string; source?: string; page?: string; ids?: string };
export function orderWhere(sp: OrderFilter): Prisma.OrderWhereInput {
  const and: Prisma.OrderWhereInput[] = [tabWhere(sp.tab ?? "all")];
  if (sp.q) { const q = sp.q.trim(); and.push({ OR: [{ orderNumber: { contains: q, mode: "insensitive" } }, { customerPhone: { contains: q } }, { customerName: { contains: q, mode: "insensitive" } }, { trackingNumber: { contains: q } }] }); }
  if (sp.from) and.push({ createdAt: { gte: new Date(sp.from) } });
  if (sp.to) and.push({ createdAt: { lt: new Date(new Date(sp.to).getTime() + 86400e3) } });
  if (sp.pm) and.push({ paymentMethod: sp.pm as never });
  if (sp.ps) and.push({ paymentStatus: sp.ps as never });
  if (sp.district) and.push({ district: sp.district });
  if (sp.courier) and.push({ courier: sp.courier });
  if (sp.tag) and.push({ tags: { has: sp.tag } });
  if (sp.source) and.push({ source: sp.source as never });
  return { AND: and };
}
