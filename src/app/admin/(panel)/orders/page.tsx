import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin, can } from "@/lib/auth";
import { ORDER_TABS, orderWhere, type OrderFilter as SP } from "@/lib/orders";
import { dateTime } from "@/lib/format";
import { DISTRICTS } from "@/lib/districts";
import { COURIERS } from "@/lib/couriers";
import { PageHeader, Pagination, tk } from "@/components/admin/ui";
import { OrdersTable } from "@/components/admin/OrdersTable";
import { saveView, deleteView } from "./actions";

export const metadata = { title: "Orders" };
const PER = 50;


export default async function Orders({ searchParams }: { searchParams: Promise<SP> }) {
  const admin = await requireAdmin("orders.view");
  const sp = await searchParams;
  const tab = sp.tab ?? "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const qs = (o: Partial<SP>) => { const u = new URLSearchParams(Object.entries({ ...sp, ...o }).filter(([, v]) => v) as [string, string][]); return `/admin/orders?${u}`; };
  const viewsRow = await db.setting.findUnique({ where: { key: "orderViews" } });
  const views = (viewsRow?.value as { name: string; query: string }[]) ?? [];
  const counts = await db.order.groupBy({ by: ["orderStatus"], _count: true });
  const newCount = counts.find((c) => c.orderStatus === "new")?._count ?? 0;
  const currentQuery = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();

  let body: React.ReactNode;
  if (tab === "abandoned") {
    const rows = await db.abandonedCheckout.findMany({ orderBy: { updatedAt: "desc" }, take: 100 });
    body = (
      <div className="card overflow-x-auto">
        <table className="t">
          <thead><tr><th>When</th><th>Customer</th><th>Phone</th><th>District</th><th>Cart value</th><th>Reminders</th><th>Status</th></tr></thead>
          <tbody>{rows.map((a) => (
            <tr key={a.id}><td className="text-[12px]">{dateTime(a.updatedAt)}</td><td>{a.name ?? "—"}</td><td><a className="underline" href={`tel:${a.phone}`}>{a.phone}</a> · <a className="underline" href={`https://wa.me/88${a.phone}`} target="_blank" rel="noopener">WA</a></td><td>{a.district ?? "—"}</td><td className="tnum">{tk(a.subtotal)}</td><td>{a.remindersSent}</td><td>{a.recovered ? <span className="chip chip-green">Recovered</span> : <span className="chip chip-yellow">Open</span>}</td></tr>
          ))}{!rows.length && <tr><td colSpan={7} className="py-10 text-center text-[var(--muted)]">No abandoned checkouts.</td></tr>}</tbody>
        </table>
      </div>
    );
  } else {
    const where = orderWhere(sp);
    const [orders, total] = await Promise.all([
      db.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PER, take: PER }),
      db.order.count({ where }),
    ]);
    body = (
      <div className="card overflow-hidden">
        <OrdersTable
          canEdit={can(admin, "orders.edit")} exportHref={`/api/admin/orders/export?${currentQuery}`}
          couriers={Object.values(COURIERS).map((c) => ({ key: c.key, name: c.name }))}
          rows={orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, date: dateTime(o.createdAt), customer: o.customerName, phone: o.customerPhone, district: o.district, total: o.total, paymentMethod: o.paymentMethod, paymentStatus: o.paymentStatus, fulfillmentStatus: o.fulfillmentStatus, orderStatus: o.orderStatus, source: o.source, courier: o.courier, tags: o.tags, calls: o.callAttempts }))}
        />
        <Pagination page={page} pages={Math.ceil(total / PER)} href={(p) => qs({ page: String(p) })} />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Orders">
        {can(admin, "orders.create") && <Link href="/admin/orders/new" className="btn btn-primary">+ Create order</Link>}
      </PageHeader>
      <div className="no-scrollbar tabs mb-3 flex gap-1 overflow-x-auto rounded-xl bg-[var(--panel2)] p-1">
        {ORDER_TABS.map((t) => <Link key={t} href={`/admin/orders?tab=${t}`} aria-current={tab === t ? "page" : undefined} className="capitalize">{t}{t === "new" && newCount ? ` (${newCount})` : ""}</Link>)}
      </div>
      {tab !== "abandoned" && (
        <details className="card mb-3" open={!!(sp.q || sp.from || sp.pm || sp.ps || sp.district || sp.courier || sp.tag || sp.source)}>
          <summary className="card-h cursor-pointer list-none">Search & filters {views.length > 0 && <span className="flex flex-wrap gap-1 font-normal">{views.map((v) => <Link key={v.name} href={`/admin/orders?${v.query}`} className="chip">★ {v.name}</Link>)}</span>}</summary>
          <form className="card-b grid gap-3 sm:grid-cols-2 lg:grid-cols-5" method="get">
            <input type="hidden" name="tab" value={tab} />
            <label className="f lg:col-span-2"><span>Search</span><input name="q" defaultValue={sp.q} className="input" placeholder="Order #, phone, name, tracking" /></label>
            <label className="f"><span>From</span><input type="date" name="from" defaultValue={sp.from} className="input" /></label>
            <label className="f"><span>To</span><input type="date" name="to" defaultValue={sp.to} className="input" /></label>
            <label className="f"><span>Payment method</span><select name="pm" defaultValue={sp.pm} className="input"><option value="">Any</option>{["cod", "bkash", "nagad", "sslcommerz"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="f"><span>Payment status</span><select name="ps" defaultValue={sp.ps} className="input"><option value="">Any</option>{["pending", "paid", "partially_paid", "refunded", "failed"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="f"><span>District</span><select name="district" defaultValue={sp.district} className="input"><option value="">Any</option>{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select></label>
            <label className="f"><span>Courier</span><select name="courier" defaultValue={sp.courier} className="input"><option value="">Any</option>{Object.values(COURIERS).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></label>
            <label className="f"><span>Source</span><select name="source" defaultValue={sp.source} className="input"><option value="">Any</option>{["web", "manual", "whatsapp", "facebook", "instagram"].map((x) => <option key={x}>{x}</option>)}</select></label>
            <label className="f"><span>Tag</span><input name="tag" defaultValue={sp.tag} className="input" /></label>
            <div className="flex items-end gap-2 lg:col-span-5"><button className="btn btn-primary">Apply</button><Link href={`/admin/orders?tab=${tab}`} className="btn btn-ghost">Reset</Link></div>
          </form>
          {currentQuery && (
            <div className="card-b flex flex-wrap items-center gap-2 border-t border-[var(--line)]">
              <form action={saveView} className="flex gap-2"><input type="hidden" name="query" value={currentQuery} /><input name="name" placeholder="Save this view as…" className="input !w-48" required /><button className="btn btn-ghost">Save view</button></form>
              {views.map((v) => <form key={v.name} action={deleteView}><input type="hidden" name="name" value={v.name} /><button className="chip" title="Delete view">✕ {v.name}</button></form>)}
            </div>
          )}
        </details>
      )}
      {body}
    </>
  );
}
