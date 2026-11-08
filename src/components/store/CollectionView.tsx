import Image from "next/image";
import { Suspense } from "react";
import type { CardProduct } from "@/lib/catalog";
import { getDict, type Locale } from "@/lib/i18n";
import { ShopGrid, GridSkeleton } from "./ShopGrid";

export function CollectionView({ locale, title, eyebrow, description, products, showCategory, banner }: {
  locale: Locale; title: string; eyebrow: string; description?: string; products: CardProduct[]; showCategory: boolean; banner?: string;
}) {
  const d = getDict(locale);
  const labels = {
    filters: d.filters, sort: d.sort, featured: d.featured, newest: d.newest, priceAsc: d.priceAsc, priceDesc: d.priceDesc, bestselling: d.bestselling,
    loadMore: d.loadMore, inStock: d.inStock, price: d.price, finish: d.finish, category: d.category, all: d.all, applyFilters: d.applyFilters, clear: d.clear,
    noResults: d.noResults, add: d.add, soldOut: d.soldOut, onlyLeft: d.onlyLeft, rings: d.rings, chains: d.chains, bracelets: d.bracelets, eyewear: d.eyewear,
  };
  return (
    <div>
      {banner ? (
        <header className="relative -mt-px h-[46svh] min-h-[340px] overflow-hidden bg-black text-white">
          <Image src={banner} alt="" fill priority sizes="100vw" className="object-cover" style={{ animation: "kenburns 14s var(--ease) both alternate infinite" }} />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/30" />
          <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1600px] px-4 pb-10 md:px-10 md:pb-14">
            <p className="fade-in mb-4 text-[11px] font-medium uppercase tracking-[0.32em] text-white/75" style={{ ["--d" as string]: ".1s" }}>{eyebrow} · {products.length} {locale === "bn" ? "পণ্য" : "pieces"}</p>
            <h1 className="display text-[clamp(3rem,9vw,8rem)]"><span className="line-mask"><span>{title}</span></span></h1>
            {description && <p className="fade-in mt-4 max-w-lg text-[15px] text-white/80" style={{ ["--d" as string]: ".5s" }}>{description}</p>}
          </div>
        </header>
      ) : (
        <header className="mx-auto max-w-[1600px] px-4 pb-6 pt-12 md:px-10 md:pt-16">
          <p className="eyebrow mb-4">{eyebrow} · {products.length} {locale === "bn" ? "পণ্য" : "pieces"}</p>
          <h1 className="display text-[clamp(3rem,9vw,8rem)]"><span className="line-mask"><span>{title}</span></span></h1>
          {description && <p className="mt-4 max-w-lg text-[var(--muted)]">{description}</p>}
        </header>
      )}
      <div className="mx-auto max-w-[1600px] px-4 pt-8 md:px-10 md:pt-10">
        <Suspense fallback={<GridSkeleton />}>
          <ShopGrid products={products} locale={locale} labels={labels} showCategory={showCategory} />
        </Suspense>
      </div>
    </div>
  );
}
