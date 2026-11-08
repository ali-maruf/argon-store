"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { cart, useCart } from "./cart-store";
import { placeOrder, saveCheckoutProgress } from "@/app/[locale]/checkout/actions";
import { Sparkle } from "./Logo";

type QuoteLine = { variantId: string; title: string; variantTitle: string; image: string; price: number; qty: number; lineTotal: number; stock: number };
type Quote = { lines: QuoteLine[]; subtotal: number; discountTotal: number; shippingTotal: number; total: number; zone: { key: string; name: string; rate: number; eta: string } | null; discountCode: string | null; discountLabel: string | null; automaticLabels: string[]; errors: string[]; freeShipping: boolean };
type Zone = { key: string; name: string; rate: number; eta: string };
type Methods = { cod: boolean; bkash: boolean; nagad: boolean; sslcommerz: boolean; advanceOutsideDhaka: boolean };
const tk = (n: number) => "৳" + n.toLocaleString("en-IN");
const PHONE = /^01[3-9]\d{8}$/;
const norm = (p: string) => { const d = p.replace(/\D/g, ""); return d.startsWith("880") ? "0" + d.slice(3) : d; };

export function CheckoutForm({ locale, districts, areas, zones, methods, s }: {
  locale: "en" | "bn"; districts: string[]; areas: Record<string, string[]>; zones: Zone[]; methods: Methods; s: Record<string, string>;
}) {
  const sp = useSearchParams();
  const router = useRouter();
  const st = useCart();
  const buy = sp.get("buy");
  const items = useMemo(
    () => (buy ? [{ variantId: buy, qty: Math.max(1, Math.min(20, Number(sp.get("qty")) || 1)) }] : st.lines.map((l) => ({ variantId: l.variantId, qty: l.qty }))),
    [buy, sp, st.lines],
  );
  const [f, setF] = useState({ name: "", phone: "", email: "", address: "", district: "", area: "", note: "", paymentMethod: "cod", code: "", otp: "" });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ msg: string; field?: string } | null>(null);
  const [needOtp, setNeedOtp] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const idem = useRef<string>("");
  const abandonToken = useRef<string>("");
  const submitting = useRef(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = JSON.parse(localStorage.getItem("argon_checkout") ?? "{}");
      setF((x) => ({ ...x, ...saved, code: st.code || "", otp: "" }));
      abandonToken.current = sessionStorage.getItem("argon_abandon") || crypto.randomUUID();
      sessionStorage.setItem("argon_abandon", abandonToken.current);
    } catch { abandonToken.current = Math.random().toString(36).slice(2); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Idempotency key: stable for this exact cart, so double-clicks/retries never create two orders.
  useEffect(() => {
    const sig = JSON.stringify(items);
    try {
      const cur = JSON.parse(sessionStorage.getItem("argon_idem") ?? "{}");
      if (cur.sig === sig && cur.key) idem.current = cur.key;
      else { idem.current = crypto.randomUUID(); sessionStorage.setItem("argon_idem", JSON.stringify({ sig, key: idem.current })); }
    } catch { idem.current = idem.current || Math.random().toString(36).slice(2) + Date.now(); }
  }, [items]);

  // Live server quote (prices, stock, discount, delivery).
  useEffect(() => {
    if (!items.length) { setQ(null); return; }
    const ctl = new AbortController();
    const t = setTimeout(() => {
      fetch("/api/cart/quote", { method: "POST", signal: ctl.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items, district: f.district || null, area: f.area || null, code: f.code || null, phone: PHONE.test(norm(f.phone)) ? norm(f.phone) : null }) })
        .then((r) => r.json()).then(setQ).catch(() => {});
    }, 250);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [items, f.district, f.area, f.code, f.phone]);

  // Persist progress locally + capture abandoned checkout server-side once the phone is valid.
  useEffect(() => {
    if (!mounted) return;
    const { otp, code, ...keep } = f; void otp; void code;
    try { localStorage.setItem("argon_checkout", JSON.stringify(keep)); } catch {}
    const phone = norm(f.phone);
    if (!PHONE.test(phone) || !items.length) return;
    const t = setTimeout(() => { void saveCheckoutProgress({ token: abandonToken.current, phone, name: f.name, email: f.email, district: f.district, items, subtotal: q?.subtotal ?? 0 }); }, 1200);
    return () => clearTimeout(t);
  }, [f, items, mounted, q?.subtotal]);

  const errors: Record<string, string | null> = {
    name: f.name.trim().length < 2 ? s.errName : null,
    phone: !PHONE.test(norm(f.phone)) ? s.errPhone : null,
    email: f.email && !/^\S+@\S+\.\S+$/.test(f.email) ? s.errEmail : null,
    address: f.address.trim().length < 8 ? s.errAddress : null,
    district: !districts.includes(f.district) ? s.errDistrict : null,
  };
  const show = (k: string) => (touched[k] && errors[k]) || (err?.field === k ? err.msg : null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setF((x) => ({ ...x, [k]: e.target.value })); if (err?.field === k) setErr(null); };
  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting.current) return;
    setTouched({ name: true, phone: true, email: true, address: true, district: true });
    const first = Object.entries(errors).find(([, v]) => v);
    if (first) { document.getElementById(`f-${first[0]}`)?.focus(); return; }
    submitting.current = true; setBusy(true); setErr(null);
    const r = await placeOrder({
      items, name: f.name, phone: f.phone, email: f.email, address: f.address, district: f.district, area: f.area, note: f.note,
      paymentMethod: f.paymentMethod as "cod", code: f.code || undefined, idempotencyKey: idem.current, abandonedToken: abandonToken.current, otp: f.otp || undefined,
    }).catch(() => ({ ok: false as const, error: "Network error — please try again." }));
    if (r.ok) {
      if (!buy) cart.clear();
      try { sessionStorage.removeItem("argon_idem"); sessionStorage.removeItem("argon_abandon"); } catch {}
      if (r.external) { window.location.href = r.redirect; return; }
      router.push(`${locale === "bn" ? "/bn" : ""}${r.redirect}`);
      return;
    }
    if ("needOtp" in r && r.needOtp) { setNeedOtp(true); if (r.devCode) setF((x) => ({ ...x, otp: r.devCode! })); }
    setErr({ msg: r.error, field: "field" in r ? r.field : undefined });
    submitting.current = false; setBusy(false);
  };

  if (mounted && !items.length) {
    return <div className="py-24 text-center"><p className="text-[var(--muted)]">{s.emptyCart}</p><Link href={`${locale === "bn" ? "/bn" : ""}/shop`} className="btn btn-primary mt-6">{s.continueShopping}</Link></div>;
  }
  const zoneKey = q?.zone?.key;
  const pmOpts = [
    methods.cod && { v: "cod", t: s.cod, sub: methods.advanceOutsideDhaka && zoneKey === "outside_dhaka" ? s.codAdvance : s.codSub, logo: "COD" },
    methods.bkash && { v: "bkash", t: s.bkash, sub: s.bkashSub, logo: "bKash" },
    methods.nagad && { v: "nagad", t: s.nagad, sub: s.nagadSub, logo: "Nagad" },
    methods.sslcommerz && { v: "sslcommerz", t: s.card, sub: s.cardSub, logo: "CARD" },
  ].filter(Boolean) as { v: string; t: string; sub: string; logo: string }[];

  const summary = (
    <div className="space-y-4">
      <ul className="space-y-4">
        {(q?.lines ?? []).map((l) => (
          <li key={l.variantId} className="flex items-center gap-3">
            <div className="relative"><Image src={l.image} alt="" width={64} height={64} className="h-16 w-16 rounded-sm object-cover" /><span className="tnum absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--fg)] px-1 text-[11px] font-bold text-[var(--bg)]">{l.qty}</span></div>
            <div className="min-w-0 flex-1"><p className="truncate text-[14px]">{l.title}</p>{l.variantTitle !== "Default" && <p className="text-[12px] text-[var(--muted)]">{l.variantTitle}</p>}</div>
            <p className="tnum text-[14px]">{tk(l.lineTotal)}</p>
          </li>
        ))}
        {!q && Array.from({ length: Math.max(1, items.length) }).map((_, i) => <li key={i} className="skeleton h-16 rounded-sm" />)}
      </ul>
      <div className="border-t border-[var(--line)] pt-4">
        {!codeOpen && !f.code ? (
          <button type="button" className="text-[13px] text-[var(--muted)] underline underline-offset-2" onClick={() => setCodeOpen(true)}>{s.discountCode}?</button>
        ) : (
          <div>
            <label className="field block"><span>{s.discountCode}</span>
              <input id="f-code" className="input uppercase" value={f.code} onChange={(e) => { setF((x) => ({ ...x, code: e.target.value.toUpperCase() })); cart.setCode(e.target.value.toUpperCase()); }} aria-invalid={!!f.code && !!q && !q.discountCode} />
            </label>
            {f.code && q && (q.discountCode ? <p className="mt-1 text-[12px] text-[var(--success)]">✦ {q.discountLabel}</p> : <p className="mt-1 text-[12px] text-[#ff5d73]">{q.errors.find((x) => /code|Add ৳/.test(x)) ?? ""}</p>)}
          </div>
        )}
      </div>
      <dl className="tnum space-y-2 border-t border-[var(--line)] pt-4 text-[14px]">
        <div className="flex justify-between"><dt>{s.subtotal}</dt><dd>{q ? tk(q.subtotal) : "—"}</dd></div>
        {q && q.discountTotal > 0 && <div className="flex justify-between text-[var(--success)]"><dt>{s.discount}{q.automaticLabels.length ? ` (${q.automaticLabels.join(", ")})` : ""}</dt><dd>−{tk(q.discountTotal)}</dd></div>}
        <div className="flex justify-between"><dt>{s.delivery}{q?.zone ? ` · ${q.zone.name}` : ""}</dt><dd>{q?.zone ? (q.shippingTotal === 0 ? "FREE" : tk(q.shippingTotal)) : s.chooseDistrict}</dd></div>
        <div className="flex justify-between border-t border-[var(--line)] pt-3 text-[18px] font-semibold"><dt>{s.total}</dt><dd>{q ? tk(q.total) : "—"}</dd></div>
      </dl>
    </div>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 md:grid-cols-12 md:gap-12">
      {/* Mobile collapsible summary */}
      <div className="glass rounded-sm md:hidden">
        <button type="button" onClick={() => setSummaryOpen((o) => !o)} aria-expanded={summaryOpen} className="flex w-full items-center justify-between px-4 py-4 text-[14px]">
          <span>{summaryOpen ? s.hideSummary : s.showSummary} ▾</span><span className="tnum font-semibold">{q ? tk(q.total) : ""}</span>
        </button>
        {summaryOpen && <div className="border-t border-[var(--line)] p-4">{summary}</div>}
      </div>

      <div className="space-y-8 md:col-span-7">
        <section aria-labelledby="c1">
          <h2 id="c1" className="eyebrow mb-4 !text-[var(--fg)]">1 · {s.contactDelivery}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label={s.fullName} error={show("name")}><input id="f-name" className="input" autoComplete="name" value={f.name} onChange={set("name")} onBlur={blur("name")} aria-invalid={!!show("name")} required /></Field>
            <Field id="phone" label={s.mobile} error={show("phone")}><input id="f-phone" className="input tnum" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="01XXXXXXXXX" maxLength={14} value={f.phone} onChange={set("phone")} onBlur={blur("phone")} aria-invalid={!!show("phone")} required /></Field>
            <Field id="email" label={s.emailOpt} error={show("email")} className="sm:col-span-2"><input id="f-email" className="input" type="email" autoComplete="email" value={f.email} onChange={set("email")} onBlur={blur("email")} aria-invalid={!!show("email")} /></Field>
            <Field id="address" label={s.address} error={show("address")} className="sm:col-span-2"><textarea id="f-address" className="input" rows={2} autoComplete="street-address" placeholder={s.addressPh} value={f.address} onChange={set("address")} onBlur={blur("address")} aria-invalid={!!show("address")} required /></Field>
            <Field id="district" label={s.district} error={show("district")}>
              <input id="f-district" className="input" list="districts" autoComplete="address-level2" value={f.district} placeholder={s.searchDistrict}
                onChange={(e) => { const v = e.target.value; const m = districts.find((d) => d.toLowerCase() === v.trim().toLowerCase()); setF((x) => ({ ...x, district: m ?? v, area: m && m !== x.district ? "" : x.area })); }}
                onBlur={blur("district")} aria-invalid={!!show("district")} required />
              <datalist id="districts">{districts.map((d) => <option key={d} value={d} />)}</datalist>
            </Field>
            <Field id="area" label={s.area}>
              <input id="f-area" className="input" list="areas" autoComplete="address-level3" value={f.area} onChange={set("area")} />
              <datalist id="areas">{(areas[f.district] ?? []).map((a) => <option key={a} value={a} />)}</datalist>
            </Field>
            <Field id="note" label={s.note} className="sm:col-span-2"><input id="f-note" className="input" value={f.note} onChange={set("note")} maxLength={300} /></Field>
          </div>
        </section>

        <section aria-labelledby="c2">
          <h2 id="c2" className="eyebrow mb-4 !text-[var(--fg)]">2 · {s.deliveryZone}</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            {zones.map((z) => (
              <div key={z.key} className={`rounded-sm border p-4 text-[13px] transition-colors ${zoneKey === z.key ? "border-[var(--fg)] bg-[var(--glass)]" : "border-[var(--line)] opacity-60"}`} aria-current={zoneKey === z.key}>
                <p className="font-medium">{z.name}</p><p className="tnum text-[var(--muted)]">{q?.freeShipping && zoneKey === z.key ? "FREE" : tk(z.rate)} · {z.eta}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12px] text-[var(--muted)]">{s.zoneHint}</p>
        </section>

        <section aria-labelledby="c3">
          <h2 id="c3" className="eyebrow mb-4 !text-[var(--fg)]">3 · {s.payment}</h2>
          <div className="space-y-2" role="radiogroup" aria-labelledby="c3">
            {pmOpts.map((m) => (
              <label key={m.v} className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-sm border px-4 py-3 transition-colors ${f.paymentMethod === m.v ? "border-[var(--fg)] bg-[var(--glass)]" : "border-[var(--line)]"}`}>
                <input type="radio" name="pm" value={m.v} checked={f.paymentMethod === m.v} onChange={() => setF((x) => ({ ...x, paymentMethod: m.v }))} className="h-5 w-5 accent-[var(--fg)]" />
                <span className="flex-1"><span className="block text-[15px] font-medium">{m.t}</span><span className="block text-[12px] text-[var(--muted)]">{m.sub}</span></span>
                <span className="rounded-md border border-[var(--line)] px-2 py-1 text-[11px] font-bold tracking-wide">{m.logo}</span>
              </label>
            ))}
          </div>
        </section>

        {needOtp && (
          <Field id="otp" label={s.otp} error={err?.field === "otp" ? err.msg : null}>
            <input id="f-otp" className="input tnum tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={f.otp} onChange={set("otp")} />
          </Field>
        )}

        {q?.errors.filter((x) => !/code|Add ৳/.test(x)).map((x) => <p key={x} role="alert" className="rounded-sm border border-[#ff5d73]/40 px-4 py-3 text-[14px] text-[#ff8a9a]">{x}</p>)}
        {err && !err.field && <p role="alert" className="rounded-sm border border-[#ff5d73]/40 px-4 py-3 text-[14px] text-[#ff8a9a]">{err.msg}</p>}
        {err?.field === "paymentMethod" && <p role="alert" className="text-[14px] text-[#ff8a9a]">{err.msg}</p>}

        <button type="submit" disabled={busy || !q || q.errors.some((x) => /sold out|left of|no longer/.test(x))} className="btn btn-crimson !min-h-16 w-full text-[17px]" aria-busy={busy}>
          {busy ? <><span className="orbit !h-5 !w-5" aria-hidden /> {s.placing}</> : <><Sparkle className="h-3 w-3" /> {s.placeOrder} — <span className="tnum">{q ? tk(q.total) : ""}</span></>}
        </button>
        <p className="text-center text-[12px] text-[var(--muted)]">{s.secureNote}</p>
      </div>

      <aside className="hidden md:col-span-5 md:block">
        <div className="glass sticky top-24 rounded-sm p-6"><h2 className="eyebrow mb-5 !text-[var(--fg)]">{s.orderSummary}</h2>{summary}</div>
      </aside>
    </form>
  );
}

function Field({ id, label, error, children, className = "" }: { id: string; label: string; error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={`f-${id}`} className="mb-1.5 block text-[13px] text-[var(--muted)]">{label}</label>
      {children}
      {error && <p id={`e-${id}`} role="alert" className="mt-1 text-[12px] text-[#ff8a9a]">{error}</p>}
    </div>
  );
}
