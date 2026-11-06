import "server-only";
import type { Discount, ShippingZone } from "@prisma/client";
import { db } from "./db";
import { getSettings } from "./settings";
import { getShippingZones } from "./catalog";

export type CartInput = { variantId: string; qty: number }[];
export type PricedLine = {
  variantId: string; productId: string; slug: string; title: string; variantTitle: string; sku: string; image: string;
  category: string; price: number; qty: number; lineTotal: number; stock: number; costPrice: number | null;
};
export type Quote = {
  lines: PricedLine[]; subtotal: number; discountTotal: number; shippingTotal: number; total: number;
  zone: { key: string; name: string; rate: number; eta: string } | null;
  discountCode: string | null; discountLabel: string | null; automaticLabels: string[];
  errors: string[]; freeShipping: boolean; freeThreshold: number; amountToFree: number;
};

export function detectZone(zones: ShippingZone[], district?: string | null, area?: string | null) {
  if (!district) return null;
  const a = (area || "").trim().toLowerCase();
  if (a) {
    const byArea = zones.find((z) => z.areas.some((x) => x.toLowerCase() === a) && (z.districts.length === 0 || z.districts.includes(district) || z.key === "sub_dhaka"));
    if (byArea) return byArea;
  }
  return zones.find((z) => z.districts.includes(district)) ?? zones.find((z) => z.key === "outside_dhaka") ?? zones[zones.length - 1] ?? null;
}

type Eligible = (l: PricedLine) => boolean;
function eligibility(d: Discount): Eligible {
  const ap = (d.appliesTo ?? {}) as { categories?: string[]; productIds?: string[] };
  const cats = ap.categories?.filter(Boolean) ?? [];
  const ids = ap.productIds?.filter(Boolean) ?? [];
  if (!cats.length && !ids.length) return () => true;
  return (l) => cats.includes(l.category) || ids.includes(l.productId);
}
function unitPrices(lines: PricedLine[], ok: Eligible) {
  return lines.filter(ok).flatMap((l) => Array.from({ length: l.qty }, () => l.price)).sort((a, b) => b - a);
}
/** Returns the discount amount for one discount, or 0 if it doesn't apply. */
function discountAmount(d: Discount, lines: PricedLine[], subtotal: number): { amount: number; freeShip: boolean } {
  if (subtotal < d.minOrder) return { amount: 0, freeShip: false };
  const ok = eligibility(d);
  const eligibleSubtotal = lines.filter(ok).reduce((s, l) => s + l.lineTotal, 0);
  if (!eligibleSubtotal) return { amount: 0, freeShip: false };
  switch (d.type) {
    case "percent": return { amount: Math.round((eligibleSubtotal * Math.min(100, d.value)) / 100), freeShip: false };
    case "fixed": return { amount: Math.min(d.value, eligibleSubtotal), freeShip: false };
    case "free_shipping": return { amount: 0, freeShip: true };
    case "bogo": {
      // Every second eligible unit (cheapest of each pair) gets `value`% off (100 = free).
      const u = unitPrices(lines, ok);
      let amt = 0;
      for (let i = 1; i < u.length; i += 2) amt += Math.round((u[i] * (d.value || 100)) / 100);
      return { amount: amt, freeShip: false };
    }
    case "bundle": {
      // "Any N for ৳X": groups the most expensive eligible units into bundles.
      const n = d.bundleQty ?? 2; const price = d.bundlePrice ?? 0;
      const u = unitPrices(lines, ok);
      let amt = 0;
      for (let i = 0; i + n <= u.length; i += n) {
        const group = u.slice(i, i + n).reduce((s, x) => s + x, 0);
        if (group > price) amt += group - price;
      }
      return { amount: amt, freeShip: false };
    }
  }
}
function isLive(d: Discount, now = new Date()) {
  return d.active && (!d.startsAt || d.startsAt <= now) && (!d.endsAt || d.endsAt >= now) && (d.usageLimit == null || d.usageCount < d.usageLimit);
}

