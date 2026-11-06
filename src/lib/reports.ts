import "server-only";
import { db } from "./db";
import type { LineSnapshot } from "./orders";

export function rangeFrom(sp: { range?: string; from?: string; to?: string }) {
  const now = new Date();
  const dhakaMidnight = () => { const d = new Date(now.getTime() + 6 * 3600e3); d.setUTCHours(0, 0, 0, 0); return new Date(d.getTime() - 6 * 3600e3); };
  if (sp.range === "custom" && sp.from) return { from: new Date(sp.from), to: sp.to ? new Date(new Date(sp.to).getTime() + 86400e3) : now, key: "custom" };
  if (sp.range === "today") return { from: dhakaMidnight(), to: now, key: "today" };
  if (sp.range === "30d") return { from: new Date(now.getTime() - 30 * 86400e3), to: now, key: "30d" };
  if (sp.range === "90d") return { from: new Date(now.getTime() - 90 * 86400e3), to: now, key: "90d" };
  return { from: new Date(now.getTime() - 7 * 86400e3), to: now, key: "7d" };
}

export async function salesReport(from: Date, to: Date) {
  const orders = await db.order.findMany({ where: { createdAt: { gte: from, lt: to } }, select: { id: true, total: true, subtotal: true, discountTotal: true, shippingTotal: true, createdAt: true, paymentMethod: true, fulfillmentStatus: true, orderStatus: true, customerPhone: true, district: true, lineItems: true, courier: true, customerId: true } });
  const live = orders.filter((o) => o.orderStatus !== "cancelled");
  const sales = live.reduce((s, o) => s + o.total, 0);
  const visits = await db.analyticsEvent.count({ where: { type: "visit", createdAt: { gte: from, lt: to } } });
  const funnel = await db.analyticsEvent.groupBy({ by: ["type"], where: { createdAt: { gte: from, lt: to } }, _count: true });
  const fc = (t: string) => funnel.find((f) => f.type === t)?._count ?? 0;

  const phones = [...new Set(live.map((o) => o.customerPhone))];
  const prior = phones.length ? await db.order.groupBy({ by: ["customerPhone"], where: { customerPhone: { in: phones }, createdAt: { lt: from } }, _count: true }) : [];
  const returning = prior.length;

  const byDay = new Map<string, { sales: number; orders: number }>();
  for (let d = new Date(from); d < to; d = new Date(d.getTime() + 86400e3)) byDay.set(new Date(d.getTime() + 6 * 3600e3).toISOString().slice(0, 10), { sales: 0, orders: 0 });
  for (const o of live) { const k = new Date(o.createdAt.getTime() + 6 * 3600e3).toISOString().slice(0, 10); const e = byDay.get(k) ?? { sales: 0, orders: 0 }; e.sales += o.total; e.orders++; byDay.set(k, e); }

  const prod = new Map<string, { title: string; qty: number; revenue: number; cost: number; category?: string }>();
  for (const o of live) for (const l of o.lineItems as LineSnapshot[]) {
    const e = prod.get(l.productId) ?? { title: l.title, qty: 0, revenue: 0, cost: 0 };
    e.qty += l.qty; e.revenue += l.qty * l.price; e.cost += l.qty * (l.costPrice ?? 0); prod.set(l.productId, e);
  }
  const cats = await db.product.findMany({ where: { id: { in: [...prod.keys()] } }, select: { id: true, category: true } });
  for (const c of cats) { const e = prod.get(c.id); if (e) e.category = c.category; }
  const byCategory = new Map<string, number>();
  for (const e of prod.values()) byCategory.set(e.category ?? "other", (byCategory.get(e.category ?? "other") ?? 0) + e.revenue);
  const byDistrict = new Map<string, { orders: number; sales: number }>();
  for (const o of live) { const e = byDistrict.get(o.district) ?? { orders: 0, sales: 0 }; e.orders++; e.sales += o.total; byDistrict.set(o.district, e); }
  const pm = new Map<string, { orders: number; sales: number }>();
  for (const o of live) { const e = pm.get(o.paymentMethod) ?? { orders: 0, sales: 0 }; e.orders++; e.sales += o.total; pm.set(o.paymentMethod, e); }
  const couriers = new Map<string, { sent: number; delivered: number; returned: number }>();
  for (const o of orders) if (o.courier) { const e = couriers.get(o.courier) ?? { sent: 0, delivered: 0, returned: 0 }; e.sent++; if (o.fulfillmentStatus === "delivered") e.delivered++; if (o.fulfillmentStatus === "returned") e.returned++; couriers.set(o.courier, e); }
  const delivered = orders.filter((o) => o.fulfillmentStatus === "delivered").length;
  const returned = orders.filter((o) => o.fulfillmentStatus === "returned").length;
  const cod = live.filter((o) => o.paymentMethod === "cod").length;
  const abandoned = await db.abandonedCheckout.groupBy({ by: ["recovered"], where: { createdAt: { gte: from, lt: to } }, _count: true });
  const ab = (r: boolean) => abandoned.find((a) => a.recovered === r)?._count ?? 0;
  const revenueProducts = [...prod.values()].reduce((s, e) => s + e.revenue, 0);
  const cost = [...prod.values()].reduce((s, e) => s + e.cost, 0);

  return {
    sales, orders: live.length, cancelled: orders.length - live.length, aov: live.length ? sales / live.length : 0,
    conversion: visits ? live.length / visits : null, visits,
    returningPct: phones.length ? returning / phones.length : 0,
    codPct: live.length ? cod / live.length : 0, deliveredPct: delivered + returned ? delivered / (delivered + returned) : null, delivered, returned,
    byDay: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    topProducts: [...prod.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue),
    byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1]),
    byDistrict: [...byDistrict.entries()].sort((a, b) => b[1].sales - a[1].sales),
    paymentMix: [...pm.entries()],
    couriers: [...couriers.entries()],
    funnel: { visits: fc("visit"), productViews: fc("product_view"), addToCart: fc("add_to_cart"), checkout: fc("checkout_start"), orders: live.length },
    abandoned: { total: ab(true) + ab(false), recovered: ab(true) },
    profit: { revenue: revenueProducts, cost, gross: revenueProducts - cost, hasCost: cost > 0 },
  };
}
