import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllProducts, getCollection } from "@/lib/catalog";
import { getDict, LOCALES, type Locale, type TKey } from "@/lib/i18n";
import { CollectionView } from "@/components/store/CollectionView";
import { db } from "@/lib/db";

export const revalidate = 600;
const CATS = ["rings", "chains", "bracelets", "eyewear"];
const EYEBROW: Record<string, string> = { rings: "Premium Rings", chains: "Chains & Pendants", bracelets: "Bracelets", eyewear: "Eyewear" };
const BANNER: Record<string, string> = { rings: "/editorial/25.webp", chains: "/editorial/7.webp", bracelets: "/editorial/12.webp", eyewear: "/editorial/4.webp", "y2k-edit": "/editorial/8.webp", bestsellers: "/editorial/3.webp" };

export async function generateStaticParams() {
  const cols = await db.collection.findMany({ select: { slug: true } }).catch(() => []);
  const slugs = [...CATS, ...cols.map((c) => c.slug)];
  return LOCALES.flatMap((locale) => slugs.map((category) => ({ locale, category })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; category: string }> }): Promise<Metadata> {
  const { category } = await params;
  const name = CATS.includes(category) ? category[0].toUpperCase() + category.slice(1) : (await getCollection(category))?.title ?? "Shop";
  return { title: `${name} — Stainless Steel`, description: `ARGON ${name.toLowerCase()} in 316L stainless steel. Cash on Delivery across Bangladesh.`, alternates: { canonical: `/shop/${category}` } };
}

export default async function Category({ params }: { params: Promise<{ locale: Locale; category: string }> }) {
  const { locale, category } = await params;
  const d = getDict(locale);
  if (CATS.includes(category)) {
    const products = (await getAllProducts()).filter((p) => p.category === category);
    return <CollectionView locale={locale} eyebrow={EYEBROW[category]} title={d[category as TKey]} products={products} showCategory={false} banner={BANNER[category]} />;
  }
  const c = await getCollection(category);
  if (!c) notFound();
  return <CollectionView locale={locale} eyebrow="✦ COLLECTION" title={locale === "bn" && c.titleBn ? c.titleBn : c.title} description={c.description} products={c.items} showCategory banner={BANNER[category] ?? "/editorial/19.webp"} />;
}
