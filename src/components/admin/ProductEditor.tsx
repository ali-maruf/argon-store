"use client";
import Image from "next/image";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveProduct, uploadMedia, type ProductPayload } from "@/app/admin/(panel)/products/actions";

type Variant = ProductPayload["variants"][number];
const BADGES = ["LIMITED STOCK", "NEW", "BESTSELLER"];
const combos = (opts: { name: string; values: string[] }[]) => opts.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((a) => o.values.map((v) => ({ ...a, [o.name]: v }))), [{}]);
const skuPart = (v: string) => v.replace(/[^0-9A-Za-z.]/g, "").replace(/mm$/i, "").toUpperCase() || "X";

export function ProductEditor({ initial, collections, baseSku }: { initial: ProductPayload; collections: { id: string; title: string }[]; baseSku: string }) {
  const [p, setP] = useState<ProductPayload>(initial);
  const [lang, setLang] = useState<"en" | "bn">("en");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ProductPayload>(k: K, v: ProductPayload[K]) => setP((x) => ({ ...x, [k]: v }));

  /** Rebuilds the variant matrix from options, keeping existing variant data where the combination already exists. */
  const regen = (options: ProductPayload["options"]) => {
    const cs = options.length ? combos(options) : [{}];
    const base = p.variants[0];
    const variants: Variant[] = cs.map((c) => {
      const title = Object.values(c).join(" / ") || "Default";
      const prev = p.variants.find((v) => JSON.stringify(v.optionValues) === JSON.stringify(c)) ?? (cs.length === 1 ? p.variants[0] : undefined);
      return prev ? { ...prev, title, optionValues: c } : {
        sku: [baseSku, ...Object.values(c).map(skuPart)].join("-"), title, optionValues: c, price: base?.price ?? 0, compareAtPrice: base?.compareAtPrice ?? null,
        costPrice: base?.costPrice ?? null, stock: 0, lowStockThreshold: base?.lowStockThreshold ?? 3, weightGrams: base?.weightGrams ?? 50, barcode: null, imageUrl: null,
      };
    });
    setP((x) => ({ ...x, options, variants }));
  };
  const setVariant = (i: number, patch: Partial<Variant>) => setP((x) => ({ ...x, variants: x.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)) }));
  const num = (s: string) => (s === "" ? null : Math.round(Number(s)));

  const upload = async (files: FileList | null, model?: File) => {
    if (!files?.length && !model) return;
    setUploading(true);
    const fd = new FormData();
    [...(files ?? [])].forEach((f) => fd.append("files", f));
    if (model) fd.set("model", model);
    const r = await uploadMedia(fd);
    setUploading(false);
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setP((x) => ({ ...x, images: [...x.images, ...r.images.map((i) => ({ ...i, alt: x.title }))], model3dUrl: r.model ?? x.model3dUrl }));
  };
  const moveImg = (i: number, d: number) => setP((x) => { const a = [...x.images]; const j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, images: a }; });
  const dragFrom = useRef<number | null>(null);

  const seoTitle = p.seoTitle || `${p.title} — Stainless Steel | ARGON`;
  const seoDesc = p.seoDescription || p.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 155);
  const margin = useMemo(() => { const v = p.variants[0]; return v?.costPrice && v.price ? Math.round(((v.price - v.costPrice) / v.price) * 100) : null; }, [p.variants]);

  const save = () => start(async () => {
    setMsg(null);
    const r = await saveProduct(p);
    if (r.ok) { setMsg({ ok: true, text: "Saved ✓ — storefront updated" }); if (!p.id) router.replace(`/admin/products/${r.id}`); else router.refresh(); }
    else setMsg({ ok: false, text: r.error });
  });

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-5 lg:col-span-2">
        <div className="card">
          <div className="card-h">
            <span>Details</span>
            <div className="tabs flex gap-1 rounded-lg bg-[var(--panel2)] p-0.5 text-[12px]">{(["en", "bn"] as const).map((l) => <a key={l} href="#" onClick={(e) => { e.preventDefault(); setLang(l); }} aria-current={lang === l ? "page" : undefined}>{l === "en" ? "English" : "বাংলা"}</a>)}</div>
          </div>
          <div className="card-b space-y-3">
            {lang === "en" ? (
              <>
                <label className="f"><span>Title</span><input className="input" value={p.title} onChange={(e) => set("title", e.target.value)} /></label>
                <div><span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">Description</span><RichText value={p.description} onChange={(v) => set("description", v)} /></div>
              </>
            ) : (
              <>
                <label className="f"><span>শিরোনাম (Title BN)</span><input className="input" value={p.titleBn ?? ""} onChange={(e) => set("titleBn", e.target.value)} /></label>
                <div><span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">বিবরণ (Description BN)</span><RichText value={p.descriptionBn ?? ""} onChange={(v) => set("descriptionBn", v)} /></div>
              </>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-h">Media <span className="text-[12px] font-normal text-[var(--muted)]">Drag to reorder · first image is the main one</span></div>
          <div className="card-b">
            <div
              className="grid grid-cols-3 gap-3 sm:grid-cols-5"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) void upload(e.dataTransfer.files); }}
            >
              {p.images.map((im, i) => (
                <div key={im.url + i} draggable onDragStart={() => (dragFrom.current = i)} onDrop={(e) => { e.stopPropagation(); const from = dragFrom.current; if (from == null || from === i) return; setP((x) => { const a = [...x.images]; const [m] = a.splice(from, 1); a.splice(i, 0, m); return { ...x, images: a }; }); dragFrom.current = null; }}
                  className={`group relative overflow-hidden rounded-xl border border-[var(--line)] ${i === 0 ? "col-span-2 row-span-2" : ""}`}>
                  <div className="relative aspect-square"><Image src={im.url} alt={im.alt} fill sizes="200px" className="object-cover" /></div>
                  <input value={im.alt} onChange={(e) => setP((x) => ({ ...x, images: x.images.map((y, j) => (j === i ? { ...y, alt: e.target.value } : y)) }))} placeholder="Alt text" className="w-full border-t border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-[11px]" aria-label="Alt text" />
                  <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                    <button type="button" className="chip" onClick={() => moveImg(i, -1)} aria-label="Move left">←</button>
                    <button type="button" className="chip" onClick={() => moveImg(i, 1)} aria-label="Move right">→</button>
                    <button type="button" className="chip chip-red" onClick={() => setP((x) => ({ ...x, images: x.images.filter((_, j) => j !== i) }))} aria-label="Remove">✕</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-square place-items-center rounded-xl border-2 border-dashed border-[var(--line)] text-[12px] text-[var(--muted)]">{uploading ? "Uploading…" : "+ Add images\nor drop here"}</button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-[var(--muted)]">3D model (.glb, optional):</span>
              {p.model3dUrl ? <><span className="chip">{p.model3dUrl.split("/").pop()}</span><button type="button" className="underline" onClick={() => set("model3dUrl", null)}>remove</button></> : <button type="button" className="btn btn-ghost" onClick={() => modelRef.current?.click()}>Upload .glb</button>}
              <input ref={modelRef} type="file" accept=".glb,.gltf" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(null, f); e.target.value = ""; }} />
            </div>
            <p className="mt-2 text-[11px] text-[var(--muted)]">Uploads are converted to WebP (max 1600px) with a blur placeholder; the storefront serves AVIF/WebP at 320–1200px automatically.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-h">Options</div>
          <div className="card-b space-y-3">
            {p.options.map((o, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2">
                <label className="f"><span>Option name</span><input className="input !w-36" value={o.name} onChange={(e) => regen(p.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} /></label>
                <label className="f flex-1"><span>Values (comma separated)</span><input className="input" defaultValue={o.values.join(", ")} onBlur={(e) => regen(p.options.map((x, j) => (j === i ? { ...x, values: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x)))} /></label>
                <button type="button" className="btn btn-ghost" onClick={() => regen(p.options.filter((_, j) => j !== i))}>Remove</button>
              </div>
            ))}
            {p.options.length < 3 && <button type="button" className="btn btn-ghost" onClick={() => regen([...p.options, { name: ["Size", "Length", "Colour"][p.options.length], values: ["Default"] }])}>+ Add option (Size, Length, Thickness, Colour…)</button>}
          </div>
        </div>

        <div className="card">
          <div className="card-h">Variants <span className="text-[12px] font-normal text-[var(--muted)]">{p.variants.length} · {margin != null ? `${margin}% margin on first` : "add cost price to see margin"}</span></div>
          <div className="overflow-x-auto">
            <table className="t">
              <thead><tr><th>Variant</th><th>SKU</th><th>Price ৳</th><th>Compare‑at</th><th>Cost</th><th>Stock</th><th>Low at</th><th>Image</th></tr></thead>
              <tbody>
                {p.variants.map((v, i) => (
                  <tr key={i}>
                    <td className="whitespace-nowrap font-medium">{v.title}</td>
                    <td><input className="input !w-40 font-mono !text-[12px]" value={v.sku} onChange={(e) => setVariant(i, { sku: e.target.value.toUpperCase() })} aria-label="SKU" /></td>
                    <td><input className="input !w-20 tnum" type="number" min={0} value={v.price} onChange={(e) => setVariant(i, { price: num(e.target.value) ?? 0 })} aria-label="Price" /></td>
                    <td><input className="input !w-20 tnum" type="number" min={0} value={v.compareAtPrice ?? ""} onChange={(e) => setVariant(i, { compareAtPrice: num(e.target.value) })} aria-label="Compare at" /></td>
                    <td><input className="input !w-20 tnum" type="number" min={0} value={v.costPrice ?? ""} onChange={(e) => setVariant(i, { costPrice: num(e.target.value) })} aria-label="Cost" /></td>
                    <td><input className="input !w-20 tnum" type="number" value={v.stock} onChange={(e) => setVariant(i, { stock: num(e.target.value) ?? 0 })} aria-label="Stock" /></td>
                    <td><input className="input !w-16 tnum" type="number" min={0} value={v.lowStockThreshold} onChange={(e) => setVariant(i, { lowStockThreshold: num(e.target.value) ?? 0 })} aria-label="Low stock threshold" /></td>
                    <td><select className="input !w-24" value={v.imageUrl ?? ""} onChange={(e) => setVariant(i, { imageUrl: e.target.value || null })} aria-label="Variant image"><option value="">—</option>{p.images.map((im, j) => <option key={j} value={im.url}>Image {j + 1}</option>)}</select></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.variants.length > 1 && (
            <div className="flex flex-wrap gap-2 border-t border-[var(--line)] px-4 py-3 text-[12px]">
              <span className="text-[var(--muted)]">Apply first row to all:</span>
              {(["price", "compareAtPrice", "costPrice", "stock"] as const).map((k) => <button key={k} type="button" className="chip" onClick={() => setP((x) => ({ ...x, variants: x.variants.map((v) => ({ ...v, [k]: x.variants[0][k] })) }))}>{k}</button>)}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-h">Search engine listing</div>
          <div className="card-b space-y-3">
            <div className="rounded-xl border border-[var(--line)] bg-white p-4 text-left" aria-label="Google preview">
              <p className="text-[12px] text-[#202124]">argon.com.bd › product › {p.slug || "…"}</p>
              <p className="truncate text-[18px] text-[#1a0dab]">{seoTitle}</p>
              <p className="line-clamp-2 text-[13px] text-[#4d5156]">{seoDesc}</p>
            </div>
            <label className="f"><span>Page title ({seoTitle.length}/60)</span><input className="input" value={p.seoTitle ?? ""} placeholder={seoTitle} onChange={(e) => set("seoTitle", e.target.value)} /></label>
            <label className="f"><span>Meta description ({seoDesc.length}/155)</span><textarea className="input" value={p.seoDescription ?? ""} placeholder={seoDesc} onChange={(e) => set("seoDescription", e.target.value)} /></label>
            <label className="f"><span>URL handle</span><input className="input font-mono" value={p.slug} onChange={(e) => set("slug", e.target.value)} /></label>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="card sticky top-20">
          <div className="card-b space-y-3">
            <label className="f"><span>Status</span><select className="input" value={p.status} onChange={(e) => set("status", e.target.value as "active")}><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option></select></label>
            <label className="f"><span>Scheduled publish (optional)</span><input className="input" type="datetime-local" value={p.publishAt ?? ""} onChange={(e) => set("publishAt", e.target.value || null)} /></label>
            {msg && <p role="status" className={`rounded-lg px-3 py-2 text-[13px] ${msg.ok ? "chip-green" : "chip-red"}`}>{msg.text}</p>}
            <button className="btn btn-primary w-full !min-h-11" disabled={pending || uploading} onClick={save}>{pending ? "Saving…" : "Save product"}</button>
            {p.id && <a className="btn btn-ghost w-full" href={`/product/${p.slug}`} target="_blank">Preview ↗</a>}
          </div>
        </div>
        <div className="card">
          <div className="card-h">Organization</div>
          <div className="card-b space-y-3">
            <label className="f"><span>Category</span><select className="input" value={p.category} onChange={(e) => set("category", e.target.value as "rings")}>{["rings", "chains", "bracelets", "eyewear"].map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="f"><span>Material</span><input className="input" value={p.material} onChange={(e) => set("material", e.target.value)} /></label>
            <label className="f"><span>Tags (comma separated; finish:silver, bestseller, y2k…)</span><input className="input" defaultValue={p.tags.join(", ")} onBlur={(e) => set("tags", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} /></label>
            <fieldset><legend className="mb-1 text-[12px] font-medium text-[var(--muted)]">Badges</legend>
              <div className="flex flex-wrap gap-2">{BADGES.map((b) => <label key={b} className="chip cursor-pointer"><input type="checkbox" checked={p.badges.includes(b)} onChange={(e) => set("badges", e.target.checked ? [...p.badges, b] : p.badges.filter((x) => x !== b))} /> {b}</label>)}</div>
            </fieldset>
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={p.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured</label>
            <fieldset><legend className="mb-1 text-[12px] font-medium text-[var(--muted)]">Collections</legend>
              <div className="space-y-1">{collections.map((c) => <label key={c.id} className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={p.collectionIds.includes(c.id)} onChange={(e) => set("collectionIds", e.target.checked ? [...p.collectionIds, c.id] : p.collectionIds.filter((x) => x !== c.id))} /> {c.title}</label>)}</div>
            </fieldset>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Minimal rich-text editor (bold/italic/list/heading/link). Output is sanitized server-side. */
export function RichText({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cmd = (c: string, arg?: string) => { document.execCommand(c, false, arg); ref.current?.focus(); onChange(ref.current?.innerHTML ?? ""); };
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--line)]">
      <div className="flex flex-wrap gap-1 border-b border-[var(--line)] bg-[var(--panel2)] px-2 py-1 text-[13px]">
        {[["bold", "B"], ["italic", "I"], ["insertUnorderedList", "• List"]].map(([c, l]) => <button key={c} type="button" className="rounded px-2 py-0.5 hover:bg-[var(--panel)]" onMouseDown={(e) => { e.preventDefault(); cmd(c); }}>{l}</button>)}
        <button type="button" className="rounded px-2 py-0.5 hover:bg-[var(--panel)]" onMouseDown={(e) => { e.preventDefault(); cmd("formatBlock", "h3"); }}>H</button>
        <button type="button" className="rounded px-2 py-0.5 hover:bg-[var(--panel)]" onMouseDown={(e) => { e.preventDefault(); cmd("formatBlock", "p"); }}>¶</button>
        <button type="button" className="rounded px-2 py-0.5 hover:bg-[var(--panel)]" onMouseDown={(e) => { e.preventDefault(); const u = prompt("Link URL"); if (u) cmd("createLink", u); }}>Link</button>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning className="prose-argon min-h-32 bg-[var(--panel)] px-3 py-2 text-[14px] outline-none" dangerouslySetInnerHTML={{ __html: value }} onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)} />
    </div>
  );
}
