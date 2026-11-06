import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { dateTime } from "@/lib/format";
import { Chip, Notice, PageHeader, tk } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Payments" };
const env = (k: string) => !!process.env[k];

export default async function Payments({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin("payments.edit");
  const { msg } = await searchParams;
  const [s, tx] = await Promise.all([getSettings(), db.payment.findMany({ orderBy: { createdAt: "desc" }, take: 60, include: { order: { select: { orderNumber: true, id: true } } } })]);
  const p = s.payments;
  const creds = { bkash: env("BKASH_APP_KEY") && env("BKASH_USERNAME"), nagad: env("NAGAD_MERCHANT_ID") && env("NAGAD_MERCHANT_PRIVATE_KEY"), sslcommerz: env("SSLCOMMERZ_STORE_ID") };
  return (
    <>
      <PageHeader title="Payments" />
      <Notice msg={msg} />
      <SettingsForm section="payments" title="Payment methods" back="/admin/payments" cols={3}
        fields={[
          { name: "cod.enabled", label: "Cash on Delivery", type: "bool", value: p.cod.enabled },
          { name: "cod.advanceOutsideDhaka", label: "Require delivery charge in advance (bKash) for outside Dhaka", type: "bool", value: p.cod.advanceOutsideDhaka },
          { name: "cod.otp", label: "COD OTP verification", type: "select", value: p.cod.otp, options: ["off", "always", "flagged"], help: "flagged = only numbers with repeat cancellations/returns" },
          { name: "bkash.enabled", label: `bKash (Tokenized Checkout) ${creds.bkash ? "✓ credentials set" : "— credentials missing"}`, type: "bool", value: p.bkash.enabled },
          { name: "bkash.sandbox", label: "bKash sandbox mode", type: "bool", value: p.bkash.sandbox },
          { name: "nagad.enabled", label: `Nagad ${creds.nagad ? "✓ credentials set" : "— credentials missing"}`, type: "bool", value: p.nagad.enabled },
          { name: "nagad.sandbox", label: "Nagad sandbox mode", type: "bool", value: p.nagad.sandbox },
          { name: "sslcommerz.enabled", label: `SSLCommerz (cards, Rocket, Upay…) ${creds.sslcommerz ? "✓ credentials set" : "— credentials missing"}`, type: "bool", value: p.sslcommerz.enabled },
          { name: "sslcommerz.sandbox", label: "SSLCommerz sandbox mode", type: "bool", value: p.sslcommerz.sandbox },
        ]}
        footer={<p className="border-t border-[var(--line)] px-4 py-3 text-[12px] text-[var(--muted)]">Gateway secrets are read from environment variables only. Orders are marked paid exclusively after server‑side verification (bKash execute/query, Nagad verify, SSLCommerz validation API + IPN signature).</p>}
      />
      <div className="card mt-5 overflow-x-auto">
        <div className="card-h">Transaction log</div>
        <table className="t">
          <thead><tr><th>When</th><th>Order</th><th>Provider</th><th className="text-right">Amount</th><th>Status</th><th>Transaction</th></tr></thead>
          <tbody>{tx.map((t) => <tr key={t.id}><td className="text-[12px]">{dateTime(t.createdAt)}</td><td><Link href={`/admin/orders/${t.order.id}`} className="tnum underline">{t.order.orderNumber}</Link></td><td>{t.provider}</td><td className="tnum text-right">{tk(t.amount)}</td><td><Chip v={t.status === "completed" ? "paid" : t.status} /></td><td className="font-mono text-[11px]">{t.transactionId ?? t.paymentRef ?? ""}</td></tr>)}
            {!tx.length && <tr><td colSpan={6} className="py-8 text-center text-[var(--muted)]">No gateway transactions yet.</td></tr>}</tbody>
        </table>
      </div>
    </>
  );
}
