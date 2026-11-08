import { unstable_cache, revalidateTag } from "next/cache";
import { db } from "./db";

export const DEFAULT_SETTINGS = {
  store: {
    name: "ARGON", tagline: "Forged in steel. Built to last.", email: "hello@argon.com.bd", phone: "01700000000",
    whatsapp: "8801700000000", messenger: "argon.go", address: "Dhaka, Bangladesh",
    instagram: "https://instagram.com/argon.go_", facebook: "https://facebook.com/argon.go", tiktok: "https://tiktok.com/@argon.go_",
    orderPrefix: "ARG-", currency: "BDT", taxEnabled: false, taxRate: 0,
    invoiceFooter: "Thank you for wearing the orbit. Exchanges within 7 days of delivery.",
  },
  announcement: { enabled: true, text: "Free delivery inside Dhaka over ৳1,500 ✦ Cash on Delivery available", textBn: "ঢাকার ভিতরে ৳১,৫০০+ অর্ডারে ফ্রি ডেলিভারি ✦ ক্যাশ অন ডেলিভারি", link: "/shop" },
  hero: {
    headline: "Forged in Steel.", headlineBn: "ইস্পাতে গড়া।", cta: "Shop the Drop", ctaBn: "ড্রপ দেখুন",
    eyebrow: "Drop 01 — Limited run", eyebrowBn: "ড্রপ ০১ — লিমিটেড",
    video: "/video/hero.mp4", videoWebm: "/video/hero.webm", videoMobile: "/video/hero-mobile.mp4", videoMobileWebm: "/video/hero-mobile.webm", poster: "/video/hero-poster.webp", posterMobile: "/video/hero-mobile-poster.webp",
    lookbookVideo: "/video/lookbook.mp4", lookbookWebm: "/video/lookbook.webm", lookbookPoster: "/video/lookbook-poster.webp",
  },
  shipping: { freeThreshold: 1500, freeZones: ["inside_dhaka"] as string[] },
  payments: {
    cod: { enabled: true, advanceOutsideDhaka: false, otp: "off" as "off" | "always" | "flagged" },
    bkash: { enabled: true, sandbox: true },
    nagad: { enabled: true, sandbox: true },
    sslcommerz: { enabled: true, sandbox: true },
  },
  conversion: {
    orderNowFastPath: true, stockUrgency: true, urgencyThreshold: 10, freeShippingBar: true, upsell: true,
    upsellSku: "ARG-C05-2.0-20", exitIntent: false, exitIntentCode: "ORBIT10", whatsappOrder: true, newsletterCode: "ORBIT10",
  },
  abandoned: { enabled: true, firstAfterHours: 1, secondAfterHours: 24, secondDiscountCode: "COMEBACK10" },
  reviews: { requestAfterDays: 4, requestEnabled: true },
  couriers: { default: "steadfast", autoSyncMinutes: 30 },
  marketing: { metaPixelId: "", ga4Id: "", gtmId: "", tiktokPixelId: "" },
  notifications: { ownerPhone: "", ownerEmail: "", telegramChatId: "", lowStockAlerts: true },
  seo: { indexing: true, maintenance: false },
  ugc: [
    { image: "/products/clean/30.webp", url: "https://instagram.com/argon.go_" },
    { image: "/products/clean/31.webp", url: "https://instagram.com/argon.go_" },
    { image: "/products/clean/28.webp", url: "https://instagram.com/argon.go_" },
    { image: "/products/clean/29.webp", url: "https://instagram.com/argon.go_" },
    { image: "/products/clean/7.webp", url: "https://instagram.com/argon.go_" },
    { image: "/products/clean/23.webp", url: "https://instagram.com/argon.go_" },
  ] as { image: string; url: string }[],
  nav: [
    { label: "Shop", href: "/shop" }, { label: "Rings", href: "/shop/rings" }, { label: "Chains", href: "/shop/chains" },
    { label: "Bracelets", href: "/shop/bracelets" }, { label: "Eyewear", href: "/shop/eyewear" },
  ] as { label: string; href: string }[],
};
export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

function merge<T>(base: T, over: unknown): T {
  if (Array.isArray(base) || typeof base !== "object" || base === null) return (over ?? base) as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  if (over && typeof over === "object") for (const [k, v] of Object.entries(over)) out[k] = k in out ? merge(out[k], v) : v;
  return out as T;
}

async function loadSettings(): Promise<Settings> {
  try {
    const rows = await db.setting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return merge(DEFAULT_SETTINGS, map);
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export const getSettings = unstable_cache(loadSettings, ["settings"], { tags: ["settings"], revalidate: 3600 });
export const getSettingsFresh = loadSettings;

export async function saveSetting<K extends SettingKey>(key: K, value: Settings[K]) {
  await db.setting.upsert({ where: { key }, create: { key, value: value as object }, update: { value: value as object } });
  revalidateTag("settings");
}
