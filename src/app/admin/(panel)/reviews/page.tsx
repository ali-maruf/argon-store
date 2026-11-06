import Image from "next/image";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { adminMutation, fdStr } from "@/lib/admin";
import { dateTime } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { Chip, PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Reviews" };

async function moderate(fd: FormData) {
  "use server";
  const id = fdStr(fd, "id"); const op = fdStr(fd, "op");
  await adminMutation("reviews.edit", `review_${op}`, "review", id, async () => {
    if (op === "approve") return db.review.update({ where: { id }, data: { status: "approved" } });
    if (op === "hide") return db.review.update({ where: { id }, data: { status: "hidden" } });
    if (op === "reply") return db.review.update({ where: { id }, data: { reply: fdStr(fd, "reply").slice(0, 600) || null } });
    if (op === "removePhoto") { const r = await db.review.findUniqueOrThrow({ where: { id } }); return db.review.update({ where: { id }, data: { photos: r.photos.filter((p) => p !== fdStr(fd, "photo")) } }); }
  }, { tags: ["reviews"] });
  revalidatePath("/admin/reviews");
}

export default async function Reviews({ searchParams }: { searchParams: Promise<{ status?: string; msg?: string }> }) {
  await requireAdmin("reviews.edit");
  const sp = await searchParams;
  const status = (["pending", "approved", "hidden"].includes(sp.status ?? "") ? sp.status : "pending") as "pending";
  const [rows, s] = await Promise.all([db.review.findMany({ where: { status }, orderBy: { createdAt: "desc" }, include: { product: { select: { title: true, slug: true } } }, take: 100 }), getSettings()]);
  return (
    <>
      <PageHeader title="Reviews" />
      <div className="tabs mb-3 flex gap-1 rounded-xl bg-[var(--panel2)] p-1">{["pending", "approved", "hidden"].map((x) => <Link key={x} href={`/admin/reviews?status=${x}`} aria-current={status === x ? "page" : undefined} className="capitalize">{x}</Link>)}</div>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {rows.map((r) => (
            <div key={r.id} className="card card-b space-y-2">
              <div className="flex flex-wrap items-center gap-2"><b>{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</b><span>{r.name}</span>{r.verified && <span className="chip chip-green">Verified buyer</span>}<Chip v={r.status} /><a className="text-[12px] underline" href={`/product/${r.product.slug}`} target="_blank">{r.product.title}</a><span className="ml-auto text-[12px] text-[var(--muted)]">{dateTime(r.createdAt)}</span></div>
              <p>{r.text}</p>
              {r.photos.length > 0 && <div className="flex gap-2">{r.photos.map((p) => <form key={p} action={moderate} className="relative"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="removePhoto" /><input type="hidden" name="photo" value={p} /><Image src={p} alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-lg object-cover" /><button className="chip chip-red absolute right-0 top-0 !px-1.5" aria-label="Remove photo">✕</button></form>)}</div>}
              <div className="flex flex-wrap gap-2">
                {r.status !== "approved" && <form action={moderate}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="approve" /><button className="btn btn-primary">Approve</button></form>}
                {r.status !== "hidden" && <form action={moderate}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="hide" /><button className="btn btn-ghost">Hide</button></form>}
                <form action={moderate} className="flex flex-1 gap-2"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="op" value="reply" /><input name="reply" defaultValue={r.reply ?? ""} placeholder="Public reply from ARGON" className="input" /><button className="btn btn-ghost">Reply</button></form>
              </div>
            </div>
          ))}
          {!rows.length && <p className="card card-b text-[var(--muted)]">No {status} reviews.</p>}
        </div>
        <SettingsForm section="reviews" title="Review requests" back="/admin/reviews" cols={1} fields={[
          { name: "requestEnabled", label: "Send a “leave a review” SMS after delivery", type: "bool", value: s.reviews.requestEnabled },
          { name: "requestAfterDays", label: "Days after delivery", type: "number", value: s.reviews.requestAfterDays },
        ]} />
      </div>
    </>
  );
}
