"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { adminMutation, fdStr, fdInt } from "@/lib/admin";
import { appendTimeline, cancelOrder, createOrder, markDelivered, OrderError, tl, type AddressSnapshot, type LineSnapshot } from "@/lib/orders";
import { sendToCourier } from "@/lib/couriers";
import { notifyCustomer } from "@/lib/notify";
import { bkash } from "@/lib/payments";
import { isBdPhone, normalizePhone } from "@/lib/format";
import { DISTRICTS } from "@/lib/districts";
import { getSettingsFresh } from "@/lib/settings";
import { revalidateTag } from "next/cache";

export type BulkResult = { ok: number; failed: { orderNumber: string; error: string }[] };

export async function bulkOrders(ids: string[], action: "confirm" | "cancel" | "ship" | "courier" | "deliver", courierKey?: string): Promise<BulkResult> {
  ids = ids.slice(0, 200);
  return adminMutation("orders.edit", `bulk_${action}`, "order", null, async (admin) => {
    const res: BulkResult = { ok: 0, failed: [] };
    for (const id of ids) {
      const o = await db.order.findUnique({ where: { id } });
      if (!o) continue;
      try {
        if (action === "confirm") {
          if (o.orderStatus !== "new" && o.orderStatus !== "on_hold") throw new Error(`is ${o.orderStatus}`);
          const u = await appendTimeline(id, tl("status", "Order confirmed", admin.name), { orderStatus: "confirmed", fulfillmentStatus: o.fulfillmentStatus === "unfulfilled" ? "processing" : o.fulfillmentStatus });
          void notifyCustomer("order_confirmed", u).catch(() => {});
        } else if (action === "cancel") await cancelOrder(id, admin.name);
        else if (action === "ship") {
          if (o.orderStatus === "cancelled") throw new Error("is cancelled");
          await appendTimeline(id, tl("status", "Marked as shipped", admin.name), { fulfillmentStatus: "shipped", orderStatus: o.orderStatus === "new" ? "confirmed" : o.orderStatus });
        } else if (action === "courier") await sendToCourier(id, courierKey || (await getSettingsFresh()).couriers.default, admin.name);
        else if (action === "deliver") await markDelivered(id, admin.name);
        res.ok++;
      } catch (e) { res.failed.push({ orderNumber: o.orderNumber, error: e instanceof Error ? e.message : String(e) }); }
    }
    revalidatePath("/admin/orders");
    return res;
  }, { details: { ids, courierKey } });
}

export async function updateOrderStatus(fd: FormData) {
  const id = fdStr(fd, "id"); const field = fdStr(fd, "field"); const value = fdStr(fd, "value");
  await adminMutation("orders.edit", "order_status", "order", id, async (admin) => {
    const o = await db.order.findUniqueOrThrow({ where: { id } });
    if (field === "orderStatus" && value === "cancelled") return cancelOrder(id, admin.name, fdStr(fd, "reason") || "Cancelled by admin");
    if (field === "fulfillmentStatus" && value === "delivered") return markDelivered(id, admin.name);
    const allowed: Record<string, string[]> = {
      orderStatus: ["new", "confirmed", "on_hold", "completed"],
      fulfillmentStatus: ["unfulfilled", "processing", "shipped", "returned"],
      paymentStatus: ["pending", "paid", "partially_paid", "refunded", "failed"],
    };
    if (!allowed[field]?.includes(value)) throw new Error("Invalid status");
    const data: Prisma.OrderUpdateInput = { [field]: value };
    if (field === "paymentStatus" && value === "paid") data.amountPaid = o.total;
    if (field === "fulfillmentStatus" && value === "returned" && o.customerId) await db.customer.update({ where: { id: o.customerId }, data: { riskScore: { increment: 15 } } });
    const u = await appendTimeline(id, tl("status", `${field.replace("Status", " status")} → ${value.replace("_", " ")}`, admin.name), data);
    if (field === "orderStatus" && value === "confirmed") void notifyCustomer("order_confirmed", u).catch(() => {});
    return u;
  }, { details: { field, value } });
  revalidatePath(`/admin/orders/${id}`);
}

