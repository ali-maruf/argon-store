import { NextResponse, type NextRequest } from "next/server";

/** English is served at the root (rewritten to /en internally); Bangla lives at /bn. */
export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return NextResponse.redirect(new URL((pathname.slice(3) || "/") + search, req.url), 308);
  }
  // Capture UTM parameters into a first-party cookie for order attribution.
  const res = pathname === "/bn" || pathname.startsWith("/bn/")
    ? NextResponse.next()
    : NextResponse.rewrite(new URL(`/en${pathname === "/" ? "" : pathname}${search}`, req.url));
  const utm = ["utm_source", "utm_medium", "utm_campaign"].map((k) => req.nextUrl.searchParams.get(k));
  if (utm.some(Boolean)) res.cookies.set("argon_utm", JSON.stringify({ source: utm[0], medium: utm[1], campaign: utm[2] }), { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax" });
  return res;
}

export const config = {
  matcher: ["/((?!_next|api|admin|feeds|products|brand|uploads|sitemap.xml|robots.txt|manifest.webmanifest|icon.png|apple-icon.png|favicon.ico|.*\\.[a-z0-9]+$).*)"],
};
