import "server-only";
import { NextResponse } from "next/server";
import { signToken } from "./auth";

const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function thankYouRedirect(orderId: string | null, failed = false) {
  if (!orderId) return NextResponse.redirect(`${site()}/`, 303);
  const k = await signToken({ oid: orderId }, "30d");
  return NextResponse.redirect(`${site()}/order/${orderId}/thank-you?k=${encodeURIComponent(k)}${failed ? "&payerr=1" : ""}`, 303);
}

export function cronAuthorized(req: Request) {
  const h = req.headers.get("authorization");
  return !!process.env.CRON_SECRET && h === `Bearer ${process.env.CRON_SECRET}`;
}
