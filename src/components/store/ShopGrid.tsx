"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { CardProduct, SortKey } from "@/lib/catalog";
import { ProductCard } from "./ProductCard";

type L = Record<"filters" | "sort" | "featured" | "newest" | "priceAsc" | "priceDesc" | "bestselling" | "loadMore" | "inStock" | "price" | "finish" | "category" | "all" | "applyFilters" | "clear" | "noResults" | "add" | "soldOut" | "onlyLeft" | "rings" | "chains" | "bracelets" | "eyewear", string>;
const PAGE = 12;
const FINISHES = ["silver", "black", "two-tone", "gold-tone"];

export function ShopGrid({ products, locale, labels, showCategory }: { products: CardProduct[]; locale: "en" | "bn"; labels: L; showCategory: boolean }) {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const [sheet, setSheet] = useState(false);
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);

  const sort = (sp.get("sort") as SortKey) || "featured";
  const cat = sp.get("cat") || "";
  const finish = sp.get("finish") || "";
  const inStock = sp.get("stock") === "1";
  const max = Number(sp.get("max") || 0);
  const priceCeil = Math.max(1000, ...products.map((p) => p.price));

  const set = (k: string, v: string) => {
    const q = new URLSearchParams(sp.toString());
    if (v) q.set(k, v); else q.delete(k);
    router.replace(`${path}${q.size ? `?${q}` : ""}`, { scroll: false });
    setLimit(PAGE);
  };

  const items = useMemo(() => {
    let a = products.filter((p) => (!cat || p.category === cat) && (!finish || p.finish.includes(finish)) && (!inStock || p.stock > 0) && (!max || p.price <= max));
    const by: Record<SortKey, (x: CardProduct, y: CardProduct) => number> = {
      featured: (x, y) => Number(y.featured) - Number(x.featured) || x.sortOrder - y.sortOrder,
      newest: (x, y) => y.createdAt.localeCompare(x.createdAt),
      "price-asc": (x, y) => x.price - y.price,
      "price-desc": (x, y) => y.price - x.price,
      bestselling: (x, y) => y.soldCount - x.soldCount || Number(y.badges.includes("BESTSELLER")) - Number(x.badges.includes("BESTSELLER")),
    };
    a = [...a].sort(by[sort] ?? by.featured);
    return a;
  }, [products, cat, finish, inStock, max, sort]);

  // Infinite scroll, with the "Load more" button as the fallback.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setLimit((l) => l + PAGE), { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [items.length]);

  const filters = (
    <div className="space-y-6">
      {showCategory && (
        <fieldset><legend className="eyebrow mb-3">{labels.category}</legend>
          <div className="flex flex-wrap gap-2">
            {["", "rings", "chains", "bracelets", "eyewear"].map((c) => (
              <button key={c} className="pill" aria-pressed={cat === c} onClick={() => set("cat", c)}>{c ? labels[c as "rings"] : labels.all}</button>
            ))}
          </div>
        </fieldset>
      )}
      <fieldset><legend className="eyebrow mb-3">{labels.finish}</legend>
        <div className="flex flex-wrap gap-2">
          {FINISHES.map((f) => <button key={f} className="pill capitalize" aria-pressed={finish === f} onClick={() => set("finish", finish === f ? "" : f)}>{f}</button>)}
        </div>
      </fieldset>
      <fieldset><legend className="eyebrow mb-3">{labels.price}: ≤ ৳{(max || priceCeil).toLocaleString("en-IN")}</legend>
        <input type="range" min={200} max={priceCeil} step={50} value={max || priceCeil} onChange={(e) => set("max", e.target.value === String(priceCeil) ? "" : e.target.value)} className="w-full accent-[var(--fg)]" aria-label={labels.price} />
      </fieldset>
      <label className="flex items-center gap-3 text-[14px]">
        <input type="checkbox" checked={inStock} onChange={(e) => set("stock", e.target.checked ? "1" : "")} className="h-5 w-5 accent-[var(--fg)]" /> {labels.inStock}
      </label>
    </div>
  );

  return (
    <div className="md:grid md:grid-cols-12 md:gap-8">
      <aside className="hidden md:col-span-3 md:block" aria-label={labels.filters}>{filters}</aside>
      <div className="md:col-span-9">
        <div className="mb-5 flex items-center justify-between gap-3">
          <button className="pill md:hidden" onClick={() => setSheet(true)}>{labels.filters}{(cat || finish || inStock || max) ? " •" : ""}</button>
          <p className="tnum hidden text-[13px] text-[var(--muted)] md:block">{items.length} items</p>
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-[var(--muted)]">{labels.sort}</span>
            <select value={sort} onChange={(e) => set("sort", e.target.value === "featured" ? "" : e.target.value)} className="input !min-h-10 !w-auto !py-1 !text-[14px]">
              <option value="featured">{labels.featured}</option><option value="newest">{labels.newest}</option>
              <option value="price-asc">{labels.priceAsc}</option><option value="price-desc">{labels.priceDesc}</option><option value="bestselling">{labels.bestselling}</option>
            </select>
          </label>
        </div>
        {items.length === 0 ? <p className="py-20 text-center text-[var(--muted)]">{labels.noResults}</p> : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 md:gap-x-5 xl:grid-cols-4">
            {items.slice(0, limit).map((p, i) => <ProductCard key={p.id} p={p} locale={locale} priority={i < 2} labels={{ add: labels.add, soldOut: labels.soldOut, onlyLeft: labels.onlyLeft }} />)}
          </div>
        )}
        {limit < items.length && (
          <div ref={sentinel} className="mt-10 text-center"><button className="btn btn-ghost" onClick={() => setLimit((l) => l + PAGE)}>{labels.loadMore}</button></div>
        )}
      </div>
      {sheet && (
        <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label={labels.filters}>
          <button className="absolute inset-0 bg-black/60" aria-label="Close" onClick={() => setSheet(false)} />
          <div className="animate-rise absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-[var(--line)] bg-[var(--bg)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[var(--line)]" />
            {filters}
            <div className="mt-6 flex gap-3">
              <button className="btn btn-ghost flex-1" onClick={() => router.replace(path, { scroll: false })}>{labels.clear}</button>
              <button className="btn btn-primary flex-1" onClick={() => setSheet(false)}>{labels.applyFilters} ({items.length})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => <div key={i}><div className="skeleton aspect-square rounded-[var(--radius-card)]" /><div className="skeleton mt-3 h-4 w-2/3 rounded" /></div>)}
    </div>
  );
}
