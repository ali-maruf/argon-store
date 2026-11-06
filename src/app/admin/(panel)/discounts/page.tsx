import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { adminMutation, fdBool, fdInt, fdIntOrNull, fdList, fdStr } from "@/lib/admin";
import { dateOnly } from "@/lib/format";
import { PageHeader, tk } from "@/components/admin/ui";
import type { Discount } from "@prisma/client";

export const metadata = { title: "Discounts" };
const TYPES = ["percent", "fixed", "free_shipping", "bogo", "bundle"] as const;

async function saveDiscount(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id");
  const type = fdStr(fd, "type") as (typeof TYPES)[number];
  if (!TYPES.includes(type)) throw new Error("Invalid type");
  const automatic = fdBool(fd, "automatic");
  const data = {
    title: fdStr(fd, "title"), code: automatic ? null : fdStr(fd, "code").toUpperCase() || null, automatic, type, value: fdInt(fd, "value"), minOrder: fdInt(fd, "minOrder"),
    bundleQty: fdIntOrNull(fd, "bundleQty"), bundlePrice: fdIntOrNull(fd, "bundlePrice"), usageLimit: fdIntOrNull(fd, "usageLimit"), perCustomerLimit: fdIntOrNull(fd, "perCustomerLimit"),
    appliesTo: { categories: fdList(fd, "categories"), productIds: [] as string[] }, active: fdBool(fd, "active"),
    startsAt: fdStr(fd, "startsAt") ? new Date(fdStr(fd, "startsAt")) : null, endsAt: fdStr(fd, "endsAt") ? new Date(fdStr(fd, "endsAt")) : null,
  };
  await adminMutation("discounts.edit", id ? "update_discount" : "create_discount", "discount", id || null, async () => (id ? db.discount.update({ where: { id }, data }) : db.discount.create({ data })), { details: data });
  revalidatePath("/admin/discounts");
}

function Form({ d }: { d?: Discount }) {
  const ap = (d?.appliesTo ?? {}) as { categories?: string[] };
  const dt = (x?: Date | null) => (x ? new Date(x.getTime() + 6 * 3600e3).toISOString().slice(0, 16) : "");
  return (
    <form action={saveDiscount} className="grid gap-3 sm:grid-cols-4">
      {d && <input type="hidden" name="id" value={d.id} />}
      <label className="f sm:col-span-2"><span>Title (shown to customer)</span><input name="title" defaultValue={d?.title} required className="input" /></label>
      <label className="f"><span>Code (blank for automatic)</span><input name="code" defaultValue={d?.code ?? ""} className="input uppercase" /></label>
      <label className="f"><span>Type</span><select name="type" defaultValue={d?.type ?? "percent"} className="input">{TYPES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}</select></label>
      <label className="f"><span>Value (% / ৳ / BOGO % off 2nd)</span><input name="value" type="number" defaultValue={d?.value ?? 10} className="input" /></label>
      <label className="f"><span>Min. order ৳ (spend X get Y)</span><input name="minOrder" type="number" defaultValue={d?.minOrder ?? 0} className="input" /></label>
      <label className="f"><span>Bundle qty</span><input name="bundleQty" type="number" defaultValue={d?.bundleQty ?? ""} className="input" /></label>
      <label className="f"><span>Bundle price ৳</span><input name="bundlePrice" type="number" defaultValue={d?.bundlePrice ?? ""} className="input" /></label>
      <label className="f"><span>Applies to categories (blank = all)</span><input name="categories" defaultValue={ap.categories?.join(", ")} placeholder="rings, chains" className="input" /></label>
      <label className="f"><span>Total usage limit</span><input name="usageLimit" type="number" defaultValue={d?.usageLimit ?? ""} className="input" /></label>
      <label className="f"><span>Per‑customer limit</span><input name="perCustomerLimit" type="number" defaultValue={d?.perCustomerLimit ?? ""} className="input" /></label>
      <label className="f"><span>Starts</span><input name="startsAt" type="datetime-local" defaultValue={dt(d?.startsAt)} className="input" /></label>
      <label className="f"><span>Ends</span><input name="endsAt" type="datetime-local" defaultValue={dt(d?.endsAt)} className="input" /></label>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="automatic" defaultChecked={d?.automatic} /> Automatic (no code)</label>
      <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="active" defaultChecked={d?.active ?? true} /> Active</label>
      <div className="sm:col-span-4"><button className="btn btn-primary">{d ? "Save" : "Create discount"}</button></div>
    </form>
  );
}

export default async function Discounts() {
  await requireAdmin("discounts.edit");
  const rows = await db.discount.findMany({ orderBy: { createdAt: "desc" } });
  return (
    <>
      <PageHeader title="Discounts & offers" />
      <details className="card mb-5"><summary className="card-h cursor-pointer list-none">+ Create discount <span className="text-[12px] font-normal text-[var(--muted)]">codes · automatic · free shipping · BOGO · bundles · tiered spend</span></summary><div className="card-b"><Form /></div></details>
      <div className="card overflow-x-auto">
        <table className="t">
          <thead><tr><th>Discount</th><th>Type</th><th>Status</th><th className="text-right">Used</th><th className="text-right">Revenue</th><th>Window</th><th /></tr></thead>
          <tbody>{rows.map((d) => (
            <tr key={d.id} className="align-top">
              <td><div className="font-medium">{d.code ? <span className="font-mono">{d.code}</span> : <span className="chip">automatic</span>}</div><div className="text-[12px] text-[var(--muted)]">{d.title}</div></td>
              <td>{d.type.replace("_", " ")} {d.type === "percent" ? `${d.value}%` : d.type === "fixed" ? tk(d.value) : d.type === "bundle" ? `${d.bundleQty} for ${tk(d.bundlePrice ?? 0)}` : ""}{d.minOrder ? <div className="text-[11px] text-[var(--muted)]">min {tk(d.minOrder)}</div> : null}</td>
              <td>{d.active ? <span className="chip chip-green">active</span> : <span className="chip">off</span>}</td>
              <td className="tnum text-right">{d.usageCount}{d.usageLimit ? ` / ${d.usageLimit}` : ""}</td>
              <td className="tnum text-right">{tk(d.revenue)}</td>
              <td className="text-[12px]">{d.startsAt ? dateOnly(d.startsAt) : "—"} → {d.endsAt ? dateOnly(d.endsAt) : "∞"}</td>
              <td><details><summary className="cursor-pointer text-[12px] underline">Edit</summary><div className="mt-3 w-[min(90vw,900px)]"><Form d={d} /></div></details></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </>
  );
}
