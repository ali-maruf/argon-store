import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCustomerPhone } from "@/lib/auth";
import { getDict, lhref, type Locale } from "@/lib/i18n";
import { dateOnly } from "@/lib/format";
import type { LineSnapshot, AddressSnapshot } from "@/lib/orders";
import { OtpLogin, SignOut, Reorder } from "@/components/store/AccountClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Account", robots: { index: false } };

export default async function Account({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const d = getDict(locale);
  const phone = await getCustomerPhone();
  if (!phone) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="font-[family-name:var(--font-display)] text-5xl">{d.account}</h1>
        <p className="mt-2 text-[var(--muted)]">{locale === "bn" ? "অ্যাকাউন্ট ঐচ্ছিক। অর্ডার দেখতে ফোন নম্বর দিয়ে সাইন ইন করুন।" : "Accounts are optional. Sign in with your phone to see your orders."}</p>
        <OtpLogin labels={{ mobile: d.mobile, sendCode: d.sendCode, verify: d.verify }} />
      </div>
    );
  }
  const [customer, orders] = await Promise.all([
    db.customer.findUnique({ where: { phone } }),
    db.order.findMany({ where: { customerPhone: phone }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const addresses = (customer?.addresses ?? []) as AddressSnapshot[];
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <div className="flex items-end justify-between">
        <div><p className="eyebrow">{phone}</p><h1 className="mt-1 font-[family-name:var(--font-display)] text-5xl">{customer?.name ?? d.account}</h1></div>
        <SignOut label={d.signOut} />
      </div>
      <h2 className="eyebrow mt-10 mb-4">{d.orders}</h2>
      {orders.length === 0 ? <p className="text-[var(--muted)]">{d.noResults}</p> : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const lines = o.lineItems as LineSnapshot[];
            return (
              <li key={o.id} className="glass flex flex-wrap items-center gap-4 rounded-2xl p-4">
                <div className="flex-1">
                  <p className="tnum font-semibold">{o.orderNumber} · ৳{o.total.toLocaleString("en-IN")}</p>
                  <p className="text-[13px] text-[var(--muted)]">{dateOnly(o.createdAt)} · {lines.map((l) => `${l.title} ×${l.qty}`).join(", ")}</p>
                  <p className="mt-1 text-[12px] capitalize">{o.orderStatus === "cancelled" ? "cancelled" : o.fulfillmentStatus}</p>
                </div>
                <Link className="pill" href={`${lhref(locale, "/track")}?o=${o.orderNumber}&p=${phone}`}>{d.track}</Link>
                <Reorder label={d.reorder} lines={lines.map((l) => ({ variantId: l.variantId, qty: l.qty }))} locale={locale} />
              </li>
            );
          })}
        </ul>
      )}
      {addresses.length > 0 && (
        <>
          <h2 className="eyebrow mt-10 mb-4">Saved addresses</h2>
          <ul className="space-y-2 text-[14px]">{addresses.map((a, i) => <li key={i} className="glass rounded-2xl p-4">{a.name} · {a.address}, {a.area}, {a.district}</li>)}</ul>
        </>
      )}
    </div>
  );
}
