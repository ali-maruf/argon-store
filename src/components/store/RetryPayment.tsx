"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { retryPayment } from "@/app/[locale]/order/[id]/thank-you/actions";

export function RetryPayment({ orderId, token, method, codEnabled }: { orderId: string; token: string; method: string; codEnabled: boolean }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const go = async (to: "retry" | "cod") => {
    setBusy(to); setErr(null);
    const r = await retryPayment(orderId, token, to);
    if (r.redirect) { if (r.external) window.location.href = r.redirect; else { router.refresh(); setBusy(null); } }
    else { setErr(r.error ?? "Please try again"); setBusy(null); }
  };
  return (
    <div className="mt-6 flex flex-col items-center gap-3">
      <div className="flex flex-wrap justify-center gap-3">
        {method !== "cod" && <button className="btn btn-primary" disabled={!!busy} onClick={() => go("retry")}>{busy === "retry" ? "Opening…" : `Retry ${method === "sslcommerz" ? "card" : method} payment`}</button>}
        {codEnabled && <button className="btn btn-ghost" disabled={!!busy} onClick={() => go("cod")}>{busy === "cod" ? "Switching…" : "Switch to Cash on Delivery"}</button>}
      </div>
      {err && <p role="alert" className="text-[13px] text-[#ff8a9a]">{err}</p>}
    </div>
  );
}
