import Image from "next/image";
import Link from "next/link";
import { getAllProducts, getApprovedReviews, getHomeSections, sortProducts } from "@/lib/catalog";
import { notFound } from "next/navigation";
import { CATEGORIES, getDict, isLocale, lhref, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { ProductCard } from "@/components/store/ProductCard";
import { Sparkle } from "@/components/store/Logo";
import { Stars } from "@/components/store/Stars";
import { LoopVideo } from "@/components/store/LoopVideo";
import { Carousel } from "@/components/store/Carousel";
import { IconArrow, IconInstagram } from "@/components/store/Icons";

export const revalidate = 600;

const DEFAULT_ORDER = ["hero", "marquee", "categories", "bestsellers", "story", "lookbook", "limited", "mosaic", "reviews", "ugc"];

export default async function Home({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const d = getDict(locale);
  const bn = locale === "bn";
  const L = (p: string) => lhref(locale, p);
  const [settings, products, sections, reviews] = await Promise.all([getSettings(), getAllProducts(), getHomeSections(), getApprovedReviews(undefined, 6)]);
  const labels = { add: d.add, soldOut: d.soldOut, onlyLeft: d.onlyLeft };
  const best = sortProducts(products.filter((p) => p.badges.includes("BESTSELLER") || p.tags.includes("bestseller") || p.featured), "bestselling");
  const bestRow = (best.length >= 6 ? best : [...best, ...sortProducts(products.filter((p) => !best.includes(p)), "featured")]).slice(0, 10);
  const limited = products.filter((p) => p.stock > 0 && p.stock <= settings.conversion.urgencyThreshold && p.badges.includes("LIMITED STOCK")).sort((a, b) => a.stock - b.stock).slice(0, 4);
  const h = settings.hero;

  // Admin-controlled order (Content → Homepage sections); newer section types fall back to their default slot.
  const order = [
    ...sections.filter((s) => s.enabled && DEFAULT_ORDER.includes(s.type)).map((s) => s.type),
    ...DEFAULT_ORDER.filter((t) => !sections.some((s) => s.type === t)),
  ];

  const headline = (bn ? h.headlineBn : h.headline).replace(/\.$/, "").split(" ");
  const SectionHead = ({ eyebrow, title, href, cta }: { eyebrow: string; title: React.ReactNode; href?: string; cta?: string }) => (
    <div className="mx-auto mb-10 flex max-w-[1600px] items-end justify-between gap-6 px-4 md:mb-14 md:px-10">
      <div><p className="eyebrow mb-4" data-reveal>{eyebrow}</p><h2 className="h-section" data-reveal style={{ ["--i" as string]: 1 }}>{title}</h2></div>
      {href && <Link href={href} className="arrow-link hidden shrink-0 md:inline-flex" data-reveal>{cta} <IconArrow /></Link>}
    </div>
  );

  const blocks: Record<string, React.ReactNode> = {
    hero: (
      <section key="hero" className="relative h-[100svh] min-h-[600px] w-full overflow-hidden bg-black text-white">
        <Image src={h.poster} alt="" fill priority fetchPriority="high" sizes="100vw" className="hidden object-cover md:block" />
        <Image src={h.posterMobile || h.poster} alt="" fill priority sizes="100vw" className="object-cover md:hidden" />
        <LoopVideo mp4={h.video} webm={h.videoWebm} mobileMp4={h.videoMobile} mobileWebm={h.videoMobileWebm} poster={h.poster} posterMobile={h.posterMobile}
          className="absolute inset-0 h-full w-full object-cover" label="ARGON Drop 01 film" controlClass="absolute bottom-8 right-4 z-10 md:bottom-10 md:right-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/45" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[1600px] px-4 pb-24 md:px-10 md:pb-16">
          <p className="fade-in mb-5 flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.32em] text-white/80" style={{ ["--d" as string]: ".2s" }}><Sparkle className="h-2.5 w-2.5" /> {bn ? h.eyebrowBn : h.eyebrow}</p>
          <h1 className="display text-[clamp(3.4rem,min(12.5vw,20vh),12.5rem)]">
            <span className="line-mask"><span style={{ ["--i" as string]: 0 }}>{headline.slice(0, -1).join(" ")}</span></span>
            <span className="line-mask"><span style={{ ["--i" as string]: 1 }} className="serif-i !normal-case">{headline.at(-1)}.</span></span>
          </h1>
          <div className="mt-8 flex flex-col gap-6 md:mt-10 md:flex-row md:items-end md:justify-between">
            <p className="fade-in max-w-sm text-[15px] leading-relaxed text-white/80" style={{ ["--d" as string]: ".9s" }}>{d.heroSub} {bn ? "ক্যাশ অন ডেলিভারি সারা দেশে।" : "Cash on Delivery nationwide."}</p>
            <div className="fade-in flex flex-wrap gap-3" style={{ ["--d" as string]: "1.05s" }}>
              <Link href={L("/shop")} className="btn btn-light">{bn ? h.ctaBn : h.cta}</Link>
              <Link href={L("/shop?sort=bestselling")} className="btn btn-outline-light">{d.viewBestsellers}</Link>
            </div>
          </div>
        </div>
        <div className="fade-in absolute bottom-10 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/70 md:flex" style={{ ["--d" as string]: "1.4s" }} aria-hidden>
          Scroll<span className="h-10 w-px bg-white/70" style={{ animation: "scrollcue 2.2s var(--ease-out) infinite" }} />
        </div>
      </section>
    ),

    marquee: (
      <section key="marquee" className="overflow-hidden border-b border-[var(--line)] py-6 md:py-8" aria-label="ARGON promises">
        <div className="marquee" style={{ ["--dur" as string]: "45s", ["--gap" as string]: "2.5rem" }}>
          {[0, 1].map((k) => (
            <div key={k} className="marquee__track items-center" aria-hidden={k === 1}>
              {["Forged in steel", "316L stainless", "Limited drops", "Cash on delivery", "Won't tarnish", "Built to last"].map((t, i) => (
                <span key={i} className="flex shrink-0 items-center gap-10 whitespace-nowrap text-[clamp(1.8rem,4vw,3.5rem)] font-medium uppercase tracking-[-0.03em]">
                  <span className={i % 2 ? "serif-i !normal-case text-[var(--muted)]" : ""}>{t}</span><Sparkle className="h-4 w-4 text-[var(--accent)]" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>
    ),

    categories: (
      <section key="cats" className="py-20 md:py-28" aria-labelledby="cats-h">
        <SectionHead eyebrow={`01 — ${d.shopBy}`} title={<span id="cats-h">{bn ? "ক্যাটাগরি" : <>Find your <span className="serif-i">piece</span></>}</span>} href={L("/shop")} cta={bn ? "সব দেখুন" : "Shop all"} />
        <div className="no-scrollbar mx-auto flex max-w-[1600px] snap-x gap-3 overflow-x-auto px-4 md:grid md:grid-cols-4 md:gap-5 md:overflow-visible md:px-10">
          {CATEGORIES.map((c, i) => {
            const count = products.filter((p) => p.category === c.key).length;
            return (
              <Link key={c.key} href={L(`/shop/${c.key}`)} className="group relative aspect-[3/4] w-[70%] shrink-0 snap-start overflow-hidden md:w-auto" data-reveal="clip" style={{ ["--i" as string]: i }}>
                <Image src={c.image} alt="" fill sizes="(max-width:768px) 70vw, 25vw" className="object-cover !transition-transform !duration-[1.4s] group-hover:!scale-[1.07]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-transparent" />
                <div className="absolute inset-x-5 bottom-5 flex items-end justify-between text-white">
                  <div><p className="text-[10px] uppercase tracking-[0.3em] text-white/70">{String(i + 1).padStart(2, "0")} · {count} {bn ? "পণ্য" : "pieces"}</p><p className="mt-1 text-[clamp(1.6rem,7vw,2rem)] font-medium uppercase tracking-[-0.03em] md:text-[clamp(1.25rem,2.3vw,2.4rem)]">{d[c.label]}</p></div>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-white/50 transition-all duration-500 group-hover:-rotate-45 group-hover:bg-white group-hover:text-black md:max-lg:hidden"><IconArrow /></span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    ),

    bestsellers: bestRow.length ? (
      <section key="best" className="border-t border-[var(--line)] py-20 md:py-28" aria-labelledby="best-h">
        <SectionHead eyebrow={`02 — ${d.bestsellers}`} title={<span id="best-h">{bn ? "সবচেয়ে জনপ্রিয়" : <>Most <span className="serif-i">worn</span></>}</span>} href={L("/shop?sort=bestselling")} cta={bn ? "সব দেখুন" : "View all"} />
        <Carousel label={d.bestsellers}>{bestRow.map((p, i) => <ProductCard key={p.id} p={p} locale={locale} labels={labels} priority={i < 2} sizes="(max-width:768px) 72vw, (max-width:1024px) 44vw, 25vw" />)}</Carousel>
      </section>
    ) : null,

    story: (
      <section key="story" className="border-t border-[var(--line)]">
        <div className="mx-auto grid max-w-[1600px] md:grid-cols-2">
          <div className="relative aspect-[4/5] overflow-hidden md:aspect-auto md:min-h-[90vh]" data-reveal="clip">
            <Image src="/products/clean/23.webp" alt="Serpent head bracelet in braided stainless steel" fill sizes="(max-width:768px) 100vw, 50vw" className="object-cover" />
          </div>
          <div className="flex flex-col justify-center px-4 py-16 md:px-16 md:py-24 lg:px-24">
            <p className="eyebrow mb-6" data-reveal>03 — {bn ? "ম্যাটেরিয়াল" : "The material"}</p>
            <h2 className="h-section" data-reveal style={{ ["--i" as string]: 1 }}>{bn ? "ট্রেন্ডের চেয়েও টেকসই" : <>Built to outlast <span className="serif-i">trends</span>.</>}</h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-[var(--muted)]" data-reveal style={{ ["--i" as string]: 2 }}>
              {bn ? "প্রতিটি পিস ৩১৬এল সার্জিক্যাল-গ্রেড স্টেইনলেস স্টিলে তৈরি। গোসল, ঘাম, জিম — কোনো কিছুতেই রং যায় না, মরিচা ধরে না, ত্বক সবুজ হয় না।" : "Every piece is cut from 316L surgical‑grade stainless steel — the same alloy used in medical implants. Shower in it, sweat in it, sleep in it. It won't rust, fade or turn your skin green."}
            </p>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-6 border-t border-[var(--line)] pt-8" data-reveal style={{ ["--i" as string]: 3 }}>
              {[["316L", bn ? "সার্জিক্যাল স্টিল" : "Surgical steel"], ["0%", bn ? "রং ওঠে না" : "Tarnish"], ["7", bn ? "দিনে এক্সচেঞ্জ" : "Day exchange"]].map(([a, b]) => (
                <div key={b}><dt className="text-3xl font-medium tracking-[-0.03em] md:text-4xl">{a}</dt><dd className="mt-1 text-[12px] uppercase tracking-[0.12em] text-[var(--muted)]">{b}</dd></div>
              ))}
            </dl>
            <Link href={L("/about")} className="arrow-link mt-10" data-reveal style={{ ["--i" as string]: 4 }}>{bn ? "আমাদের গল্প" : "Our story"} <IconArrow /></Link>
          </div>
        </div>
      </section>
    ),

    lookbook: (
      <section key="lookbook" className="relative h-[85svh] min-h-[520px] overflow-hidden bg-black text-white" aria-labelledby="look-h">
        <Image src={h.lookbookPoster} alt="" fill sizes="100vw" className="object-cover" />
        <LoopVideo mp4={h.lookbookVideo} webm={h.lookbookWebm} poster={h.lookbookPoster} className="absolute inset-0 h-full w-full object-cover" label="Bracelet lookbook film" controlClass="absolute bottom-6 right-4 z-10 md:right-10" />
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative mx-auto flex h-full max-w-[1600px] flex-col items-center justify-center px-4 text-center">
          <p className="eyebrow mb-6 !text-white/80" data-reveal>04 — {bn ? "লুকবুক" : "Lookbook"}</p>
          <h2 id="look-h" className="display text-[clamp(3rem,10vw,9rem)]" data-reveal style={{ ["--i" as string]: 1 }}>{bn ? "স্টিলের" : "Heavy"} <span className="serif-i !normal-case">{bn ? "ভার" : "metal"}</span></h2>
          <p className="mt-6 max-w-md text-[15px] text-white/80" data-reveal style={{ ["--i" as string]: 2 }}>{bn ? "ফ্রাঙ্কো, কার্ব, বাইজেন্টাইন — হাতে ভারী, চোখে নিখুঁত।" : "Franco, curb and Byzantine links. Weighty on the wrist, flawless up close."}</p>
          <Link href={L("/shop/bracelets")} className="btn btn-light mt-10" data-reveal style={{ ["--i" as string]: 3 }}>{bn ? "ব্রেসলেট দেখুন" : "Shop bracelets"}</Link>
        </div>
      </section>
    ),

    limited: limited.length ? (
      <section key="limited" className="py-20 md:py-28" aria-labelledby="lim-h">
        <SectionHead eyebrow={`05 — ${d.limitedDrop}`} title={<span id="lim-h">{bn ? "শেষ হলে আর নেই" : <>Almost <span className="serif-i">gone</span></>}</span>} href={L("/shop?stock=1")} cta={bn ? "সব দেখুন" : "Shop now"} />
        <div className="mx-auto grid max-w-[1600px] grid-cols-2 gap-x-3 gap-y-10 px-4 md:grid-cols-4 md:gap-x-5 md:px-10">
          {limited.map((p, i) => <div key={p.id} data-reveal style={{ ["--i" as string]: i }}><ProductCard p={p} locale={locale} labels={labels} /></div>)}
        </div>
      </section>
    ) : null,

    mosaic: (
      <section key="mosaic" className="border-t border-[var(--line)] py-20 md:py-28" aria-label="Collections">
        <div className="mx-auto grid max-w-[1600px] gap-3 px-4 md:grid-cols-12 md:gap-5 md:px-10">
          {([
            ["/shop/y2k-edit", "/editorial/4.webp", "The Y2K Edit", bn ? "ক্রোম, শিল্ড, তারা" : "Chrome, shields & stars", "md:col-span-7 md:row-span-2 aspect-[4/5] md:aspect-auto"],
            ["/shop/rings", "/products/clean/25.webp", bn ? "গথিক রিং" : "Gothic rings", bn ? "সাহসী নকশা" : "Bold silhouettes", "md:col-span-5 aspect-[4/3]"],
            ["/shop/chains", "/products/clean/6.webp", bn ? "পেনড্যান্ট" : "Pendants", bn ? "বুকের ওপর" : "Worn over the heart", "md:col-span-5 aspect-[4/3]"],
          ] as const).map(([href, img, title, sub, cls], i) => (
            <Link key={href} href={L(href)} className={`group relative overflow-hidden ${cls}`} data-reveal="clip" style={{ ["--i" as string]: i }}>
              <Image src={img} alt="" fill sizes="(max-width:768px) 100vw, 55vw" className="object-cover !transition-transform !duration-[1.4s] group-hover:!scale-[1.05]" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
              <div className="absolute inset-x-5 bottom-5 text-white md:inset-x-8 md:bottom-8">
                <p className="text-[10px] uppercase tracking-[0.3em] text-white/70">{sub}</p>
                <p className="mt-2 flex items-center gap-3 text-3xl font-medium uppercase tracking-[-0.03em] md:text-5xl">{title}<IconArrow className="h-6 w-6 transition-transform duration-500 group-hover:translate-x-2" /></p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    ),

    reviews: reviews.count > 0 ? (
      <section key="reviews" className="border-t border-[var(--line)] py-20 md:py-28" aria-labelledby="rev-h">
        <SectionHead eyebrow={`${d.reviews} · ${reviews.avg.toFixed(1)} / 5 · ${d.basedOn.replace("{n}", String(reviews.count))}`} title={<span id="rev-h">{bn ? "ক্রেতাদের কথা" : <>Worn & <span className="serif-i">loved</span></>}</span>} />
        <div className="mx-auto grid max-w-[1600px] gap-px bg-[var(--line)] px-0 md:grid-cols-3">
          {reviews.items.slice(0, 3).map((r, i) => (
            <figure key={r.id} className="bg-[var(--bg)] p-8 md:p-12" data-reveal style={{ ["--i" as string]: i }}>
              <Stars value={r.rating} />
              <blockquote className="mt-6 text-xl leading-snug tracking-[-0.01em]">“{r.text}”</blockquote>
              <figcaption className="mt-6 text-[12px] uppercase tracking-[0.14em] text-[var(--muted)]">{r.name}{r.verified && <> · ✦ {d.verifiedBuyer}</>} · <Link href={L(`/product/${r.product.slug}`)} className="ulink">{r.product.title}</Link></figcaption>
            </figure>
          ))}
        </div>
      </section>
    ) : null,

    ugc: settings.ugc.length ? (
      <section key="ugc" className="border-t border-[var(--line)] py-20 md:py-28" aria-labelledby="ugc-h">
        <div className="mx-auto mb-10 flex max-w-[1600px] flex-col items-center px-4 text-center">
          <p className="eyebrow mb-4" data-reveal>@argon.go_</p>
          <h2 id="ugc-h" className="h-section" data-reveal style={{ ["--i" as string]: 1 }}>{bn ? "অরবিট পরুন" : <>Wear the <span className="serif-i">orbit</span></>}</h2>
          <a href={settings.store.instagram} target="_blank" rel="noopener" className="btn btn-ghost mt-8" data-reveal style={{ ["--i" as string]: 2 }}><IconInstagram className="h-4 w-4" /> {bn ? "ইনস্টাগ্রামে ফলো করুন" : "Follow on Instagram"}</a>
        </div>
        <div className="marquee" style={{ ["--dur" as string]: "60s", ["--gap" as string]: "12px" }}>
          {[0, 1].map((k) => (
            <div key={k} className="marquee__track" aria-hidden={k === 1}>
              {[...settings.ugc, ...settings.ugc].map((u, i) => (
                <a key={i} href={u.url} target="_blank" rel="noopener" tabIndex={k ? -1 : 0} className="group relative block aspect-square w-[44vw] shrink-0 overflow-hidden md:w-[19vw]" aria-label={`Instagram post ${(i % settings.ugc.length) + 1}`}>
                  <Image src={u.image} alt="" fill sizes="(max-width:768px) 44vw, 19vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                  <span className="absolute inset-0 grid place-items-center bg-black/40 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100"><IconInstagram className="h-7 w-7" /></span>
                </a>
              ))}
            </div>
          ))}
        </div>
      </section>
    ) : null,
  };

  return <>{order.map((t) => blocks[t] ?? null)}</>;
}
