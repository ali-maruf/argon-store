import { NextResponse } from "next/server";
import { getProductBySlug } from "@/lib/catalog";

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const p = await getProductBySlug((await params).slug);
  if (!p) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ id: p.id, title: p.title, options: p.options, variants: p.variants }, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } });
}
