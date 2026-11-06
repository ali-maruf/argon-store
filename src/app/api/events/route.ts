import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const TYPES = new Set(["visit", "product_view", "add_to_cart", "checkout_start"]);

/** First-party funnel events (visits → product views → add to cart → checkout → order) for the admin funnel report. */
export async function POST(req: Request) {
  const j = await req.json().catch(() => null) as { type?: string; productId?: string } | null;
  if (!j?.type || !TYPES.has(j.type)) return new NextResponse(null, { status: 204 });
  await db.analyticsEvent.create({ data: { type: j.type, productId: typeof j.productId === "string" ? j.productId.slice(0, 40) : null } }).catch(() => {});
  return new NextResponse(null, { status: 204 });
}
