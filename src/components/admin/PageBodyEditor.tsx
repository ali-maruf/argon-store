"use client";
import { useState } from "react";
import { RichText } from "./ProductEditor";

export function PageBodyEditor({ name, label, initial }: { name: string; label: string; initial: string }) {
  const [v, setV] = useState(initial);
  return (
    <div>
      <span className="mb-1 block text-[12px] font-medium text-[var(--muted)]">{label}</span>
      <RichText value={initial} onChange={setV} />
      <input type="hidden" name={name} value={v} />
    </div>
  );
}
