"use client";
import { useEffect, useState } from "react";
import { track } from "./cart-store";

/** Records one "visit" per browser session (funnel), and shows the optional desktop exit-intent offer once per session. */
export function SessionEffects({ exitIntent, code }: { exitIntent: boolean; code: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try { if (!sessionStorage.getItem("argon_v")) { sessionStorage.setItem("argon_v", "1"); track("visit"); } } catch {}
    if (!exitIntent || !matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const on = (e: MouseEvent) => {
      if (e.clientY > 8) return;
      try { if (sessionStorage.getItem("argon_exit")) return; sessionStorage.setItem("argon_exit", "1"); } catch {}
      setShow(true);
    };
    const t = setTimeout(() => document.addEventListener("mouseout", on), 8000);
    return () => { clearTimeout(t); document.removeEventListener("mouseout", on); };
  }, [exitIntent]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Offer" onClick={() => setShow(false)}>
      <div className="glass animate-rise max-w-sm rounded-[var(--radius-card)] bg-[var(--bg)] p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">✦ Before you go</p>
        <p className="mt-3 font-[family-name:var(--font-display)] text-4xl">10% off your first order</p>
        <p className="tnum mt-4 inline-block rounded-full border border-[var(--line)] px-5 py-2 text-lg font-semibold tracking-widest">{code}</p>
        <button className="btn btn-primary mt-6 w-full" onClick={() => setShow(false)}>Keep shopping</button>
      </div>
    </div>
  );
}
