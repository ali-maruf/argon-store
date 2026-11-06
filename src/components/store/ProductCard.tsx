"use client";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { CardProduct, VariantLite } from "@/lib/catalog";
import { cart } from "./cart-store";
import { SparkleBurst } from "./SparkleBurst";
import { Sparkle } from "./Logo";

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

export function ProductCard({ p, locale, priority = false, labels }: {
  p: CardProduct; locale: "en" | "bn"; priority?: boolean;
  labels: { add: string; soldOut: string; onlyLeft: string };
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [burst, setBurst] = useState(0);
  const [sheet, setSheet] = useState<VariantLite[] | null>(null);
  const title = locale === "bn" && p.titleBn ? p.titleBn : p.title;
  const href = `${locale === "bn" ? "/bn" : ""}/product/${p.slug}`;

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current!; const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5; const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg)`;
    el.style.setProperty("--sx", `${(1 - (x + 0.5)) * 100}%`);
  };
  const reset = () => { if (ref.current) ref.current.style.transform = ""; };

  const quickAdd = async () => {
    if (p.hasVariants) {
      const r = await fetch(`/api/products/${p.slug}`).then((r) => r.json());
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
    <div className="group relative">
      <div ref={ref} onPointerMove={onMove} onPointerLeave={reset} className="card3d hairline glass relative overflow-hidden rounded-[var(--radius-card)]">
        <Link href={href} className="block" aria-label={title}>
          <div className="relative aspect-square overflow-hidden">
            {p.images[0] && (
              <Image src={p.images[0].url} alt={p.images[0].alt} fill sizes="(max-width:768px) 50vw, (max-width:1200px) 33vw, 300px" priority={priority}
                placeholder={p.images[0].blur ? "blur" : "empty"} blurDataURL={p.images[0].blur} className="scale-[1.12] object-cover" />
            )}
            {p.images[1] && (
              <Image src={p.images[1].url} alt="" fill sizes="(max-width:768px) 50vw, 300px" loading="lazy" className="img-alt scale-[1.12] object-cover opacity-0 transition-opacity duration-300" />
            )}
            <div className="sheen" />
          </div>
        </Link>
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap gap-1.5"><Badges badges={p.badges} stock={p.stock} soldOutLabel={labels.soldOut} /></div>
        {p.stock > 0 && (
          <button onClick={quickAdd} className="absolute bottom-2.5 right-2.5 grid h-10 min-w-10 place-items-center rounded-full bg-[var(--fg)] px-3 text-[13px] font-semibold text-[var(--bg)] shadow-lg transition-transform active:scale-95" aria-label={`${labels.add} ${title}`}>
            + <span className="sr-only md:not-sr-only md:ml-1">{labels.add}</span>
          </button>
        )}
        {burst > 0 && <SparkleBurst key={burst} />}
      </div>
      <Link href={href} className="mt-3 block px-1">
        <p className="truncate text-[14px] font-medium md:text-[15px]">{title}</p>
        <p className="tnum mt-0.5 flex items-baseline gap-2 text-[14px]">
          <span>{tk(p.price)}</span>
          {p.compareAtPrice && p.compareAtPrice > p.price && <s className="text-[12px] text-[var(--muted)]">{tk(p.compareAtPrice)}</s>}
          {p.stock > 0 && p.stock <= 5 && <span className="text-[11px] text-[var(--accent)]">{labels.onlyLeft.replace("{n}", String(p.stock))}</span>}
        </p>
      </Link>

      {sheet && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
          <button className="absolute inset-0 bg-black/60" aria-label="Close" onClick={() => setSheet(null)} />
          <div className="animate-rise relative w-full max-w-md rounded-t-3xl border border-[var(--line)] bg-[var(--bg)] p-6 md:rounded-3xl">
            <p className="font-[family-name:var(--font-display)] text-2xl">{title}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {sheet.map((v) => (
                <button key={v.id} className="pill tnum" disabled={v.stock <= 0} onClick={() => add(v)}>
                  {v.title} · {tk(v.price)}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
