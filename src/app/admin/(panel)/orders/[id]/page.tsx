import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin, can } from "@/lib/auth";
import type { AddressSnapshot, LineSnapshot, TimelineEntry } from "@/lib/orders";
import { phoneRisk } from "@/lib/security";
import { COURIERS, courier } from "@/lib/couriers";
import { DISTRICTS } from "@/lib/districts";
import { dateTime } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Chip, Notice, PageHeader, tk } from "@/components/admin/ui";
import { addNote, blockCustomer, duplicateOrder, editAddress, editLines, logCall, refund, sendOrderToCourier, setTags, setTracking, updateOrderStatus } from "../actions";

export const metadata = { title: "Order" };

export default async function OrderDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ e?: string }> }) {
  const admin = await requireAdmin("orders.view");
  const { id } = await params; const { e } = await searchParams;
  const o = await db.order.findUnique({ where: { id }, include: { payments: { orderBy: { createdAt: "desc" } } } });
  if (!o) notFound();
  const [risk, history, blocked, settings] = await Promise.all([
    phoneRisk(o.customerPhone),
    db.order.findMany({ where: { customerPhone: o.customerPhone, id: { not: o.id } }, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, orderNumber: true, total: true, fulfillmentStatus: true, orderStatus: true, createdAt: true } }),
    db.blocklist.findFirst({ where: { type: "phone", value: o.customerPhone } }),
    getSettings(),
  ]);
  const a = o.shippingAddress as AddressSnapshot; const lines = o.lineItems as LineSnapshot[]; const tl = [...(o.timeline as TimelineEntry[])].reverse();
  const edit = can(admin, "orders.edit");
  const editable = !["shipped", "delivered", "cancelled", "returned"].includes(o.fulfillmentStatus) && o.orderStatus !== "cancelled";
  const due = Math.max(0, o.total - o.amountPaid);
  const sel = (field: string, value: string, opts: string[]) => (
    <form action={updateOrderStatus} className="flex items-center gap-2">
      <input type="hidden" name="id" value={o.id} /><input type="hidden" name="field" value={field} />
      <select name="value" defaultValue={value} className="input !w-auto" disabled={!edit} aria-label={field}>{opts.map((x) => <option key={x} value={x}>{x.replace("_", " ")}</option>)}</select>
      {edit && <button className="btn btn-ghost">Update</button>}
    </form>
  );

  return (
    <>
      <PageHeader back="/admin/orders" title={<span className="tnum">{o.orderNumber}</span>}>
        <Chip v={o.orderStatus} /><Chip v={o.paymentStatus} /><Chip v={o.fulfillmentStatus} />
        <a className="btn btn-ghost" href={`/admin/orders/print?type=invoice&ids=${o.id}`} target="_blank">Invoice</a>
        <a className="btn btn-ghost" href={`/admin/orders/print?type=label-thermal&ids=${o.id}`} target="_blank">Label</a>
        {can(admin, "orders.create") && <form action={duplicateOrder}><input type="hidden" name="id" value={o.id} /><button className="btn btn-ghost">Duplicate</button></form>}
      </PageHeader>
      <p className="-mt-3 mb-4 text-[12px] text-[var(--muted)]">{dateTime(o.createdAt)} · via {o.source}{o.utmSource ? ` · utm ${o.utmSource}/${o.utmMedium ?? ""}/${o.utmCampaign ?? ""}` : ""}{o.otpVerified ? " · OTP verified" : ""}</p>
      <Notice error={e} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Items */}
          <div className="card">
            <div className="card-h">Items {editable && edit && <span className="text-[12px] font-normal text-[var(--muted)]">Editable until shipped</span>}</div>
            <form action={editLines}>
              <input type="hidden" name="id" value={o.id} />
              <ul className="divide-y divide-[var(--line)]">
                {lines.map((l) => (
                  <li key={l.variantId} className="flex items-center gap-3 px-4 py-3">
                    {l.image && <Image src={l.image} alt="" width={48} height={48} className="h-12 w-12 rounded-lg object-cover" />}
                    <div className="flex-1"><Link href={`/admin/products/${l.productId}`} className="font-medium hover:underline">{l.title}</Link><p className="text-[12px] text-[var(--muted)]">{l.variantTitle} · {l.sku}</p></div>
                    <span className="tnum text-[13px] text-[var(--muted)]">{tk(l.price)} ×</span>
                    {editable && edit ? <input name={`qty_${l.variantId}`} type="number" min={0} max={50} defaultValue={l.qty} className="input !w-16 tnum" aria-label="Quantity" /> : <span className="tnum">{l.qty}</span>}
                    <span className="tnum w-20 text-right">{tk(l.price * l.qty)}</span>
                  </li>
                ))}
              </ul>
              <dl className="tnum space-y-1.5 border-t border-[var(--line)] px-4 py-3 text-[13px]">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{tk(o.subtotal)}</dd></div>
                <div className="flex items-center justify-between"><dt>Discount{o.discountCode ? ` (${o.discountCode})` : ""}</dt><dd>{editable && edit ? <input name="discountTotal" type="number" min={0} defaultValue={o.discountTotal} className="input !w-24 text-right" aria-label="Discount" /> : `−${tk(o.discountTotal)}`}</dd></div>
                <div className="flex items-center justify-between"><dt>Delivery ({o.zone.replace("_", " ")})</dt><dd>{editable && edit ? <input name="shippingTotal" type="number" min={0} defaultValue={o.shippingTotal} className="input !w-24 text-right" aria-label="Delivery" /> : tk(o.shippingTotal)}</dd></div>
                <div className="flex justify-between text-[15px] font-bold"><dt>Total</dt><dd>{tk(o.total)}</dd></div>
                <div className="flex justify-between text-[var(--muted)]"><dt>Paid</dt><dd>{tk(o.amountPaid)}</dd></div>
                <div className="flex justify-between font-semibold"><dt>{o.paymentMethod === "cod" ? "COD to collect" : "Due"}</dt><dd>{tk(due)}</dd></div>
              </dl>
              {editable && edit && <div className="border-t border-[var(--line)] px-4 py-3 text-right"><button className="btn btn-ghost">Save item changes</button></div>}
            </form>
          </div>

          {/* Status + call workflow */}
          <div className="card">
            <div className="card-h">Status</div>
            <div className="card-b grid gap-4 sm:grid-cols-3">
              <div><p className="mb-1 text-[12px] text-[var(--muted)]">Order</p>{sel("orderStatus", o.orderStatus, ["new", "confirmed", "on_hold", "completed", "cancelled"])}</div>
              <div><p className="mb-1 text-[12px] text-[var(--muted)]">Fulfillment</p>{sel("fulfillmentStatus", o.fulfillmentStatus, ["unfulfilled", "processing", "shipped", "delivered", "returned"])}</div>
              <div><p className="mb-1 text-[12px] text-[var(--muted)]">Payment</p>{sel("paymentStatus", o.paymentStatus, ["pending", "paid", "partially_paid", "refunded", "failed"])}</div>
            </div>
            {edit && o.orderStatus !== "cancelled" && (
              <div className="card-b flex flex-wrap items-center gap-2 border-t border-[var(--line)]">
                <span className="text-[13px] font-medium">☎ Call to confirm</span>
                <span className="text-[12px] text-[var(--muted)]">{o.callAttempts} call{o.callAttempts === 1 ? "" : "s"}{o.callOutcome ? ` · last: ${o.callOutcome.replace("_", " ")}` : ""}</span>
                <div className="ml-auto flex flex-wrap gap-1.5">
                  {[["confirmed", "Confirmed"], ["no_answer", "No answer"], ["call_later", "Call later"], ["wrong_number", "Wrong number"], ["cancelled", "Cancelled"]].map(([k, l]) => (
                    <form key={k} action={logCall}><input type="hidden" name="id" value={o.id} /><input type="hidden" name="outcome" value={k} /><button className={`btn ${k === "confirmed" ? "btn-primary" : "btn-ghost"}`}>{l}</button></form>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Fulfilment */}
          <div className="card">
            <div className="card-h">Fulfilment {o.courier && <span className="text-[12px] font-normal">{courier(o.courier).name} · {o.trackingNumber} · {o.courierStatus}</span>}</div>
            <div className="card-b space-y-3">
              {o.trackingNumber && o.courier && courier(o.courier).trackingUrl(o.trackingNumber) && <a className="text-[13px] underline" href={courier(o.courier).trackingUrl(o.trackingNumber)} target="_blank" rel="noopener">Open courier tracking ↗</a>}
              {edit && !o.consignmentId && o.orderStatus !== "cancelled" && (
                <form action={sendOrderToCourier} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={o.id} />
                  <select name="courier" className="input !w-auto" defaultValue={settings.couriers.default}>{Object.values(COURIERS).filter((c) => c.key !== "manual").map((c) => <option key={c.key} value={c.key}>{c.name}{c.configured() ? "" : " (not configured)"}</option>)}</select>
                  <button className="btn btn-primary">Send to courier</button>
                  <span className="self-center text-[12px] text-[var(--muted)]">COD amount: {tk(due)}</span>
                </form>
              )}
              {edit && (
                <form action={setTracking} className="flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={o.id} />
                  <select name="courier" className="input !w-auto" defaultValue={o.courier ?? "manual"}>{Object.values(COURIERS).map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}</select>
                  <input name="tracking" defaultValue={o.trackingNumber ?? ""} placeholder="Tracking number (manual)" className="input !w-56" />
                  <button className="btn btn-ghost">Save tracking</button>
                </form>
              )}
            </div>
          </div>

          {/* Payments */}
          <div className="card">
            <div className="card-h">Payments <span className="text-[12px] font-normal uppercase text-[var(--muted)]">{o.paymentMethod}</span></div>
            <ul className="divide-y divide-[var(--line)] text-[13px]">
              {o.payments.map((p) => <li key={p.id} className="flex items-center gap-3 px-4 py-2.5"><span className="w-24">{p.provider}</span><Chip v={p.status === "completed" ? "paid" : p.status} /><span className="tnum">{tk(p.amount)}</span><span className="flex-1 truncate text-[var(--muted)]">{p.transactionId ?? p.paymentRef ?? ""}</span><span className="text-[12px] text-[var(--muted)]">{dateTime(p.createdAt)}</span></li>)}
              {!o.payments.length && <li className="px-4 py-3 text-[var(--muted)]">No gateway transactions{o.paymentMethod === "cod" ? " — cash on delivery" : ""}.</li>}
            </ul>
            {edit && o.amountPaid > 0 && (
              <form action={refund} className="flex flex-wrap items-center gap-2 border-t border-[var(--line)] px-4 py-3">
                <input type="hidden" name="id" value={o.id} />
                <input name="amount" type="number" min={1} max={o.amountPaid} defaultValue={o.amountPaid} className="input !w-28" aria-label="Refund amount" />
                <input name="reason" placeholder="Reason" className="input !w-48" />
                {o.payments.some((p) => p.provider === "bkash" && p.status === "completed") && <label className="flex items-center gap-1 text-[12px]"><input type="checkbox" name="gateway" /> Refund via bKash API</label>}
                <button className="btn btn-ghost">Refund</button>
              </form>
            )}
          </div>

          {/* Timeline */}
          <div className="card">
            <div className="card-h">Timeline</div>
            {edit && <form action={addNote} className="flex gap-2 border-b border-[var(--line)] px-4 py-3"><input type="hidden" name="id" value={o.id} /><input name="note" placeholder="Add an internal note…" className="input" /><button className="btn btn-ghost">Post</button></form>}
            <ol className="space-y-3 px-4 py-4">
              {tl.map((t, i) => (
                <li key={i} className="flex gap-3 text-[13px]">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--fg)]" />
                  <div><p>{t.message}</p><p className="text-[11px] text-[var(--muted)]">{dateTime(t.at)} · {t.type}{t.by ? ` · ${t.by}` : ""}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <div className="card">
            <div className="card-h">Customer {blocked && <Chip v="blocked" />}</div>
            <div className="card-b space-y-1 text-[13px]">
              <p className="font-semibold">{o.customerName}</p>
              <p className="tnum">{o.customerPhone}</p>
              {o.customerEmail && <p>{o.customerEmail}</p>}
              <div className="flex gap-2 pt-2"><a className="btn btn-ghost" href={`tel:${o.customerPhone}`}>☎ Call</a><a className="btn btn-ghost" target="_blank" rel="noopener" href={`https://wa.me/88${o.customerPhone}?text=${encodeURIComponent(`Hi ${o.customerName.split(" ")[0]}, this is ARGON about your order ${o.orderNumber}.`)}`}>WhatsApp</a></div>
              {o.customerId && <Link href={`/admin/customers/${o.customerId}`} className="block pt-2 underline">View profile</Link>}
            </div>
          </div>
          <div className="card">
            <div className="card-h">Risk check</div>
            <div className="card-b space-y-1 text-[13px]">
              <p>{risk.total} orders on this number · {risk.delivered} delivered · {risk.returned} returned · {risk.cancelled} cancelled</p>
              <p>Success ratio: <b>{risk.successRatio == null ? "new customer" : `${Math.round(risk.successRatio * 100)}%`}</b></p>
              {risk.flagged && <p className="chip chip-red">⚠ Flagged: repeat cancellations/returns</p>}
              <p className="pt-1 text-[11px] text-[var(--muted)]">Courier fraud‑check ratios appear here when the courier exposes them for your account.</p>
              {can(admin, "customers.edit") && !blocked && (
                <form action={blockCustomer} className="pt-2"><input type="hidden" name="id" value={o.id} /><input type="hidden" name="phone" value={o.customerPhone} /><input type="hidden" name="ip" value={o.ip ?? ""} />
                  <label className="mb-2 flex items-center gap-2 text-[12px]"><input type="checkbox" name="blockIp" /> Also block IP {o.ip}</label>
                  <button className="btn btn-danger">Block number</button></form>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-h">Shipping address</div>
            {editable && edit ? (
              <form action={editAddress} className="card-b space-y-2">
                <input type="hidden" name="id" value={o.id} />
                <input name="name" defaultValue={a.name} className="input" aria-label="Name" />
                <input name="phone" defaultValue={a.phone} className="input" aria-label="Phone" />
                <textarea name="address" defaultValue={a.address} className="input" aria-label="Address" />
                <select name="district" defaultValue={a.district} className="input" aria-label="District">{DISTRICTS.map((d) => <option key={d}>{d}</option>)}</select>
                <input name="area" defaultValue={a.area} className="input" aria-label="Area" />
                <button className="btn btn-ghost">Save address</button>
              </form>
            ) : <div className="card-b text-[13px]"><p>{a.name} · {a.phone}</p><p>{a.address}</p><p>{a.area}{a.area ? ", " : ""}{a.district}</p></div>}
            {o.note && <p className="border-t border-[var(--line)] px-4 py-3 text-[13px]"><b>Customer note:</b> {o.note}</p>}
          </div>
          <div className="card">
            <div className="card-h">Tags</div>
            <form action={setTags} className="card-b flex gap-2"><input type="hidden" name="id" value={o.id} /><input name="tags" defaultValue={o.tags.join(", ")} className="input" placeholder="vip, gift, urgent" /><button className="btn btn-ghost" disabled={!edit}>Save</button></form>
          </div>
          {history.length > 0 && (
            <div className="card">
              <div className="card-h">Order history</div>
              <ul className="divide-y divide-[var(--line)] text-[13px]">{history.map((h) => <li key={h.id} className="flex items-center justify-between px-4 py-2"><Link href={`/admin/orders/${h.id}`} className="tnum underline">{h.orderNumber}</Link><span className="tnum">{tk(h.total)}</span><Chip v={h.orderStatus === "cancelled" ? "cancelled" : h.fulfillmentStatus} /></li>)}</ul>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
