import "server-only";
import { db } from "./db";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const strip = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

/** RSS 2.0 product feed with g: namespace, accepted by both Meta Commerce Manager and Google Merchant Center. */
export async function productFeed(kind: "facebook" | "google") {
  const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const products = await db.product.findMany({ where: { status: "active" }, include: { variants: true, images: { orderBy: { position: "asc" } } } });
  const items = products.flatMap((p) => p.variants.map((v) => `
    <item>
      <g:id>${esc(v.sku)}</g:id>
      <g:item_group_id>${esc(p.id)}</g:item_group_id>
      <g:title>${esc(`${p.title}${v.title !== "Default" ? ` — ${v.title}` : ""}`)}</g:title>
      <g:description>${esc(strip(p.description).slice(0, 4900))}</g:description>
      <g:link>${SITE}/product/${p.slug}</g:link>
      <g:image_link>${SITE}${p.images[0]?.url ?? ""}</g:image_link>
      ${p.images.slice(1, 10).map((i) => `<g:additional_image_link>${SITE}${i.url}</g:additional_image_link>`).join("")}
      <g:availability>${v.stock > 0 ? "in stock" : "out of stock"}</g:availability>
      <g:price>${v.compareAtPrice ?? v.price}.00 BDT</g:price>
      ${v.compareAtPrice ? `<g:sale_price>${v.price}.00 BDT</g:sale_price>` : ""}
      <g:brand>ARGON</g:brand>
      <g:condition>new</g:condition>
      <g:material>${esc(p.material)}</g:material>
      <g:google_product_category>${p.category === "eyewear" ? "178" : "188"}</g:google_product_category>
      ${kind === "facebook" ? `<g:inventory>${Math.max(0, v.stock)}</g:inventory>` : ""}
      <g:identifier_exists>no</g:identifier_exists>
    </item>`)).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>ARGON</title><link>${SITE}</link><description>ARGON product catalog</description>${items}
</channel></rss>`;
}
