"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import sanitize from "sanitize-html";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { adminMutation } from "@/lib/admin";
import { storeImage, storeFile } from "@/lib/storage";
import { slugify } from "@/lib/format";

const clean = (html: string) => sanitize(html, { allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "h2", "h3", "a", "blockquote"], allowedAttributes: { a: ["href", "target", "rel"] } });

const VariantZ = z.object({
  id: z.string().optional(), sku: z.string().trim().min(2).max(60), title: z.string().max(120), optionValues: z.record(z.string()),
  price: z.number().int().min(0), compareAtPrice: z.number().int().min(0).nullable(), costPrice: z.number().int().min(0).nullable(),
  stock: z.number().int().min(-1000).max(100000), lowStockThreshold: z.number().int().min(0).max(1000), weightGrams: z.number().int().min(0).max(10000),
  barcode: z.string().max(60).nullable(), imageUrl: z.string().nullable(),
});
const ProductZ = z.object({
  id: z.string().nullable(), title: z.string().trim().min(2).max(140), titleBn: z.string().max(140).nullable(), slug: z.string().max(140),
  description: z.string().max(20000), descriptionBn: z.string().max(20000).nullable(), category: z.enum(["rings", "chains", "bracelets", "eyewear"]),
  tags: z.array(z.string().max(40)).max(30), badges: z.array(z.string().max(30)).max(6), material: z.string().max(80),
  status: z.enum(["draft", "active", "archived"]), featured: z.boolean(), seoTitle: z.string().max(80).nullable(), seoDescription: z.string().max(200).nullable(),
  publishAt: z.string().nullable(), model3dUrl: z.string().nullable(),
  images: z.array(z.object({ url: z.string().max(500), alt: z.string().max(200), blurData: z.string().max(4000).nullable() })).max(20),
  options: z.array(z.object({ name: z.string().trim().min(1).max(30), values: z.array(z.string().trim().min(1).max(40)).min(1).max(30) })).max(3),
  variants: z.array(VariantZ).min(1).max(200),
  collectionIds: z.array(z.string()).max(50),
});
export type ProductPayload = z.infer<typeof ProductZ>;

export async function saveProduct(raw: ProductPayload): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = ProductZ.safeParse(raw);
  if (!parsed.success) return { ok: false, error: `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}` };
  const p = parsed.data;
  const slug = slugify(p.slug || p.title);
  const skus = p.variants.map((v) => v.sku);
  if (new Set(skus).size !== skus.length) return { ok: false, error: "SKUs must be unique" };
  try {
    const id = await adminMutation("products.edit", p.id ? "update_product" : "create_product", "product", p.id, async (admin) => {
      const clash = await db.product.findFirst({ where: { slug, NOT: p.id ? { id: p.id } : undefined } });
      if (clash) throw new Error(`Slug "${slug}" is already used`);
      const skuClash = await db.productVariant.findFirst({ where: { sku: { in: skus }, NOT: p.id ? { productId: p.id } : undefined } });
      if (skuClash) throw new Error(`SKU ${skuClash.sku} belongs to another product`);
      const data = {
        title: p.title, titleBn: p.titleBn || null, slug, description: clean(p.description), descriptionBn: p.descriptionBn ? clean(p.descriptionBn) : null,
        category: p.category, tags: p.tags, badges: p.badges, material: p.material, status: p.status, featured: p.featured,
        seoTitle: p.seoTitle || null, seoDescription: p.seoDescription || null, publishAt: p.publishAt ? new Date(p.publishAt) : null, model3dUrl: p.model3dUrl || null,
      };
      return db.$transaction(async (tx) => {
        const prod = p.id ? await tx.product.update({ where: { id: p.id }, data }) : await tx.product.create({ data });
        await tx.productImage.deleteMany({ where: { productId: prod.id } });
        await tx.productImage.createMany({ data: p.images.map((im, i) => ({ productId: prod.id, url: im.url, alt: im.alt, blurData: im.blurData, position: i })) });
        const imgs = await tx.productImage.findMany({ where: { productId: prod.id } });
        await tx.productOption.deleteMany({ where: { productId: prod.id } });
        await tx.productOption.createMany({ data: p.options.map((o, i) => ({ productId: prod.id, name: o.name, values: o.values, position: i })) });
        const existing = await tx.productVariant.findMany({ where: { productId: prod.id } });
        await tx.productVariant.deleteMany({ where: { productId: prod.id, sku: { notIn: skus } } });
        for (const [i, v] of p.variants.entries()) {
          const prev = existing.find((e) => e.sku === v.sku);
          const vd = { title: v.title || "Default", optionValues: v.optionValues as Prisma.InputJsonValue, price: v.price, compareAtPrice: v.compareAtPrice, costPrice: v.costPrice, stock: v.stock, lowStockThreshold: v.lowStockThreshold, weightGrams: v.weightGrams, barcode: v.barcode, imageId: imgs.find((x) => x.url === v.imageUrl)?.id ?? null, position: i };
          const saved = await tx.productVariant.upsert({ where: { sku: v.sku }, create: { productId: prod.id, sku: v.sku, ...vd }, update: vd });
          const delta = v.stock - (prev?.stock ?? 0);
          if (delta) await tx.inventoryAdjustment.create({ data: { variantId: saved.id, delta, reason: prev ? "correction" : "received", note: "Product editor", adminId: admin.id } });
        }
        await tx.collectionProduct.deleteMany({ where: { productId: prod.id, collectionId: { notIn: p.collectionIds } } });
        for (const cid of p.collectionIds) await tx.collectionProduct.upsert({ where: { collectionId_productId: { collectionId: cid, productId: prod.id } }, create: { collectionId: cid, productId: prod.id, position: 999 }, update: {} });
        return prod.id;
      });
    }, { tags: ["catalog"], details: { title: p.title, status: p.status } });
    revalidatePath("/admin/products");
    return { ok: true, id };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Save failed" }; }
}

