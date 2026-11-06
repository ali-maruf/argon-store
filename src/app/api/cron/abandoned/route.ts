import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronAuthorized } from "@/lib/http";
import { getSettingsFresh } from "@/lib/settings";
import { renderTemplate, sendSms } from "@/lib/notify";

/** Abandoned-checkout recovery: SMS after N1 hours, SMS + discount after N2 hours. Skips anyone who has since ordered. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = (await getSettingsFresh()).abandoned;
  if (!s.enabled) return NextResponse.json({ skipped: true });
  const now = Date.now();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const candidates = await db.abandonedCheckout.findMany({ where: { recovered: false, remindersSent: { lt: 2 }, createdAt: { gt: new Date(now - 72 * 3600e3) } }, take: 200 });
  let sent = 0;
  for (const a of candidates) {
    const due = a.remindersSent === 0 ? s.firstAfterHours : s.secondAfterHours;
    if (a.updatedAt.getTime() > now - due * 3600e3) continue;
    const ordered = await db.order.findFirst({ where: { customerPhone: a.phone, createdAt: { gt: a.createdAt } }, select: { id: true } });
    if (ordered) { await db.abandonedCheckout.update({ where: { id: a.id }, data: { recovered: true, orderId: ordered.id } }); continue; }
    if (await db.blocklist.findFirst({ where: { type: "phone", value: a.phone } })) continue;
    const key = a.remindersSent === 0 ? "abandoned_1" : "abandoned_2";
    const t = await renderTemplate(key, "sms", { name: a.name?.split(" ")[0] ?? "", link: `${site}/checkout`, code: s.secondDiscountCode, store: "ARGON" });
    if (t) await sendSms(a.phone, t.body);
    await db.abandonedCheckout.update({ where: { id: a.id }, data: { remindersSent: { increment: 1 }, lastReminderAt: new Date() } });
    sent++;
  }
  return NextResponse.json({ checked: candidates.length, sent });
}
