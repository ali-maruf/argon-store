import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { Notice, PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Marketing" };

export default async function Marketing({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin("marketing.edit");
  const { msg } = await searchParams;
  const s = await getSettings();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const [subs, utm] = await Promise.all([
    db.subscriber.count(),
    db.order.groupBy({ by: ["utmSource", "utmCampaign"], where: { utmSource: { not: null } }, _count: true, _sum: { total: true }, orderBy: { _count: { utmSource: "desc" } }, take: 15 }),
  ]);
  const c = s.conversion;
  return (
    <>
      <PageHeader title="Marketing & conversion" />
      <Notice msg={msg} />
      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsForm section="marketing" title="Pixels & tags" back="/admin/marketing" cols={1} fields={[
          { name: "metaPixelId", label: "Meta Pixel ID", value: s.marketing.metaPixelId, help: "Purchase is also sent server‑side via the Conversions API (set META_CAPI_TOKEN) and deduplicated with event_id = order id." },
          { name: "ga4Id", label: "GA4 Measurement ID (G‑XXXX)", value: s.marketing.ga4Id },
          { name: "gtmId", label: "Google Tag Manager ID (GTM‑XXXX)", value: s.marketing.gtmId },
          { name: "tiktokPixelId", label: "TikTok Pixel ID", value: s.marketing.tiktokPixelId },
        ]} />
        <SettingsForm section="conversion" title="Conversion features" back="/admin/marketing" cols={1} fields={[
          { name: "orderNowFastPath", label: "“Order Now — COD” fast path on product pages", type: "bool", value: c.orderNowFastPath },
          { name: "stockUrgency", label: "Real stock urgency (“Only X left”)", type: "bool", value: c.stockUrgency },
          { name: "urgencyThreshold", label: "Show urgency at or below", type: "number", value: c.urgencyThreshold },
          { name: "freeShippingBar", label: "Free‑delivery progress bar in cart", type: "bool", value: c.freeShippingBar },
          { name: "upsell", label: "One‑tap upsell in cart", type: "bool", value: c.upsell },
          { name: "upsellSku", label: "Upsell variant SKU", value: c.upsellSku },
          { name: "whatsappOrder", label: "WhatsApp order button on product pages", type: "bool", value: c.whatsappOrder },
          { name: "newsletterCode", label: "First‑order code shown after newsletter signup", value: c.newsletterCode },
          { name: "exitIntent", label: "Exit‑intent offer (desktop, once per session)", type: "bool", value: c.exitIntent },
          { name: "exitIntentCode", label: "Exit‑intent code", value: c.exitIntentCode },
        ]} />
        <div className="card">
          <div className="card-h">Product feeds</div>
          <div className="card-b space-y-2 text-[13px]">
            <p>Facebook / Instagram catalog: <a className="font-mono underline" href="/feeds/facebook.xml" target="_blank">{site}/feeds/facebook.xml</a></p>
            <p>Google Merchant Center: <a className="font-mono underline" href="/feeds/google.xml" target="_blank">{site}/feeds/google.xml</a></p>
            <p className="text-[var(--muted)]">Both refresh hourly and list every variant with live stock.</p>
            <p>Newsletter / drop list subscribers: <b>{subs}</b></p>
          </div>
        </div>
        <div className="card overflow-x-auto">
          <div className="card-h">Orders by UTM source</div>
          <table className="t"><thead><tr><th>Source</th><th>Campaign</th><th className="text-right">Orders</th><th className="text-right">Sales</th></tr></thead>
            <tbody>{utm.map((u, i) => <tr key={i}><td>{u.utmSource}</td><td>{u.utmCampaign ?? "—"}</td><td className="tnum text-right">{u._count}</td><td className="tnum text-right">৳{(u._sum.total ?? 0).toLocaleString("en-IN")}</td></tr>)}
              {!utm.length && <tr><td colSpan={4} className="py-6 text-center text-[var(--muted)]">UTM parameters on links are captured automatically and stored on each order.</td></tr>}</tbody></table>
        </div>
      </div>
    </>
  );
}