export async function quote(input: {
  items: CartInput; district?: string | null; area?: string | null; code?: string | null; phone?: string | null;
}): Promise<Quote> {
  const settings = await getSettings();
  const errors: string[] = [];
  const merged = new Map<string, number>();
  for (const it of input.items) if (it.qty > 0) merged.set(it.variantId, Math.min(20, (merged.get(it.variantId) ?? 0) + Math.floor(it.qty)));
  const variants = merged.size
    ? await db.productVariant.findMany({ where: { id: { in: [...merged.keys()] } }, include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } } })
    : [];
  const lines: PricedLine[] = [];
  for (const v of variants) {
    if (v.product.status !== "active") { errors.push(`${v.product.title} is no longer available`); continue; }
    const qty = merged.get(v.id)!;
    if (v.stock < qty) errors.push(v.stock <= 0 ? `${v.product.title} (${v.title}) is sold out` : `Only ${v.stock} left of ${v.product.title} (${v.title})`);
    lines.push({
      variantId: v.id, productId: v.productId, slug: v.product.slug, title: v.product.title, variantTitle: v.title, sku: v.sku,
      image: v.product.images[0]?.url ?? "", category: v.product.category, price: v.price, qty, lineTotal: v.price * qty, stock: v.stock, costPrice: v.costPrice,
    });
  }
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  // Automatic discounts (bundles, tiered spend offers) stack with at most one code.
  const now = new Date();
  const autos = (await db.discount.findMany({ where: { automatic: true, active: true } })).filter((d) => isLive(d, now));
  let discountTotal = 0; let freeShip = false; const automaticLabels: string[] = [];
  for (const d of autos) {
    const r = discountAmount(d, lines, subtotal);
    if (r.amount > 0 || r.freeShip) { discountTotal += r.amount; freeShip ||= r.freeShip; automaticLabels.push(d.title); }
  }
  let discountCode: string | null = null; let discountLabel: string | null = null;
  const code = input.code?.trim().toUpperCase();
  if (code) {
    const d = await db.discount.findUnique({ where: { code } });
    if (!d || !isLive(d, now)) errors.push("That discount code isn't valid");
    else {
      let allowed = true;
      if (d.perCustomerLimit && input.phone) {
        const used = await db.order.count({ where: { customerPhone: input.phone, discountCode: code, orderStatus: { not: "cancelled" } } });
        if (used >= d.perCustomerLimit) { allowed = false; errors.push("You've already used this code"); }
      }
      if (allowed) {
        const r = discountAmount(d, lines, subtotal);
        if (r.amount > 0 || r.freeShip) { discountTotal += r.amount; freeShip ||= r.freeShip; discountCode = code; discountLabel = d.title; }
        else errors.push(d.minOrder > subtotal ? `Add ৳${d.minOrder - subtotal} more to use ${code}` : "This code doesn't apply to your cart");
      }
    }
  }
  discountTotal = Math.min(discountTotal, subtotal);

  const zones = await getShippingZones();
  const z = detectZone(zones, input.district, input.area);
  const threshold = settings.shipping.freeThreshold;
  const qualifiesFree = !!z && settings.shipping.freeZones.includes(z.key) && subtotal - discountTotal >= threshold;
  let shippingTotal = 0;
  if (z && lines.length) {
    const weightKg = Math.max(0, lines.reduce((s, l) => s + l.qty * 50, 0) / 1000 - 0.5);
    shippingTotal = freeShip || qualifiesFree ? 0 : z.rate + Math.ceil(weightKg) * z.perKgRate;
  }
  const total = Math.max(0, subtotal - discountTotal + shippingTotal);
  return {
    lines, subtotal, discountTotal, shippingTotal, total,
    zone: z ? { key: z.key, name: z.name, rate: z.rate, eta: z.eta } : null,
    discountCode, discountLabel, automaticLabels, errors, freeShipping: freeShip || qualifiesFree,
    freeThreshold: threshold, amountToFree: Math.max(0, threshold - (subtotal - discountTotal)),
  };
}
