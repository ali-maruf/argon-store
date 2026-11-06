import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { dateOnly } from "@/lib/format";
import { PageHeader, Pagination, tk } from "@/components/admin/ui";

export const metadata = { title: "Customers" };
const SEGMENTS: Record<string, { label: string; where: Prisma.CustomerWhereInput }> = {
  all: { label: "All", where: {} },
  new: { label: "New (30d)", where: { createdAt: { gt: new Date(Date.now() - 30 * 86400e3) } } },
  repeat: { label: "Repeat", where: { orderCount: { gte: 2 } } },
  vip: { label: "VIP (৳5,000+)", where: { totalSpent: { gte: 5000 } } },
  risk: { label: "At‑risk", where: { riskScore: { gte: 20 } } },
  blocked: { label: "Blocked", where: { isBlocked: true } },
};

export default async function Customers({ searchParams }: { searchParams: Promise<{ seg?: string; q?: string; page?: string }> }) {
  await requireAdmin("customers.view");
  const sp = await searchParams;
  const seg = SEGMENTS[sp.seg ?? "all"] ? sp.seg ?? "all" : "all";
  const page = Math.max(1, Number(sp.page) || 1);
  const where: Prisma.CustomerWhereInput = { AND: [SEGMENTS[seg].where, sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" } }, { phone: { contains: sp.q } }, { email: { contains: sp.q, mode: "insensitive" } }] } : {}] };
  const [rows, total] = await Promise.all([db.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 50, take: 50, include: { _count: { select: { orders: true } } } }), db.customer.count({ where })]);
  return (
    <>
      <PageHeader title="Customers"><a className="btn btn-ghost" href={`/api/admin/customers/export?seg=${seg}`}>Export CSV</a></PageHeader>
      <div className="tabs no-scrollbar mb-3 flex gap-1 overflow-x-auto rounded-xl bg-[var(--panel2)] p-1">{Object.entries(SEGMENTS).map(([k, s]) => <Link key={k} href={`/admin/customers?seg=${k}`} aria-current={seg === k ? "page" : undefined}>{s.label}</Link>)}</div>
      <form className="card card-b mb-3 flex gap-2" method="get"><input type="hidden" name="seg" value={seg} /><input name="q" defaultValue={sp.q} placeholder="Name, phone or email" className="input !w-64" /><button className="btn btn-ghost">Search</button></form>
      <div className="card overflow-x-auto">
        <table className="t">
          <thead><tr><th>Customer</th><th>Phone</th><th className="text-right">Orders</th><th className="text-right">Spent (delivered)</th><th>Risk</th><th>Since</th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id}><td><Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">{c.name}</Link>{c.isBlocked && <span className="chip chip-red ml-2">blocked</span>}{c.tags.map((t) => <span key={t} className="chip ml-1">{t}</span>)}</td><td className="tnum">{c.phone}</td><td className="tnum text-right">{c._count.orders}</td><td className="tnum text-right">{tk(c.totalSpent)}</td><td>{c.riskScore >= 20 ? <span className="chip chip-red">{c.riskScore}</span> : c.riskScore}</td><td className="text-[12px]">{dateOnly(c.createdAt)}</td></tr>
          ))}{!rows.length && <tr><td colSpan={6} className="py-10 text-center text-[var(--muted)]">No customers.</td></tr>}</tbody>
        </table>
        <Pagination page={page} pages={Math.ceil(total / 50)} href={(p) => `/admin/customers?seg=${seg}&page=${p}${sp.q ? `&q=${sp.q}` : ""}`} />
      </div>
    </>
  );
}
