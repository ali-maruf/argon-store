import type { MetadataRoute } from "next";
import { getSettings } from "@/lib/settings";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings();
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  if (!s.seo.indexing) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/checkout", "/account", "/order", "/track", "/search"] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
