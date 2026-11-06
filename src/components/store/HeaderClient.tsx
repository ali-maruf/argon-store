"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cart, cartCount, useCart } from "./cart-store";

export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);
  const last = useRef(0);
  useEffect(() => {
    const on = () => {
      const y = window.scrollY;
      setHidden(y > 120 && y > last.current);
      last.current = y;
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <header
      className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] backdrop-blur-[14px] transition-transform duration-200"
      style={{ transform: hidden ? "translateY(-100%)" : "none" }}
    >
      {children}
    </header>
  );
}

export function CartButton({ label }: { label: string }) {
  const s = useCart();
  const n = cartCount(s);
  return (
    <button onClick={() => cart.setOpen(true)} className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--glass)]" aria-label={`${label} (${n})`}>
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" />
      </svg>
      {n > 0 && (
        <span className="tnum absolute right-0.5 top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[var(--fg)] px-1 text-[11px] font-bold text-[var(--bg)]">{n}</span>
      )}
      {s.pulse > 0 && <span key={s.pulse} aria-hidden className="pointer-events-none absolute inset-0 rounded-full border border-[var(--fg)]" style={{ animation: "ringpulse .6s var(--ease) both" }} />}
    </button>
  );
}

export function LangToggle({ locale }: { locale: "en" | "bn" }) {
  const path = usePathname() || "/";
  const base = path.startsWith("/bn") ? path.slice(3) || "/" : path;
  const href = locale === "bn" ? base : base === "/" ? "/bn" : `/bn${base}`;
  return (
    <Link href={href} prefetch={false} className="grid h-11 min-w-11 place-items-center rounded-full px-2 text-[13px] font-medium hover:bg-[var(--glass)]" hrefLang={locale === "bn" ? "en" : "bn"} aria-label={locale === "bn" ? "Switch to English" : "বাংলায় দেখুন"}>
      {locale === "bn" ? "EN" : "বাং"}
    </Link>
  );
}

export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try { localStorage.setItem("argon_theme", next); } catch {}
  };
  return (
    <button onClick={toggle} className="grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--glass)]" aria-label="Toggle light / dark theme">
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 4a8 8 0 0 0 0 16Z" fill="currentColor" /></svg>
    </button>
  );
}

export function SearchButton({ locale, placeholder, label }: { locale: "en" | "bn"; placeholder: string; label: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  return (
    <>
      <button onClick={() => setOpen((o) => !o)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-[var(--glass)]" aria-label={label} aria-expanded={open}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4-4" /></svg>
      </button>
      {open && (
        <form
          role="search"
          className="animate-rise absolute inset-x-0 top-full border-b border-[var(--line)] bg-[var(--bg)] p-4"
          onSubmit={(e) => { e.preventDefault(); const q = ref.current?.value.trim(); if (q) { setOpen(false); router.push(`${locale === "bn" ? "/bn" : ""}/search?q=${encodeURIComponent(q)}`); } }}
        >
          <div className="mx-auto flex max-w-2xl gap-2">
            <input ref={ref} name="q" className="input" placeholder={placeholder} aria-label={label} onKeyDown={(e) => e.key === "Escape" && setOpen(false)} />
            <button className="btn btn-primary">{label}</button>
          </div>
        </form>
      )}
    </>
  );
}

export function MobileMenu({ links, label }: { links: { href: string; label: string }[]; label: string }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  return (
    <div className="md:hidden">
      <button onClick={() => setOpen(true)} className="grid h-11 w-11 place-items-center rounded-full" aria-label={label} aria-expanded={open}>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 8h16M4 16h16" /></svg>
      </button>
      {open && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={label}>
          <button className="absolute inset-0 bg-black/60" aria-label="Close menu" onClick={() => setOpen(false)} />
          <nav className="animate-rise absolute inset-y-0 left-0 w-[82%] max-w-sm bg-[var(--bg)] p-6">
            <button onClick={() => setOpen(false)} className="mb-8 grid h-11 w-11 place-items-center rounded-full border border-[var(--line)]" aria-label="Close menu">✕</button>
            <ul className="space-y-1">
              {links.map((l) => (
                <li key={l.href}><Link href={l.href} className="block py-3 font-[family-name:var(--font-display)] text-3xl">{l.label}</Link></li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  );
}
