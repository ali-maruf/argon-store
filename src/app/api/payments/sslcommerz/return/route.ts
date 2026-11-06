import { sslcommerz } from "@/lib/payments";
import { thankYouRedirect } from "@/lib/http";

// Browser return (success/fail/cancel all land here as POST). Validated with the validation API, not trusted as-is.
export async function POST(req: Request) {
  const fd = await req.formData();
  const pid = new URL(req.url).searchParams.get("pid") ?? String(fd.get("tran_id") ?? "");
  const r = await sslcommerz.validate(pid, (fd.get("val_id") as string) || null, String(fd.get("status") ?? "FAILED")).catch((e) => { console.error(e); return { ok: false, orderId: null }; });
  return thankYouRedirect(r.orderId, !r.ok);
}
