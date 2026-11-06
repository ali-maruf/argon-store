"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createManualOrder } from "@/app/admin/(panel)/orders/actions";

type V = { id: string; label: string; sku: string; price: number; stock: number };
const tk = (n: number) => "৳" + n.toLocaleString("en-IN");

export function ManualOrderForm({ variants, districts }: { variants: V[]; districts: string[] }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<{ v: V; qty: number }[]>([]);
  const [f, setF] = useState({ name: "", phone: "", email: "", address: "", district: "Dhaka", area: "", paymentMethod: "cod", paid: false, source: "facebook", code: "", note: "", shipping: "" });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const hits = useMemo(() => (q.length < 1 ? [] : variants.filter((v) => `${v.label} ${v.sku}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8)), [q, variants]);
  const sub = items.reduce((s, i) => s + i.v.price * i.qty, 0);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <form className="grid gap-5 lg:grid-cols-3" onSubmit={(e) => {
      e.preventDefault(); setErr(null);
      start(async () => {
        const r = await createManualOrder({ items: items.map((i) => ({ variantId: i.v.id, qty: i.qty })), name: f.name, phone: f.phone, email: f.email, address: f.address, district: f.district, area: f.area, paymentMethod: f.paymentMethod as "cod", paid: f.paid, source: f.source as "facebook", code: f.code || undefined, note: f.note || undefined, shippingOverride: f.shipping === "" ? null : Number(f.shipping) });
        if (r.ok) router.push(`/admin/orders/${r.id}`); else setErr(r.error);
      });
    }}>
      <div className="space-y-5 lg:col-span-2">
        <div className="card">
          <div className="card-h">Products</div>
          <div className="card-b">
            <div className="relative">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products or SKU…" className="input" aria-label="Search products" />
              {hits.length > 0 && (
                <ul className="card absolute inset-x-0 top-full z-10 mt-1 max-h-72 overflow-y-auto p-1">
                  {hits.map((v) => (
                    <li key={v.id}><button type="button" disabled={v.stock <= 0} className="flex w-full justify-between rounded-lg px-3 py-2 text-left hover:bg-[var(--panel2)] disabled:opacity-40"
                      onClick={() => { setItems((xs) => xs.some((x) => x.v.id === v.id) ? xs.map((x) => x.v.id === v.id ? { ...x, qty: x.qty + 1 } : x) : [...xs, { v, qty: 1 }]); setQ(""); }}>
                      <span>{v.label} <span className="text-[12px] text-[var(--muted)]">{v.sku}</span></span><span className="tnum text-[12px]">{tk(v.price)} · {v.stock} in stock</span>
                    </button></li>
                  ))}
                </ul>
              )}
            </div>
            <ul className="mt-3 divide-y divide-[var(--line)]">
              {items.map((i) => (
                <li key={i.v.id} className="flex items-center gap-3 py-2">
                  <span className="flex-1">{i.v.label}</span>
                  <input type="number" min={1} max={i.v.stock} value={i.qty} onChange={(e) => setItems((xs) => xs.map((x) => x.v.id === i.v.id ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x))} className="input !w-16" aria-label="Qty" />
                  <span className="tnum w-20 text-right">{tk(i.v.price * i.qty)}</span>
                  <button type="button" onClick={() => setItems((xs) => xs.filter((x) => x.v.id !== i.v.id))} aria-label="Remove">✕</button>
                </li>
              ))}
            </ul>
            <p className="tnum mt-3 text-right font-semibold">Subtotal {tk(sub)}</p>
          </div>
        </div>
        <div className="card">
          <div className="card-h">Customer & delivery</div>
          <div className="card-b grid gap-3 sm:grid-cols-2">
            <label className="f"><span>Name</span><input required value={f.name} onChange={set("name")} className="input" /></label>
            <label className="f"><span>Phone</span><input required value={f.phone} onChange={set("phone")} className="input" inputMode="numeric" /></label>
            <label className="f sm:col-span-2"><span>Address</span><textarea required value={f.address} onChange={set("address")} className="input" /></label>
            <label className="f"><span>District</span><select value={f.district} onChange={set("district")} className="input">{districts.map((d) => <option key={d}>{d}</option>)}</select></label>
            <label className="f"><span>Area</span><input value={f.area} onChange={set("area")} className="input" /></label>
            <label className="f"><span>Email</span><input value={f.email} onChange={set("email")} className="input" type="email" /></label>
            <label className="f"><span>Note</span><input value={f.note} onChange={set("note")} className="input" /></label>
          </div>
        </div>
      </div>
      <div className="space-y-5">
        <div className="card">
          <div className="card-h">Payment & source</div>
          <div className="card-b space-y-3">
            <label className="f"><span>Source</span><select value={f.source} onChange={set("source")} className="input">{["facebook", "instagram", "whatsapp", "manual"].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="f"><span>Payment method</span><select value={f.paymentMethod} onChange={set("paymentMethod")} className="input">{["cod", "bkash", "nagad", "sslcommerz"].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={f.paid} onChange={set("paid")} /> Already paid in full</label>
            <label className="f"><span>Discount code</span><input value={f.code} onChange={set("code")} className="input uppercase" /></label>
            <label className="f"><span>Delivery charge override (৳, blank = auto)</span><input value={f.shipping} onChange={set("shipping")} className="input" type="number" min={0} /></label>
          </div>
        </div>
        {err && <p role="alert" className="chip-red rounded-lg px-3 py-2 text-[13px]">{err}</p>}
        <button className="btn btn-primary w-full !min-h-11" disabled={pending || !items.length}>{pending ? "Creating…" : "Create order"}</button>
      </div>
    </form>
  );
}
