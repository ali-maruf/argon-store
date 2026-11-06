import Link from "next/link";
import { LogoMark } from "@/components/store/Logo";

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 py-20 text-center">
      <div>
        <div className="relative mx-auto h-40 w-40" aria-hidden>
          <div className="absolute inset-0 grid place-items-center"><LogoMark className="h-20 w-20 opacity-80" /></div>
          <div className="absolute inset-x-0 top-1/2 h-12 -translate-y-1/2 rounded-[50%] border border-[var(--muted)]" style={{ animation: "spin 8s linear infinite" }} />
        </div>
        <p className="eyebrow mt-6">4 0 4</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-5xl">Lost in orbit.</h1>
        <p className="mt-3 text-[var(--muted)]">This page drifted out of range.</p>
        <Link href="/" className="btn btn-primary mt-8">Back to home</Link>
      </div>
    </div>
  );
}
