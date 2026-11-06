import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { adminMutation, fdInt, fdList, fdStr } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { COURIERS } from "@/lib/couriers";
import { Notice, PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Shipping" };

async function saveZone(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id");
  await adminMutation("shipping.edit", "update_zone", "shipping_zone", id, async () => db.shippingZone.update({ where: { id }, data: {
    name: fdStr(fd, "name"), nameBn: fdStr(fd, "nameBn") || null, rate: fdInt(fd, "rate"), perKgRate: fdInt(fd, "perKgRate"), eta: fdStr(fd, "eta"),
    districts: fdList(fd, "districts"), areas: fdList(fd, "areas"), courier: fdStr(fd, "courier") || null,
  } }), { tags: ["shipping"] });
  revalidatePath("/admin/shipping");
}

export default async function Shipping({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin("shipping.edit");
  const { msg } = await searchParams;
  const [zones, s] = await Promise.all([db.shippingZone.findMany({ orderBy: { position: "asc" } }), getSettings()]);
  return (
    <>
      <PageHeader title="Shipping & delivery" />
      <Notice msg={msg} />
      <div className="grid gap-5 lg:grid-cols-2">
        {zones.map((z) => (
          <form key={z.id} action={saveZone} className="card">
            <input type="hidden" name="id" value={z.id} />
            <div className="card-h">{z.name} <span className="font-mono text-[11px] font-normal text-[var(--muted)]">{z.key}</span><button className="btn btn-primary">Save</button></div>
            <div className="card-b grid gap-3 sm:grid-cols-2">
              <label className="f"><span>Name</span><input name="name" defaultValue={z.name} className="input" /></label>
              <label className="f"><span>Name (BN)</span><input name="nameBn" defaultValue={z.nameBn ?? ""} className="input" /></label>
              <label className="f"><span>Flat rate ৳</span><input name="rate" type="number" defaultValue={z.rate} className="input" /></label>
              <label className="f"><span>Extra per kg over 0.5 kg ৳ (weight‑based)</span><input name="perKgRate" type="number" defaultValue={z.perKgRate} className="input" /></label>
              <label className="f"><span>Delivery time</span><input name="eta" defaultValue={z.eta} className="input" /></label>
              <label className="f"><span>Default courier</span><select name="courier" defaultValue={z.courier ?? ""} className="input"><option value="">Store default</option>{Object.values(COURIERS).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select></label>
              <label className="f sm:col-span-2"><span>Districts in this zone {z.key === "outside_dhaka" ? "(blank = every district not matched elsewhere)" : ""}</span><input name="districts" defaultValue={z.districts.join(", ")} className="input" /></label>
              <label className="f sm:col-span-2"><span>Areas / thanas that map here (overrides district)</span><input name="areas" defaultValue={z.areas.join(", ")} className="input" /></label>
            </div>
          </form>
        ))}
        <SettingsForm section="shipping" title="Free delivery" back="/admin/shipping" cols={1} fields={[
          { name: "freeThreshold", label: "Free delivery threshold ৳", type: "number", value: s.shipping.freeThreshold },
          { name: "freeZones", label: "Zones that get free delivery (keys)", type: "list", value: s.shipping.freeZones, help: "inside_dhaka, sub_dhaka, outside_dhaka" },
        ]} />
        <div className="card">
          <div className="card-h">Courier integrations</div>
          <ul className="divide-y divide-[var(--line)]">
            {Object.values(COURIERS).filter((c) => c.key !== "manual").map((c) => <li key={c.key} className="flex items-center justify-between px-4 py-3"><span>{c.name}</span>{c.configured() ? <span className="chip chip-green">API connected</span> : <span className="chip chip-yellow">Add credentials in environment</span>}</li>)}
          </ul>
          <p className="border-t border-[var(--line)] px-4 py-3 text-[12px] text-[var(--muted)]">API keys live in environment variables (never in the database): STEADFAST_API_KEY / STEADFAST_SECRET_KEY, PATHAO_CLIENT_ID / PATHAO_CLIENT_SECRET / PATHAO_USERNAME / PATHAO_PASSWORD / PATHAO_STORE_ID, REDX_API_TOKEN. Status sync runs every 30 minutes.</p>
        </div>
        <SettingsForm section="couriers" title="Courier defaults" back="/admin/shipping" cols={1} fields={[
          { name: "default", label: "Default courier", type: "select", value: s.couriers.default, options: Object.keys(COURIERS) },
        ]} />
      </div>
    </>
  );
}
