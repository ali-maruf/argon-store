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
import { Carousel } from "@/components/store/Carousel";
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
  const like = others.filter((x) => x.category === p.category).slice(0, 8);
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

  const acc = (id: string, title: string, body: React.ReactNode, open = false) => (
    <details id={id} className="group scroll-mt-28 border-b border-[var(--line)]" open={open}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between text-[13px] font-medium uppercase tracking-[0.14em]">{title}<span className="relative h-3 w-3"><span className="absolute inset-x-0 top-1/2 h-px bg-current" /><span className="absolute inset-y-0 left-1/2 w-px bg-current transition-transform duration-300 group-open:rotate-90 group-open:opacity-0" /></span></summary>
      <div className="prose-argon pb-6 text-[14px]">{body}</div>
    </details>
  );
  const crumb = (
    <nav aria-label="Breadcrumb" className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
      <Link href={lhref(locale, "/shop")} className="ulink">{d.shop}</Link> <span className="mx-1.5">/</span> <Link href={lhref(locale, `/shop/${p.category}`)} className="ulink">{p.category}</Link>
    </nav>
  );

  return (
    <div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\u003c") }} />
      <ProductDetail
        p={p} locale={locale} rating={{ avg: reviews.avg, count: reviews.count }} urgency={settings.conversion.stockUrgency ? settings.conversion.urgencyThreshold : 0}
        whatsapp={settings.store.whatsapp} fastPath={settings.conversion.orderNowFastPath} waOrder={settings.conversion.whatsappOrder} breadcrumb={crumb}
        labels={{ orderNow: d.orderNow, orderNowShort: d.orderNowShort, addToCart: d.addToCart, quantity: d.quantity, onlyLeft: d.onlyLeft, soldOut: d.soldOut, trust1: d.trust1, trust2: d.trust2, trust4: d.trust4 }}
      />

      <section className="mx-auto mt-20 grid max-w-[1600px] gap-10 px-4 md:mt-28 md:grid-cols-12 md:px-10">
        <div className="md:col-span-4">
          <p className="eyebrow mb-4" data-reveal>{locale === "bn" ? "বিস্তারিত" : "The details"}</p>
          <h2 className="h-section" data-reveal style={{ ["--i" as string]: 1 }}>{locale === "bn" ? "যত্নে তৈরি" : <>Made to <span className="serif-i">last</span></>}</h2>
        </div>
        <div className="border-t border-[var(--line)] md:col-span-7 md:col-start-6">
          {acc("details", d.details, <div dangerouslySetInnerHTML={{ __html: desc }} />, true)}
          {acc("size-guide", d.sizeGuide, p.category === "rings" ? <RingSizeTable locale={locale} /> : p.category === "chains" ? <p>18&quot; sits at the collarbone · 20&quot; just below · 22&quot; mid‑chest · 24&quot; low. Most men choose 20–22&quot;.</p> : p.category === "bracelets" ? <p>19 cm fits wrists up to 17 cm; 21 cm fits wrists up to 19 cm. Measure your wrist and add 2 cm.</p> : <p>One size fits most.</p>)}
          {acc("delivery", d.deliveryPayment, <><p>Inside Dhaka ৳70 (1–2 days) · Dhaka sub‑area ৳100 · Outside Dhaka ৳130 (2–4 days). Free inside Dhaka over ৳{settings.shipping.freeThreshold.toLocaleString("en-IN")}.</p><p>Pay with Cash on Delivery, bKash, Nagad or card.</p></>)}
          {acc("care", d.care, <p>Wipe with a soft cloth after wearing. Avoid harsh chemicals and perfume directly on the piece. Store separately to avoid scratches.</p>)}
          {acc("exchange", d.exchange, <p>Exchange any unused item within 7 days of delivery. WhatsApp us with your order number. <Link href={lhref(locale, "/return-exchange-policy")}>Read the policy</Link>.</p>)}
        </div>
      </section>

      {look.length > 0 && (
        <section className="mt-24 border-t border-[var(--line)] pt-20 md:mt-32" aria-labelledby="look-h">
          <div className="mx-auto mb-10 max-w-[1600px] px-4 md:px-10"><p className="eyebrow mb-4" data-reveal>{locale === "bn" ? "স্টাইল করুন" : "Style it with"}</p><h2 id="look-h" className="h-section" data-reveal style={{ ["--i" as string]: 1 }}>{d.completeLook}</h2></div>
          <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-x-3 gap-y-10 px-4 md:grid-cols-3 md:gap-x-5 md:px-10">{look.map((x, i) => <div key={x.id} data-reveal style={{ ["--i" as string]: i }}><ProductCard p={x} locale={locale} labels={labels} /></div>)}</div>
        </section>
      )}

      <section id="reviews" className="mx-auto mt-24 max-w-[1600px] scroll-mt-28 border-t border-[var(--line)] px-4 pt-20 md:mt-32 md:px-10" aria-labelledby="rev-h">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow mb-4">{reviews.count > 0 ? `${reviews.avg.toFixed(1)} / 5 · ${reviews.count} ${d.reviews.toLowerCase()}` : d.reviews}</p>
            <h2 id="rev-h" className="h-section">{locale === "bn" ? "ক্রেতাদের কথা" : <>Real <span className="serif-i">reviews</span></>}</h2>
          </div>
          <ReviewForm productId={p.id} />
        </div>
        {reviews.count === 0 ? <p className="mt-6 text-[14px] text-[var(--muted)]">{locale === "bn" ? "এখনো কোনো রিভিউ নেই। প্রথম রিভিউটি আপনার হোক।" : "No reviews yet — only verified buyers can review. Bought this? Be the first."}</p> : (
          <ul className="mt-10 grid gap-px bg-[var(--line)] md:grid-cols-2">
            {reviews.items.map((r) => (
              <li key={r.id} className="bg-[var(--bg)] p-6 md:p-8">
                <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-[12px] text-[var(--muted)]">{new Date(r.createdAt).toLocaleDateString("en-GB")}</span></div>
                <p className="mt-4 text-[16px] leading-relaxed">{r.text}</p>
                {r.photos.length > 0 && <div className="mt-4 flex gap-2">{r.photos.map((ph) => <Image key={ph} src={ph} alt="Customer photo" width={88} height={88} className="h-[88px] w-[88px] object-cover" />)}</div>}
                <p className="mt-4 text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{r.name}{r.verified && <> · ✦ {d.verifiedBuyer}</>}</p>
                {r.reply && <p className="mt-4 border-l border-[var(--fg)] pl-3 text-[13px] text-[var(--muted)]"><b className="text-[var(--fg)]">ARGON:</b> {r.reply}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {like.length > 0 && (
        <section className="mt-24 border-t border-[var(--line)] pt-20 md:mt-32" aria-labelledby="like-h">
          <div className="mx-auto mb-10 max-w-[1600px] px-4 md:px-10"><p className="eyebrow mb-4" data-reveal>{locale === "bn" ? "আরও" : "More from"} {p.category}</p><h2 id="like-h" className="h-section" data-reveal style={{ ["--i" as string]: 1 }}>{d.youMayLike}</h2></div>
          <Carousel label={d.youMayLike}>{like.map((x) => <ProductCard key={x.id} p={x} locale={locale} labels={labels} sizes="(max-width:768px) 72vw, 25vw" />)}</Carousel>
        </section>
      )}
      <div className="h-20 md:hidden" />
    </div>
  );
}
