import { NextResponse } from "next/server";
import { z } from "zod";
import { quote } from "@/lib/pricing";
import { normalizePhone } from "@/lib/format";

const Body = z.object({
  items: z.array(z.object({ variantId: z.string().max(40), qty: z.number().int().min(1).max(20) })).max(30),
  district: z.string().max(40).nullish(), area: z.string().max(80).nullish(), code: z.string().max(40).nullish(), phone: z.string().max(20).nullish(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const b = parsed.data;
  const q = await quote({ ...b, phone: b.phone ? normalizePhone(b.phone) : null });
  // Don't leak cost price to the client.
  return NextResponse.json({ ...q, lines: q.lines.map(({ costPrice, ...l }) => { void costPrice; return l; }) });
}
