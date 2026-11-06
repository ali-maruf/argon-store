import type { Metadata } from "next";
import { notFound } from "next/navigation";
import sanitize from "sanitize-html";
import { getPage } from "@/lib/catalog";
import { LOCALES, type Locale } from "@/lib/i18n";
import { RingSizeTable } from "@/components/store/RingSizeTable";
import { db } from "@/lib/db";

export const revalidate = 3600;
export async function generateStaticParams() {
  const pages = await db.page.findMany({ where: { published: true }, select: { slug: true } }).catch(() => []);
  return LOCALES.flatMap((locale) => [...pages.map((p) => p.slug), "size-guide"].map((page) => ({ locale, page })));
}
export async function generateMetadata({ params }: { params: Promise<{ page: string }> }): Promise<Metadata> {
  const { page } = await params;
  if (page === "size-guide") return { title: "Size guide" };
  const p = await getPage(page);
  return p ? { title: p.title, alternates: { canonical: `/${page}` } } : {};
}

export default async function CmsPage({ params }: { params: Promise<{ locale: Locale; page: string }> }) {
  const { locale, page } = await params;
  if (page === "size-guide") {
    return (
      <article className="mx-auto max-w-2xl px-4 py-14">
        <h1 className="font-[family-name:var(--font-display)] text-5xl">{locale === "bn" ? "সাইজ গাইড" : "Size guide"}</h1>
        <h2 className="eyebrow mt-10 mb-3">Rings</h2>
        <div className="prose-argon"><RingSizeTable locale={locale} /></div>
        <h2 className="eyebrow mt-10 mb-3">Chains</h2>
        <p className="text-[var(--muted)]">18&quot; collarbone · 20&quot; just below · 22&quot; mid‑chest · 24&quot; low.</p>
        <h2 className="eyebrow mt-10 mb-3">Bracelets</h2>
        <p className="text-[var(--muted)]">Measure your wrist and add 2 cm. 19 cm fits up to 17 cm wrists; 21 cm fits up to 19 cm.</p>
        <p className="no-print mt-10"><a href="#" className="btn btn-ghost" data-print>Print this guide</a></p>
        <script dangerouslySetInnerHTML={{ __html: `document.querySelector('[data-print]')?.addEventListener('click',function(e){e.preventDefault();print()})` }} />
      </article>
    );
  }
  const p = await getPage(page);
  if (!p) notFound();
  const body = sanitize(locale === "bn" && p.bodyBn ? p.bodyBn : p.body, { allowedTags: sanitize.defaults.allowedTags.concat(["h1", "h2", "img"]), allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt"] } });
  const faqLd = page === "faq" ? {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: [...p.body.matchAll(/<h3>(.*?)<\/h3>\s*<p>(.*?)<\/p>/g)].map((m) => ({ "@type": "Question", name: m[1], acceptedAnswer: { "@type": "Answer", text: m[2].replace(/<[^>]+>/g, "") } })),
  } : null;
  return (
    <article className="mx-auto max-w-2xl px-4 py-14">
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />}
      <h1 className="font-[family-name:var(--font-display)] text-5xl">{locale === "bn" && p.titleBn ? p.titleBn : p.title}</h1>
      <div className="prose-argon mt-8" dangerouslySetInnerHTML={{ __html: body }} />
    </article>
  );
}
