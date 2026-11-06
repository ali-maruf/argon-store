import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

export const revalidate = 3600;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, pages, cols] = await Promise.all([
    db.product.findMany({ where: { status: "active" }, select: { slug: true, updatedAt: true } }),
    db.page.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } }),
    db.collection.findMany({ select: { slug: true } }),
  ]).catch(() => [[], [], []] as const);
  const entry = (path: string, lastModified?: Date, priority = 0.6): MetadataRoute.Sitemap[number] => ({
    url: `${SITE}${path}`, lastModified, priority, alternates: { languages: { en: `${SITE}${path}`, bn: `${SITE}/bn${path === "/" ? "" : path}` } },
  });
  return [
    entry("/", new Date(), 1), entry("/shop", new Date(), 0.9),
    ...["rings", "chains", "bracelets", "eyewear", ...cols.map((c) => c.slug)].map((c) => entry(`/shop/${c}`, new Date(), 0.8)),
    ...products.map((p) => entry(`/product/${p.slug}`, p.updatedAt, 0.8)),
    ...pages.map((p) => entry(`/${p.slug}`, p.updatedAt, 0.3)), entry("/size-guide"),
  ];
}
