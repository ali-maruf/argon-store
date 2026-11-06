import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { DISTRICTS } from "@/lib/districts";
import { PageHeader } from "@/components/admin/ui";
import { ManualOrderForm } from "@/components/admin/ManualOrderForm";

export const metadata = { title: "Create order" };

export default async function NewOrder() {
  await requireAdmin("orders.create");
  const variants = await db.productVariant.findMany({ where: { product: { status: "active" } }, include: { product: { select: { title: true } } }, orderBy: [{ product: { sortOrder: "asc" } }, { position: "asc" }] });
  return (
    <>
      <PageHeader back="/admin/orders" title="Create order" />
      <ManualOrderForm districts={DISTRICTS} variants={variants.map((v) => ({ id: v.id, label: `${v.product.title}${v.title !== "Default" ? ` — ${v.title}` : ""}`, sku: v.sku, price: v.price, stock: v.stock }))} />
    </>
  );
}