export async function logCall(fd: FormData) {
  const id = fdStr(fd, "id"); const outcome = fdStr(fd, "outcome");
  if (!["confirmed", "no_answer", "wrong_number", "cancelled", "call_later"].includes(outcome)) throw new Error("Invalid outcome");
  await adminMutation("orders.edit", "order_call", "order", id, async (admin) => {
    const o = await db.order.findUniqueOrThrow({ where: { id } });
    const data: Prisma.OrderUpdateInput = { callAttempts: { increment: 1 }, callOutcome: outcome };
    if (outcome === "confirmed") { data.orderStatus = "confirmed"; if (o.fulfillmentStatus === "unfulfilled") data.fulfillmentStatus = "processing"; }
    if (outcome === "wrong_number" || outcome === "no_answer") data.orderStatus = o.orderStatus === "new" ? "on_hold" : o.orderStatus;
    const u = await appendTimeline(id, tl("call", `Confirmation call #${o.callAttempts + 1}: ${outcome.replace("_", " ")}`, admin.name), data);
    if (outcome === "cancelled") await cancelOrder(id, admin.name, "Cancelled on confirmation call");
    if (outcome === "confirmed") void notifyCustomer("order_confirmed", u).catch(() => {});
  }, { details: { outcome } });
  revalidatePath(`/admin/orders/${id}`);
}

export async function addNote(fd: FormData) {
  const id = fdStr(fd, "id"); const note = fdStr(fd, "note").slice(0, 1000);
  if (!note) return;
  await adminMutation("orders.edit", "order_note", "order", id, async (admin) => appendTimeline(id, tl("note", note, admin.name)));
  revalidatePath(`/admin/orders/${id}`);
}

export async function setTags(fd: FormData) {
  const id = fdStr(fd, "id"); const tags = fdStr(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);
  await adminMutation("orders.edit", "order_tags", "order", id, async () => db.order.update({ where: { id }, data: { tags } }));
  revalidatePath(`/admin/orders/${id}`);
}

export async function sendOrderToCourier(fd: FormData) {
  const id = fdStr(fd, "id"); const c = fdStr(fd, "courier");
  try { await adminMutation("orders.edit", "send_to_courier", "order", id, async (admin) => sendToCourier(id, c, admin.name), { details: { courier: c } }); }
  catch (e) { redirect(`/admin/orders/${id}?e=${encodeURIComponent(e instanceof Error ? e.message : "Courier error")}`); }
  revalidatePath(`/admin/orders/${id}`);
}

export async function setTracking(fd: FormData) {
  const id = fdStr(fd, "id");
  await adminMutation("orders.edit", "set_tracking", "order", id, async (admin) => appendTimeline(id, tl("courier", `Tracking set: ${fdStr(fd, "courier")} ${fdStr(fd, "tracking")}`, admin.name), {
    courier: fdStr(fd, "courier") || "manual", trackingNumber: fdStr(fd, "tracking") || null, consignmentId: fdStr(fd, "tracking") || null, fulfillmentStatus: "shipped",
  }));
  revalidatePath(`/admin/orders/${id}`);
}

const AddrSchema = z.object({ name: z.string().min(2).max(80), phone: z.string().transform(normalizePhone).refine(isBdPhone), address: z.string().min(5).max(300), district: z.string().refine((d) => DISTRICTS.includes(d)), area: z.string().max(80) });
export async function editAddress(fd: FormData) {
  const id = fdStr(fd, "id");
  const a = AddrSchema.parse({ name: fdStr(fd, "name"), phone: fdStr(fd, "phone"), address: fdStr(fd, "address"), district: fdStr(fd, "district"), area: fdStr(fd, "area") });
  await adminMutation("orders.edit", "edit_address", "order", id, async (admin) => {
    const o = await db.order.findUniqueOrThrow({ where: { id } });
    if (["shipped", "delivered"].includes(o.fulfillmentStatus)) throw new Error("Already shipped");
    return appendTimeline(id, tl("edit", `Address updated: ${a.address}, ${a.area}, ${a.district}`, admin.name), { shippingAddress: a as unknown as Prisma.InputJsonValue, customerName: a.name, customerPhone: a.phone, district: a.district });
  }, { details: a });
  revalidatePath(`/admin/orders/${id}`);
}

