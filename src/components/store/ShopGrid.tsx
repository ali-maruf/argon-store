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
        <fieldset><legend className="eyebrow mb-4">{labels.category}</legend>
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

  const active = [cat, finish, inStock ? "1" : "", max ? "1" : ""].filter(Boolean).length;
  return (
    <div>
      <div className="sticky top-[var(--header-h)] z-20 -mx-4 mb-8 flex items-center justify-between gap-3 border-y border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] px-4 py-3 backdrop-blur-xl md:-mx-10 md:px-10">
        <button className="flex min-h-10 items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.16em]" onClick={() => setSheet(true)}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
          {labels.filters}{active ? <span className="tnum grid h-5 min-w-5 place-items-center rounded-full bg-[var(--fg)] px-1 text-[10px] text-[var(--bg)]">{active}</span> : null}
        </button>
        <p className="tnum hidden text-[12px] uppercase tracking-[0.16em] text-[var(--muted)] md:block">{items.length} {locale === "bn" ? "পণ্য" : "products"}</p>
        <label className="flex items-center gap-2 text-[12px] uppercase tracking-[0.16em]">
          <span className="hidden text-[var(--muted)] sm:inline">{labels.sort}</span>
          <select value={sort} onChange={(e) => set("sort", e.target.value === "featured" ? "" : e.target.value)} className="cursor-pointer bg-transparent py-2 text-[12px] font-semibold uppercase tracking-[0.12em] outline-none" aria-label={labels.sort}>
            <option value="featured">{labels.featured}</option><option value="newest">{labels.newest}</option>
            <option value="price-asc">{labels.priceAsc}</option><option value="price-desc">{labels.priceDesc}</option><option value="bestselling">{labels.bestselling}</option>
          </select>
        </label>
      </div>
      {items.length === 0 ? <p className="py-24 text-center text-[var(--muted)]">{labels.noResults}</p> : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-12 md:grid-cols-3 md:gap-x-5 xl:grid-cols-4">
          {items.slice(0, limit).map((p, i) => <div key={p.id} data-reveal style={{ ["--i" as string]: i % 4 }}><ProductCard p={p} locale={locale} priority={i < 4} labels={{ add: labels.add, soldOut: labels.soldOut, onlyLeft: labels.onlyLeft }} /></div>)}
        </div>
      )}
      {limit < items.length && (
        <div ref={sentinel} className="mt-14 text-center"><button className="btn btn-ghost" onClick={() => setLimit((l) => l + PAGE)}>{labels.loadMore}</button></div>
      )}
      <div className={`fixed inset-0 z-[70] ${sheet ? "" : "pointer-events-none"}`} role="dialog" aria-modal="true" aria-label={labels.filters} aria-hidden={!sheet}>
        <button className={`absolute inset-0 bg-black/60 transition-opacity duration-500 ${sheet ? "opacity-100" : "opacity-0"}`} aria-label="Close" onClick={() => setSheet(false)} tabIndex={sheet ? 0 : -1} />
        <div className={`absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col bg-[var(--bg)] transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-[420px] md:border-l md:border-[var(--line)] ${sheet ? "translate-x-0 translate-y-0" : "translate-y-full md:translate-x-full md:translate-y-0"}`}>
          <div className="flex items-center justify-between border-b border-[var(--line)] px-6 py-5"><p className="text-[12px] font-semibold uppercase tracking-[0.16em]">{labels.filters}</p><button onClick={() => setSheet(false)} aria-label="Close" className="text-xl leading-none">✕</button></div>
          <div className="flex-1 overflow-y-auto px-6 py-6">{filters}</div>
          <div className="flex gap-3 border-t border-[var(--line)] px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            <button className="btn btn-ghost flex-1" onClick={() => router.replace(path, { scroll: false })}>{labels.clear}</button>
            <button className="btn btn-primary flex-1" onClick={() => setSheet(false)}>{labels.applyFilters} ({items.length})</button>
          </div>
        </div>
      </div>
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
