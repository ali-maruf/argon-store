import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { adminMutation, fdBool, fdStr } from "@/lib/admin";
import { slugify } from "@/lib/format";
import { PageHeader } from "@/components/admin/ui";
import { PageBodyEditor } from "@/components/admin/PageBodyEditor";
import sanitize from "sanitize-html";

export const metadata = { title: "Edit page" };
const clean = (h: string) => sanitize(h, { allowedTags: sanitize.defaults.allowedTags.concat(["h1", "h2", "img"]), allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt"] } });

async function savePage(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id");
  const data = { title: fdStr(fd, "title"), titleBn: fdStr(fd, "titleBn") || null, slug: slugify(fdStr(fd, "slug") || fdStr(fd, "title")), body: clean(fdStr(fd, "body")), bodyBn: fdStr(fd, "bodyBn") ? clean(fdStr(fd, "bodyBn")) : null, published: fdBool(fd, "published") };
  const saved = await adminMutation("content.edit", id ? "update_page" : "create_page", "page", id || null, async () => (id ? db.page.update({ where: { id }, data }) : db.page.create({ data })), { tags: ["content"], paths: [`/${data.slug}`] });
  redirect(`/admin/content/pages/${saved.id}?saved=1`);
}
async function deletePage(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id");
  await adminMutation("content.edit", "delete_page", "page", id, async () => db.page.delete({ where: { id } }), { tags: ["content"] });
  redirect("/admin/content");
}

export default async function EditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin("content.edit");
  const { id } = await params; const { saved } = await searchParams;
  const p = id === "new" ? null : await db.page.findUnique({ where: { id } });
  if (id !== "new" && !p) notFound();
  return (
    <>
      <PageHeader back="/admin/content" title={p?.title ?? "New page"}>
        {p && <a className="btn btn-ghost" href={`/${p.slug}`} target="_blank">View ↗</a>}
        {p && <form action={deletePage}><input type="hidden" name="id" value={p.id} /><button className="btn btn-ghost text-[#b4232f]">Delete</button></form>}
      </PageHeader>
      {saved && <p className="chip-green mb-4 rounded-lg px-4 py-2 text-[13px]">Saved ✓</p>}
      <form action={savePage} className="card card-b space-y-4">
        {p && <input type="hidden" name="id" value={p.id} />}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="f"><span>Title (EN)</span><input name="title" defaultValue={p?.title} required className="input" /></label>
          <label className="f"><span>Title (BN)</span><input name="titleBn" defaultValue={p?.titleBn ?? ""} className="input" /></label>
          <label className="f"><span>URL handle</span><input name="slug" defaultValue={p?.slug} className="input font-mono" /></label>
        </div>
        <PageBodyEditor name="body" label="Body (EN)" initial={p?.body ?? "<p></p>"} />
        <PageBodyEditor name="bodyBn" label="Body (BN)" initial={p?.bodyBn ?? ""} />
        <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="published" defaultChecked={p?.published ?? true} /> Published</label>
        <button className="btn btn-primary">Save page</button>
      </form>
    </>
  );
}
