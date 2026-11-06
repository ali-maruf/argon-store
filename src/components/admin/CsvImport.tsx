"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importProductsCsv } from "@/app/admin/(panel)/products/actions";

export function CsvImport() {
  const ref = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <>
      <input ref={ref} type="file" accept=".csv,text/csv" hidden onChange={(e) => {
        const f = e.target.files?.[0]; if (!f) return;
        const fd = new FormData(); fd.set("file", f);
        start(async () => { const r = await importProductsCsv(fd); setMsg(r.message); router.refresh(); });
        e.target.value = "";
      }} />
      <button className="btn btn-ghost" disabled={pending} onClick={() => ref.current?.click()} title="Columns: handle,title,category,status,price,compare_at,cost,sku,stock,option1_name,option1_value,option2_name,option2_value,tags,image">{pending ? "Importing…" : "Import CSV"}</button>
      {msg && <span className="text-[12px]" role="status">{msg}</span>}
    </>
  );
}
