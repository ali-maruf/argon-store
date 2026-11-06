import { db } from "@/lib/db";
import { audit, getAdmin } from "@/lib/auth";
import { toCsv } from "@/lib/format";

export async function GET() {
  const a = await getAdmin();
  if (!a?.permissions.includes("products.view")) return new Response("Forbidden", { status: 403 });
  const vs = await db.productVariant.findMany({ include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } } }, orderBy: [{ product: { sortOrder: "asc" } }, { position: "asc" }] });
  const csv = toCsv(vs.map((v) => {
    const ov = Object.entries(v.optionValues as Record<string, string>);
    return {
      handle: v.product.slug, title: v.product.title, category: v.product.category, status: v.product.status, price: v.price, compare_at: v.compareAtPrice ?? "", cost: v.costPrice ?? "",
      sku: v.sku, stock: v.stock, option1_name: ov[0]?.[0] ?? "", option1_value: ov[0]?.[1] ?? "", option2_name: ov[1]?.[0] ?? "", option2_value: ov[1]?.[1] ?? "",
      tags: v.product.tags.join(";"), image: v.product.images[0]?.url ?? "",
    };
  }));
  await audit(a, "export", "product", null, { count: vs.length });
  return new Response("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="argon-products.csv"` } });
}
