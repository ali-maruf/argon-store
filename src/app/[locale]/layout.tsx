import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { Instrument_Serif, Space_Grotesk, Hind_Siliguri } from "next/font/google";
import "../globals.css";
import { getDict, isLocale, lhref, LOCALES, CATEGORIES, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { getAllProducts, getShippingZones } from "@/lib/catalog";
import { db } from "@/lib/db";
import { Header, ThemeToggle } from "@/components/store/HeaderClient";
import { CartDrawer } from "@/components/store/CartDrawer";
import { LogoMark, Sparkle } from "@/components/store/Logo";
import { NewsletterForm } from "@/components/store/NewsletterForm";
import { SessionEffects } from "@/components/store/SessionEffects";
import { RevealObserver } from "@/components/store/RevealObserver";
import { IconCash, IconFacebook, IconInstagram, IconShield, IconSwap, IconTiktok, IconTruck, IconWhatsapp } from "@/components/store/Icons";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif", display: "swap" });
const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const hind = Hind_Siliguri({ subsets: ["bengali"], weight: ["400", "600"], variable: "--font-bn", display: "swap", preload: false });

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "ARGON — Premium Stainless Steel Jewelry", template: "%s | ARGON" },
  description: "Premium 316L stainless‑steel rings, chains, bracelets and eyewear. Limited drops. Cash on Delivery across Bangladesh.",
  openGraph: { type: "website", siteName: "ARGON", images: [{ url: "/brand/og.png", width: 1200, height: 630 }] },
  twitter: { card: "summary_large_image" },
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/brand/icon-32.png", sizes: "32x32" }, { url: "/brand/icon-16.png", sizes: "16x16" }], apple: "/brand/apple-touch-icon.png" },
};
export const viewport: Viewport = { themeColor: "#0A0A0B", width: "device-width", initialScale: 1 };
export const generateStaticParams = () => LOCALES.map((locale) => ({ locale }));

