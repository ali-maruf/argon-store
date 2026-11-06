"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkOrders, type BulkResult } from "@/app/admin/(panel)/orders/actions";

type Row = { id: string; orderNumber: string; date: string; customer: string; phone: string; district: string; total: number; paymentMethod: string; paymentStatus: string; fulfillmentStatus: string; orderStatus: string; source: string; courier: string | null; tags: string[]; calls: number };
const C: Record<string, string> = { paid: "green", delivered: "green", completed: "green", confirmed: "blue", shipped: "blue", processing: "blue", pending: "yellow", new: "yellow", unfulfilled: "yellow", on_hold: "yellow", partially_paid: "yellow", failed: "red", cancelled: "red", returned: "red", refunded: "red" };
const Chip = ({ v }: { v: string }) => <span className={`chip ${C[v] ? `chip-${C[v]}` : ""}`}>{v.replace(/_/g, " ")}</span>;

export function OrdersTable({ rows, canEdit, couriers, exportHref }: { rows: Row[]; canEdit: boolean; couriers: { key: string; name: string }[]; exportHref: string }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [courier, setCourier] = useState(couriers[0]?.key ?? "steadfast");
  const [res, setRes] = useState<BulkResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const all = rows.length > 0 && sel.size === rows.length;
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const ids = [...sel];
  const run = (a: "confirm" | "cancel" | "ship" | "courier" | "deliver") => {
    if (a === "cancel" && !confirm(`Cancel ${ids.length} orders and restock items?`)) return;
    start(async () => { const r = await bulkOrders(ids, a, courier); setRes(r); setSel(new Set()); router.refresh(); });
  };
  const print = (type: string) => window.open(`/admin/orders/print?type=${type}&ids=${ids.join(",")}`, "_blank");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
        <span className="text-[13px] text-[var(--muted)]">{sel.size ? `${sel.size} selected` : `${rows.length} orders`}</span>
        {sel.size > 0 && canEdit && (
          <>
            <button className="btn btn-ghost" disabled={pending} onClick={() => run("confirm")}>Confirm</button>
            <span className="flex items-center gap-1">
              <select className="input !w-auto" value={courier} onChange={(e) => setCourier(e.target.value)} aria-label="Courier">{couriers.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select>
              <button className="btn btn-ghost" disabled={pending} onClick={() => run("courier")}>Send to courier</button>
            </span>
            <button className="btn btn-ghost" disabled={pending} onClick={() => run("ship")}>Mark shipped</button>
            <button className="btn btn-ghost" disabled={pending} onClick={() => run("deliver")}>Mark delivered</button>
            <button className="btn btn-ghost text-[#b4232f]" disabled={pending} onClick={() => run("cancel")}>Cancel</button>
          </>
        )}
        {sel.size > 0 && (
          <>
            <button className="btn btn-ghost" onClick={() => print("invoice")}>Print invoices</button>
            <button className="btn btn-ghost" onClick={() => print("label-a4")}>Labels A4</button>
            <button className="btn btn-ghost" onClick={() => print("label-thermal")}>Labels 4×6</button>
          </>
        )}
        <a className="btn btn-ghost ml-auto" href={sel.size ? `/api/admin/orders/export?ids=${ids.join(",")}` : exportHref}>Export CSV</a>
        {pending && <span className="orbit !h-5 !w-5" aria-label="Working" />}
      </div>
      {res && (
        <div className={`px-4 py-2 text-[13px] ${res.failed.length ? "chip-yellow" : "chip-green"}`} role="status">
          {res.ok} done{res.failed.length ? ` · ${res.failed.length} failed: ${res.failed.map((f) => `${f.orderNumber} (${f.error})`).join("; ")}` : ""}
          <button className="ml-3 underline" onClick={() => setRes(null)}>dismiss</button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="t">
          <thead><tr>
            <th className="w-8"><input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all" /></th>
            <th>Order</th><th>Date</th><th>Customer</th><th>District</th><th className="text-right">Total</th><th>Payment</th><th>Fulfillment</th><th>Status</th><th>Source</th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={sel.has(r.id) ? "bg-[var(--panel2)]" : ""}>
                <td><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Select ${r.orderNumber}`} /></td>
                <td><Link href={`/admin/orders/${r.id}`} className="tnum font-semibold hover:underline">{r.orderNumber}</Link>{r.tags.length > 0 && <div className="mt-0.5 flex gap-1">{r.tags.slice(0, 2).map((t) => <span key={t} className="chip !text-[10px]">{t}</span>)}</div>}</td>
                <td className="whitespace-nowrap text-[12px] text-[var(--muted)]">{r.date}</td>
                <td><div>{r.customer}</div><div className="tnum text-[12px] text-[var(--muted)]">{r.phone}</div></td>
                <td>{r.district}</td>
                <td className="tnum text-right">৳{r.total.toLocaleString("en-IN")}</td>
                <td><div className="flex flex-col items-start gap-1"><span className="text-[11px] uppercase text-[var(--muted)]">{r.paymentMethod}</span><Chip v={r.paymentStatus} /></div></td>
                <td><Chip v={r.fulfillmentStatus} />{r.courier && <div className="mt-1 text-[11px] text-[var(--muted)]">{r.courier}</div>}</td>
                <td><Chip v={r.orderStatus} />{r.calls > 0 && <div className="mt-1 text-[11px] text-[var(--muted)]">☎ {r.calls}</div>}</td>
                <td className="text-[12px]">{r.source}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={10} className="py-12 text-center text-[var(--muted)]">No orders match.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
