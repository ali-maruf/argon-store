import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/http";
import { syncCourierStatuses } from "@/lib/couriers";

export const maxDuration = 60;
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await syncCourierStatuses());
}
