import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronAuthorized } from "@/lib/http";
import { getSettingsFresh } from "@/lib/settings";
import { notifyCustomer } from "@/lib/notify";
import { appendTimeline, tl, type TimelineEntry } from "@/lib/orders";

/** Sends one "leave a review" SMS X days after delivery. */
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const s = (await getSettingsFresh()).reviews;
  if (!s.requestEnabled) return NextResponse.json({ skipped: true });
  const before = new Date(Date.now() - s.requestAfterDays * 86400e3);
  const after = new Date(Date.now() - (s.requestAfterDays + 3) * 86400e3);
  const orders = await db.order.findMany({ where: { fulfillmentStatus: "delivered", updatedAt: { lte: before, gte: after } }, take: 200 });
  let sent = 0;
  for (const o of orders) {
    if ((o.timeline as TimelineEntry[]).some((t) => t.type === "review_request")) continue;
    const slug = (o.lineItems as { slug: string }[])[0]?.slug;
    await notifyCustomer("review_request", o, { link: `${process.env.NEXT_PUBLIC_SITE_URL}/product/${slug}#reviews` });
    await appendTimeline(o.id, tl("review_request", "Review request SMS sent", "system"));
    sent++;
  }
  return NextResponse.json({ sent });
}
