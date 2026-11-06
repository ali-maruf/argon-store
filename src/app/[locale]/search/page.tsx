import type { Metadata } from "next";
import { getAllProducts } from "@/lib/catalog";
import { getDict, type Locale } from "@/lib/i18n";
import { CollectionView } from "@/components/store/CollectionView";

export const metadata: Metadata = { title: "Search", robots: { index: false } };

export default async function Search({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ q?: string }> }) {
  const { locale } = await params;
  const q = ((await searchParams).q ?? "").trim().toLowerCase().slice(0, 60);
  const d = getDict(locale);
  const terms = q.split(/\s+/).filter(Boolean);
  const products = (await getAllProducts()).filter((p) => {
    const hay = `${p.title} ${p.titleBn ?? ""} ${p.category} ${p.tags.join(" ")}`.toLowerCase();
    return terms.every((t) => hay.includes(t) || hay.includes(t.replace(/s$/, "")));
  });
  return <CollectionView locale={locale} eyebrow={d.search} title={`“${q}”`} products={products} showCategory />;
}
