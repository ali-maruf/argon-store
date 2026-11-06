import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isBdPhone, normalizePhone } from "@/lib/format";
import { clientIp, rateLimit } from "@/lib/security";

export async function POST(req: Request) {
  if (!(await rateLimit(`sub:${await clientIp()}`, 5, 600)).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const { contact } = (await req.json().catch(() => ({}))) as { contact?: string };
  const c = String(contact ?? "").trim().slice(0, 120);
  let value: string; let kind: string;
  if (/^\S+@\S+\.\S+$/.test(c)) { value = c.toLowerCase(); kind = "email"; }
  else if (isBdPhone(c)) { value = normalizePhone(c); kind = "phone"; }
  else return NextResponse.json({ error: "Enter a valid email or BD mobile number" }, { status: 400 });
  await db.subscriber.upsert({ where: { contact: value }, create: { contact: value, kind }, update: {} });
  return NextResponse.json({ ok: true });
}
