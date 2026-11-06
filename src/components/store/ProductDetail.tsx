"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FullProduct, VariantLite } from "@/lib/catalog";
import { cart, track } from "./cart-store";
import { Stepper } from "./CartDrawer";
import { SparkleBurst } from "./SparkleBurst";
import { Badges } from "./ProductCard";
import { Sparkle } from "./Logo";
import { Stars } from "./Stars";

const tk = (n: number) => "৳" + n.toLocaleString("en-IN");
type L = Record<"orderNow" | "orderNowShort" | "addToCart" | "quantity" | "onlyLeft" | "soldOut" | "trust1" | "trust2" | "trust4", string>;

export function ProductDetail({ p, locale, labels, rating, urgency, whatsapp, fastPath, waOrder }: {
  p: FullProduct; locale: "en" | "bn"; labels: L; rating: { avg: number; count: number }; urgency: number; whatsapp: string; fastPath: boolean; waOrder: boolean;
}) {
  const router = useRouter();
  const title = locale === "bn" && p.titleBn ? p.titleBn : p.title;
  const firstAvailable = p.variants.find((v) => v.stock > 0) ?? p.variants[0];
  const [sel, setSel] = useState<Record<string, string>>(firstAvailable.optionValues);
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const [burst, setBurst] = useState(0);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);
  const strip = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);

  const variant: VariantLite | undefined = useMemo(
    () => p.variants.find((v) => p.options.every((o) => v.optionValues[o.name] === sel[o.name])) ?? (p.options.length ? undefined : p.variants[0]),
    [sel, p],
  );
  const price = variant?.price ?? p.price;
  const compare = variant?.compareAtPrice ?? null;
  const stock = variant?.stock ?? 0;

  useEffect(() => { track("product_view", { productId: p.id, value: p.price }); }, [p.id, p.price]);
  useEffect(() => {
    const el = ctaRef.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowSticky(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el); return () => io.disconnect();
  }, []);

  /** A value is selectable if some in-stock variant matches it together with the other current selections. */
  const available = (opt: string, val: string) =>
    p.variants.some((v) => v.stock > 0 && v.optionValues[opt] === val && p.options.every((o) => o.name === opt || v.optionValues[o.name] === sel[o.name]));
  const exists = (opt: string, val: string) => p.variants.some((v) => v.optionValues[opt] === val && v.stock > 0);

  const line = () => variant && ({ variantId: variant.id, productId: p.id, slug: p.slug, title, variantTitle: variant.title, price: variant.price, image: p.images[0]?.url ?? "", maxQty: variant.stock });
  const addToCart = () => { const l = line(); if (!l) return; cart.add(l, qty, true); setBurst((b) => b + 1); };
  const orderNow = () => {
    if (!variant) return;
    track("checkout_start", { value: price * qty });
    router.push(`${locale === "bn" ? "/bn" : ""}/checkout?buy=${variant.id}&qty=${qty}`);
  };
  const waText = encodeURIComponent(`Hi ARGON! I'd like to order:\n${p.title}${variant && variant.title !== "Default" ? ` (${variant.title})` : ""} × ${qty}\n${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/product/${p.slug}`);

  const onScroll = () => { const el = strip.current; if (el) setImg(Math.round(el.scrollLeft / el.clientWidth)); };
  const goTo = (i: number) => { setImg(i); strip.current?.scrollTo({ left: i * (strip.current?.clientWidth ?? 0), behavior: "smooth" }); };

  return (
    <div className="grid gap-8 md:grid-cols-12 md:gap-12">
      {/* Gallery */}
      <div className="md:col-span-7">
        <div className="md:flex md:gap-4">
          <div className="hidden w-20 shrink-0 flex-col gap-3 md:flex">
            {p.images.map((im, i) => (
              <button key={im.url} onClick={() => goTo(i)} className={`relative aspect-square overflow-hidden rounded-xl border ${img === i ? "border-[var(--fg)]" : "border-[var(--line)]"}`} aria-label={`Image ${i + 1}`} aria-current={img === i}>
                <Image src={im.url} alt="" fill sizes="80px" className="object-cover" />
              </button>
            ))}
          </div>
          <div className="relative flex-1">
            <div ref={strip} onScroll={onScroll} className="no-scrollbar hairline flex snap-x snap-mandatory overflow-x-auto rounded-[var(--radius-card)]">
              {p.images.map((im, i) => (
                <div key={im.url} className="relative aspect-square w-full shrink-0 snap-center overflow-hidden"
                  onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setZoom({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 }); }}
                  onMouseLeave={() => setZoom(null)}>
                  <Image src={im.url} alt={im.alt} fill priority={i === 0} fetchPriority={i === 0 ? "high" : "auto"} sizes="(max-width:768px) 100vw, 58vw"
                    placeholder={im.blur ? "blur" : "empty"} blurDataURL={im.blur}
                    className="object-cover transition-transform duration-200"
                    style={zoom && img === i ? { transform: "scale(1.9)", transformOrigin: `${zoom.x}% ${zoom.y}%` } : undefined} />
                </div>
              ))}
            </div>
            {p.images.length > 1 && (
              <div className="mt-3 flex justify-center gap-1.5 md:hidden">
                {p.images.map((_, i) => <button key={i} onClick={() => goTo(i)} className={`h-1.5 rounded-full transition-all ${img === i ? "w-6 bg-[var(--fg)]" : "w-1.5 bg-[var(--line)]"}`} aria-label={`Image ${i + 1}`} />)}
              </div>
            )}
            {p.model3dUrl && <ModelViewer src={p.model3dUrl} alt={title} />}
          </div>
        </div>
      </div>

      {/* Buy box */}
      <div className="md:col-span-5">
        <div className="flex flex-wrap gap-1.5"><Badges badges={p.badges} stock={stock} urgency={urgency} soldOutLabel={labels.soldOut} /></div>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-4xl leading-tight md:text-5xl">{title}</h1>
        {rating.count > 0 && <a href="#reviews" className="mt-2 flex items-center gap-2 text-[13px] text-[var(--muted)]"><Stars value={rating.avg} /> {rating.avg.toFixed(1)} ({rating.count})</a>}
        <p className="tnum mt-4 flex items-baseline gap-3">
          <span className="text-3xl font-semibold">{tk(price)}</span>
          {compare && compare > price && <><s className="text-[var(--muted)]">{tk(compare)}</s><span className="badge badge-limited">−{Math.round(((compare - price) / compare) * 100)}%</span></>}
        </p>
        {stock > 0 && stock <= urgency && (
          <p className="mt-3 flex items-center gap-2 text-[14px] font-medium text-[var(--accent)]"><Sparkle className="h-3 w-3" /> LIMITED STOCK — {labels.onlyLeft.replace("{n}", String(stock))}</p>
        )}

        {p.options.map((o) => (
          <fieldset key={o.name} className="mt-6">
            <legend className="eyebrow mb-3">{o.name}{sel[o.name] ? <span className="ml-2 normal-case tracking-normal text-[var(--fg)]">{sel[o.name]}</span> : null}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={o.name}>
              {o.values.map((val) => {
                const ok = exists(o.name, val);
                return (
                  <button key={val} type="button" role="radio" aria-checked={sel[o.name] === val} disabled={!ok}
                    className={`pill ${ok && !available(o.name, val) ? "opacity-60" : ""}`}
                    onClick={() => {
                      const next = { ...sel, [o.name]: val };
                      // If the combo doesn't exist in stock, snap other options to the first in-stock match.
                      if (!p.variants.some((v) => v.stock > 0 && p.options.every((x) => v.optionValues[x.name] === next[x.name]))) {
                        const m = p.variants.find((v) => v.stock > 0 && v.optionValues[o.name] === val);
                        if (m) { setSel(m.optionValues); return; }
                      }
                      setSel(next);
                    }}>
                    {val}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}

        <div className="mt-6 flex items-center gap-4">
          <span className="eyebrow">{labels.quantity}</span>
          <Stepper value={qty} max={Math.max(1, Math.min(stock, 10))} onChange={setQty} label={labels.quantity} />
        </div>

        <div ref={ctaRef} className="relative mt-6 space-y-3">
          {stock > 0 ? (
            <>
              {fastPath && <button onClick={orderNow} className="btn btn-crimson !min-h-14 w-full text-base"><Sparkle className="h-3 w-3" /> {labels.orderNow}</button>}
              <button onClick={addToCart} className={`btn ${fastPath ? "btn-ghost" : "btn-primary"} relative !min-h-14 w-full`}>{labels.addToCart}{burst > 0 && <SparkleBurst key={burst} />}</button>
            </>
          ) : <button disabled className="btn btn-ghost !min-h-14 w-full">{labels.soldOut}</button>}
          {waOrder && <a href={`https://wa.me/${whatsapp}?text=${waText}`} target="_blank" rel="noopener" className="block text-center text-[13px] text-[var(--muted)] underline underline-offset-4">Order on WhatsApp</a>}
        </div>

        <ul className="mt-6 grid grid-cols-2 gap-2 text-[13px]">
          {[labels.trust1, locale === "bn" ? "পানি ও ঘাম প্রতিরোধী" : "Water & sweat resistant", labels.trust2, labels.trust4].map((t) => (
            <li key={t} className="glass flex items-center gap-2 rounded-xl px-3 py-2.5"><Sparkle className="h-2.5 w-2.5 shrink-0" />{t}</li>
          ))}
        </ul>
      </div>

      {/* Sticky mobile bar */}
      {stock > 0 && (
        <div className={`glass fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 transition-transform duration-200 md:hidden ${showSticky ? "translate-y-0" : "translate-y-full"}`} aria-hidden={!showSticky}>
          <div className="min-w-0 flex-1"><p className="truncate text-[13px]">{title}</p><p className="tnum font-semibold">{tk(price * qty)}</p></div>
          <button onClick={fastPath ? orderNow : addToCart} tabIndex={showSticky ? 0 : -1} className="btn btn-crimson !min-h-12 shrink-0">{fastPath ? labels.orderNowShort : labels.addToCart}</button>
        </div>
      )}
    </div>
  );
}

function ModelViewer({ src, alt }: { src: string; alt: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!on || customElements.get("model-viewer")) return;
    const s = document.createElement("script"); s.type = "module"; s.src = "https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/dist/model-viewer.min.js";
    document.head.appendChild(s);
  }, [on]);
  if (!on) return <button onClick={() => setOn(true)} className="pill mt-3">View in 3D</button>;
  const MV = "model-viewer" as unknown as React.ElementType;
  return <MV src={src} alt={alt} camera-controls auto-rotate ar style={{ width: "100%", height: 360, marginTop: 12, borderRadius: 20, background: "var(--glass)" }} />;
}
