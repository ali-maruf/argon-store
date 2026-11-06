"use server";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/auth";
import { startPayment } from "@/lib/payments";
import { afterOrderPlaced, appendTimeline, tl } from "@/lib/orders";
import { clientIp, rateLimit } from "@/lib/security";

export async function retryPayment(orderId: string, token: string, to: "retry" | "cod"): Promise<{ redirect?: string; external?: boolean; error?: string }> {
  const tok = await verifyToken<{ oid: string }>(token);
  if (!tok || tok.oid !== orderId) return { error: "Link expired" };
  const ip = await clientIp();
  if (!(await rateLimit(`retry:${orderId}`, 8, 900)).ok) return { error: "Too many attempts" };
  const o = await db.order.findUnique({ where: { id: orderId } });
  if (!o || o.orderStatus === "cancelled") return { error: "Order not found" };
  if (o.paymentStatus === "paid") return { redirect: "refresh" };
  if (to === "cod") {
    const u = await appendTimeline(o.id, tl("payment", "Customer switched to Cash on Delivery"), { paymentMethod: "cod", paymentStatus: o.amountPaid > 0 ? "partially_paid" : "pending", orderStatus: "new" });
    void afterOrderPlaced(u);
    return { redirect: "refresh" };
  }
  if (o.paymentMethod === "cod") return { error: "This order is Cash on Delivery" };
  const r = await startPayment(o, o.paymentMethod, "full", ip);
  return "error" in r ? { error: r.error } : { redirect: r.redirectUrl, external: true };
}
