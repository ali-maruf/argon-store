import { Suspense } from "react";
import type { CardProduct } from "@/lib/catalog";
import { getDict, type Locale } from "@/lib/i18n";
import { ShopGrid, GridSkeleton } from "./ShopGrid";

export function CollectionView({ locale, title, eyebrow, description, products, showCategory }: { locale: Locale; title: string; eyebrow: string; description?: string; products: CardProduct[]; showCategory: boolean }) {
  const d = getDict(locale);
  const labels = {
    filters: d.filters, sort: d.sort, featured: d.featured, newest: d.newest, priceAsc: d.priceAsc, priceDesc: d.priceDesc, bestselling: d.bestselling,
    loadMore: d.loadMore, inStock: d.inStock, price: d.price, finish: d.finish, category: d.category, all: d.all, applyFilters: d.applyFilters, clear: d.clear,
    noResults: d.noResults, add: d.add, soldOut: d.soldOut, onlyLeft: d.onlyLeft, rings: d.rings, chains: d.chains, bracelets: d.bracelets, eyewear: d.eyewear,
  };
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-5xl md:text-6xl">{title}</h1>
      {description && <p className="mt-3 max-w-xl text-[var(--muted)]">{description}</p>}
      <div className="mt-8">
        <Suspense fallback={<GridSkeleton />}>
          <ShopGrid products={products} locale={locale} labels={labels} showCategory={showCategory} />
        </Suspense>
      </div>
    </div>
  );
}
