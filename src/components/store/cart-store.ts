"use client";
import { useSyncExternalStore } from "react";

export type CartLine = { variantId: string; productId: string; slug: string; title: string; variantTitle: string; price: number; image: string; qty: number; maxQty: number };
type State = { lines: CartLine[]; open: boolean; pulse: number; code: string };

const KEY = "argon_cart_v1";
let state: State = { lines: [], open: false, pulse: 0, code: "" };
let loaded = false;
const subs = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try { const raw = localStorage.getItem(KEY); if (raw) { const j = JSON.parse(raw); state = { ...state, lines: j.lines ?? [], code: j.code ?? "" }; } } catch {}
}
function set(next: Partial<State>) {
  state = { ...state, ...next };
  try { localStorage.setItem(KEY, JSON.stringify({ lines: state.lines, code: state.code })); } catch {}
  subs.forEach((f) => f());
}
const EMPTY: State = { lines: [], open: false, pulse: 0, code: "" };

export const cart = {
  subscribe(f: () => void) { load(); subs.add(f); return () => subs.delete(f); },
  get: () => { load(); return state; },
  add(line: Omit<CartLine, "qty">, qty = 1, open = true) {
    const lines = [...state.lines];
    const i = lines.findIndex((l) => l.variantId === line.variantId);
    if (i >= 0) lines[i] = { ...lines[i], ...line, qty: Math.min(line.maxQty, lines[i].qty + qty) };
    else lines.push({ ...line, qty: Math.min(line.maxQty, qty) });
    set({ lines, open, pulse: state.pulse + 1 });
    track("add_to_cart", { productId: line.productId, value: line.price * qty });
  },
  setQty(variantId: string, qty: number) {
    set({ lines: state.lines.map((l) => (l.variantId === variantId ? { ...l, qty: Math.max(1, Math.min(l.maxQty, qty)) } : l)) });
  },
  remove(variantId: string) { set({ lines: state.lines.filter((l) => l.variantId !== variantId) }); },
  clear() { set({ lines: [], code: "" }); },
  setOpen(open: boolean) { set({ open }); },
  setCode(code: string) { set({ code }); },
};

export function useCart() {
  return useSyncExternalStore(cart.subscribe, cart.get, () => EMPTY);
}
export const cartCount = (s: State) => s.lines.reduce((n, l) => n + l.qty, 0);
export const cartSubtotal = (s: State) => s.lines.reduce((n, l) => n + l.qty * l.price, 0);

/** Fire-and-forget funnel event (first-party) + pixels if present. */
export function track(type: string, data: { productId?: string; value?: number } = {}) {
  try {
    navigator.sendBeacon?.("/api/events", JSON.stringify({ type, productId: data.productId }));
    const w = window as unknown as { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; ttq?: { track: (...a: unknown[]) => void } };
    const map: Record<string, [string, string]> = { add_to_cart: ["AddToCart", "add_to_cart"], product_view: ["ViewContent", "view_item"], checkout_start: ["InitiateCheckout", "begin_checkout"] };
    const m = map[type];
    if (m) {
      w.fbq?.("track", m[0], { value: data.value, currency: "BDT" });
      w.gtag?.("event", m[1], { value: data.value, currency: "BDT" });
      w.ttq?.track(m[0], { value: data.value, currency: "BDT" });
    }
  } catch {}
}
