"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { cart, cartSubtotal, track, useCart } from "./cart-store";
import { Sparkle } from "./Logo";

type Upsell = { variantId: string; productId: string; slug: string; title: string; variantTitle: string; price: number; image: string; stock: number } | null;
type Props = {
  locale: "en" | "bn"; freeThreshold: number; freeBar: boolean; insideRate: number; outsideRate: number; upsell: Upsell;
  s: Record<"cart" | "close" | "emptyCart" | "continueShopping" | "remove" | "subtotal" | "checkout" | "discountCode" | "apply" | "estDelivery" | "insideDhaka" | "outsideDhaka" | "freeDeliveryAway" | "freeDeliveryUnlocked" | "add" | "quantity", string>;
};
const tk = (n: number) => "৳" + n.toLocaleString("en-IN");

export function CartDrawer({ locale, freeThreshold, freeBar, insideRate, outsideRate, upsell, s }: Props) {
  const st = useCart();
  const sub = cartSubtotal(st);
  const panel = useRef<HTMLDivElement>(null);
  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [codeMsg, setCodeMsg] = useState<string | null>(null);
  const prefix = locale === "bn" ? "/bn" : "";

  useEffect(() => {
    if (!st.open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && cart.setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; prev?.focus(); };
  }, [st.open]);
  useEffect(() => setCode(st.code), [st.code]);

  const applyCode = async () => {
    setCodeMsg(null);
    const r = await fetch("/api/cart/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: st.lines.map((l) => ({ variantId: l.variantId, qty: l.qty })), code }) }).then((r) => r.json());
    if (r.discountCode) { cart.setCode(r.discountCode); setCodeMsg(`✦ ${r.discountLabel} — −${tk(r.discountTotal)}`); }
    else { cart.setCode(""); setCodeMsg(r.errors?.[0] ?? "Invalid code"); }
  };

  const pct = Math.min(100, (sub / freeThreshold) * 100);
  const showUpsell = upsell && !st.lines.some((l) => l.variantId === upsell.variantId) && st.lines.length > 0;

  return (
    <div aria-hidden={!st.open} className={`fixed inset-0 z-[60] ${st.open ? "" : "pointer-events-none"}`}>
      <div onClick={() => cart.setOpen(false)} className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${st.open ? "opacity-100" : "opacity-0"}`} />
      <div
        ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-label={s.cart}
        className={`absolute inset-y-0 right-0 flex w-full max-w-[420px] flex-col border-l border-[var(--line)] bg-[var(--bg)] outline-none transition-transform duration-300 ease-[cubic-bezier(.2,.7,.2,1)] ${st.open ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
          <p className="eyebrow !text-[var(--fg)]">{s.cart}</p>
          <button onClick={() => cart.setOpen(false)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--glass)]" aria-label={s.close}>✕</button>
        </div>

        {freeBar && st.lines.length > 0 && (
          <div className="border-b border-[var(--line)] px-5 py-3">
            <p className="text-[13px]">{sub >= freeThreshold ? s.freeDeliveryUnlocked : s.freeDeliveryAway.replace("{amt}", tk(freeThreshold - sub))}</p>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--glass)]" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${pct}%`, background: "var(--chrome)" }} />
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5">
          {st.lines.length === 0 ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <p className="mb-4 text-[var(--muted)]">{s.emptyCart}</p>
                <Link href={`${prefix}/shop`} onClick={() => cart.setOpen(false)} className="btn btn-ghost">{s.continueShopping}</Link>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--line)]">
              {st.lines.map((l) => (
                <li key={l.variantId} className="flex gap-4 py-4">
                  <Image src={l.image} alt={l.title} width={80} height={80} className="h-20 w-20 rounded-sm object-cover" />
                  <div className="min-w-0 flex-1">
                    <Link href={`${prefix}/product/${l.slug}`} onClick={() => cart.setOpen(false)} className="block truncate text-[15px] font-medium">{l.title}</Link>
                    {l.variantTitle !== "Default" && <p className="text-[13px] text-[var(--muted)]">{l.variantTitle}</p>}
                    <div className="mt-2 flex items-center justify-between">
                      <Stepper value={l.qty} max={l.maxQty} onChange={(q) => cart.setQty(l.variantId, q)} label={s.quantity} />
                      <p className="tnum text-[15px]">{tk(l.price * l.qty)}</p>
                    </div>
                    <button onClick={() => cart.remove(l.variantId)} className="mt-1 text-[12px] text-[var(--muted)] underline underline-offset-2">{s.remove}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {showUpsell && upsell && (
            <div className="glass my-3 flex items-center gap-3 rounded-sm p-3">
              <Image src={upsell.image} alt="" width={56} height={56} className="h-14 w-14 rounded-lg object-cover" />
              <p className="flex-1 text-[13px]">{s.add} <span className="font-medium">{upsell.title}</span> <span className="text-[var(--muted)]">({upsell.variantTitle})</span> {locale === "bn" ? "মাত্র" : "for"} <span className="tnum">{tk(upsell.price)}</span></p>
              <button className="btn btn-ghost !min-h-10 !px-4 text-[13px]" onClick={() => cart.add({ ...upsell, maxQty: upsell.stock }, 1, true)}>+ {s.add}</button>
            </div>
          )}
        </div>

        {st.lines.length > 0 && (
          <div className="space-y-3 border-t border-[var(--line)] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
            {!showCode && !st.code ? (
              <button className="text-[13px] text-[var(--muted)] underline underline-offset-2" onClick={() => setShowCode(true)}>{s.discountCode}?</button>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input className="input !min-h-11 uppercase" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={s.discountCode} aria-label={s.discountCode} />
                  <button className="btn btn-ghost !min-h-11" onClick={applyCode}>{s.apply}</button>
                </div>
                {codeMsg && <p className="mt-1 text-[12px] text-[var(--muted)]" role="status">{codeMsg}</p>}
              </div>
            )}
            <div className="flex justify-between text-[15px]"><span>{s.subtotal}</span><span className="tnum font-semibold">{tk(sub)}</span></div>
            <p className="text-[12px] text-[var(--muted)]">{s.estDelivery}: {s.insideDhaka} {sub >= freeThreshold ? "৳0" : tk(insideRate)} · {s.outsideDhaka} {tk(outsideRate)}</p>
            <Link href={`${prefix}/checkout`} onClick={() => { cart.setOpen(false); track("checkout_start", { value: sub }); }} className="btn btn-primary w-full !min-h-14 text-base">
              <Sparkle className="h-3 w-3" /> {s.checkout} · <span className="tnum">{tk(sub)}</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export function Stepper({ value, max, onChange, label }: { value: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center rounded-full border border-[var(--line)]" role="group" aria-label={label}>
      <button type="button" className="grid h-9 w-9 place-items-center disabled:opacity-30" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="Decrease">−</button>
      <span className="tnum w-6 text-center text-[14px]" aria-live="polite">{value}</span>
      <button type="button" className="grid h-9 w-9 place-items-center disabled:opacity-30" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="Increase">+</button>
    </div>
  );
}