/** Edit line quantities / remove lines before shipping. Stock is adjusted by the delta. */
export async function editLines(fd: FormData) {
  const id = fdStr(fd, "id");
  await adminMutation("orders.edit", "edit_lines", "order", id, async (admin) => {
    const o = await db.order.findUniqueOrThrow({ where: { id } });
    if (["shipped", "delivered", "cancelled"].includes(o.fulfillmentStatus)) throw new Error("Can't edit after shipping");
    const lines = o.lineItems as LineSnapshot[];
    const next: LineSnapshot[] = [];
    await db.$transaction(async (tx) => {
      for (const l of lines) {
        const q = Math.max(0, Math.min(50, fdInt(fd, `qty_${l.variantId}`, l.qty)));
        const delta = q - l.qty;
        if (delta > 0) {
          const r = await tx.productVariant.updateMany({ where: { id: l.variantId, stock: { gte: delta } }, data: { stock: { decrement: delta } } });
          if (r.count !== 1) throw new Error(`Not enough stock for ${l.title}`);
        } else if (delta < 0) await tx.productVariant.update({ where: { id: l.variantId }, data: { stock: { increment: -delta } } });
        if (delta) await tx.inventoryAdjustment.create({ data: { variantId: l.variantId, delta: -delta, reason: "order", orderId: id, note: `${o.orderNumber} edited`, adminId: admin.id } });
        if (q > 0) next.push({ ...l, qty: q });
      }
    });
    if (!next.length) throw new Error("An order needs at least one item — cancel it instead");
    const subtotal = next.reduce((s, l) => s + l.price * l.qty, 0);
    const shippingTotal = fdInt(fd, "shippingTotal", o.shippingTotal);
    const discountTotal = Math.min(subtotal, fdInt(fd, "discountTotal", o.discountTotal));
    revalidateTag("catalog");
    return appendTimeline(id, tl("edit", `Items edited · new total ৳${subtotal - discountTotal + shippingTotal}`, admin.name), {
      lineItems: next as unknown as Prisma.InputJsonValue, subtotal, shippingTotal, discountTotal, total: subtotal - discountTotal + shippingTotal,
    });
  });
  revalidatePath(`/admin/orders/${id}`);
}

export async function refund(fd: FormData) {
  const id = fdStr(fd, "id"); const amount = fdInt(fd, "amount"); const reason = fdStr(fd, "reason") || "Refund";
  await adminMutation("orders.edit", "refund", "order", id, async (admin) => {
    const o = await db.order.findUniqueOrThrow({ where: { id }, include: { payments: true } });
    if (amount <= 0 || amount > o.amountPaid) throw new Error("Refund must be between ৳1 and the amount paid");
    const p = o.payments.find((x) => x.status === "completed" && x.provider === "bkash");
    let via = "manual (cash / mobile transfer)";
    if (p && fd.get("gateway") === "on") { const r = await bkash.refund(p.id, amount, reason); if (r.transactionStatus !== "Completed") throw new Error(`bKash refund failed: ${r.statusMessage ?? "unknown"}`); via = `bKash refund ${r.refundTrxID}`; }
    await db.payment.create({ data: { orderId: id, provider: via.startsWith("bKash") ? "bkash" : "manual", amount: -amount, status: "refunded", transactionId: via } });
    const left = o.amountPaid - amount;
    return appendTimeline(id, tl("refund", `Refunded ৳${amount} via ${via} — ${reason}`, admin.name), { amountPaid: left, paymentStatus: left <= 0 ? "refunded" : "partially_paid" });
  }, { details: { amount, reason } });
  revalidatePath(`/admin/orders/${id}`);
}

