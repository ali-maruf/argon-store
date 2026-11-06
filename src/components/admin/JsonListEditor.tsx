"use client";
import { useState, useTransition } from "react";
import { saveSettingsJson } from "@/app/admin/(panel)/settings-actions";
import { uploadMedia } from "@/app/admin/(panel)/products/actions";

type Item = Record<string, string>;
export function JsonListEditor({ title, section, fields, initial, upload }: { title: string; section: "nav" | "ugc"; fields: { key: string; label: string }[]; initial: Item[]; upload?: boolean }) {
  const [items, setItems] = useState<Item[]>(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const move = (i: number, d: number) => setItems((xs) => { const a = [...xs]; const j = i + d; if (j < 0 || j >= a.length) return xs; [a[i], a[j]] = [a[j], a[i]]; return a; });
  return (
    <div className="card">
      <div className="card-h">{title}<button className="btn btn-primary" disabled={pending} onClick={() => start(async () => { await saveSettingsJson(section, items); setMsg("Saved ✓"); })}>Save</button></div>
      <div className="card-b space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            {fields.map((f) => <input key={f.key} value={it[f.key] ?? ""} placeholder={f.label} aria-label={f.label} onChange={(e) => setItems((xs) => xs.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} className="input flex-1 !min-w-32" />)}
            {upload && <label className="chip cursor-pointer">Upload<input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; const fd = new FormData(); fd.append("files", f); const r = await uploadMedia(fd); if (r.ok && r.images[0]) setItems((xs) => xs.map((x, j) => (j === i ? { ...x, image: r.images[0].url } : x))); }} /></label>}
            <button className="chip" onClick={() => move(i, -1)} aria-label="Up">↑</button>
            <button className="chip" onClick={() => move(i, 1)} aria-label="Down">↓</button>
            <button className="chip chip-red" onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
          </div>
        ))}
        <button className="btn btn-ghost" onClick={() => setItems((xs) => [...xs, Object.fromEntries(fields.map((f) => [f.key, ""]))])}>+ Add</button>
        {msg && <span className="ml-2 text-[12px]" role="status">{msg}</span>}
      </div>
    </div>
  );
}
