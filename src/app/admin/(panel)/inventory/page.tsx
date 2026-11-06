import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin, can } from "@/lib/auth";
import { adminMutation, fdInt, fdStr } from "@/lib/admin";
import { dateTime } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Notice, PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Inventory" };

async function adjust(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id"); const mode = fdStr(fd, "mode"); const n = fdInt(fd, "n"); const reason = fdStr(fd, "reason"); const note = fdStr(fd, "note");
  if (!["received", "damaged", "correction", "return"].includes(reason)) throw new Error("Pick a reason");
  await adminMutation("inventory.edit", "inventory_adjust", "variant", id, async (admin) => {
    await db.$transaction(async (tx) => {
      const v = await tx.productVariant.findUniqueOrThrow({ where: { id } });
      const delta = mode === "set" ? n - v.stock : reason === "damaged" ? -Math.abs(n) : n;
      if (!delta) return;
      await tx.productVariant.update({ where: { id }, data: { stock: { increment: delta } } });
      await tx.inventoryAdjustment.create({ data: { variantId: id, delta, reason, note: note || null, adminId: admin.id } });
    });
  }, { tags: ["catalog"], details: { mode, n, reason } });
  revalidatePath("/admin/inventory");
}

export default async function Inventory({ searchParams }: { searchParams: Promise<{ q?: string; low?: string; msg?: string }> }) {
  const admin = await requireAdmin("products.view");
  const sp = await searchParams;
  const where: Prisma.ProductVariantWhereInput = { ...(sp.q ? { OR: [{ sku: { contains: sp.q, mode: "insensitive" } }, { product: { title: { contains: sp.q, mode: "insensitive" } } }] } : {}) };
  const [variants, log, settings] = await Promise.all([
    db.productVariant.findMany({ where, include: { product: { select: { title: true, status: true } } }, orderBy: [{ stock: "asc" }], take: 400 }),
    db.inventoryAdjustment.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { variant: { select: { sku: true } } } }),
    getSettings(),
  ]);
  const rows = sp.low ? variants.filter((v) => v.stock <= v.lowStockThreshold) : variants;
  const admins = Object.fromEntries((await db.adminUser.findMany({ select: { id: true, name: true } })).map((a) => [a.id, a.name]));
  const edit = can(admin, "inventory.edit");
  return (
    <>
      <PageHeader title="Inventory"><a href={sp.low ? "/admin/inventory" : "/admin/inventory?low=1"} className="btn btn-ghost">{sp.low ? "Show all" : "Low stock only"}</a></PageHeader>
      <Notice msg={sp.msg} />
      <form className="card card-b mb-3 flex gap-2" method="get"><input name="q" defaultValue={sp.q} placeholder="SKU or product" className="input !w-64" />{sp.low && <input type="hidden" name="low" value="1" />}<button className="btn btn-ghost">Search</button></form>
      <div className="grid gap-5 xl:grid-cols-3">
        <div className="card overflow-x-auto xl:col-span-2">
          <table className="t">
            <thead><tr><th>Product</th><th>SKU</th><th className="text-right">On hand</th>{edit && <th>Adjust</th>}</tr></thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td><div className="font-medium">{v.product.title}</div><div className="text-[12px] text-[var(--muted)]">{v.title}{v.product.status !== "active" ? ` · ${v.product.status}` : ""}</div></td>
                  <td className="font-mono text-[12px]">{v.sku}</td>
                  <td className={`tnum text-right font-semibold ${v.stock <= v.lowStockThreshold ? "text-[#b4232f]" : ""}`}>{v.stock}</td>
                  {edit && (
                    <td>
                      <form action={adjust} className="flex flex-wrap items-center gap-1">
                        <input type="hidden" name="id" value={v.id} />
                        <select name="mode" className="input !w-auto !text-[12px]" aria-label="Mode"><option value="add">+/−</option><option value="set">Set to</option></select>
                        <input name="n" type="number" className="input !w-20 tnum" required aria-label="Quantity" />
                        <select name="reason" className="input !w-auto !text-[12px]" aria-label="Reason"><option value="received">Received</option><option value="correction">Correction</option><option value="damaged">Damaged</option><option value="return">Return</option></select>
                        <input name="note" placeholder="Note" className="input !w-28 !text-[12px]" aria-label="Note" />
                        <button className="btn btn-ghost">Save</button>
                      </form>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-5">
          <div className="card">
            <div className="card-h">Adjustment log</div>
            <ul className="divide-y divide-[var(--line)] text-[12px]">
              {log.map((l) => <li key={l.id} className="flex items-center gap-2 px-4 py-2"><span className={`tnum w-10 font-semibold ${l.delta < 0 ? "text-[#b4232f]" : "text-[#0b6b3a]"}`}>{l.delta > 0 ? "+" : ""}{l.delta}</span><span className="font-mono">{l.variant.sku}</span><span className="chip">{l.reason}</span><span className="ml-auto text-right text-[var(--muted)]">{l.note ?? ""}<br />{dateTime(l.createdAt)}{l.adminId ? ` · ${admins[l.adminId] ?? ""}` : ""}</span></li>)}
            </ul>
          </div>
          {can(admin, "notifications.edit") && <SettingsForm section="notifications" title="Low‑stock alerts" back="/admin/inventory" cols={1} fields={[
            { name: "lowStockAlerts", label: "Send daily low‑stock alert to the owner", type: "bool", value: settings.notifications.lowStockAlerts },
            { name: "ownerPhone", label: "Owner phone (SMS)", value: settings.notifications.ownerPhone },
            { name: "ownerEmail", label: "Owner email", type: "email", value: settings.notifications.ownerEmail },
          ]} />}
        </div>
      </div>
    </>
  );
}
