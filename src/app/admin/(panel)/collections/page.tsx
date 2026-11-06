import Image from "next/image";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { adminMutation, fdStr } from "@/lib/admin";
import { slugify } from "@/lib/format";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Collections" };

async function upsertCollection(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id"); const title = fdStr(fd, "title"); const type = fdStr(fd, "type") === "automated" ? "automated" : "manual";
  const rules = type === "automated" ? [{ field: fdStr(fd, "ruleField"), value: fdStr(fd, "ruleValue") }] : undefined;
  await adminMutation("collections.edit", id ? "update_collection" : "create_collection", "collection", id || null, async () => {
    const data = { title, titleBn: fdStr(fd, "titleBn") || null, slug: slugify(fdStr(fd, "slug") || title), description: fdStr(fd, "description"), type, rules };
    return id ? db.collection.update({ where: { id }, data }) : db.collection.create({ data });
  }, { tags: ["catalog"] });
  revalidatePath("/admin/collections");
}
async function addProduct(fd: FormData) {
  "use server";
  const collectionId = fdStr(fd, "collectionId"); const productId = fdStr(fd, "productId");
  await adminMutation("collections.edit", "collection_add", "collection", collectionId, async () => {
    const max = await db.collectionProduct.aggregate({ where: { collectionId }, _max: { position: true } });
    await db.collectionProduct.upsert({ where: { collectionId_productId: { collectionId, productId } }, create: { collectionId, productId, position: (max._max.position ?? 0) + 1 }, update: {} });
  }, { tags: ["catalog"] });
  revalidatePath("/admin/collections");
}
async function moveProduct(fd: FormData) {
  "use server";
  const collectionId = fdStr(fd, "collectionId"); const productId = fdStr(fd, "productId"); const dir = fdStr(fd, "dir");
  await adminMutation("collections.edit", "collection_sort", "collection", collectionId, async () => {
    const items = await db.collectionProduct.findMany({ where: { collectionId }, orderBy: { position: "asc" } });
    const i = items.findIndex((x) => x.productId === productId);
    if (dir === "remove") { await db.collectionProduct.delete({ where: { collectionId_productId: { collectionId, productId } } }); return; }
    const j = dir === "up" ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= items.length) return;
    [items[i], items[j]] = [items[j], items[i]];
    for (const [k, it] of items.entries()) await db.collectionProduct.update({ where: { collectionId_productId: { collectionId, productId: it.productId } }, data: { position: k } });
  }, { tags: ["catalog"] });
  revalidatePath("/admin/collections");
}
async function deleteCollection(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id");
  await adminMutation("collections.edit", "delete_collection", "collection", id, async () => db.collection.delete({ where: { id } }), { tags: ["catalog"] });
  revalidatePath("/admin/collections");
}

export default async function Collections() {
  await requireAdmin("collections.edit");
  const [cols, products] = await Promise.all([
    db.collection.findMany({ include: { products: { orderBy: { position: "asc" }, include: { product: { include: { images: { take: 1, orderBy: { position: "asc" } } } } } } }, orderBy: { createdAt: "asc" } }),
    db.product.findMany({ select: { id: true, title: true }, orderBy: { title: "asc" } }),
  ]);
  const form = (c?: (typeof cols)[number]) => {
    const rule = (c?.rules as { field: string; value: string }[] | null)?.[0];
    return (
      <form action={upsertCollection} className="grid gap-3 sm:grid-cols-3">
        {c && <input type="hidden" name="id" value={c.id} />}
        <label className="f"><span>Title</span><input name="title" defaultValue={c?.title} required className="input" /></label>
        <label className="f"><span>Title (BN)</span><input name="titleBn" defaultValue={c?.titleBn ?? ""} className="input" /></label>
        <label className="f"><span>Handle</span><input name="slug" defaultValue={c?.slug} className="input font-mono" /></label>
        <label className="f sm:col-span-3"><span>Description</span><input name="description" defaultValue={c?.description} className="input" /></label>
        <label className="f"><span>Type</span><select name="type" defaultValue={c?.type ?? "manual"} className="input"><option value="manual">Manual</option><option value="automated">Automated (rule)</option></select></label>
        <label className="f"><span>Rule field</span><select name="ruleField" defaultValue={rule?.field ?? "tag"} className="input"><option value="tag">Tag equals</option><option value="category">Category equals</option><option value="price_lte">Price ≤</option></select></label>
        <label className="f"><span>Rule value</span><input name="ruleValue" defaultValue={rule?.value} className="input" /></label>
        <div className="sm:col-span-3"><button className="btn btn-primary">{c ? "Save" : "Create collection"}</button></div>
      </form>
    );
  };
  return (
    <>
      <PageHeader title="Collections" />
      <details className="card mb-5"><summary className="card-h cursor-pointer list-none">+ New collection</summary><div className="card-b">{form()}</div></details>
      <div className="space-y-5">
        {cols.map((c) => (
          <div key={c.id} className="card">
            <div className="card-h"><span>{c.title} <span className="chip ml-2">{c.type}</span> <a href={`/shop/${c.slug}`} target="_blank" className="ml-2 text-[12px] font-normal underline">/shop/{c.slug}</a></span>
              <form action={deleteCollection}><input type="hidden" name="id" value={c.id} /><button className="btn btn-ghost text-[#b4232f]">Delete</button></form></div>
            <div className="card-b space-y-4">
              <details><summary className="cursor-pointer text-[13px] underline">Edit details</summary><div className="mt-3">{form(c)}</div></details>
              {c.type === "manual" ? (
                <>
                  <ol className="divide-y divide-[var(--line)] rounded-xl border border-[var(--line)]">
                    {c.products.map((cp) => (
                      <li key={cp.productId} className="flex items-center gap-3 px-3 py-2">
                        {cp.product.images[0] && <Image src={cp.product.images[0].url} alt="" width={36} height={36} className="h-9 w-9 rounded-lg object-cover" />}
                        <span className="flex-1">{cp.product.title}</span>
                        {(["up", "down", "remove"] as const).map((d) => <form key={d} action={moveProduct}><input type="hidden" name="collectionId" value={c.id} /><input type="hidden" name="productId" value={cp.productId} /><input type="hidden" name="dir" value={d} /><button className="chip" aria-label={d}>{d === "up" ? "↑" : d === "down" ? "↓" : "✕"}</button></form>)}
                      </li>
                    ))}
                  </ol>
                  <form action={addProduct} className="flex gap-2"><input type="hidden" name="collectionId" value={c.id} /><select name="productId" className="input !w-72">{products.filter((p) => !c.products.some((cp) => cp.productId === p.id)).map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select><button className="btn btn-ghost">Add product</button></form>
                </>
              ) : <p className="text-[13px] text-[var(--muted)]">Products are matched automatically by rule: {JSON.stringify(c.rules)}</p>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
