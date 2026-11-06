import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { dateTime } from "@/lib/format";
import { PageHeader, Pagination } from "@/components/admin/ui";

export const metadata = { title: "Audit log" };

export default async function Audit({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  await requireAdmin("audit.view");
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const where = sp.q ? { OR: [{ action: { contains: sp.q } }, { entity: { contains: sp.q } }, { adminName: { contains: sp.q, mode: "insensitive" as const } }, { entityId: sp.q }] } : {};
  const [rows, total] = await Promise.all([db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 100, take: 100 }), db.auditLog.count({ where })]);
  return (
    <>
      <PageHeader title="Audit log" />
      <form className="card card-b mb-3 flex gap-2" method="get"><input name="q" defaultValue={sp.q} placeholder="Action, entity, admin or ID" className="input !w-72" /><button className="btn btn-ghost">Filter</button></form>
      <div className="card overflow-x-auto">
        <table className="t text-[13px]">
          <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Entity</th><th>Details</th><th>IP</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id} className="align-top"><td className="whitespace-nowrap text-[12px]">{dateTime(r.createdAt)}</td><td>{r.adminName ?? "—"}</td><td><span className="chip">{r.action}</span></td><td className="font-mono text-[11px]">{r.entity}{r.entityId ? `:${r.entityId.slice(0, 24)}` : ""}</td><td className="max-w-md truncate font-mono text-[11px] text-[var(--muted)]" title={JSON.stringify(r.details)}>{r.details ? JSON.stringify(r.details).slice(0, 140) : ""}</td><td className="text-[11px]">{r.ip}</td></tr>
          ))}</tbody>
        </table>
        <Pagination page={page} pages={Math.ceil(total / 100)} href={(p) => `/admin/audit?page=${p}${sp.q ? `&q=${sp.q}` : ""}`} />
      </div>
    </>
  );
}
