import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { rangeFrom, salesReport } from "@/lib/reports";
import { BarChart, PageHeader, Stat, tk } from "@/components/admin/ui";

export const metadata = { title: "Analytics" };
const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

export default async function Reports({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  await requireAdmin("reports.view");
  const sp = await searchParams;
  const r = rangeFrom(sp);
  const rep = await salesReport(r.from, r.to);
  const q = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]).toString();
  const exp = (kind: string) => `/api/admin/reports/export?kind=${kind}&${q}`;
  const f = rep.funnel;
  const steps = [["Visits", f.visits], ["Product views", f.productViews], ["Add to cart", f.addToCart], ["Checkout started", f.checkout], ["Orders", f.orders]] as const;
  return (
    <>
      <PageHeader title="Analytics & reports">
        <div className="tabs flex gap-1 rounded-xl bg-[var(--panel2)] p-1">{[["today", "Today"], ["7d", "7d"], ["30d", "30d"], ["90d", "90d"]].map(([k, l]) => <Link key={k} href={`/admin/reports?range=${k}`} aria-current={r.key === k ? "page" : undefined}>{l}</Link>)}</div>
        <form className="flex gap-1"><input type="hidden" name="range" value="custom" /><input type="date" name="from" defaultValue={sp.from} className="input !w-auto" aria-label="From" /><input type="date" name="to" defaultValue={sp.to} className="input !w-auto" aria-label="To" /><button className="btn btn-ghost">Go</button></form>
      </PageHeader>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales" value={tk(rep.sales)} /><Stat label="Orders" value={rep.orders} />
        <Stat label="Gross profit (from cost price)" value={rep.profit.hasCost ? tk(rep.profit.gross) : "—"} sub={rep.profit.hasCost ? `${pct(rep.profit.gross, rep.profit.revenue)} margin` : "Add cost prices to variants"} />
        <Stat label="Abandoned recovery" value={pct(rep.abandoned.recovered, rep.abandoned.total)} sub={`${rep.abandoned.recovered}/${rep.abandoned.total}`} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="card"><div className="card-h">Sales by day <a className="text-[12px] font-normal underline" href={exp("days")}>CSV</a></div><div className="card-b"><BarChart data={rep.byDay.map((d) => ({ label: d.date, value: d.sales }))} /></div></div>
        <div className="card">
          <div className="card-h">Conversion funnel</div>
          <ul className="card-b space-y-2">{steps.map(([l, v], i) => <li key={l}><div className="flex justify-between text-[13px]"><span>{l}</span><span className="tnum">{v.toLocaleString()} {i > 0 && <span className="text-[var(--muted)]">({pct(v, steps[i - 1][1])})</span>}</span></div><div className="mt-1 h-2 rounded-full bg-[var(--panel2)]"><div className="h-full rounded-full bg-[var(--fg)]" style={{ width: pct(v, Math.max(1, steps[0][1])) }} /></div></li>)}</ul>
        </div>
        <Table title="By product" href={exp("products")} head={["Product", "Units", "Revenue", "Profit"]} rows={rep.topProducts.map((p) => [p.title, p.qty, tk(p.revenue), p.cost ? tk(p.revenue - p.cost) : "—"])} />
        <Table title="By category" href={exp("categories")} head={["Category", "Revenue"]} rows={rep.byCategory.map(([c, v]) => [c, tk(v)])} />
        <Table title="By district" href={exp("districts")} head={["District", "Orders", "Sales"]} rows={rep.byDistrict.map(([d, v]) => [d, v.orders, tk(v.sales)])} />
        <Table title="Payment method mix" href={exp("payments")} head={["Method", "Orders", "Sales"]} rows={rep.paymentMix.map(([m, v]) => [m.toUpperCase(), v.orders, tk(v.sales)])} />
        <Table title="Courier performance" href={exp("couriers")} head={["Courier", "Sent", "Delivered %", "Returned %"]} rows={rep.couriers.map(([c, v]) => [c, v.sent, pct(v.delivered, v.sent), pct(v.returned, v.sent)])} />
      </div>
    </>
  );
}

function Table({ title, head, rows, href }: { title: string; head: string[]; rows: (string | number)[][]; href: string }) {
  return (
    <div className="card overflow-x-auto">
      <div className="card-h">{title}<a className="text-[12px] font-normal underline" href={href}>CSV</a></div>
      <table className="t"><thead><tr>{head.map((h, i) => <th key={h} className={i ? "text-right" : ""}>{h}</th>)}</tr></thead>
        <tbody>{rows.slice(0, 15).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? "tnum text-right" : "capitalize"}>{c}</td>)}</tr>)}{!rows.length && <tr><td colSpan={head.length} className="py-6 text-center text-[var(--muted)]">No data</td></tr>}</tbody></table>
    </div>
  );
}
