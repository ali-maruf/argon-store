"use client";
import { useState } from "react";

/** Reviews are accepted only from verified buyers: order number + phone must match a delivered order with this product. */
export function ReviewForm({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  if (!open) return <button className="btn btn-ghost" onClick={() => setOpen(true)}>Write a review</button>;
  if (status?.ok) return <p role="status" className="text-[14px]">✦ {status.msg}</p>;
  return (
    <form
      className="glass mt-4 w-full space-y-3 rounded-[var(--radius-card)] p-5"
      onSubmit={async (e) => {
        e.preventDefault(); setBusy(true);
        const fd = new FormData(e.currentTarget); fd.set("productId", productId); fd.set("rating", String(rating));
        const r = await fetch("/api/reviews", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        setStatus({ ok: r.ok, msg: j.message ?? j.error ?? "Something went wrong" }); setBusy(false);
      }}
    >
      <p className="text-[13px] text-[var(--muted)]">Only verified buyers can review. Enter the order number and phone you ordered with.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="orderNumber" required placeholder="Order number (ARG-10001)" className="input" aria-label="Order number" />
        <input name="phone" required inputMode="numeric" placeholder="01XXXXXXXXX" className="input" aria-label="Phone" />
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((i) => (
          <button type="button" key={i} role="radio" aria-checked={rating === i} aria-label={`${i} stars`} onClick={() => setRating(i)} className="text-2xl">{i <= rating ? "★" : "☆"}</button>
        ))}
      </div>
      <textarea name="text" required minLength={5} maxLength={1000} rows={3} placeholder="How does it look and feel?" className="input" aria-label="Review" />
      <label className="block text-[13px] text-[var(--muted)]">Photos (optional, up to 3)<input name="photos" type="file" accept="image/*" multiple className="mt-1 block text-[13px]" /></label>
      {status && !status.ok && <p role="alert" className="text-[13px] text-[#ff5d73]">{status.msg}</p>}
      <button className="btn btn-primary" disabled={busy}>{busy ? "Sending…" : "Submit review"}</button>
    </form>
  );
}
