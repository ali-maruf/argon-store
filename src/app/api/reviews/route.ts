import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizePhone } from "@/lib/format";
import { clientIp, rateLimit } from "@/lib/security";
import { storeImage } from "@/lib/storage";
import type { LineSnapshot } from "@/lib/orders";

const Body = z.object({ productId: z.string().max(40), orderNumber: z.string().trim().toUpperCase().max(20), phone: z.string().transform(normalizePhone), rating: z.coerce.number().int().min(1).max(5), text: z.string().trim().min(5).max(1000) });

/** Verified-buyer reviews only: the order must be delivered, match the phone, and contain this product. Goes to moderation. */
export async function POST(req: Request) {
  if (!(await rateLimit(`review:${await clientIp()}`, 5, 3600)).ok) return NextResponse.json({ error: "Too many reviews — try later" }, { status: 429 });
  const fd = await req.formData();
  const parsed = Body.safeParse(Object.fromEntries(["productId", "orderNumber", "phone", "rating", "text"].map((k) => [k, fd.get(k)])));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const b = parsed.data;
  const order = await db.order.findFirst({ where: { orderNumber: b.orderNumber, customerPhone: b.phone } });
  const lines = (order?.lineItems ?? []) as LineSnapshot[];
  if (!order || !lines.some((l) => l.productId === b.productId)) return NextResponse.json({ error: "We couldn't find this product in that order" }, { status: 403 });
  if (order.fulfillmentStatus !== "delivered") return NextResponse.json({ error: "You can review once your order is delivered" }, { status: 403 });
  if (await db.review.findFirst({ where: { orderId: order.id, productId: b.productId } })) return NextResponse.json({ error: "You've already reviewed this item" }, { status: 409 });
  const photos: string[] = [];
  for (const f of fd.getAll("photos").slice(0, 3)) if (f instanceof File && f.size > 0) photos.push((await storeImage(f, "reviews")).url);
  await db.review.create({ data: { productId: b.productId, orderId: order.id, customerId: order.customerId, name: order.customerName.split(" ")[0], rating: b.rating, text: b.text, photos, verified: true, status: "pending" } });
  return NextResponse.json({ message: "Thanks! Your review will appear once approved." });
}
