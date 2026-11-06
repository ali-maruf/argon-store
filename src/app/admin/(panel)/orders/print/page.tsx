import QRCode from "qrcode";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import type { AddressSnapshot, LineSnapshot } from "@/lib/orders";
import { dateOnly } from "@/lib/format";
import { PrintButton } from "@/components/admin/PrintButton";

export const metadata = { title: "Print" };
const tk = (n: number) => "৳" + n.toLocaleString("en-IN");

export default async function Print({ searchParams }: { searchParams: Promise<{ ids?: string; type?: string }> }) {
  await requireAdmin("orders.view");
  const { ids = "", type = "invoice" } = await searchParams;
  const list = ids.split(",").filter(Boolean).slice(0, 200);
  const [orders, s] = await Promise.all([db.order.findMany({ where: { id: { in: list } }, orderBy: { createdAt: "asc" } }), getSettings()]);
  const qrs = Object.fromEntries(await Promise.all(orders.map(async (o) => [o.id, await QRCode.toDataURL(o.orderNumber, { margin: 0, width: 160 })] as const)));
  const thermal = type === "label-thermal";

  return (
    <div className="bg-white text-black">
      <style>{`
        @page { size: ${thermal ? "4in 6in" : "A4"}; margin: ${thermal ? "0.15in" : "12mm"}; }
        .sheet { break-after: page; } .sheet:last-child { break-after: auto; }
        .lbl { border: 1.5px dashed #000; padding: 10px; break-inside: avoid; }
        body, .admin { background: #fff !important; color: #000 !important; }
      `}</style>
      <div className="no-print mb-4 flex items-center gap-3"><PrintButton /><span className="text-[13px] text-gray-500">{orders.length} orders · {type}</span></div>

      {type === "invoice" && orders.map((o) => {
        const a = o.shippingAddress as AddressSnapshot; const lines = o.lineItems as LineSnapshot[];
        return (
          <section key={o.id} className="sheet mx-auto max-w-[190mm] py-4 text-[13px]">
            <div className="flex items-start justify-between border-b-2 border-black pb-4">
              <div><p className="text-2xl font-bold tracking-[0.35em]">ARGON</p><p className="text-[12px]">{s.store.address} · {s.store.phone} · {s.store.email}</p></div>
              <div className="text-right"><p className="text-xl font-bold">INVOICE</p><p className="tnum">{o.orderNumber}</p><p>{dateOnly(o.createdAt)}</p></div>
            </div>
            <div className="mt-4 flex justify-between gap-6">
              <div><p className="text-[11px] uppercase text-gray-500">Bill / ship to</p><p className="font-semibold">{a.name}</p><p>{a.phone}</p><p>{a.address}</p><p>{a.area}{a.area ? ", " : ""}{a.district}</p></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrs[o.id]} alt="" width={80} height={80} />
            </div>
            <table className="mt-5 w-full border-collapse text-left">
              <thead><tr className="border-b border-black"><th className="py-2">Item</th><th>SKU</th><th className="text-right">Qty</th><th className="text-right">Price</th><th className="text-right">Total</th></tr></thead>
              <tbody>{lines.map((l) => <tr key={l.variantId} className="border-b border-gray-300"><td className="py-2">{l.title}{l.variantTitle !== "Default" ? ` — ${l.variantTitle}` : ""}</td><td>{l.sku}</td><td className="text-right">{l.qty}</td><td className="text-right tnum">{tk(l.price)}</td><td className="text-right tnum">{tk(l.price * l.qty)}</td></tr>)}</tbody>
            </table>
            <div className="ml-auto mt-4 w-64 space-y-1 tnum">
              <p className="flex justify-between"><span>Subtotal</span><span>{tk(o.subtotal)}</span></p>
              {o.discountTotal > 0 && <p className="flex justify-between"><span>Discount</span><span>−{tk(o.discountTotal)}</span></p>}
              <p className="flex justify-between"><span>Delivery</span><span>{tk(o.shippingTotal)}</span></p>
              <p className="flex justify-between border-t border-black pt-1 text-base font-bold"><span>Total</span><span>{tk(o.total)}</span></p>
              <p className="flex justify-between"><span>Paid ({o.paymentMethod.toUpperCase()})</span><span>{tk(o.amountPaid)}</span></p>
              <p className="flex justify-between font-bold"><span>Due on delivery</span><span>{tk(Math.max(0, o.total - o.amountPaid))}</span></p>
            </div>
            <p className="mt-10 border-t border-gray-300 pt-3 text-center text-[11px] text-gray-600">{s.store.invoiceFooter} · Instagram @argon.go_</p>
          </section>
        );
      })}

      {type !== "invoice" && (
        <div className={thermal ? "" : "grid grid-cols-2 gap-3"}>
          {orders.map((o) => {
            const a = o.shippingAddress as AddressSnapshot; const lines = o.lineItems as LineSnapshot[];
            return (
              <section key={o.id} className={`lbl ${thermal ? "sheet h-[5.6in] w-[3.7in]" : ""} text-[12px]`}>
                <div className="flex items-center justify-between border-b border-black pb-2"><b className="tracking-[0.3em]">ARGON</b><span className="tnum font-bold">{o.orderNumber}</span></div>
                <div className="mt-2 flex gap-3">
                  <div className="flex-1">
                    <p className="text-[10px] uppercase">To</p>
                    <p className="text-[15px] font-bold">{a.name}</p>
                    <p className="tnum text-[15px] font-bold">{a.phone}</p>
                    <p>{a.address}</p><p className="font-semibold">{a.area}{a.area ? ", " : ""}{a.district}</p>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrs[o.id]} alt="" width={thermal ? 96 : 72} height={thermal ? 96 : 72} />
                </div>
                <div className="mt-2 border-y border-black py-2 text-center">
                  <p className="text-[10px] uppercase">{o.paymentStatus === "paid" ? "Prepaid" : "Collect cash (COD)"}</p>
                  <p className="tnum text-xl font-black">{tk(Math.max(0, o.total - o.amountPaid))}</p>
                </div>
                <p className="mt-2 text-[11px]">{lines.map((l) => `${l.sku}×${l.qty}`).join(", ")}</p>
                {o.trackingNumber && <p className="mt-1 text-[11px]">{o.courier?.toUpperCase()} · {o.trackingNumber}</p>}
                {o.note && <p className="mt-1 text-[11px] italic">Note: {o.note}</p>}
                <p className="mt-2 text-[10px]">From: ARGON · {s.store.phone}</p>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
