import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { Notice, PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin("settings.edit");
  const { msg } = await searchParams;
  const s = await getSettings();
  const st = s.store;
  return (
    <>
      <PageHeader title="Settings" />
      <Notice msg={msg} />
      <div className="grid gap-5">
        <SettingsForm section="store" title="Store details" back="/admin/settings" cols={3} fields={[
          { name: "name", label: "Store name", value: st.name }, { name: "tagline", label: "Tagline", value: st.tagline },
          { name: "email", label: "Contact email", type: "email", value: st.email }, { name: "phone", label: "Phone", value: st.phone },
          { name: "whatsapp", label: "WhatsApp number (880…)", value: st.whatsapp }, { name: "messenger", label: "Messenger username", value: st.messenger },
          { name: "address", label: "Address", value: st.address }, { name: "instagram", label: "Instagram URL", type: "url", value: st.instagram },
          { name: "facebook", label: "Facebook URL", type: "url", value: st.facebook }, { name: "tiktok", label: "TikTok URL", type: "url", value: st.tiktok },
          { name: "orderPrefix", label: "Order number prefix", value: st.orderPrefix }, { name: "currency", label: "Currency", type: "select", value: st.currency, options: ["BDT"] },
          { name: "taxEnabled", label: "Charge tax/VAT", type: "bool", value: st.taxEnabled }, { name: "taxRate", label: "Tax rate %", type: "number", value: st.taxRate },
          { name: "invoiceFooter", label: "Invoice footer", type: "textarea", value: st.invoiceFooter },
        ]} />
        <SettingsForm section="seo" title="Search engines & availability" back="/admin/settings" fields={[
          { name: "indexing", label: "Allow search engines (robots.txt + sitemap)", type: "bool", value: s.seo.indexing },
          { name: "maintenance", label: "Maintenance mode (storefront shows a holding page; admin stays available)", type: "bool", value: s.seo.maintenance },
        ]} />
        <div className="card card-b text-[13px] text-[var(--muted)]">
          <p><b className="text-[var(--fg)]">Languages:</b> English (default, at /) and Bangla (at /bn). Product titles, descriptions, pages, templates and the announcement bar each have EN/BN fields.</p>
          <p className="mt-2"><b className="text-[var(--fg)]">Logo & favicon:</b> served from /public/brand (SVG logo, 16/32/180/512 icons, maskable PWA icon and OG image). Replace the files to rebrand.</p>
          <p className="mt-2"><b className="text-[var(--fg)]">Backups:</b> Supabase and Neon take automatic daily backups with point‑in‑time restore (enable PITR on your plan). See README → Backups for a pg_dump GitHub Action alternative.</p>
        </div>
      </div>
    </>
  );
}