async function getUpsell(sku: string) {
  try {
    const v = await db.productVariant.findUnique({ where: { sku }, include: { product: { include: { images: { orderBy: { position: "asc" }, take: 1 } } } } });
    if (!v || v.stock <= 0 || v.product.status !== "active") return null;
    return { variantId: v.id, productId: v.productId, slug: v.product.slug, title: v.product.title, variantTitle: v.title, price: v.price, image: v.product.images[0]?.url ?? "", stock: v.stock };
  } catch { return null; }
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: l } = await params;
  if (!isLocale(l)) notFound();
  const locale = l as Locale;
  const d = getDict(locale);
  const bn = locale === "bn";
  const [settings, zones, products] = await Promise.all([getSettings(), getShippingZones(), getAllProducts().catch(() => [])]);
  const upsell = settings.conversion.upsell ? await getUpsell(settings.conversion.upsellSku) : null;
  const inside = zones.find((z) => z.key === "inside_dhaka")?.rate ?? 70;
  const outside = zones.find((z) => z.key === "outside_dhaka")?.rate ?? 130;
  const navLabels: Record<string, string> = { "/shop": d.shop, "/shop/rings": d.rings, "/shop/chains": d.chains, "/shop/bracelets": d.bracelets, "/shop/eyewear": d.eyewear };
  const nav = settings.nav.map((n) => ({ href: lhref(locale, n.href), label: navLabels[n.href] ?? n.label }));
  const m = settings.marketing;
  const wa = `https://wa.me/${settings.store.whatsapp}`;
  const mega = {
    categories: CATEGORIES.map((c) => ({ href: lhref(locale, `/shop/${c.key}`), label: d[c.label], image: c.image, count: products.filter((p) => p.category === c.key).length })),
    featured: [
      { href: lhref(locale, "/shop/y2k-edit"), label: "The Y2K Edit", sub: "Collection", image: "/products/clean/7.webp" },
      { href: lhref(locale, "/shop?sort=bestselling"), label: d.bestsellers, sub: "Most worn", image: "/products/clean/12.webp" },
      { href: lhref(locale, "/shop/eyewear"), label: d.eyewear, sub: "New season", image: "/products/clean/4.webp" },
    ],
    quick: [
      { href: lhref(locale, "/shop?sort=newest"), label: bn ? "নতুন এসেছে" : "New arrivals" },
      { href: lhref(locale, "/shop?max=500"), label: bn ? "৳৫০০ এর নিচে" : "Under ৳500" },
      { href: lhref(locale, "/size-guide"), label: d.sizeGuide },
      { href: lhref(locale, "/track"), label: d.track },
    ],
  };
  const tickerItems = [
    bn && settings.announcement.textBn ? settings.announcement.textBn : settings.announcement.text,
    bn ? "৩১৬এল স্টেইনলেস স্টিল — মরিচা ধরে না" : "316L stainless steel — won't rust or tarnish",
    bn ? "৭ দিনের সহজ এক্সচেঞ্জ" : "7‑day easy exchange",
    bn ? "বিকাশ · নগদ · কার্ড" : "Pay with bKash, Nagad or card",
  ];
  const ticker = settings.announcement.enabled ? (
    <div className="flex h-9 items-center bg-[var(--accent-bg)] text-[11px] font-medium uppercase tracking-[0.18em] text-white">
      <div className="marquee w-full" style={{ ["--dur" as string]: "38s" }}>
        {[0, 1].map((k) => (
          <div key={k} className="marquee__track" aria-hidden={k === 1}>
            {[...tickerItems, ...tickerItems].map((t, i) => <span key={i} className="flex shrink-0 items-center gap-12 whitespace-nowrap">{t}<Sparkle className="h-2.5 w-2.5" /></span>)}
          </div>
        ))}
      </div>
    </div>
  ) : null;

  const footCols: [string, [string, string][]][] = [
    [d.shop, [["/shop", bn ? "সব পণ্য" : "Shop all"], ["/shop/rings", d.rings], ["/shop/chains", d.chains], ["/shop/bracelets", d.bracelets], ["/shop/eyewear", d.eyewear], ["/shop/y2k-edit", "Y2K Edit"]]],
    [bn ? "সহায়তা" : "Help", [["/track", d.track], ["/size-guide", d.sizeGuide], ["/shipping-policy", bn ? "শিপিং" : "Shipping"], ["/return-exchange-policy", bn ? "রিটার্ন ও এক্সচেঞ্জ" : "Returns & exchange"], ["/faq", "FAQ"]]],
    ["ARGON", [["/about", bn ? "আমাদের কথা" : "Our story"], ["/contact", bn ? "যোগাযোগ" : "Contact"], ["/account", d.account], ["/privacy-policy", bn ? "প্রাইভেসি" : "Privacy"], ["/terms", bn ? "শর্তাবলি" : "Terms"]]],
  ];

  return (
    <html lang={locale} className={`${serif.variable} ${grotesk.variable} ${bn ? hind.variable : ""}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("argon_theme");if(t)document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-[var(--fg)] focus:px-4 focus:py-2 focus:text-[var(--bg)]">Skip to content</a>
        <Header locale={locale} nav={nav} mega={mega} ticker={ticker}
          labels={{ search: d.search, cart: d.cart, menu: d.menu, account: d.account, placeholder: d.searchPlaceholder, shopAll: bn ? "সব দেখুন" : "Shop all", close: d.close }} />

        <main id="main">
          {settings.seo.maintenance ? (
            <div className="mx-auto grid min-h-[70vh] max-w-lg place-items-center px-4 text-center">
              <div><LogoMark className="mx-auto h-16 w-16" /><h1 className="h-section mt-6">{bn ? "শীঘ্রই ফিরছি" : "Back in orbit soon"}</h1><p className="mt-3 text-[var(--muted)]">{bn ? "অর্ডারের জন্য হোয়াটসঅ্যাপে মেসেজ দিন।" : "We're updating the store. Message us on WhatsApp to order."}</p><a href={wa} className="btn btn-primary mt-6">WhatsApp</a></div>
            </div>
          ) : children}
        </main>

        <footer className="no-print mt-28 border-t border-[var(--line)] bg-[var(--bg)]">
          <ul className="mx-auto grid max-w-[1600px] grid-cols-2 border-b border-[var(--line)] md:grid-cols-4">
            {([[IconShield, d.trust1, d.trust1s], [IconCash, d.trust2, d.trust2s], [IconTruck, d.trust3, d.trust3s], [IconSwap, d.trust4, d.trust4s]] as const).map(([Icon, a, b], i) => (
              <li key={a} className={`flex items-start gap-4 px-5 py-8 md:px-10 ${i % 2 ? "" : "border-r border-[var(--line)]"} ${i === 1 ? "md:border-r" : ""} ${i < 2 ? "border-b md:border-b-0" : ""} border-[var(--line)]`}>
                <Icon className="h-6 w-6 shrink-0 text-[var(--muted)]" />
                <div><p className="text-[13px] font-semibold uppercase tracking-[0.08em]">{a}</p><p className="mt-1 text-[13px] text-[var(--muted)]">{b}</p></div>
              </li>
            ))}
          </ul>
          <div className="mx-auto grid max-w-[1600px] gap-12 px-5 py-16 md:grid-cols-12 md:px-10">
            <div className="md:col-span-5">
              <p className="h-section !text-[clamp(1.8rem,3.2vw,2.75rem)]">{bn ? "ড্রপ লিস্টে যোগ দিন" : <>Join the <span className="serif-i">drop</span> list</>}</p>
              <p className="mt-3 max-w-sm text-[14px] text-[var(--muted)]">{d.joinDropSub}</p>
              <div className="mt-6 max-w-md"><NewsletterForm placeholder={d.phoneOrEmail} cta={d.subscribe} done={d.subscribed} code={settings.conversion.newsletterCode} /></div>
              <div className="mt-8 flex gap-2">
                {([[settings.store.instagram, IconInstagram, "Instagram"], [settings.store.facebook, IconFacebook, "Facebook"], [settings.store.tiktok, IconTiktok, "TikTok"], [wa, IconWhatsapp, "WhatsApp"]] as const).map(([href, Icon, name]) => (
                  <a key={name} href={href} target="_blank" rel="noopener" aria-label={name} className="grid h-11 w-11 place-items-center border border-[var(--line)] transition-colors hover:border-[var(--fg)] hover:bg-[var(--fg)] hover:text-[var(--bg)]"><Icon /></a>
                ))}
              </div>
            </div>
            {footCols.map(([title, links]) => (
              <div key={title} className="md:col-span-2 md:col-start-auto">
                <p className="eyebrow mb-5">{title}</p>
                <ul className="space-y-3 text-[14px]">{links.map(([h, t]) => <li key={h}><Link href={lhref(locale, h)} className="ulink">{t}</Link></li>)}</ul>
              </div>
            ))}
            <div className="md:col-span-1" />
          </div>
          <div className="relative overflow-hidden border-t border-[var(--line)]" aria-hidden>
            <p className="chrome-text select-none py-2 text-center text-[24.5vw] font-semibold leading-[0.82] tracking-[-0.06em] opacity-90" data-reveal>ARGON</p>
          </div>
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4 border-t border-[var(--line)] px-5 py-6 text-[12px] text-[var(--muted)] md:flex-row md:items-center md:justify-between md:px-10">
            <p>© {new Date().getFullYear()} ARGON · {bn ? "ঢাকা, বাংলাদেশ" : "Forged in Dhaka"} · @argon.go_</p>
            <ul className="flex flex-wrap items-center gap-1.5" aria-label="Payment methods">
              {["COD", "bKash", "Nagad", "VISA", "Mastercard", "Rocket"].map((p) => <li key={p} className="border border-[var(--line)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--fg)]">{p}</li>)}
            </ul>
            <ThemeToggle />
          </div>
        </footer>

        <a href={wa} target="_blank" rel="noopener" className="no-print fixed bottom-5 left-4 z-30 grid h-12 w-12 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_8px_30px_-6px_rgba(37,211,102,.5)] transition-transform hover:scale-105 md:bottom-6 md:left-6" aria-label="Chat on WhatsApp">
          <IconWhatsapp className="h-6 w-6" />
        </a>

        <CartDrawer
          locale={locale} freeThreshold={settings.shipping.freeThreshold} freeBar={settings.conversion.freeShippingBar} insideRate={inside} outsideRate={outside} upsell={upsell}
          s={{ cart: d.cart, close: d.close, emptyCart: d.emptyCart, continueShopping: d.continueShopping, remove: d.remove, subtotal: d.subtotal, checkout: d.checkout, discountCode: d.discountCode, apply: d.apply, estDelivery: d.estDelivery, insideDhaka: d.insideDhaka, outsideDhaka: d.outsideDhaka, freeDeliveryAway: d.freeDeliveryAway, freeDeliveryUnlocked: d.freeDeliveryUnlocked, add: d.add, quantity: d.quantity }}
        />
        <RevealObserver />
        <SessionEffects exitIntent={settings.conversion.exitIntent} code={settings.conversion.exitIntentCode} />

        {m.metaPixelId && (
          <Script id="meta-pixel" strategy="lazyOnload">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${m.metaPixelId}');fbq('track','PageView');`}</Script>
        )}
        {m.ga4Id && (<>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${m.ga4Id}`} strategy="lazyOnload" />
          <Script id="ga4" strategy="lazyOnload">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${m.ga4Id}');`}</Script>
        </>)}
        {m.gtmId && <Script id="gtm" strategy="lazyOnload">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i;f.parentNode.insertBefore(j,f)})(window,document,'script','dataLayer','${m.gtmId}');`}</Script>}
        {m.tiktokPixelId && <Script id="tiktok" strategy="lazyOnload">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.load=function(e){var n=d.createElement("script");n.async=!0;n.src="https://analytics.tiktok.com/i18n/pixel/events.js?sdkid="+e;d.head.appendChild(n)};ttq.load('${m.tiktokPixelId}');ttq.page()}(window,document,'ttq');`}</Script>}
      </body>
    </html>
  );
}