export async function uploadMedia(fd: FormData): Promise<{ ok: true; images: { url: string; alt: string; blurData: string }[]; model?: string } | { ok: false; error: string }> {
  try {
    return await adminMutation("products.edit", "upload_media", "media", null, async () => {
      const images: { url: string; alt: string; blurData: string }[] = [];
      for (const f of fd.getAll("files")) if (f instanceof File && f.size && f.type.startsWith("image/")) { const r = await storeImage(f); images.push({ url: r.url, alt: "", blurData: r.blurData }); }
      const m = fd.get("model");
      const model = m instanceof File && m.size ? await storeFile(m) : undefined;
      return { ok: true as const, images, model };
    });
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Upload failed" }; }
}

export async function duplicateProduct(fd: FormData) {
  const id = String(fd.get("id"));
  const newId = await adminMutation("products.edit", "duplicate_product", "product", id, async () => {
    const p = await db.product.findUniqueOrThrow({ where: { id }, include: { images: true, options: true, variants: true } });
    const suffix = Date.now().toString(36).slice(-4);
    const copy = await db.product.create({ data: {
      title: `${p.title} (copy)`, titleBn: p.titleBn, slug: `${p.slug}-copy-${suffix}`, description: p.description, descriptionBn: p.descriptionBn, category: p.category, tags: p.tags, badges: p.badges, material: p.material, status: "draft", seoTitle: p.seoTitle, seoDescription: p.seoDescription,
      images: { create: p.images.map((i) => ({ url: i.url, alt: i.alt, position: i.position, blurData: i.blurData })) },
      options: { create: p.options.map((o) => ({ name: o.name, values: o.values, position: o.position })) },
      variants: { create: p.variants.map((v) => ({ sku: `${v.sku}-${suffix}`.toUpperCase(), title: v.title, optionValues: v.optionValues as Prisma.InputJsonValue, price: v.price, compareAtPrice: v.compareAtPrice, costPrice: v.costPrice, stock: 0, lowStockThreshold: v.lowStockThreshold, weightGrams: v.weightGrams, position: v.position })) },
    } });
    return copy.id;
  });
  redirect(`/admin/products/${newId}`);
}

export async function bulkProducts(ids: string[], action: string, value: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await adminMutation("products.edit", `bulk_${action}`, "product", null, async (admin) => {
      if (action === "status") await db.product.updateMany({ where: { id: { in: ids } }, data: { status: z.enum(["draft", "active", "archived"]).parse(value) } });
      else if (action === "addTag" || action === "removeTag") {
        for (const p of await db.product.findMany({ where: { id: { in: ids } } })) {
          const tags = action === "addTag" ? [...new Set([...p.tags, value.trim()])] : p.tags.filter((t) => t !== value.trim());
          await db.product.update({ where: { id: p.id }, data: { tags } });
        }
      } else if (action === "price" || action === "priceAdjustPct") {
        const n = Number(value); if (!Number.isFinite(n)) throw new Error("Invalid number");
        for (const v of await db.productVariant.findMany({ where: { productId: { in: ids } } }))
          await db.productVariant.update({ where: { id: v.id }, data: { price: Math.max(0, Math.round(action === "price" ? n : v.price * (1 + n / 100))) } });
      } else if (action === "stock") {
        const n = Math.max(0, Math.round(Number(value)));
        for (const v of await db.productVariant.findMany({ where: { productId: { in: ids } } })) {
          if (v.stock === n) continue;
          await db.productVariant.update({ where: { id: v.id }, data: { stock: n } });
          await db.inventoryAdjustment.create({ data: { variantId: v.id, delta: n - v.stock, reason: "correction", note: "Bulk edit", adminId: admin.id } });
        }
      } else throw new Error("Unknown action");
    }, { tags: ["catalog"], details: { ids, value } });
    revalidatePath("/admin/products");
    return { ok: true };
  } catch (e) { return { ok: false, error: e instanceof Error ? e.message : "Failed" }; }
}

