import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  const a = await getAdmin();
  if (!a) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ hits: [] });
  const ci = { contains: q, mode: "insensitive" as const };
  const [orders, products, customers] = await Promise.all([
    a.permissions.includes("orders.view") ? db.order.findMany({ where: { OR: [{ orderNumber: ci }, { customerPhone: { contains: q } }, { customerName: ci }] }, take: 6, orderBy: { createdAt: "desc" } }) : [],
    a.permissions.includes("products.view") ? db.product.findMany({ where: { OR: [{ title: ci }, { variants: { some: { sku: ci } } }] }, take: 6 }) : [],
    a.permissions.includes("customers.view") ? db.customer.findMany({ where: { OR: [{ name: ci }, { phone: { contains: q } }, { email: ci }] }, take: 6 }) : [],
  ]);
  return NextResponse.json({
    hits: [
      ...orders.map((o) => ({ type: "Order", label: `${o.orderNumber} · ${o.customerName}`, sub: `৳${o.total}`, href: `/admin/orders/${o.id}` })),
      ...products.map((p) => ({ type: "Product", label: p.title, sub: p.status, href: `/admin/products/${p.id}` })),
      ...customers.map((c) => ({ type: "Customer", label: c.name, sub: c.phone, href: `/admin/customers/${c.id}` })),
    ],
  });
}
