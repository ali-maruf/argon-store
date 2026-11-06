import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { cronAuthorized } from "@/lib/http";
import { notifyOwner } from "@/lib/notify";
import { getSettingsFresh } from "@/lib/settings";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await getSettingsFresh()).notifications.lowStockAlerts) return NextResponse.json({ skipped: true });
  const rows = await db.$queryRaw<{ sku: string; title: string; stock: number }[]>`
    SELECT v.sku, p.title, v.stock FROM "ProductVariant" v JOIN "Product" p ON p.id = v."productId"
    WHERE p.status = 'active' AND v.stock <= v."lowStockThreshold" ORDER BY v.stock ASC LIMIT 40`;
  if (rows.length) await notifyOwner(`⚠️ ${rows.length} low-stock variants:\n` + rows.slice(0, 15).map((r) => `${r.sku} ${r.title}: ${r.stock}`).join("\n"));
  return NextResponse.json({ low: rows.length });
}
