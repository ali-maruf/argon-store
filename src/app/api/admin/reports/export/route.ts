import { getAdmin } from "@/lib/auth";
import { rangeFrom, salesReport } from "@/lib/reports";
import { toCsv } from "@/lib/format";

export async function GET(req: Request) {
  const a = await getAdmin();
  if (!a?.permissions.includes("reports.view")) return new Response("Forbidden", { status: 403 });
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const r = rangeFrom(sp);
  const rep = await salesReport(r.from, r.to);
  const rows: Record<string, unknown>[] =
    sp.kind === "products" ? rep.topProducts.map((p) => ({ product: p.title, category: p.category, units: p.qty, revenue: p.revenue, cost: p.cost, profit: p.revenue - p.cost }))
    : sp.kind === "categories" ? rep.byCategory.map(([category, revenue]) => ({ category, revenue }))
    : sp.kind === "districts" ? rep.byDistrict.map(([district, v]) => ({ district, ...v }))
    : sp.kind === "payments" ? rep.paymentMix.map(([method, v]) => ({ method, ...v }))
    : sp.kind === "couriers" ? rep.couriers.map(([courier, v]) => ({ courier, ...v }))
    : rep.byDay;
  return new Response("﻿" + toCsv(rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="argon-${sp.kind ?? "days"}-${r.key}.csv"` } });
}
