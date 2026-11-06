import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllProducts, getApprovedReviews, getProductBySlug } from "@/lib/catalog";
import { getDict, lhref, LOCALES, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { ProductDetail } from "@/components/store/ProductDetail";
import { ProductCard } from "@/components/store/ProductCard";
import { Stars } from "@/components/store/Stars";
import { ReviewForm } from "@/components/store/ReviewForm";
import { RingSizeTable } from "@/components/store/RingSizeTable";
import { db } from "@/lib/db";

export const revalidate = 600;
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateStaticParams() {
  const ps = await db.product.findMany({ where: { status: "active" }, select: { slug: true } }).catch(() => []);
  return LOCALES.flatMap((locale) => ps.map((p) => ({ locale, slug: p.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale; slug: string }> }): Promise<Metadata> {
  const { slug, locale } = await params;
  const p = await getProductBySlug(slug);
  if (!p) return {};
  const title = p.seoTitle ?? `${p.title} — Stainless Steel`;
  const description = p.seoDescription ?? p.description.replace(/<[^>]+>/g, " ").slice(0, 155);
  return {
    title: { absolute: title }, description,
    alternates: { canonical: `/product/${slug}`, languages: { en: `/product/${slug}`, bn: `/bn/product/${slug}` } },
    openGraph: { title, description, images: [{ url: p.images[0]?.url ?? "/brand/og.png", width: 1200, height: 1200 }], locale: locale === "bn" ? "bn_BD" : "en_US" },
    other: { "product:price:amount": String(p.price), "product:price:currency": "BDT" },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ locale: Locale; slug: string }> }) {
  const { locale, slug } = await params;
  const p = await getProductBySlug(slug);
  if (!p) notFound();
  const d = getDict(locale);
  const [settings, all, reviews] = await Promise.all([getSettings(), getAllProducts(), getApprovedReviews(p.id, 20)]);
  const others = all.filter((x) => x.id !== p.id && x.stock > 0);
  const look = [...new Map(others.filter((x) => x.category !== p.category).map((x) => [x.category, x])).values()].slice(0, 3);
  const like = others.filter((x) => x.category === p.category).slice(0, 4);
  const labels = { add: d.add, soldOut: d.soldOut, onlyLeft: d.onlyLeft };
  const desc = locale === "bn" && p.descriptionBn ? p.descriptionBn : p.description;

  const ld: Record<string, unknown>[] = [{
    "@context": "https://schema.org", "@type": "Product", name: p.title, sku: p.variants[0]?.sku, image: p.images.map((i) => `${SITE}${i.url}`),
    description: p.seoDescription ?? p.description.replace(/<[^>]+>/g, " ").trim(), material: p.material, brand: { "@type": "Brand", name: "ARGON" },
    offers: {
      "@type": "AggregateOffer", priceCurrency: "BDT", lowPrice: Math.min(...p.variants.map((v) => v.price)), highPrice: Math.max(...p.variants.map((v) => v.price)),
      offerCount: p.variants.length, availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${SITE}/product/${p.slug}`,
    },
    ...(reviews.count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: reviews.avg.toFixed(1), reviewCount: reviews.count } } : {}),
  }, {
    "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: `${SITE}/shop` },
      { "@type": "ListItem", position: 2, name: p.category, item: `${SITE}/shop/${p.category}` },
      { "@type": "ListItem", position: 3, name: p.title, item: `${SITE}/product/${p.slug}` },
    ],
  }];

  const acc = (title: string, body: React.ReactNode, open = false) => (
    <details className="group border-b border-[var(--line)] py-1" open={open}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between text-[15px] font-medium">{title}<span className="transition-transform group-open:rotate-45">+</span></summary>
      <div className="prose-argon pb-5 text-[14px]">{body}</div>
    </details>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="mb-5 text-[12px] text-[var(--muted)]">
        <Link href={lhref(locale, "/shop")}>{d.shop}</Link> / <Link href={lhref(locale, `/shop/${p.category}`)} className="capitalize">{p.category}</Link>
      </nav>
      <ProductDetail
        p={p} locale={locale} rating={{ avg: reviews.avg, count: reviews.count }} urgency={settings.conversion.stockUrgency ? settings.conversion.urgencyThreshold : 0}
        whatsapp={settings.store.whatsapp} fastPath={settings.conversion.orderNowFastPath} waOrder={settings.conversion.whatsappOrder}
        labels={{ orderNow: d.orderNow, orderNowShort: d.orderNowShort, addToCart: d.addToCart, quantity: d.quantity, onlyLeft: d.onlyLeft, soldOut: d.soldOut, trust1: d.trust1, trust2: d.trust2, trust4: d.trust4 }}
      />

      <div className="mt-12 grid gap-12 md:grid-cols-12">
        <div className="md:col-span-7">
          {acc(d.details, <div dangerouslySetInnerHTML={{ __html: desc }} />, true)}
          {acc(d.sizeGuide, p.category === "rings" ? <RingSizeTable locale={locale} /> : p.category === "chains" ? <p>18&quot; sits at the collarbone · 20&quot; just below · 22&quot; mid‑chest · 24&quot; low. Most men choose 20–22&quot;.</p> : p.category === "bracelets" ? <p>19 cm fits wrists up to 17 cm; 21 cm fits wrists up to 19 cm. Measure your wrist and add 2 cm.</p> : <p>One size fits most.</p>)}
          {acc(d.deliveryPayment, <><p>Inside Dhaka ৳70 (1–2 days) · Dhaka sub‑area ৳100 · Outside Dhaka ৳130 (2–4 days). Free inside Dhaka over ৳{settings.shipping.freeThreshold.toLocaleString("en-IN")}.</p><p>Pay with Cash on Delivery, bKash, Nagad or card.</p></>)}
          {acc(d.care, <p>Wipe with a soft cloth after wearing. Avoid harsh chemicals and perfume directly on the piece. Store separately to avoid scratches.</p>)}
          {acc(d.exchange, <p>Exchange any unused item within 7 days of delivery. WhatsApp us with your order number. <Link href={lhref(locale, "/return-exchange-policy")}>Read the policy</Link>.</p>)}
        </div>
      </div>

      {look.length > 0 && (
        <section className="mt-16" aria-labelledby="look-h">
          <h2 id="look-h" className="font-[family-name:var(--font-display)] text-3xl">{d.completeLook}</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">{look.map((x) => <ProductCard key={x.id} p={x} locale={locale} labels={labels} />)}</div>
        </section>
      )}

      <section id="reviews" className="mt-16 scroll-mt-24" aria-labelledby="rev-h">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="rev-h" className="font-[family-name:var(--font-display)] text-3xl">{d.reviews}{reviews.count > 0 && <span className="ml-3 align-middle text-[14px] text-[var(--muted)]"><Stars value={reviews.avg} /> {reviews.avg.toFixed(1)} · {reviews.count}</span>}</h2>
          <ReviewForm productId={p.id} />
        </div>
        {reviews.count === 0 ? <p className="mt-4 text-[14px] text-[var(--muted)]">{locale === "bn" ? "এখনো কোনো রিভিউ নেই। প্রথম রিভিউটি আপনার হোক।" : "No reviews yet. Bought this? Be the first."}</p> : (
          <ul className="mt-6 grid gap-3 md:grid-cols-2">
            {reviews.items.map((r) => (
              <li key={r.id} className="glass rounded-[var(--radius-card)] p-5">
                <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-[12px] text-[var(--muted)]">{new Date(r.createdAt).toLocaleDateString("en-GB")}</span></div>
                <p className="mt-3 text-[15px]">{r.text}</p>
                {r.photos.length > 0 && <div className="mt-3 flex gap-2">{r.photos.map((ph) => <Image key={ph} src={ph} alt="Customer photo" width={80} height={80} className="h-20 w-20 rounded-lg object-cover" />)}</div>}
                <p className="mt-3 text-[12px] text-[var(--muted)]">{r.name}{r.verified && <> · ✦ {d.verifiedBuyer}</>}</p>
                {r.reply && <p className="mt-3 border-l-2 border-[var(--line)] pl-3 text-[13px] text-[var(--muted)]"><b className="text-[var(--fg)]">ARGON:</b> {r.reply}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {like.length > 0 && (
        <section className="mt-16" aria-labelledby="like-h">
          <h2 id="like-h" className="font-[family-name:var(--font-display)] text-3xl">{d.youMayLike}</h2>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">{like.map((x) => <ProductCard key={x.id} p={x} locale={locale} labels={labels} />)}</div>
        </section>
      )}
      <div className="h-20 md:hidden" />
    </div>
  );
}
