import { db } from "@/lib/db";
import { audit, getAdmin } from "@/lib/auth";
import { orderWhere, type LineSnapshot, type AddressSnapshot, type OrderFilter } from "@/lib/orders";
import { toCsv } from "@/lib/format";

export async function GET(req: Request) {
  const a = await getAdmin();
  if (!a?.permissions.includes("orders.export")) return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams) as OrderFilter;
  const where = sp.ids ? { id: { in: sp.ids.split(",").slice(0, 1000) } } : orderWhere(sp);
  const orders = await db.order.findMany({ where, orderBy: { createdAt: "desc" }, take: 5000 });
  const csv = toCsv(orders.map((o) => {
    const ad = o.shippingAddress as AddressSnapshot;
    return {
      order: o.orderNumber, date: o.createdAt.toISOString(), customer: o.customerName, phone: o.customerPhone, email: o.customerEmail ?? "",
      address: ad.address, area: ad.area, district: o.district, zone: o.zone,
      items: (o.lineItems as LineSnapshot[]).map((l) => `${l.sku} x${l.qty}`).join(" | "),
      subtotal: o.subtotal, discount: o.discountTotal, shipping: o.shippingTotal, total: o.total, paid: o.amountPaid, cod_due: Math.max(0, o.total - o.amountPaid),
      payment_method: o.paymentMethod, payment_status: o.paymentStatus, fulfillment: o.fulfillmentStatus, status: o.orderStatus,
      courier: o.courier ?? "", tracking: o.trackingNumber ?? "", source: o.source, tags: o.tags.join(";"), discount_code: o.discountCode ?? "",
      utm_source: o.utmSource ?? "", utm_medium: o.utmMedium ?? "", utm_campaign: o.utmCampaign ?? "", note: o.note ?? "",
    };
  }));
  await audit(a, "export", "order", null, { count: orders.length });
  return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="argon-orders-${new Date().toISOString().slice(0, 10)}.csv"` } });
}
