import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { getDict, lhref, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { getShippingZones } from "@/lib/catalog";
import type { LineSnapshot } from "@/lib/orders";
import { SparkleBurst } from "@/components/store/SparkleBurst";
import { LogoMark } from "@/components/store/Logo";
import { PurchaseEvent } from "@/components/store/PurchaseEvent";
import { RetryPayment } from "@/components/store/RetryPayment";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order placed", robots: { index: false } };
const tk = (n: number) => "৳" + n.toLocaleString("en-IN");

export default async function ThankYou({ params, searchParams }: { params: Promise<{ locale: Locale; id: string }>; searchParams: Promise<{ k?: string; payerr?: string; paid?: string }> }) {
  const { locale, id } = await params;
  const { k, payerr } = await searchParams;
  const tok = k ? await verifyToken<{ oid: string }>(k) : null;
  if (!tok || tok.oid !== id) notFound();
  const o = await db.order.findUnique({ where: { id } });
  if (!o) notFound();
  const d = getDict(locale);
  const [settings, zones] = await Promise.all([getSettings(), getShippingZones()]);
  const zone = zones.find((z) => z.key === o.zone);
  const lines = o.lineItems as LineSnapshot[];
  const prepaidPending = o.paymentMethod !== "cod" && o.paymentStatus !== "paid";
  const waMsg = encodeURIComponent(`Hi ARGON! My order number is ${o.orderNumber}.`);
  const statusLabel: Record<string, string> = { pending: o.paymentMethod === "cod" ? "Cash on Delivery" : "Awaiting payment", paid: "Paid ✦", partially_paid: "Delivery charge paid · rest on delivery", failed: "Payment failed", refunded: "Refunded" };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 text-center md:py-20">
      <PurchaseEvent orderId={o.id} value={o.total} paid={o.paymentMethod === "cod" || o.paymentStatus !== "failed"} />
      <div className="relative mx-auto grid h-28 w-28 place-items-center">
        <div className="absolute inset-0 rounded-full border border-[var(--line)]" style={{ animation: "ringpulse 1.2s var(--ease) 2" }} />
        <LogoMark className="h-16 w-16" />
        <SparkleBurst />
      </div>
      <p className="eyebrow mt-6 text-[var(--success)]">✦ {prepaidPending ? (locale === "bn" ? "পেমেন্ট বাকি" : "Payment pending") : d.thankYou}</p>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-5xl">{prepaidPending ? (locale === "bn" ? "প্রায় শেষ।" : "Almost there.") : (locale === "bn" ? "ধন্যবাদ।" : "It's yours.")}</h1>
      <p className="mt-3 text-[var(--muted)]">{prepaidPending ? (locale === "bn" ? "পেমেন্ট সম্পন্ন হয়নি। আবার চেষ্টা করুন বা ক্যাশ অন ডেলিভারি বেছে নিন।" : "Your payment didn't go through. Try again, or switch to Cash on Delivery.") : d.thankYouSub}</p>
      {(prepaidPending || payerr) && <RetryPayment orderId={o.id} token={k!} method={o.paymentMethod} codEnabled={settings.payments.cod.enabled} />}

      <dl className="glass mx-auto mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-sm text-left text-[14px]">
        <div className="p-5"><dt className="eyebrow">{d.orderNumber}</dt><dd className="tnum mt-1 text-lg font-semibold">{o.orderNumber}</dd></div>
        <div className="p-5"><dt className="eyebrow">{d.total}</dt><dd className="tnum mt-1 text-lg font-semibold">{tk(o.total)}</dd></div>
        <div className="p-5"><dt className="eyebrow">{d.expectedDelivery}</dt><dd className="mt-1">{zone?.eta ?? "2–4 days"}</dd></div>
        <div className="p-5"><dt className="eyebrow">{d.paymentStatus}</dt><dd className="mt-1">{statusLabel[o.paymentStatus]}</dd></div>
      </dl>

      <ul className="mt-6 space-y-3 text-left">
        {lines.map((l) => (
          <li key={l.variantId} className="flex items-center gap-3">
            <Image src={l.image} alt="" width={56} height={56} className="h-14 w-14 rounded-sm object-cover" />
            <span className="flex-1 text-[14px]">{l.title}{l.variantTitle !== "Default" && <span className="text-[var(--muted)]"> · {l.variantTitle}</span>} × {l.qty}</span>
            <span className="tnum text-[14px]">{tk(l.price * l.qty)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href={`${lhref(locale, "/track")}?o=${o.orderNumber}&p=${o.customerPhone}`} className="btn btn-primary">{d.trackOrder}</Link>
        <a href={`https://wa.me/${settings.store.whatsapp}?text=${waMsg}`} target="_blank" rel="noopener" className="btn btn-ghost">{d.whatsappUs}</a>
      </div>
      <p className="mt-8 text-[13px] text-[var(--muted)]">{locale === "bn" ? "পরার পর ছবি তুলে ইনস্টাগ্রামে" : "Wearing it? Share a photo and tag"} <a href={settings.store.instagram} className="underline" target="_blank" rel="noopener">@argon.go_</a> ✦</p>
    </div>
  );
}
