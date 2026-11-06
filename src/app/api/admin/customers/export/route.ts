import { db } from "@/lib/db";
import { audit, getAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/format";

export async function GET() {
  const a = await getAdmin();
  if (!a?.permissions.includes("customers.view")) return new Response("Forbidden", { status: 403 });
  const rows = await db.customer.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { orders: true } } } });
  const csv = toCsv(rows.map((c) => ({ name: c.name, phone: c.phone, email: c.email ?? "", orders: c._count.orders, delivered_spend: c.totalSpent, risk: c.riskScore, blocked: c.isBlocked, tags: c.tags.join(";"), since: c.createdAt.toISOString() })));
  await audit(a, "export", "customer", null, { count: rows.length });
  return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="argon-customers.csv"` } });
}
