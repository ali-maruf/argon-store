"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { bulkProducts } from "@/app/admin/(panel)/products/actions";

type Row = { id: string; title: string; slug: string; image: string; status: string; category: string; tags: string[]; stock: number; variants: number; price: number; sold: number };
const C: Record<string, string> = { active: "chip-green", draft: "chip-yellow", archived: "" };

export function ProductsTable({ rows, canEdit }: { rows: Row[]; canEdit: boolean }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [action, setAction] = useState("status");
  const [value, setValue] = useState("active");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const all = rows.length > 0 && sel.size === rows.length;
  const placeholder: Record<string, string> = { addTag: "tag", removeTag: "tag", price: "new price ৳", priceAdjustPct: "+10 or -15 (%)", stock: "stock per variant" };
  return (
    <>
      {canEdit && sel.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
          <span className="text-[13px]">{sel.size} selected · Bulk edit</span>
          <select className="input !w-auto" value={action} onChange={(e) => { setAction(e.target.value); setValue(e.target.value === "status" ? "active" : ""); }}>
            <option value="status">Set status</option><option value="price">Set price</option><option value="priceAdjustPct">Adjust price %</option><option value="stock">Set stock</option><option value="addTag">Add tag</option><option value="removeTag">Remove tag</option>
          </select>
          {action === "status" ? <select className="input !w-auto" value={value} onChange={(e) => setValue(e.target.value)}><option>active</option><option>draft</option><option>archived</option></select>
            : <input className="input !w-40" value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder[action]} />}
          <button className="btn btn-primary" disabled={pending} onClick={() => start(async () => { const r = await bulkProducts([...sel], action, value); setMsg(r.ok ? "Updated ✓" : r.error!); setSel(new Set()); router.refresh(); })}>Apply</button>
          {msg && <span className="text-[12px]">{msg}</span>}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="t">
          <thead><tr>{canEdit && <th className="w-8"><input type="checkbox" checked={all} onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Select all" /></th>}<th>Product</th><th>Status</th><th>Category</th><th className="text-right">Price</th><th className="text-right">Inventory</th><th className="text-right">Sold</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                {canEdit && <td><input type="checkbox" checked={sel.has(r.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} aria-label={`Select ${r.title}`} /></td>}
                <td><Link href={`/admin/products/${r.id}`} className="flex items-center gap-3 hover:underline">{r.image ? <Image src={r.image} alt="" width={40} height={40} className="h-10 w-10 rounded-lg object-cover" /> : <span className="h-10 w-10 rounded-lg bg-[var(--panel2)]" />}<span className="font-medium">{r.title}</span></Link></td>
                <td><span className={`chip ${C[r.status]}`}>{r.status}</span></td>
                <td className="capitalize">{r.category}</td>
                <td className="tnum text-right">৳{r.price.toLocaleString("en-IN")}</td>
                <td className={`tnum text-right ${r.stock <= 3 ? "text-[#b4232f]" : ""}`}>{r.stock} in stock{r.variants > 1 ? <span className="text-[var(--muted)]"> · {r.variants} variants</span> : null}</td>
                <td className="tnum text-right">{r.sold}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="py-12 text-center text-[var(--muted)]">No products.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
