import type { Metadata } from "next";
import { getAllProducts } from "@/lib/catalog";
import { getDict, type Locale } from "@/lib/i18n";
import { CollectionView } from "@/components/store/CollectionView";

export const revalidate = 600;
export const metadata: Metadata = { title: "Shop all", description: "Rings, chains, bracelets and eyewear in 316L stainless steel. Cash on Delivery.", alternates: { canonical: "/shop" } };

export default async function Shop({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const d = getDict(locale);
  return <CollectionView locale={locale} eyebrow="✦ ARGON" title={d.shop} products={await getAllProducts()} showCategory />;
}