export async function duplicateOrder(fd: FormData) {
  const id = fdStr(fd, "id");
  const o = await db.order.findUniqueOrThrow({ where: { id } });
  const a = o.shippingAddress as AddressSnapshot;
  const created = await adminMutation("orders.create", "duplicate_order", "order", id, async (admin) => createOrder({
    items: (o.lineItems as LineSnapshot[]).map((l) => ({ variantId: l.variantId, qty: l.qty })), name: a.name, phone: a.phone, email: o.customerEmail,
    address: a.address, district: a.district, area: a.area, paymentMethod: "cod", source: "manual", adminName: admin.name, note: `Duplicate of ${o.orderNumber}`,
  }));
  redirect(`/admin/orders/${created.id}`);
}

export async function blockCustomer(fd: FormData) {
  const phone = fdStr(fd, "phone"); const ip = fdStr(fd, "ip"); const id = fdStr(fd, "id");
  await adminMutation("customers.edit", "block", "customer", phone, async () => {
    await db.blocklist.upsert({ where: { type_value: { type: "phone", value: phone } }, create: { type: "phone", value: phone, reason: "Blocked from order" }, update: {} });
    if (ip && fd.get("blockIp") === "on") await db.blocklist.upsert({ where: { type_value: { type: "ip", value: ip } }, create: { type: "ip", value: ip, reason: `Order ${id}` }, update: {} });
    await db.customer.updateMany({ where: { phone }, data: { isBlocked: true } });
  });
  revalidatePath(`/admin/orders/${id}`);
}

const ManualSchema = z.object({
  items: z.array(z.object({ variantId: z.string(), qty: z.number().int().min(1).max(50) })).min(1),
  name: z.string().min(2), phone: z.string().transform(normalizePhone).refine(isBdPhone, "Invalid phone"), email: z.string().email().optional().or(z.literal("")),
  address: z.string().min(5), district: z.string().refine((d) => DISTRICTS.includes(d), "Pick a district"), area: z.string().default(""),
  paymentMethod: z.enum(["cod", "bkash", "nagad", "sslcommerz"]), paid: z.boolean(), source: z.enum(["manual", "whatsapp", "facebook", "instagram"]),
  code: z.string().optional(), note: z.string().optional(), shippingOverride: z.number().int().min(0).nullable(),
});
export async function createManualOrder(input: z.input<typeof ManualSchema>): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const p = ManualSchema.safeParse(input);
  if (!p.success) return { ok: false, error: p.error.issues[0].message };
  try {
    const o = await adminMutation("orders.create", "create_manual_order", "order", null, async (admin) => {
      const created = await createOrder({ ...p.data, email: p.data.email || null, code: p.data.code || null, adminName: admin.name });
      if (p.data.paid) await appendTimeline(created.id, tl("payment", `Marked paid (${p.data.paymentMethod}) at creation`, admin.name), { paymentStatus: "paid", amountPaid: created.total });
      return created;
    });
    return { ok: true, id: o.id };
  } catch (e) { return { ok: false, error: e instanceof OrderError || e instanceof Error ? e.message : "Failed" }; }
}

export async function saveView(fd: FormData) {
  const name = fdStr(fd, "name").slice(0, 40); const query = fdStr(fd, "query").slice(0, 500);
  if (!name) return;
  await adminMutation("orders.view", "save_view", "setting", "orderViews", async () => {
    const row = await db.setting.findUnique({ where: { key: "orderViews" } });
    const views = ((row?.value as { name: string; query: string }[]) ?? []).filter((v) => v.name !== name);
    views.push({ name, query });
    await db.setting.upsert({ where: { key: "orderViews" }, create: { key: "orderViews", value: views }, update: { value: views } });
  });
  revalidatePath("/admin/orders");
}
export async function deleteView(fd: FormData) {
  const name = fdStr(fd, "name");
  await adminMutation("orders.view", "delete_view", "setting", "orderViews", async () => {
    const row = await db.setting.findUnique({ where: { key: "orderViews" } });
    const views = ((row?.value as { name: string; query: string }[]) ?? []).filter((v) => v.name !== name);
    await db.setting.upsert({ where: { key: "orderViews" }, create: { key: "orderViews", value: views }, update: { value: views } });
  });
  revalidatePath("/admin/orders");
}
