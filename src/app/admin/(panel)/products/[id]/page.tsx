import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, can } from "@/lib/auth";
import { PageHeader, Chip } from "@/components/admin/ui";
import { ProductEditor } from "@/components/admin/ProductEditor";
import type { ProductPayload } from "../actions";
import { duplicateProduct } from "../actions";

export const metadata = { title: "Product" };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin("products.view");
  const { id } = await params;
  const collections = await db.collection.findMany({ where: { type: "manual" }, select: { id: true, title: true }, orderBy: { title: "asc" } });
  let initial: ProductPayload;
  let baseSku = `ARG-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  if (id === "new") {
    initial = { id: null, title: "", titleBn: null, slug: "", description: "<p></p>", descriptionBn: null, category: "rings", tags: [], badges: ["LIMITED STOCK", "NEW"], material: "316L Stainless Steel", status: "draft", featured: false, seoTitle: null, seoDescription: null, publishAt: null, model3dUrl: null, images: [], options: [], collectionIds: [],
      variants: [{ sku: baseSku, title: "Default", optionValues: {}, price: 0, compareAtPrice: null, costPrice: null, stock: 0, lowStockThreshold: 3, weightGrams: 50, barcode: null, imageUrl: null }] };
  } else {
    const p = await db.product.findUnique({ where: { id }, include: { images: { orderBy: { position: "asc" } }, options: { orderBy: { position: "asc" } }, variants: { orderBy: { position: "asc" } }, collections: true } });
    if (!p) notFound();
    baseSku = p.variants[0]?.sku.split("-").slice(0, 2).join("-") ?? baseSku;
    const imgUrl = (imageId: string | null) => p.images.find((i) => i.id === imageId)?.url ?? null;
    initial = {
      id: p.id, title: p.title, titleBn: p.titleBn, slug: p.slug, description: p.description, descriptionBn: p.descriptionBn, category: p.category as "rings", tags: p.tags, badges: p.badges, material: p.material,
      status: p.status, featured: p.featured, seoTitle: p.seoTitle, seoDescription: p.seoDescription, publishAt: p.publishAt ? new Date(p.publishAt.getTime() + 6 * 3600e3).toISOString().slice(0, 16) : null, model3dUrl: p.model3dUrl,
      images: p.images.map((i) => ({ url: i.url, alt: i.alt, blurData: i.blurData })), options: p.options.map((o) => ({ name: o.name, values: o.values })), collectionIds: p.collections.map((c) => c.collectionId),
      variants: p.variants.map((v) => ({ id: v.id, sku: v.sku, title: v.title, optionValues: v.optionValues as Record<string, string>, price: v.price, compareAtPrice: v.compareAtPrice, costPrice: v.costPrice, stock: v.stock, lowStockThreshold: v.lowStockThreshold, weightGrams: v.weightGrams, barcode: v.barcode, imageUrl: imgUrl(v.imageId) })),
    };
  }
  return (
    <>
      <PageHeader back="/admin/products" title={initial.title || "New product"}>
        {initial.id && <Chip v={initial.status} />}
        {initial.id && can(admin, "products.edit") && <form action={duplicateProduct}><input type="hidden" name="id" value={initial.id} /><button className="btn btn-ghost">Duplicate</button></form>}
      </PageHeader>
      <ProductEditor initial={initial} collections={collections} baseSku={baseSku} />
    </>
  );
}
