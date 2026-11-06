import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { rangeFrom, salesReport } from "@/lib/reports";
import { BarChart, PageHeader, Stat, tk } from "@/components/admin/ui";

export const metadata = { title: "Dashboard" };
const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const r = rangeFrom(sp);
  const [rep, toConfirm, lowStock, pendingReviews, abandonedOpen] = await Promise.all([
    salesReport(r.from, r.to),
    db.order.count({ where: { orderStatus: "new" } }),
    db.$queryRaw<[{ n: bigint }]>`SELECT COUNT(*)::bigint AS n FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId" WHERE p.status = 'active' AND v.stock <= v."lowStockThreshold"`,
    db.review.count({ where: { status: "pending" } }),
    db.abandonedCheckout.count({ where: { recovered: false, createdAt: { gt: new Date(Date.now() - 3 * 86400e3) } } }),
  ]);
  const low = Number(lowStock[0]?.n ?? 0);
  const ranges = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"]];

  return (
    <>
      <PageHeader title={`Good ${new Date().getUTCHours() + 6 < 12 ? "morning" : "day"}, ${admin.name.split(" ")[0]}`}>
        <div className="tabs flex gap-1 rounded-xl bg-[var(--panel2)] p-1">
          {ranges.map(([k, l]) => <Link key={k} href={`/admin?range=${k}`} aria-current={r.key === k ? "page" : undefined}>{l}</Link>)}
        </div>
        <form className="flex items-center gap-1"><input type="hidden" name="range" value="custom" /><input type="date" name="from" defaultValue={sp.from} className="input !w-auto" aria-label="From" /><input type="date" name="to" defaultValue={sp.to} className="input !w-auto" aria-label="To" /><button className="btn btn-ghost">Go</button></form>
      </PageHeader>

      {(toConfirm > 0 || low > 0 || pendingReviews > 0 || abandonedOpen > 0) && (
        <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {toConfirm > 0 && <Link href="/admin/orders?tab=new" className="card card-b flex items-center justify-between hover:bg-[var(--panel2)]"><span><b className="tnum">{toConfirm}</b> orders to confirm</span>→</Link>}
          {low > 0 && <Link href="/admin/inventory?low=1" className="card card-b flex items-center justify-between hover:bg-[var(--panel2)]"><span><b className="tnum">{low}</b> low‑stock variants</span>→</Link>}
          {pendingReviews > 0 && <Link href="/admin/reviews" className="card card-b flex items-center justify-between hover:bg-[var(--panel2)]"><span><b className="tnum">{pendingReviews}</b> reviews pending</span>→</Link>}
          {abandonedOpen > 0 && <Link href="/admin/orders?tab=abandoned" className="card card-b flex items-center justify-between hover:bg-[var(--panel2)]"><span><b className="tnum">{abandonedOpen}</b> abandoned checkouts</span>→</Link>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Sales" value={tk(rep.sales)} sub={`${rep.cancelled} cancelled excluded`} />
        <Stat label="Orders" value={rep.orders} />
        <Stat label="Avg. order value" value={tk(rep.aov)} />
        <Stat label="Conversion rate" value={pct(rep.conversion)} sub={`${rep.visits.toLocaleString()} visits`} />
        <Stat label="Returning customers" value={pct(rep.returningPct)} />
        <Stat label="COD vs prepaid" value={`${Math.round(rep.codPct * 100)} / ${100 - Math.round(rep.codPct * 100)}`} sub="% of orders" />
        <Stat label="Delivered rate" value={pct(rep.deliveredPct)} sub={`${rep.delivered} delivered · ${rep.returned} returned`} />
        <Stat label="Abandoned recovered" value={rep.abandoned.total ? pct(rep.abandoned.recovered / rep.abandoned.total) : "—"} sub={`${rep.abandoned.recovered} of ${rep.abandoned.total}`} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="card-h">Sales over time <span className="text-[12px] font-normal text-[var(--muted)]">{tk(rep.sales)}</span></div>
          <div className="card-b">
            <BarChart data={rep.byDay.map((d) => ({ label: d.date, value: d.sales }))} />
            <div className="mt-2 flex justify-between text-[11px] text-[var(--muted)]"><span>{rep.byDay[0]?.date}</span><span>{rep.byDay.at(-1)?.date}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="card-h">Top products</div>
          <ul className="card-b space-y-2.5">
            {rep.topProducts.slice(0, 6).map((p) => {
              const max = rep.topProducts[0]?.revenue || 1;
              return <li key={p.id}><div className="flex justify-between text-[13px]"><span className="truncate">{p.title}</span><span className="tnum">{tk(p.revenue)}</span></div><div className="mt-1 h-1.5 rounded-full bg-[var(--panel2)]"><div className="h-full rounded-full bg-[var(--fg)]" style={{ width: `${(p.revenue / max) * 100}%` }} /></div></li>;
            })}
            {!rep.topProducts.length && <li className="text-[var(--muted)]">No sales in this range yet.</li>}
          </ul>
        </div>
      </div>
    </>
  );
}
