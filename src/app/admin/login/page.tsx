import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getAdmin, getPending2fa } from "@/lib/auth";
import { totp } from "@/lib/admin";
import { LogoMark } from "@/components/store/Logo";
import { loginPassword, loginTotp } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ step?: string; e?: string }> }) {
  if (await getAdmin()) redirect("/admin");
  const { step, e } = await searchParams;
  const uid = step ? await getPending2fa() : null;
  let qr: string | null = null; let secret: string | null = null;
  if (uid) {
    const u = await db.adminUser.findUnique({ where: { id: uid } });
    if (u && !u.totpEnabled) {
      secret = u.totpSecret ?? totp.secret();
      if (!u.totpSecret) await db.adminUser.update({ where: { id: u.id }, data: { totpSecret: secret } });
      qr = await QRCode.toDataURL(totp.uri(u.email, secret), { margin: 1, width: 200 });
    }
  }
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg)] p-4">
      <div className="card w-full max-w-sm p-7">
        <div className="mb-6 flex items-center gap-3"><LogoMark className="h-9 w-9 [--logo-fill:var(--fg)]" /><div><p className="font-bold tracking-[0.3em]">ARGON</p><p className="text-[12px] text-[var(--muted)]">Admin</p></div></div>
        {e && <p role="alert" className="mb-4 rounded-lg bg-[#fde0e3] px-3 py-2 text-[13px] text-[#9b1c2a]">{e}</p>}
        {!uid ? (
          <form action={loginPassword} className="space-y-3">
            <label className="f"><span>Email</span><input name="email" type="email" required autoComplete="username" className="input" /></label>
            <label className="f"><span>Password</span><input name="password" type="password" required autoComplete="current-password" className="input" /></label>
            <button className="btn btn-primary w-full">Continue</button>
          </form>
        ) : (
          <form action={loginTotp} className="space-y-3">
            {qr ? (
              <>
                <p className="text-[13px]"><b>Set up two‑factor authentication.</b> Scan with Google Authenticator, 1Password or Authy, then enter the 6‑digit code.</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="2FA QR code" width={200} height={200} className="mx-auto rounded-lg bg-white p-2" />
                <p className="break-all text-center font-mono text-[11px] text-[var(--muted)]">{secret}</p>
              </>
            ) : <p className="text-[13px]">Enter the 6‑digit code from your authenticator app.</p>}
            <input name="code" required inputMode="numeric" autoComplete="one-time-code" maxLength={6} className="input text-center font-mono text-lg tracking-[0.5em]" aria-label="Authentication code" autoFocus />
            <button className="btn btn-primary w-full">Verify</button>
          </form>
        )}
      </div>
    </main>
  );
}
