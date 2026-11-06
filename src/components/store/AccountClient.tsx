"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestLoginOtp, verifyLoginOtp, signOutCustomer, reorderLines } from "@/app/[locale]/account/actions";
import { cart } from "./cart-store";

export function OtpLogin({ labels }: { labels: { mobile: string; sendCode: string; verify: string } }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form className="mt-8 space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg(null);
      if (!sent) { const r = await requestLoginOtp(phone); setBusy(false); if (r.ok) { setSent(true); if (r.devCode) setCode(r.devCode); setMsg(r.devCode ? `Dev mode: code ${r.devCode}` : "Code sent"); } else setMsg(r.error!); return; }
      const r = await verifyLoginOtp(phone, code); setBusy(false);
      if (r.ok) router.refresh(); else setMsg(r.error!);
    }}>
      <input className="input tnum" inputMode="numeric" autoComplete="tel-national" placeholder="01XXXXXXXXX" aria-label={labels.mobile} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={sent} required />
      {sent && <input className="input tnum tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="••••••" aria-label="Code" value={code} onChange={(e) => setCode(e.target.value)} required />}
      <button className="btn btn-primary w-full" disabled={busy}>{sent ? labels.verify : labels.sendCode}</button>
      {msg && <p role="status" className="text-[13px] text-[var(--muted)]">{msg}</p>}
    </form>
  );
}

export function SignOut({ label }: { label: string }) {
  const router = useRouter();
  return <button className="pill" onClick={async () => { await signOutCustomer(); router.refresh(); }}>{label}</button>;
}

export function Reorder({ label, lines, locale }: { label: string; lines: { variantId: string; qty: number }[]; locale: string }) {
  const router = useRouter();
  return (
    <button className="pill" onClick={async () => {
      const items = await reorderLines(lines);
      items.forEach((l) => cart.add(l, l.qty, false));
      router.push(`${locale === "bn" ? "/bn" : ""}/checkout`);
    }}>{label}</button>
  );
}