/** CSV import: one row per variant. Columns: handle,title,category,status,price,compare_at,cost,sku,stock,option1_name,option1_value,option2_name,option2_value,tags,image */
export async function importProductsCsv(fd: FormData): Promise<{ ok: boolean; message: string }> {
  const f = fd.get("file");
  if (!(f instanceof File)) return { ok: false, message: "Choose a CSV file" };
  const text = await f.text();
  const rows = parseCsv(text);
  const [head, ...data] = rows; if (!head) return { ok: false, message: "Empty file" };
  const ix = (k: string) => head.indexOf(k);
  let created = 0, updated = 0;
  try {
    await adminMutation("products.edit", "import_csv", "product", null, async (admin) => {
      for (const r of data) {
        const g = (k: string) => (ix(k) >= 0 ? (r[ix(k)] ?? "").trim() : "");
        const handle = slugify(g("handle") || g("title")); const sku = g("sku"); if (!handle || !sku) continue;
        let p = await db.product.findUnique({ where: { slug: handle } });
        if (!p) { p = await db.product.create({ data: { slug: handle, title: g("title") || handle, category: ["rings", "chains", "bracelets", "eyewear"].includes(g("category")) ? g("category") : "rings", status: (["draft", "active", "archived"].includes(g("status")) ? g("status") : "draft") as "draft", tags: g("tags").split(";").filter(Boolean) } }); created++; }
        const ov: Record<string, string> = {};
        if (g("option1_name")) ov[g("option1_name")] = g("option1_value");
        if (g("option2_name")) ov[g("option2_name")] = g("option2_value");
        const prev = await db.productVariant.findUnique({ where: { sku } });
        const vd = { productId: p.id, title: Object.values(ov).join(" / ") || "Default", optionValues: ov, price: Number(g("price")) || 0, compareAtPrice: Number(g("compare_at")) || null, costPrice: Number(g("cost")) || null, stock: Number(g("stock")) || 0 };
        const v = await db.productVariant.upsert({ where: { sku }, create: { sku, ...vd }, update: vd });
        if (prev) updated++;
        if (vd.stock !== (prev?.stock ?? 0)) await db.inventoryAdjustment.create({ data: { variantId: v.id, delta: vd.stock - (prev?.stock ?? 0), reason: "correction", note: "CSV import", adminId: admin.id } });
        if (g("image") && !(await db.productImage.findFirst({ where: { productId: p.id, url: g("image") } }))) await db.productImage.create({ data: { productId: p.id, url: g("image"), position: 99 } });
        for (const [name, val] of Object.entries(ov)) {
          const o = await db.productOption.findFirst({ where: { productId: p.id, name } });
          if (!o) await db.productOption.create({ data: { productId: p.id, name, values: [val] } });
          else if (!o.values.includes(val)) await db.productOption.update({ where: { id: o.id }, data: { values: [...o.values, val] } });
        }
      }
    }, { tags: ["catalog"] });
  } catch (e) { return { ok: false, message: e instanceof Error ? e.message : "Import failed" }; }
  revalidatePath("/admin/products");
  return { ok: true, message: `Imported: ${created} new products, ${updated} variants updated, ${data.length} rows read.` };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cur = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim())).map((r) => r.map((x) => x.replace(/^﻿/, "")));
}
