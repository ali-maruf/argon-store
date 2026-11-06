import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdmin } from "@/lib/auth";

export async function GET(req: Request) {
  const a = await getAdmin();
  if (!a?.permissions.includes("orders.view")) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const since = new Date(new URL(req.url).searchParams.get("since") ?? Date.now());
  const now = new Date();
  const orders = await db.order.findMany({ where: { createdAt: { gt: since, lte: now } }, select: { orderNumber: true, total: true, customerName: true, district: true }, take: 20 });
  return NextResponse.json({ orders, now: now.toISOString() });
}
