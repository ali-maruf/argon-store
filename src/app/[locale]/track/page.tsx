import type { Metadata } from "next";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { getDict, type Locale } from "@/lib/i18n";
import { courier } from "@/lib/couriers";
import type { TimelineEntry } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Track order", robots: { index: false } };

const STEPS = ["placed", "confirmed", "shipped", "delivered"] as const;

export default async function Track({ params, searchParams }: { params: Promise<{ locale: Locale }>; searchParams: Promise<{ o?: string; p?: string }> }) {
  const { locale } = await params;
  const { o, p } = await searchParams;
  const d = getDict(locale);
  let result: React.ReactNode = null;

  if (o && p) {
    const limited = !(await rateLimit(`track:${await clientIp()}`, 20, 600)).ok;
    const order = limited ? null : await db.order.findFirst({ where: { orderNumber: o.trim().toUpperCase(), customerPhone: normalizePhone(p) } });
    if (!order) result = <p role="alert" className="mt-8 text-center text-[var(--muted)]">{limited ? "Too many lookups — try again shortly." : "No order found with that number and phone."}</p>;
    else {
      const stage = order.orderStatus === "cancelled" ? -1 : order.fulfillmentStatus === "delivered" ? 3 : order.fulfillmentStatus === "shipped" ? 2 : order.orderStatus === "confirmed" || order.fulfillmentStatus === "processing" ? 1 : 0;
      const tline = (order.timeline as TimelineEntry[]).filter((t) => ["created", "status", "courier", "delivered", "cancelled", "payment"].includes(t.type));
      const url = order.courier && order.trackingNumber ? courier(order.courier).trackingUrl(order.trackingNumber) : "";
      result = (
        <div className="mt-10">
          <div className="glass rounded-[var(--radius-card)] p-6">
            <p className="eyebrow">{d.orderNumber}</p>
            <p className="tnum mt-1 text-2xl font-semibold">{order.orderNumber}</p>
            {stage === -1 ? <p className="mt-4 text-[var(--accent)]">This order was cancelled.</p> : (
              <ol className="mt-6 grid grid-cols-4 gap-2" aria-label="Order progress">
                {STEPS.map((s, i) => (
                  <li key={s} className="text-center" aria-current={i === stage ? "step" : undefined}>
                    <div className={`h-1 rounded-full ${i <= stage ? "bg-[var(--fg)]" : "bg-[var(--line)]"}`} />
                    <p className={`mt-2 text-[12px] capitalize ${i <= stage ? "" : "text-[var(--muted)]"}`}>{s}</p>
                  </li>
                ))}
              </ol>
            )}
            {url && <a href={url} target="_blank" rel="noopener" className="btn btn-ghost mt-6">Track with {courier(order.courier!).name} · {order.trackingNumber}</a>}
          </div>
          <ul className="mt-6 space-y-3 border-l border-[var(--line)] pl-5">
            {tline.reverse().map((t, i) => (
              <li key={i} className="relative text-[14px]"><span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-[var(--fg)]" />{t.message.replace(/ · trx.*/, "")}<span className="block text-[12px] text-[var(--muted)]">{new Date(t.at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</span></li>
            ))}
          </ul>
        </div>
      );
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12 md:py-20">
      <h1 className="font-[family-name:var(--font-display)] text-5xl">{d.track}</h1>
      <p className="mt-2 text-[var(--muted)]">{d.trackSub}</p>
      <form className="mt-8 grid gap-3 sm:grid-cols-[1fr_1fr_auto]" method="get">
        <input name="o" defaultValue={o} required placeholder="ARG-10001" className="input uppercase" aria-label={d.orderNumber} />
        <input name="p" defaultValue={p} required inputMode="numeric" placeholder="01XXXXXXXXX" className="input" aria-label={d.mobile} />
        <button className="btn btn-primary">{d.track}</button>
      </form>
      {result}
    </div>
  );
}
