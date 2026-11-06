import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { sslcommerz } from "@/lib/payments";

const md5 = (s: string) => createHash("md5").update(s).digest("hex");

/** Server-to-server IPN. Checks verify_sign, then re-validates through the validation API. */
export async function POST(req: Request) {
  const fd = await req.formData();
  const data = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)]));
  if (data.verify_sign && data.verify_key) {
    const keys = data.verify_key.split(",");
    const pairs: Record<string, string> = Object.fromEntries(keys.map((k) => [k, data[k] ?? ""]));
    pairs.store_passwd = md5(process.env.SSLCOMMERZ_STORE_PASSWORD ?? "");
    const str = Object.keys(pairs).sort().map((k) => `${k}=${pairs[k]}`).join("&");
    if (md5(str) !== data.verify_sign) return NextResponse.json({ ok: false, error: "bad signature" }, { status: 400 });
  }
  const r = await sslcommerz.validate(data.tran_id ?? "", data.val_id || null, data.status);
  return NextResponse.json({ ok: r.ok });
}
