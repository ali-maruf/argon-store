import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, can } from "@/lib/auth";
import { adminMutation, fdStr } from "@/lib/admin";
import { dateOnly } from "@/lib/format";
import { phoneRisk } from "@/lib/security";
import { Chip, PageHeader, Stat, tk } from "@/components/admin/ui";

export const metadata = { title: "Customer" };

async function saveCustomer(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id");
  await adminMutation("customers.edit", "update_customer", "customer", id, async () => db.customer.update({ where: { id }, data: { notes: fdStr(fd, "notes").slice(0, 2000), tags: fdStr(fd, "tags").split(",").map((t) => t.trim()).filter(Boolean) } }));
  revalidatePath(`/admin/customers/${id}`);
}
async function toggleBlock(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id");
  await adminMutation("customers.edit", "toggle_block", "customer", id, async () => {
    const c = await db.customer.findUniqueOrThrow({ where: { id } });
    if (c.isBlocked) await db.blocklist.deleteMany({ where: { type: "phone", value: c.phone } });
    else await db.blocklist.upsert({ where: { type_value: { type: "phone", value: c.phone } }, create: { type: "phone", value: c.phone, reason: "Blocked from profile" }, update: {} });
    return db.customer.update({ where: { id }, data: { isBlocked: !c.isBlocked } });
  });
  revalidatePath(`/admin/customers/${id}`);
}

export default async function Customer({ params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin("customers.view");
  const { id } = await params;
  const c = await db.customer.findUnique({ where: { id }, include: { orders: { orderBy: { createdAt: "desc" }, take: 100 } } });
  if (!c) notFound();
  const risk = await phoneRisk(c.phone);
  const ltv = c.orders.filter((o) => o.orderStatus !== "cancelled").reduce((s, o) => s + o.total, 0);
  return (
    <>
      <PageHeader back="/admin/customers" title={c.name}>
        {c.isBlocked && <Chip v="blocked" />}
        <a className="btn btn-ghost" href={`tel:${c.phone}`}>☎ {c.phone}</a>
        <a className="btn btn-ghost" target="_blank" rel="noopener" href={`https://wa.me/88${c.phone}`}>WhatsApp</a>
        {can(admin, "customers.edit") && <form action={toggleBlock}><input type="hidden" name="id" value={c.id} /><button className={`btn ${c.isBlocked ? "btn-ghost" : "btn-danger"}`}>{c.isBlocked ? "Unblock" : "Block"}</button></form>}
      </PageHeader>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Lifetime value (placed)" value={tk(ltv)} />
        <Stat label="Delivered spend" value={tk(c.totalSpent)} />
        <Stat label="Orders" value={c.orders.length} sub={`${risk.delivered} delivered · ${risk.returned} returned · ${risk.cancelled} cancelled`} />
        <Stat label="Success ratio" value={risk.successRatio == null ? "—" : `${Math.round(risk.successRatio * 100)}%`} sub={`Risk score ${c.riskScore}`} />
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="card overflow-x-auto lg:col-span-2">
          <div className="card-h">Orders</div>
          <table className="t"><tbody>{c.orders.map((o) => <tr key={o.id}><td><Link href={`/admin/orders/${o.id}`} className="tnum underline">{o.orderNumber}</Link></td><td className="text-[12px]">{dateOnly(o.createdAt)}</td><td className="tnum">{tk(o.total)}</td><td><Chip v={o.paymentStatus} /></td><td><Chip v={o.orderStatus === "cancelled" ? "cancelled" : o.fulfillmentStatus} /></td></tr>)}</tbody></table>
        </div>
        <form action={saveCustomer} className="card">
          <input type="hidden" name="id" value={c.id} />
          <div className="card-h">Notes & tags <button className="btn btn-primary" disabled={!can(admin, "customers.edit")}>Save</button></div>
          <div className="card-b space-y-3">
            <p className="text-[13px]">{c.email ?? "No email"} · since {dateOnly(c.createdAt)}</p>
            <label className="f"><span>Tags</span><input name="tags" defaultValue={c.tags.join(", ")} className="input" /></label>
            <label className="f"><span>Internal notes</span><textarea name="notes" defaultValue={c.notes} className="input" rows={5} /></label>
          </div>
        </form>
      </div>
    </>
  );
}
