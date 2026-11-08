"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { CardProduct, VariantLite } from "@/lib/catalog";
import { cart } from "./cart-store";
import { SparkleBurst } from "./SparkleBurst";
import { Sparkle } from "./Logo";
import { IconClose } from "./Icons";

const tk = (n: number) => "৳" + n.toLocaleString("en-IN");

export function Badges({ badges, stock, urgency = 10, soldOutLabel = "Sold out" }: { badges: string[]; stock: number; urgency?: number; soldOutLabel?: string }) {
  if (stock <= 0) return <span className="badge badge-best">{soldOutLabel}</span>;
  return (
    <>
      {badges.includes("NEW") && <span className="badge badge-new">New</span>}
      {badges.includes("BESTSELLER") && <span className="badge badge-best">Bestseller</span>}
      {badges.includes("LIMITED STOCK") && stock <= urgency && <span className="badge badge-limited"><Sparkle className="h-2 w-2" /> Limited</span>}
    </>
  );
}

export function ProductCard({ p, locale, priority = false, labels, sizes = "(max-width:768px) 50vw, (max-width:1280px) 33vw, 25vw" }: {
  p: CardProduct; locale: "en" | "bn"; priority?: boolean; sizes?: string;
  labels: { add: string; soldOut: string; onlyLeft: string };
}) {
  const [burst, setBurst] = useState(0);
  const [sheet, setSheet] = useState<VariantLite[] | null>(null);
  const [busy, setBusy] = useState(false);
  const title = locale === "bn" && p.titleBn ? p.titleBn : p.title;
  const href = `${locale === "bn" ? "/bn" : ""}/product/${p.slug}`;

  const quickAdd = async () => {
    if (p.hasVariants) {
      setBusy(true);
      const r = await fetch(`/api/products/${p.slug}`).then((r) => r.json()).finally(() => setBusy(false));
      setSheet(r.variants);
      return;
    }
    add({ id: p.defaultVariantId, title: "Default", price: p.price, stock: p.stock } as VariantLite);
  };
  const add = (v: VariantLite) => {
    cart.add({ variantId: v.id, productId: p.id, slug: p.slug, title, variantTitle: v.title, price: v.price, image: p.images[0]?.url ?? "", maxQty: v.stock });
    setBurst((b) => b + 1); setSheet(null);
  };

  return (
    <div className="pcard group relative">
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--bg-2)]">
        <Link href={href} className="absolute inset-0" aria-label={title}>
          {p.images[0] && (
            <Image src={p.images[0].url} alt={p.images[0].alt} fill sizes={sizes} priority={priority}
              placeholder={p.images[0].blur ? "blur" : "empty"} blurDataURL={p.images[0].blur} className="img-a object-cover" />
          )}
          {p.images[1] && <Image src={p.images[1].url} alt="" fill sizes={sizes} loading="lazy" className="img-b object-cover" />}
        </Link>
        <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5"><Badges badges={p.badges} stock={p.stock} soldOutLabel={labels.soldOut} /></div>
        {p.stock > 0 && (
          <button onClick={quickAdd} disabled={busy}
            className="quick absolute inset-x-2 bottom-2 flex h-11 items-center justify-center gap-2 bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] text-[11px] font-semibold uppercase tracking-[0.16em] backdrop-blur-md transition-colors hover:bg-[var(--fg)] hover:text-[var(--bg)]"
            aria-label={`${labels.add} ${title}`}>
            {busy ? "…" : <>+ {locale === "bn" ? "দ্রুত যোগ" : "Quick add"}</>}
          </button>
        )}
        {burst > 0 && <SparkleBurst key={burst} />}
      </div>
      <Link href={href} className="mt-3.5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium uppercase tracking-[0.06em] md:text-[14px]">{title}</p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">{p.stock > 0 && p.stock <= 5 ? <span className="text-[var(--accent)]">{labels.onlyLeft.replace("{n}", String(p.stock))}</span> : p.hasVariants ? (locale === "bn" ? "একাধিক অপশন" : "Multiple options") : "316L steel"}</p>
        </div>
        <p className="tnum shrink-0 text-right text-[13px] md:text-[14px]">
          {tk(p.price)}
          {p.compareAtPrice && p.compareAtPrice > p.price && <s className="block text-[11px] text-[var(--muted)]">{tk(p.compareAtPrice)}</s>}
        </p>
      </Link>

      {sheet && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <button className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" aria-label="Close" onClick={() => setSheet(null)} />
          <div className="animate-rise relative w-full max-w-md border border-[var(--line)] bg-[var(--bg)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="flex items-start gap-4">
              {p.images[0] && <Image src={p.images[0].url} alt="" width={72} height={90} className="h-[90px] w-[72px] object-cover" />}
              <div className="flex-1"><p className="text-[14px] font-medium uppercase tracking-[0.06em]">{title}</p><p className="tnum mt-1 text-[var(--muted)]">{tk(p.price)}</p></div>
              <button onClick={() => setSheet(null)} aria-label="Close"><IconClose /></button>
            </div>
            <p className="eyebrow mb-3 mt-6">{locale === "bn" ? "অপশন বেছে নিন" : "Select option"}</p>
            <div className="flex flex-wrap gap-2">
              {sheet.map((v) => <button key={v.id} className="pill tnum" disabled={v.stock <= 0} onClick={() => add(v)}>{v.title}{sheet.some((x) => x.price !== v.price) ? ` · ${tk(v.price)}` : ""}</button>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
