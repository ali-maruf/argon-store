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
import { IconCash, IconClose, IconShield, IconSwap, IconTruck, IconWhatsapp } from "./Icons";

const tk = (n: number) => "৳" + n.toLocaleString("en-IN");
type L = Record<"orderNow" | "orderNowShort" | "addToCart" | "quantity" | "onlyLeft" | "soldOut" | "trust1" | "trust2" | "trust4", string>;

export function ProductDetail({ p, locale, labels, rating, urgency, whatsapp, fastPath, waOrder, breadcrumb }: {
  p: FullProduct; locale: "en" | "bn"; labels: L; rating: { avg: number; count: number }; urgency: number; whatsapp: string; fastPath: boolean; waOrder: boolean; breadcrumb?: React.ReactNode;
}) {
  const router = useRouter();
  const bn = locale === "bn";
  const title = bn && p.titleBn ? p.titleBn : p.title;
  const firstAvailable = p.variants.find((v) => v.stock > 0) ?? p.variants[0];
  const [sel, setSel] = useState<Record<string, string>>(firstAvailable.optionValues);
  const [qty, setQty] = useState(1);
  const [img, setImg] = useState(0);
  const [burst, setBurst] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
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
  useEffect(() => {
    if (lightbox === null) return;
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); if (e.key === "ArrowRight") setLightbox((i) => ((i ?? 0) + 1) % p.images.length); if (e.key === "ArrowLeft") setLightbox((i) => ((i ?? 0) - 1 + p.images.length) % p.images.length); };
    document.addEventListener("keydown", on); document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", on); document.body.style.overflow = ""; };
  }, [lightbox, p.images.length]);

  const available = (opt: string, val: string) =>
    p.variants.some((v) => v.stock > 0 && v.optionValues[opt] === val && p.options.every((o) => o.name === opt || v.optionValues[o.name] === sel[o.name]));
  const exists = (opt: string, val: string) => p.variants.some((v) => v.optionValues[opt] === val && v.stock > 0);

  const addToCart = () => {
    if (!variant) return;
    cart.add({ variantId: variant.id, productId: p.id, slug: p.slug, title, variantTitle: variant.title, price: variant.price, image: p.images[0]?.url ?? "", maxQty: variant.stock }, qty, true);
    setBurst((b) => b + 1);
  };
  const orderNow = () => {
    if (!variant) return;
    track("checkout_start", { value: price * qty });
    router.push(`${bn ? "/bn" : ""}/checkout?buy=${variant.id}&qty=${qty}`);
  };
  const waText = encodeURIComponent(`Hi ARGON! I'd like to order:\n${p.title}${variant && variant.title !== "Default" ? ` (${variant.title})` : ""} × ${qty}\n${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/product/${p.slug}`);
  const onScroll = () => { const el = strip.current; if (el) setImg(Math.round(el.scrollLeft / el.clientWidth)); };

  return (
    <div className="md:grid md:grid-cols-12">
      {/* Gallery: swipe on mobile, editorial stack on desktop */}
      <div className="md:col-span-7 lg:col-span-8">
        <div className="relative md:hidden">
          <div ref={strip} onScroll={onScroll} className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
            {p.images.map((im, i) => (
              <button key={im.url} onClick={() => setLightbox(i)} className="relative aspect-[4/5] w-full shrink-0 snap-center overflow-hidden bg-[var(--bg-2)]" aria-label={`Zoom image ${i + 1}`}>
                <Image src={im.url} alt={im.alt} fill priority={i === 0} fetchPriority={i === 0 ? "high" : "auto"} sizes="100vw" placeholder={im.blur ? "blur" : "empty"} blurDataURL={im.blur} className="object-cover" />
              </button>
            ))}
          </div>
          {p.images.length > 1 && <p className="tnum absolute bottom-4 right-4 bg-black/60 px-2.5 py-1 text-[11px] tracking-widest text-white backdrop-blur">{img + 1} / {p.images.length}</p>}
        </div>
        <div className="hidden grid-cols-2 gap-1 md:grid">
          {p.images.map((im, i) => (
            <button key={im.url} onClick={() => setLightbox(i)} className={`group relative cursor-zoom-in overflow-hidden bg-[var(--bg-2)] ${i === 0 || p.images.length === 2 ? "col-span-2 aspect-square" : "aspect-[4/5]"}`} aria-label={`Zoom image ${i + 1}`}>
              <Image src={im.url} alt={im.alt} fill priority={i === 0} fetchPriority={i === 0 ? "high" : "auto"} sizes={i === 0 ? "60vw" : "30vw"} placeholder={im.blur ? "blur" : "empty"} blurDataURL={im.blur}
                className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.04]" />
            </button>
          ))}
          {p.model3dUrl && <div className="col-span-2"><ModelViewer src={p.model3dUrl} alt={title} /></div>}
        </div>
      </div>

      {/* Buy box */}
      <div className="md:col-span-5 lg:col-span-4">
        <div className="px-4 pt-6 md:sticky md:top-[calc(var(--header-h)+24px)] md:px-10 md:pt-10 lg:px-12">
          {breadcrumb}
          <div className="mt-4 flex flex-wrap gap-1.5"><Badges badges={p.badges} stock={stock} urgency={urgency} soldOutLabel={labels.soldOut} /></div>
          <h1 className="mt-4 text-[clamp(1.9rem,3vw,2.75rem)] font-medium uppercase leading-[0.95] tracking-[-0.035em]">{title}</h1>
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="tnum flex items-baseline gap-3">
              <span className="text-2xl">{tk(price)}</span>
              {compare && compare > price && <><s className="text-[var(--muted)]">{tk(compare)}</s><span className="badge badge-limited">−{Math.round(((compare - price) / compare) * 100)}%</span></>}
            </p>
            {rating.count > 0 && <a href="#reviews" className="flex items-center gap-2 text-[12px] text-[var(--muted)]"><Stars value={rating.avg} size={12} /> ({rating.count})</a>}
          </div>
          <p className="mt-1 text-[12px] text-[var(--muted)]">{bn ? "ডেলিভারি চার্জ চেকআউটে যোগ হবে" : "Delivery calculated at checkout · COD available"}</p>

          {stock > 0 && stock <= urgency && (
            <div className="mt-6">
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" /></span>{labels.onlyLeft.replace("{n}", String(stock))}</p>
              <div className="mt-2 h-[3px] bg-[var(--line)]"><div className="h-full bg-[var(--accent)]" style={{ width: `${Math.max(8, (stock / urgency) * 100)}%` }} /></div>
            </div>
          )}

          {p.options.map((o) => (
            <fieldset key={o.name} className="mt-7">
              <legend className="mb-3 flex w-full justify-between text-[12px] uppercase tracking-[0.14em]"><span className="text-[var(--muted)]">{o.name}: <span className="text-[var(--fg)]">{sel[o.name]}</span></span>{o.name === "Size" && <a href="#size-guide" className="ulink normal-case tracking-normal text-[var(--muted)]">{bn ? "সাইজ গাইড" : "Size guide"}</a>}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={o.name}>
                {o.values.map((val) => {
                  const ok = exists(o.name, val);
                  return (
                    <button key={val} type="button" role="radio" aria-checked={sel[o.name] === val} disabled={!ok} className={`pill ${ok && !available(o.name, val) ? "opacity-60" : ""}`}
                      onClick={() => {
                        const next = { ...sel, [o.name]: val };
                        if (!p.variants.some((v) => v.stock > 0 && p.options.every((x) => v.optionValues[x.name] === next[x.name]))) {
                          const m = p.variants.find((v) => v.stock > 0 && v.optionValues[o.name] === val);
                          if (m) { setSel(m.optionValues); return; }
                        }
                        setSel(next);
                      }}>{val}</button>
                  );
                })}
              </div>
            </fieldset>
          ))}

          <div ref={ctaRef} className="relative mt-8 space-y-2.5">
            {stock > 0 ? (
              <>
                <div className="flex gap-2.5">
                  <Stepper value={qty} max={Math.max(1, Math.min(stock, 10))} onChange={setQty} label={labels.quantity} />
                  <button onClick={addToCart} className="btn btn-ghost relative flex-1">{labels.addToCart}{burst > 0 && <SparkleBurst key={burst} />}</button>
                </div>
                {fastPath && <button onClick={orderNow} className="btn btn-crimson w-full !min-h-14"><Sparkle className="h-3 w-3" /> {labels.orderNow}</button>}
              </>
            ) : <button disabled className="btn btn-ghost w-full">{labels.soldOut}</button>}
            {waOrder && <a href={`https://wa.me/${whatsapp}?text=${waText}`} target="_blank" rel="noopener" className="flex min-h-11 items-center justify-center gap-2 text-[12px] uppercase tracking-[0.14em] text-[var(--muted)] transition-colors hover:text-[var(--fg)]"><IconWhatsapp className="h-4 w-4" /> {bn ? "হোয়াটসঅ্যাপে অর্ডার" : "Order on WhatsApp"}</a>}
          </div>

          <ul className="mt-6 divide-y divide-[var(--line)] border-y border-[var(--line)] text-[13px]">
            {([[IconTruck, bn ? "আজ অর্ডার করলে ২৪ ঘণ্টায় পাঠানো হবে" : "Order today — ships within 24h", bn ? "ঢাকায় ১–২ দিন · সারা দেশে ২–৪ দিন" : "Dhaka 1–2 days · Nationwide 2–4 days"],
              [IconCash, labels.trust2, bn ? "পণ্য হাতে পেয়ে টাকা দিন" : "Or pay with bKash, Nagad, card"],
              [IconShield, labels.trust1, bn ? "পানি ও ঘাম প্রতিরোধী" : "Water & sweat resistant"],
              [IconSwap, labels.trust4, bn ? "অব্যবহৃত পণ্য ৭ দিনে বদলান" : "Unworn items, within 7 days"]] as const).map(([Icon, a, b]) => (
              <li key={a} className="flex items-center gap-4 py-3.5"><Icon className="h-5 w-5 shrink-0 text-[var(--muted)]" /><span><span className="block">{a}</span><span className="block text-[12px] text-[var(--muted)]">{b}</span></span></li>
            ))}
          </ul>
        </div>
      </div>

      {/* Sticky mobile bar */}
      {stock > 0 && (
        <div className={`fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl transition-transform duration-300 md:hidden ${showSticky ? "translate-y-0" : "translate-y-full"}`} aria-hidden={!showSticky}>
          <div className="min-w-0 flex-1"><p className="truncate text-[12px] uppercase tracking-[0.06em]">{title}</p><p className="tnum font-semibold">{tk(price * qty)}</p></div>
          <button onClick={fastPath ? orderNow : addToCart} tabIndex={showSticky ? 0 : -1} className="btn btn-crimson !min-h-12 shrink-0 !px-5">{fastPath ? labels.orderNowShort : labels.addToCart}</button>
        </div>
      )}

      {/* Lightbox */}
      {lightbox !== null && (
        <div className="fixed inset-0 z-[90] bg-black" role="dialog" aria-modal="true" aria-label={`${title} images`}>
          <Image src={p.images[lightbox].url} alt={p.images[lightbox].alt} fill sizes="100vw" className="object-contain" />
          <button onClick={() => setLightbox(null)} className="absolute right-4 top-4 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white backdrop-blur" aria-label="Close"><IconClose /></button>
          {p.images.length > 1 && <>
            <button onClick={() => setLightbox((lightbox - 1 + p.images.length) % p.images.length)} className="absolute left-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur" aria-label="Previous">‹</button>
            <button onClick={() => setLightbox((lightbox + 1) % p.images.length)} className="absolute right-4 top-1/2 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white backdrop-blur" aria-label="Next">›</button>
          </>}
          <p className="tnum absolute bottom-6 left-1/2 -translate-x-1/2 text-[12px] tracking-widest text-white/70">{lightbox + 1} / {p.images.length}</p>
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
  if (!on) return <button onClick={() => setOn(true)} className="btn btn-ghost mt-1 w-full">View in 3D</button>;
  const MV = "model-viewer" as unknown as React.ElementType;
  return <MV src={src} alt={alt} camera-controls auto-rotate ar style={{ width: "100%", height: 480, background: "var(--bg-2)" }} />;
}
