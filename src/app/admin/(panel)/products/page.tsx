import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, can } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import { ProductsTable } from "@/components/admin/ProductsTable";
import { CsvImport } from "@/components/admin/CsvImport";

export const metadata = { title: "Products" };

export default async function Products({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string }> }) {
  const admin = await requireAdmin("products.view");
  const sp = await searchParams;
  const where: Prisma.ProductWhereInput = {
    ...(sp.q ? { OR: [{ title: { contains: sp.q, mode: "insensitive" } }, { variants: { some: { sku: { contains: sp.q, mode: "insensitive" } } } }, { tags: { has: sp.q } }] } : {}),
    ...(sp.status ? { status: sp.status as "active" } : {}), ...(sp.category ? { category: sp.category } : {}),
  };
  const products = await db.product.findMany({ where, include: { images: { take: 1, orderBy: { position: "asc" } }, variants: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }], take: 500 });
  return (
    <>
      <PageHeader title="Products">
        <a className="btn btn-ghost" href="/api/admin/products/export">Export CSV</a>
        {can(admin, "products.edit") && <CsvImport />}
        {can(admin, "products.edit") && <Link href="/admin/products/new" className="btn btn-primary">+ Add product</Link>}
      </PageHeader>
      <form className="card card-b mb-3 flex flex-wrap gap-2" method="get">
        <input name="q" defaultValue={sp.q} placeholder="Search title, SKU or tag" className="input !w-64" />
        <select name="status" defaultValue={sp.status} className="input !w-auto"><option value="">All statuses</option><option>active</option><option>draft</option><option>archived</option></select>
        <select name="category" defaultValue={sp.category} className="input !w-auto"><option value="">All categories</option>{["rings", "chains", "bracelets", "eyewear"].map((c) => <option key={c}>{c}</option>)}</select>
        <button className="btn btn-ghost">Filter</button>
      </form>
      <div className="card overflow-hidden">
        <ProductsTable canEdit={can(admin, "products.edit")} rows={products.map((p) => ({
          id: p.id, title: p.title, slug: p.slug, image: p.images[0]?.url ?? "", status: p.status, category: p.category, tags: p.tags,
          stock: p.variants.reduce((s, v) => s + v.stock, 0), variants: p.variants.length,
          price: p.variants.length ? Math.min(...p.variants.map((v) => v.price)) : 0, sold: p.soldCount,
        }))} />
      </div>
    </>
  );
}
