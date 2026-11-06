import Image from "next/image";
import Link from "next/link";
import { getAllProducts, getApprovedReviews, getHomeSections, sortProducts } from "@/lib/catalog";
import { CATEGORIES, getDict, lhref, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { ProductCard } from "@/components/store/ProductCard";
import { LogoMark, Sparkle } from "@/components/store/Logo";
import { NewsletterForm } from "@/components/store/NewsletterForm";
import { Stars } from "@/components/store/Stars";
import { HeroLoader } from "@/components/store/HeroLoader";

export const revalidate = 600;

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const d = getDict(locale);
  const [settings, products, sections, reviews] = await Promise.all([getSettings(), getAllProducts(), getHomeSections(), getApprovedReviews(undefined, 3)]);
  const labels = { add: d.add, soldOut: d.soldOut, onlyLeft: d.onlyLeft };
  const best = sortProducts(products.filter((p) => p.badges.includes("BESTSELLER") || p.tags.includes("bestseller")), "bestselling").slice(0, 8);
  const limited = products.filter((p) => p.stock > 0 && p.stock <= settings.conversion.urgencyThreshold && p.badges.includes("LIMITED STOCK")).sort((a, b) => a.stock - b.stock).slice(0, 8);
  const order = sections.length ? sections.filter((s) => s.enabled).map((s) => s.type) : ["hero", "categories", "bestsellers", "trust", "limited", "ugc", "reviews", "newsletter"];
  const h = settings.hero;

  const blocks: Record<string, React.ReactNode> = {
    hero: (
      <section key="hero" className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-[45%] h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl" style={{ background: "radial-gradient(circle, #6E0414 0%, rgba(65,2,11,.5) 40%, transparent 70%)" }} />
        <div className="relative mx-auto grid max-w-7xl items-center gap-6 px-4 pb-14 pt-8 md:grid-cols-12 md:px-8 md:pb-24 md:pt-16">
          <div className="hero-stage relative order-1 mx-auto aspect-square w-full max-w-[380px] md:order-2 md:col-span-6 md:max-w-[560px]">
            {h.enable3d && <HeroLoader />}
            <div className="poster absolute inset-0 grid place-items-center transition-opacity duration-300">
              <LogoMark className="h-[62%] w-[62%] drop-shadow-[0_20px_60px_rgba(110,4,20,.6)]" />
            </div>
          </div>
          <div className="order-2 text-center md:order-1 md:col-span-6 md:text-left">
            <p className="eyebrow">{locale === "bn" ? "লিমিটেড ড্রপ" : "Premium Steel"}</p>
            <h1 className="chrome-text mt-4 font-[family-name:var(--font-display)] text-[56px] leading-[0.95] md:text-[96px]">{locale === "bn" ? h.headlineBn : h.headline}</h1>
            <p className="mx-auto mt-5 max-w-md text-[17px] text-[var(--muted)] md:mx-0">{d.heroSub}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
              <Link href={lhref(locale, "/shop")} className="btn btn-primary !min-h-14 px-8 text-base"><Sparkle className="h-3 w-3" /> {locale === "bn" ? h.ctaBn : h.cta}</Link>
              <Link href={lhref(locale, "/shop?sort=bestselling")} className="btn btn-ghost !min-h-14 px-8">{d.viewBestsellers}</Link>
            </div>
          </div>
        </div>
      </section>
    ),
    categories: (
      <section key="cats" className="mx-auto max-w-7xl px-4 py-10 md:px-8" aria-labelledby="cats-h">
        <h2 id="cats-h" className="eyebrow mb-6 text-center">{d.shopBy}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {CATEGORIES.map((c) => (
            <Link key={c.key} href={lhref(locale, `/shop/${c.key}`)} className="hairline group relative aspect-square overflow-hidden rounded-[var(--radius-card)]">
              <Image src={c.image} alt="" fill sizes="(max-width:768px) 50vw, 25vw" className="scale-[1.15] object-cover transition-transform duration-300 group-hover:scale-[1.2]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <span className="absolute inset-x-0 bottom-4 text-center text-[12px] font-semibold uppercase tracking-[0.4em] text-white">{d[c.label]}</span>
            </Link>
          ))}
        </div>
      </section>
    ),
    bestsellers: best.length ? (
      <section key="best" className="py-10" aria-labelledby="best-h">
        <div className="mx-auto flex max-w-7xl items-end justify-between px-4 md:px-8">
          <div><p className="eyebrow">✦ {d.bestsellers}</p><h2 id="best-h" className="mt-2 font-[family-name:var(--font-display)] text-4xl">{locale === "bn" ? "সবার পছন্দ" : "Most worn."}</h2></div>
          <Link href={lhref(locale, "/shop?sort=bestselling")} className="text-[14px] text-[var(--muted)] underline underline-offset-4">{d.shop} →</Link>
        </div>
        <div className="no-scrollbar mx-auto mt-6 flex max-w-7xl snap-x gap-3 overflow-x-auto px-4 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-8">
          {best.map((p, i) => <div key={p.id} className="w-[46%] shrink-0 snap-start md:w-auto"><ProductCard p={p} locale={locale} labels={labels} priority={i < 2} /></div>)}
        </div>
      </section>
    ) : null,
    trust: (
      <section key="trust" className="mx-auto max-w-7xl px-4 py-10 md:px-8" aria-label="Why ARGON">
        <ul className="glass grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-card)] md:grid-cols-4">
          {([[d.trust1, d.trust1s], [d.trust2, d.trust2s], [d.trust3, d.trust3s], [d.trust4, d.trust4s]] as const).map(([a, b]) => (
            <li key={a} className="p-5 md:p-7"><Sparkle className="mb-3 h-3 w-3" /><p className="text-[14px] font-semibold">{a}</p><p className="mt-1 text-[13px] text-[var(--muted)]">{b}</p></li>
          ))}
        </ul>
      </section>
    ),
    limited: limited.length ? (
      <section key="limited" className="mx-auto max-w-7xl px-4 py-10 md:px-8" aria-labelledby="lim-h">
        <p className="eyebrow text-[var(--accent)]">✦ {d.limitedDrop}</p>
        <h2 id="lim-h" className="mt-2 font-[family-name:var(--font-display)] text-4xl">{d.limitedSub}</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
          {limited.map((p) => <ProductCard key={p.id} p={p} locale={locale} labels={labels} />)}
        </div>
      </section>
    ) : null,
    ugc: settings.ugc.length ? (
      <section key="ugc" className="mx-auto max-w-7xl px-4 py-10 md:px-8" aria-labelledby="ugc-h">
        <div className="mb-6 flex items-end justify-between">
          <h2 id="ugc-h" className="font-[family-name:var(--font-display)] text-4xl">{locale === "bn" ? "অরবিট পরুন" : "Wear the orbit."}</h2>
          <a href={settings.store.instagram} target="_blank" rel="noopener" className="text-[14px] text-[var(--muted)] underline underline-offset-4">@argon.go_</a>
        </div>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6 md:gap-3">
          {settings.ugc.slice(0, 6).map((u, i) => (
            <a key={i} href={u.url} target="_blank" rel="noopener" className="relative aspect-square overflow-hidden rounded-xl" aria-label={`Instagram post ${i + 1}`}>
              <Image src={u.image} alt="" fill sizes="(max-width:768px) 33vw, 16vw" className="scale-[1.15] object-cover transition-transform duration-300 hover:scale-[1.2]" />
            </a>
          ))}
        </div>
      </section>
    ) : null,
    reviews: reviews.count > 0 ? (
      <section key="reviews" className="mx-auto max-w-7xl px-4 py-10 md:px-8" aria-labelledby="rev-h">
        <div className="flex flex-wrap items-end gap-4">
          <h2 id="rev-h" className="font-[family-name:var(--font-display)] text-4xl">{d.reviews}</h2>
          <p className="flex items-center gap-2 text-[14px] text-[var(--muted)]"><Stars value={reviews.avg} /> {reviews.avg.toFixed(1)} · {d.basedOn.replace("{n}", String(reviews.count))}</p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {reviews.items.map((r) => (
            <figure key={r.id} className="glass rounded-[var(--radius-card)] p-6">
              <Stars value={r.rating} />
              <blockquote className="mt-3 text-[15px]">“{r.text}”</blockquote>
              <figcaption className="mt-4 text-[13px] text-[var(--muted)]">{r.name}{r.verified && <> · ✦ {d.verifiedBuyer}</>} · <Link href={lhref(locale, `/product/${r.product.slug}`)} className="underline">{r.product.title}</Link></figcaption>
            </figure>
          ))}
        </div>
      </section>
    ) : null,
    newsletter: (
      <section key="nl" className="mx-auto max-w-3xl px-4 py-16 text-center md:px-8">
        <Sparkle className="mx-auto h-4 w-4" />
        <h2 className="mt-4 font-[family-name:var(--font-display)] text-4xl md:text-5xl">{d.joinDrop}</h2>
        <p className="mx-auto mt-3 max-w-md text-[var(--muted)]">{d.joinDropSub}</p>
        <div className="mx-auto mt-6 max-w-md"><NewsletterForm placeholder={d.phoneOrEmail} cta={d.subscribe} done={d.subscribed} code={settings.conversion.newsletterCode} /></div>
      </section>
    ),
  };

  return <>{order.map((t) => blocks[t] ?? null)}</>;
}
