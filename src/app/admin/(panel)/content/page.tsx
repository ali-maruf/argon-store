import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { adminMutation, fdStr } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { Notice, PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";
import { JsonListEditor } from "@/components/admin/JsonListEditor";

export const metadata = { title: "Content" };
const LABELS: Record<string, string> = { hero: "Hero (3D logo)", categories: "Category tiles", bestsellers: "Bestsellers row", trust: "Trust strip", limited: "Limited stock drop", ugc: "Instagram / UGC grid", reviews: "Reviews (real only)", newsletter: "Join the drop list" };

async function sectionAction(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id"); const op = fdStr(fd, "op");
  await adminMutation("content.edit", `home_section_${op}`, "home_section", id, async () => {
    const all = await db.homeSection.findMany({ orderBy: { position: "asc" } });
    const i = all.findIndex((s) => s.id === id);
    if (op === "toggle") await db.homeSection.update({ where: { id }, data: { enabled: !all[i].enabled } });
    else {
      const j = op === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= all.length) return;
      [all[i], all[j]] = [all[j], all[i]];
      for (const [k, s] of all.entries()) await db.homeSection.update({ where: { id: s.id }, data: { position: k } });
    }
  }, { tags: ["content"] });
  revalidatePath("/admin/content");
}

export default async function Content({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  await requireAdmin("content.edit");
  const { msg } = await searchParams;
  const [s, sections, pages] = await Promise.all([getSettings(), db.homeSection.findMany({ orderBy: { position: "asc" } }), db.page.findMany({ orderBy: { slug: "asc" } })]);
  return (
    <>
      <PageHeader title="Content" />
      <Notice msg={msg} />
      <div className="grid gap-5 lg:grid-cols-2">
        <SettingsForm section="announcement" title="Announcement bar" back="/admin/content" cols={1} fields={[
          { name: "enabled", label: "Show announcement bar", type: "bool", value: s.announcement.enabled },
          { name: "text", label: "Text (EN)", value: s.announcement.text }, { name: "textBn", label: "Text (BN)", value: s.announcement.textBn },
          { name: "link", label: "Link", value: s.announcement.link },
        ]} />
        <SettingsForm section="hero" title="Homepage hero (A/B‑ready copy)" back="/admin/content" cols={1} fields={[
          { name: "headline", label: "Headline (EN)", value: s.hero.headline }, { name: "headlineBn", label: "Headline (BN)", value: s.hero.headlineBn },
          { name: "cta", label: "Primary CTA (EN)", value: s.hero.cta }, { name: "ctaBn", label: "Primary CTA (BN)", value: s.hero.ctaBn },
          { name: "enable3d", label: "Enable 3D chrome logo (lazy‑loaded; falls back to static image)", type: "bool", value: s.hero.enable3d },
        ]} />
        <div className="card">
          <div className="card-h">Homepage sections <span className="text-[12px] font-normal text-[var(--muted)]">Reorder, show or hide</span></div>
          <ol className="divide-y divide-[var(--line)]">
            {sections.map((sec) => (
              <li key={sec.id} className="flex items-center gap-2 px-4 py-2.5">
                <span className={`flex-1 ${sec.enabled ? "" : "text-[var(--muted)] line-through"}`}>{LABELS[sec.type] ?? sec.type}</span>
                {(["up", "down", "toggle"] as const).map((op) => <form key={op} action={sectionAction}><input type="hidden" name="id" value={sec.id} /><input type="hidden" name="op" value={op} /><button className="chip">{op === "up" ? "↑" : op === "down" ? "↓" : sec.enabled ? "Hide" : "Show"}</button></form>)}
              </li>
            ))}
          </ol>
        </div>
        <div className="card">
          <div className="card-h">Pages <span className="text-[12px] font-normal text-[var(--muted)]">Policies, About, FAQ (EN/BN)</span></div>
          <ul className="divide-y divide-[var(--line)]">
            {pages.map((p) => <li key={p.id} className="flex items-center justify-between px-4 py-2.5"><Link href={`/admin/content/pages/${p.id}`} className="hover:underline">{p.title}</Link><span className="flex gap-2 text-[12px]"><span className="text-[var(--muted)]">/{p.slug}</span>{!p.published && <span className="chip">hidden</span>}</span></li>)}
          </ul>
          <div className="border-t border-[var(--line)] px-4 py-3"><Link href="/admin/content/pages/new" className="btn btn-ghost">+ New page</Link></div>
        </div>
        <JsonListEditor title="Navigation menu" section="nav" fields={[{ key: "label", label: "Label" }, { key: "href", label: "Link (e.g. /shop/rings)" }]} initial={s.nav} />
        <JsonListEditor title="Instagram / UGC grid (6 images)" section="ugc" fields={[{ key: "image", label: "Image URL" }, { key: "url", label: "Instagram post URL" }]} initial={s.ugc} upload />
      </div>
    </>
  );
}
