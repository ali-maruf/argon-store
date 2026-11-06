import { bkash } from "@/lib/payments";
import { thankYouRedirect } from "@/lib/http";
import { db } from "@/lib/db";

// bKash redirects the customer here with ?paymentID=&status=. We never trust it: execute + query server-side.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const pid = u.searchParams.get("pid") ?? "";
  const paymentID = u.searchParams.get("paymentID") ?? "";
  const status = u.searchParams.get("status") ?? "failure";
  try {
    const r = await bkash.verify(pid, paymentID, status);
    return thankYouRedirect(r.orderId, !r.ok);
  } catch (e) {
    console.error("bkash callback", e);
    const p = await db.payment.findUnique({ where: { id: pid } }).catch(() => null);
    return thankYouRedirect(p?.orderId ?? null, true);
  }
}
