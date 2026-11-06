import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import blur from "@/data/blur.json";
import type { Locale } from "./i18n";

const blurMap = blur as Record<string, string>;
export const blurFor = (url: string) => blurMap[url];

const productInclude = {
  images: { orderBy: { position: "asc" } },
  variants: { orderBy: { position: "asc" } },
  options: { orderBy: { position: "asc" } },
} satisfies Prisma.ProductInclude;
type ProductFull = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

export type CardProduct = {
  id: string; slug: string; title: string; titleBn: string | null; category: string; badges: string[]; tags: string[];
  images: { url: string; alt: string; blur?: string }[];
  price: number; compareAtPrice: number | null; stock: number; hasVariants: boolean; defaultVariantId: string;
  finish: string[]; createdAt: string; soldCount: number; featured: boolean; sortOrder: number;
};
export type VariantLite = { id: string; sku: string; title: string; optionValues: Record<string, string>; price: number; compareAtPrice: number | null; stock: number };
export type FullProduct = CardProduct & {
  description: string; descriptionBn: string | null; material: string; seoTitle: string | null; seoDescription: string | null; model3dUrl: string | null;
  options: { name: string; values: string[] }[]; variants: VariantLite[];
};

function toCard(p: ProductFull): CardProduct {
  const v = p.variants;
  const inStock = v.filter((x) => x.stock > 0);
  const cheapest = (inStock.length ? inStock : v).reduce((a, b) => (b.price < a.price ? b : a), v[0]);
  const finishes = new Set<string>();
  for (const x of v) {
    const ov = x.optionValues as Record<string, string>;
    const c = ov.Colour || ov.Color;
    if (c) finishes.add(c.toLowerCase());
  }
  for (const tag of p.tags) if (tag.startsWith("finish:")) finishes.add(tag.slice(7));
  return {
    id: p.id, slug: p.slug, title: p.title, titleBn: p.titleBn, category: p.category, badges: p.badges, tags: p.tags,
    images: p.images.map((i) => ({ url: i.url, alt: i.alt || p.title, blur: i.blurData ?? blurMap[i.url] })),
    price: cheapest?.price ?? 0, compareAtPrice: cheapest?.compareAtPrice ?? null,
    stock: v.reduce((s, x) => s + Math.max(0, x.stock), 0), hasVariants: v.length > 1, defaultVariantId: cheapest?.id ?? "",
    finish: [...finishes], createdAt: p.createdAt.toISOString(), soldCount: p.soldCount, featured: p.featured, sortOrder: p.sortOrder,
  };
}
function toFull(p: ProductFull): FullProduct {
  return {
    ...toCard(p), description: p.description, descriptionBn: p.descriptionBn, material: p.material, seoTitle: p.seoTitle,
    seoDescription: p.seoDescription, model3dUrl: p.model3dUrl,
    options: p.options.map((o) => ({ name: o.name, values: o.values })),
    variants: p.variants.map((x) => ({ id: x.id, sku: x.sku, title: x.title, optionValues: x.optionValues as Record<string, string>, price: x.price, compareAtPrice: x.compareAtPrice, stock: x.stock })),
  };
}

const visible = (): Prisma.ProductWhereInput => ({ status: "active", OR: [{ publishAt: null }, { publishAt: { lte: new Date() } }] });

export const getAllProducts = unstable_cache(
  async (): Promise<CardProduct[]> => {
    const rows = await db.product.findMany({ where: visible(), include: productInclude, orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
    return rows.filter((p) => p.variants.length).map(toCard);
  },
  ["all-products"], { tags: ["catalog"], revalidate: 600 },
);

export const getProductBySlug = unstable_cache(
  async (slug: string): Promise<FullProduct | null> => {
    const p = await db.product.findFirst({ where: { slug, ...visible() }, include: productInclude });
    return p && p.variants.length ? toFull(p) : null;
  },
  ["product-by-slug"], { tags: ["catalog"], revalidate: 600 },
);

export const getCollection = unstable_cache(
  async (slug: string) => {
    const c = await db.collection.findUnique({ where: { slug }, include: { products: { orderBy: { position: "asc" } } } });
    if (!c) return null;
    const all = await getAllProducts();
    let items: CardProduct[];
    if (c.type === "automated" && Array.isArray(c.rules)) {
      const rules = c.rules as { field: string; value: string }[];
      items = all.filter((p) => rules.every((r) => (r.field === "tag" ? p.tags.includes(r.value) || p.badges.includes(r.value.toUpperCase()) : r.field === "category" ? p.category === r.value : r.field === "price_lte" ? p.price <= Number(r.value) : true)));
    } else {
      const order = new Map(c.products.map((cp) => [cp.productId, cp.position]));
      items = all.filter((p) => order.has(p.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    }
    return { title: c.title, titleBn: c.titleBn, slug: c.slug, description: c.description, items };
  },
  ["collection"], { tags: ["catalog"], revalidate: 600 },
);

export const getApprovedReviews = unstable_cache(
  async (productId?: string, take = 20) => {
    const where: Prisma.ReviewWhereInput = { status: "approved", ...(productId ? { productId } : {}) };
    const [rows, agg] = await Promise.all([
      db.review.findMany({ where, orderBy: { createdAt: "desc" }, take, include: { product: { select: { title: true, slug: true } } } }),
      db.review.aggregate({ where, _avg: { rating: true }, _count: true }),
    ]);
    return {
      avg: agg._avg.rating ?? 0, count: agg._count,
      items: rows.map((r) => ({ id: r.id, name: r.name, rating: r.rating, text: r.text, photos: r.photos, verified: r.verified, reply: r.reply, createdAt: r.createdAt.toISOString(), product: r.product })),
    };
  },
  ["reviews"], { tags: ["reviews"], revalidate: 600 },
);

export const getShippingZones = unstable_cache(
  async () => db.shippingZone.findMany({ orderBy: { position: "asc" } }),
  ["zones"], { tags: ["shipping"], revalidate: 3600 },
);

export const getHomeSections = unstable_cache(
  async () => db.homeSection.findMany({ orderBy: { position: "asc" } }),
  ["home-sections"], { tags: ["content"], revalidate: 3600 },
);

export const getPage = unstable_cache(
  async (slug: string) => db.page.findFirst({ where: { slug, published: true } }),
  ["page"], { tags: ["content"], revalidate: 3600 },
);

export function localTitle(p: { title: string; titleBn?: string | null }, locale: Locale) {
  return locale === "bn" && p.titleBn ? p.titleBn : p.title;
}

export type SortKey = "featured" | "newest" | "price-asc" | "price-desc" | "bestselling";
export function sortProducts(items: CardProduct[], sort: SortKey) {
  const a = [...items];
  switch (sort) {
    case "newest": return a.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    case "price-asc": return a.sort((x, y) => x.price - y.price);
    case "price-desc": return a.sort((x, y) => y.price - x.price);
    case "bestselling": return a.sort((x, y) => y.soldCount - x.soldCount || Number(y.badges.includes("BESTSELLER")) - Number(x.badges.includes("BESTSELLER")));
    default: return a.sort((x, y) => Number(y.featured) - Number(x.featured) || x.sortOrder - y.sortOrder);
  }
}
