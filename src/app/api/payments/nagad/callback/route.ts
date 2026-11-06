import { nagad } from "@/lib/payments";
import { thankYouRedirect } from "@/lib/http";
import { db } from "@/lib/db";

// Nagad redirects with ?payment_ref_id=&status=. Verified against Nagad's verify API before marking paid.
export async function GET(req: Request) {
  const u = new URL(req.url);
  const pid = u.searchParams.get("pid") ?? "";
  const ref = u.searchParams.get("payment_ref_id") ?? "";
  try {
    if (!ref) throw new Error("missing payment_ref_id");
    const r = await nagad.verify(pid, ref);
    return thankYouRedirect(r.orderId, !r.ok);
  } catch (e) {
    console.error("nagad callback", e);
    const p = await db.payment.findUnique({ where: { id: pid } }).catch(() => null);
    return thankYouRedirect(p?.orderId ?? null, true);
  }
}
