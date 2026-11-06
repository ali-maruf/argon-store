import type { Metadata, Viewport } from "next";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { Instrument_Serif, Space_Grotesk, Hind_Siliguri } from "next/font/google";
import "../globals.css";
import { getDict, isLocale, lhref, LOCALES, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { getShippingZones } from "@/lib/catalog";
import { db } from "@/lib/db";
import { HeaderShell, CartButton, LangToggle, MobileMenu, SearchButton, ThemeToggle } from "@/components/store/HeaderClient";
import { CartDrawer } from "@/components/store/CartDrawer";
import { LogoMark, Sparkle, Wordmark } from "@/components/store/Logo";
import { NewsletterForm } from "@/components/store/NewsletterForm";
import { SessionEffects } from "@/components/store/SessionEffects";

const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", variable: "--font-serif", display: "swap" });
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
  const [settings, zones] = await Promise.all([getSettings(), getShippingZones()]);
  const upsell = settings.conversion.upsell ? await getUpsell(settings.conversion.upsellSku) : null;
  const inside = zones.find((z) => z.key === "inside_dhaka")?.rate ?? 70;
  const outside = zones.find((z) => z.key === "outside_dhaka")?.rate ?? 130;
  const navLabels: Record<string, string> = { "/shop": d.shop, "/shop/rings": d.rings, "/shop/chains": d.chains, "/shop/bracelets": d.bracelets, "/shop/eyewear": d.eyewear };
  const nav = settings.nav.map((n) => ({ href: lhref(locale, n.href), label: navLabels[n.href] ?? n.label }));
  const m = settings.marketing;
  const wa = `https://wa.me/${settings.store.whatsapp}`;

  return (
    <html lang={locale} className={`${serif.variable} ${grotesk.variable} ${locale === "bn" ? hind.variable : ""}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("argon_theme");if(t)document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className="min-h-dvh">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[var(--fg)] focus:px-4 focus:py-2 focus:text-[var(--bg)]">Skip to content</a>
        {settings.announcement.enabled && (
          <div className="bg-[var(--accent-bg)] px-4 py-2 text-center text-[12px] tracking-wide text-white">
            <Link href={lhref(locale, settings.announcement.link || "/shop")}>{locale === "bn" && settings.announcement.textBn ? settings.announcement.textBn : settings.announcement.text}</Link>
          </div>
        )}
        <HeaderShell>
          <div className="relative mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 md:px-8">
            <MobileMenu links={nav} label={d.menu} />
            <Link href={lhref(locale, "/")} className="flex items-center gap-2.5" aria-label="ARGON home">
              <LogoMark className="h-8 w-8" />
              <Wordmark className="hidden sm:inline" />
            </Link>
            <nav className="ml-8 hidden items-center gap-7 text-[14px] md:flex" aria-label="Main">
              {nav.map((n) => <Link key={n.href} href={n.href} className="text-[var(--muted)] transition-colors hover:text-[var(--fg)]">{n.label}</Link>)}
            </nav>
            <div className="ml-auto flex items-center">
              <SearchButton locale={locale} placeholder={d.searchPlaceholder} label={d.search} />
              <LangToggle locale={locale} />
              <span className="hidden sm:block"><ThemeToggle /></span>
              <CartButton label={d.cart} />
            </div>
          </div>
        </HeaderShell>

        <main id="main">
          {settings.seo.maintenance ? (
            <div className="mx-auto grid min-h-[60vh] max-w-lg place-items-center px-4 text-center">
              <div><LogoMark className="mx-auto h-16 w-16" /><h1 className="mt-6 font-[family-name:var(--font-display)] text-5xl">{locale === "bn" ? "শীঘ্রই ফিরছি।" : "Back in orbit soon."}</h1><p className="mt-3 text-[var(--muted)]">{locale === "bn" ? "অর্ডারের জন্য হোয়াটসঅ্যাপে মেসেজ দিন।" : "We're updating the store. Message us on WhatsApp to order."}</p><a href={wa} className="btn btn-primary mt-6">WhatsApp</a></div>
            </div>
          ) : children}
        </main>
        <SessionEffects exitIntent={settings.conversion.exitIntent} code={settings.conversion.exitIntentCode} />

        <footer className="mt-24 border-t border-[var(--line)]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-12 md:px-8">
            <div className="md:col-span-4">
              <div className="flex items-center gap-3"><LogoMark className="h-10 w-10" /><Wordmark /></div>
              <p className="mt-4 max-w-xs text-[14px] text-[var(--muted)]">{settings.store.tagline}</p>
              <div className="mt-6 flex gap-2 text-[13px]">
                <a className="pill" href={settings.store.instagram} target="_blank" rel="noopener">Instagram</a>
                <a className="pill" href={settings.store.facebook} target="_blank" rel="noopener">Facebook</a>
                <a className="pill" href={settings.store.tiktok} target="_blank" rel="noopener">TikTok</a>
              </div>
            </div>
            <div className="md:col-span-2">
              <p className="eyebrow mb-4">{d.shop}</p>
              <ul className="space-y-2 text-[14px]">{nav.map((n) => <li key={n.href}><Link href={n.href}>{n.label}</Link></li>)}</ul>
            </div>
            <div className="md:col-span-2">
              <p className="eyebrow mb-4">Help</p>
              <ul className="space-y-2 text-[14px]">
                {[["/track", d.track], ["/size-guide", d.sizeGuide], ["/faq", "FAQ"], ["/contact", "Contact"], ["/about", "About"]].map(([h, t]) => <li key={h}><Link href={lhref(locale, h)}>{t}</Link></li>)}
                <li><a href={wa} target="_blank" rel="noopener">WhatsApp</a></li>
              </ul>
            </div>
            <div className="md:col-span-4">
              <p className="eyebrow mb-4">{d.joinDrop}</p>
              <NewsletterForm placeholder={d.phoneOrEmail} cta={d.subscribe} done={d.subscribed} />
            </div>
          </div>
          <div className="mx-auto flex max-w-7xl flex-col gap-4 border-t border-[var(--line)] px-4 py-6 text-[12px] text-[var(--muted)] md:flex-row md:items-center md:justify-between md:px-8">
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {[["/shipping-policy", "Shipping"], ["/return-exchange-policy", "Returns & Exchange"], ["/privacy-policy", "Privacy"], ["/terms", "Terms"]].map(([h, t]) => <li key={h}><Link href={lhref(locale, h)}>{t}</Link></li>)}
            </ul>
            <ul className="flex flex-wrap items-center gap-2" aria-label="Payment methods">
              {["COD", "bKash", "Nagad", "VISA", "Mastercard"].map((p) => <li key={p} className="rounded-md border border-[var(--line)] px-2 py-1 text-[11px] font-semibold tracking-wide text-[var(--fg)]">{p}</li>)}
            </ul>
            <p>© {new Date().getFullYear()} ARGON <Sparkle className="inline h-2.5 w-2.5" /> @argon.go_</p>
          </div>
        </footer>

        <a href={wa} target="_blank" rel="noopener" className="glass no-print fixed bottom-5 left-4 z-30 grid h-12 w-12 place-items-center rounded-full shadow-lg md:bottom-6 md:left-6" aria-label="Chat on WhatsApp">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" /></svg>
        </a>

        <CartDrawer
          locale={locale} freeThreshold={settings.shipping.freeThreshold} freeBar={settings.conversion.freeShippingBar} insideRate={inside} outsideRate={outside} upsell={upsell}
          s={{ cart: d.cart, close: d.close, emptyCart: d.emptyCart, continueShopping: d.continueShopping, remove: d.remove, subtotal: d.subtotal, checkout: d.checkout, discountCode: d.discountCode, apply: d.apply, estDelivery: d.estDelivery, insideDhaka: d.insideDhaka, outsideDhaka: d.outsideDhaka, freeDeliveryAway: d.freeDeliveryAway, freeDeliveryUnlocked: d.freeDeliveryUnlocked, add: d.add, quantity: d.quantity }}
        />

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
