"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cart, cartCount, useCart } from "./cart-store";
import { LogoMark } from "./Logo";
import { IconArrow, IconBag, IconChevron, IconClose, IconMenu, IconSearch, IconUser } from "./Icons";

type NavItem = { href: string; label: string };
type Mega = { categories: { href: string; label: string; image: string; count: number }[]; featured: { href: string; label: string; image: string; sub: string }[]; quick: NavItem[] };

export function Header({ locale, nav, mega, labels, ticker }: {
  ticker?: React.ReactNode;
  locale: "en" | "bn"; nav: NavItem[]; mega: Mega;
  labels: { search: string; cart: string; menu: string; account: string; placeholder: string; shopAll: string; close: string };
}) {
  const path = usePathname() || "/";
  const isHome = path === "/" || path === "/bn" || path === "/en";
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const last = useRef(0);
  const closeT = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const on = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      if (y > 600 && y > last.current + 6) setHidden(true);
      else if (y < last.current - 6 || y <= 600) setHidden(false);
      last.current = y;
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { setMegaOpen(false); setMobile(false); setSearch(false); }, [path]);
  useEffect(() => { document.body.style.overflow = mobile ? "hidden" : ""; }, [mobile]);

  const solid = !isHome || scrolled || megaOpen || search;
  const prefix = locale === "bn" ? "/bn" : "";
  const openMega = () => { if (closeT.current) clearTimeout(closeT.current); setMegaOpen(true); };
  const closeMega = () => { closeT.current = setTimeout(() => setMegaOpen(false), 120); };

  return (
    <>
      <header
        className={`no-print fixed inset-x-0 z-40 transition-[transform,background-color,color,border-color] duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${solid ? "border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] text-[var(--fg)] backdrop-blur-xl" : "border-b border-transparent bg-transparent text-white"}`}
        style={{ top: 0, transform: hidden && !megaOpen && !mobile ? "translateY(-100%)" : "none" }}
        onMouseLeave={closeMega}
      >
        {ticker && <div className={`grid overflow-hidden transition-[grid-template-rows] duration-500 ${scrolled ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}><div className="min-h-0">{ticker}</div></div>}
        <div className="mx-auto grid h-[var(--header-h)] max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center px-4 md:px-10">
          <div className="flex items-center gap-1">
            <button onClick={() => setMobile(true)} className="-ml-2 grid h-11 w-11 place-items-center xl:hidden" aria-label={labels.menu} aria-expanded={mobile}><IconMenu /></button>
            <nav className="hidden items-center gap-8 xl:flex" aria-label="Main">
              {nav.map((n, i) => i === 0 ? (
                <button key={n.href} onMouseEnter={openMega} onFocus={openMega} onClick={() => setMegaOpen((o) => !o)} aria-expanded={megaOpen} className="flex items-center gap-1 text-[12px] font-medium uppercase tracking-[0.16em]">
                  <span className={`ulink ${megaOpen ? "!bg-[length:100%_1px]" : ""}`}>{n.label}</span><IconChevron className={`h-3 w-3 transition-transform duration-300 ${megaOpen ? "rotate-180" : ""}`} />
                </button>
              ) : (
                <Link key={n.href} href={n.href} onMouseEnter={closeMega} className="ulink text-[12px] font-medium uppercase tracking-[0.16em]" aria-current={path === n.href ? "page" : undefined}>{n.label}</Link>
              ))}
            </nav>
          </div>

          <Link href={prefix || "/"} className="flex flex-col items-center gap-0.5" aria-label="ARGON home">
            <LogoMark className={`h-7 w-7 transition-all duration-500 md:h-8 md:w-8 ${solid ? "" : "[--logo-fill:#fff]"}`} />
            <span className="text-[10px] font-semibold tracking-[0.55em] md:text-[11px]">ARGON</span>
          </Link>

          <div className="flex items-center justify-end">
            <button onClick={() => setSearch((s) => !s)} className="grid h-11 w-11 place-items-center" aria-label={labels.search} aria-expanded={search}><IconSearch /></button>
            <LangToggle locale={locale} />
            <Link href={`${prefix}/account`} className="hidden h-11 w-11 place-items-center sm:grid" aria-label={labels.account}><IconUser /></Link>
            <CartButton label={labels.cart} />
          </div>
        </div>

        {/* Mega menu */}
        <div
          className={`absolute inset-x-0 top-full hidden overflow-hidden border-b border-[var(--line)] bg-[var(--bg)] text-[var(--fg)] transition-[clip-path,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)] xl:block ${megaOpen ? "opacity-100 [clip-path:inset(0_0_0_0)]" : "pointer-events-none opacity-0 [clip-path:inset(0_0_100%_0)]"}`}
          onMouseEnter={openMega}
        >
          <div className="mx-auto grid max-w-[1600px] grid-cols-12 gap-8 px-10 py-10">
            <div className="col-span-3">
              <p className="eyebrow mb-5">Shop by category</p>
              <ul className="space-y-1">
                {mega.categories.map((c, i) => (
                  <li key={c.href} style={{ transitionDelay: `${megaOpen ? i * 50 + 100 : 0}ms` }} className={`transition-[opacity,transform] duration-500 ${megaOpen ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`}>
                    <Link href={c.href} className="group flex items-baseline gap-3 py-1.5 text-3xl font-medium uppercase tracking-[-0.03em]">
                      <span className="transition-transform duration-500 group-hover:translate-x-2">{c.label}</span><sup className="text-[11px] font-normal tracking-normal text-[var(--muted)]">{c.count}</sup>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href={`${prefix}/shop`} className="arrow-link mt-6">{labels.shopAll} <IconArrow /></Link>
            </div>
            <div className="col-span-2 pt-1">
              <p className="eyebrow mb-5">Discover</p>
              <ul className="space-y-3 text-[14px]">{mega.quick.map((q) => <li key={q.href}><Link href={q.href} className="ulink text-[var(--muted)] hover:text-[var(--fg)]">{q.label}</Link></li>)}</ul>
            </div>
            <div className="col-span-7 grid grid-cols-3 gap-4">
              {mega.featured.map((f, i) => (
                <Link key={f.href} href={f.href} className={`group relative aspect-[3/4] overflow-hidden transition-[opacity,transform] duration-700 ${megaOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"}`} style={{ transitionDelay: `${megaOpen ? 120 + i * 80 : 0}ms` }}>
                  <Image src={f.image} alt="" fill sizes="20vw" className="object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(.16,1,.3,1)] group-hover:scale-[1.06]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
                  <div className="absolute inset-x-4 bottom-4 text-white"><p className="text-[10px] uppercase tracking-[0.3em] opacity-80">{f.sub}</p><p className="mt-1 text-lg font-medium uppercase tracking-[-0.02em]">{f.label}</p></div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Search panel */}
        {search && <SearchPanel locale={locale} placeholder={labels.placeholder} label={labels.search} onClose={() => setSearch(false)} />}
      </header>
      {/* Overlay behind mega menu */}
      <div className={`fixed inset-0 z-30 bg-black/50 backdrop-blur-[2px] transition-opacity duration-500 ${megaOpen || search ? "opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => { setMegaOpen(false); setSearch(false); }} aria-hidden />

      {/* Mobile drawer */}
      <div className={`fixed inset-0 z-[55] xl:hidden ${mobile ? "" : "pointer-events-none"}`} aria-hidden={!mobile}>
        <div className={`absolute inset-0 bg-black/60 transition-opacity duration-500 ${mobile ? "opacity-100" : "opacity-0"}`} onClick={() => setMobile(false)} />
        <nav role="dialog" aria-modal="true" aria-label={labels.menu} className={`absolute inset-y-0 left-0 flex w-[88%] max-w-sm flex-col bg-[var(--bg)] transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] ${mobile ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="flex h-[var(--header-h)] items-center justify-between border-b border-[var(--line)] px-5">
            <span className="text-[11px] font-semibold tracking-[0.5em]">ARGON</span>
            <button onClick={() => setMobile(false)} className="grid h-11 w-11 place-items-center" aria-label={labels.close}><IconClose /></button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-6">
            <ul>
              {[{ href: `${prefix}/shop`, label: labels.shopAll }, ...mega.categories].map((c, i) => (
                <li key={c.href} className={`border-b border-[var(--line)] transition-[opacity,transform] duration-500 ${mobile ? "translate-x-0 opacity-100" : "-translate-x-4 opacity-0"}`} style={{ transitionDelay: `${mobile ? 80 + i * 50 : 0}ms` }}>
                  <Link href={c.href} className="flex items-center justify-between py-4 text-2xl font-medium uppercase tracking-[-0.03em]">{c.label}<IconArrow /></Link>
                </li>
              ))}
            </ul>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {mega.featured.slice(0, 2).map((f) => (
                <Link key={f.href} href={f.href} className="relative aspect-[3/4] overflow-hidden">
                  <Image src={f.image} alt="" fill sizes="45vw" className="object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
                  <p className="absolute inset-x-3 bottom-3 text-[13px] font-medium uppercase text-white">{f.label}</p>
                </Link>
              ))}
            </div>
            <ul className="mt-6 space-y-3 text-[14px] text-[var(--muted)]">{mega.quick.map((q) => <li key={q.href}><Link href={q.href}>{q.label}</Link></li>)}<li><Link href={`${prefix}/account`}>{labels.account}</Link></li></ul>
          </div>
        </nav>
      </div>
      {!isHome && <div aria-hidden style={{ height: ticker ? "calc(var(--header-h) + 36px)" : "var(--header-h)" }} />}
    </>
  );
}

function SearchPanel({ locale, placeholder, label, onClose }: { locale: "en" | "bn"; placeholder: string; label: string; onClose: () => void }) {
  const router = useRouter();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <form role="search" className="animate-rise absolute inset-x-0 top-full border-b border-[var(--line)] bg-[var(--bg)] px-4 py-8 text-[var(--fg)] md:px-10"
      onSubmit={(e) => { e.preventDefault(); const q = ref.current?.value.trim(); if (q) { onClose(); router.push(`${locale === "bn" ? "/bn" : ""}/search?q=${encodeURIComponent(q)}`); } }}>
      <div className="mx-auto flex max-w-3xl items-center gap-4 border-b border-[var(--fg)] pb-3">
        <IconSearch className="h-6 w-6 shrink-0" />
        <input ref={ref} name="q" className="w-full bg-transparent text-2xl font-medium uppercase tracking-[-0.02em] outline-none placeholder:text-[var(--muted)] md:text-4xl" placeholder={placeholder} aria-label={label} onKeyDown={(e) => e.key === "Escape" && onClose()} />
        <button type="button" onClick={onClose} aria-label="Close search"><IconClose /></button>
      </div>
      <div className="mx-auto mt-4 flex max-w-3xl flex-wrap gap-2 text-[12px]">
        {["Fang ring", "Spider", "Franco", "Sunglasses", "Box chain"].map((t) => <button key={t} type="button" className="pill !min-h-9" onClick={() => { onClose(); router.push(`${locale === "bn" ? "/bn" : ""}/search?q=${encodeURIComponent(t)}`); }}>{t}</button>)}
      </div>
    </form>
  );
}

export function CartButton({ label }: { label: string }) {
  const s = useCart();
  const n = cartCount(s);
  return (
    <button onClick={() => cart.setOpen(true)} className="relative -mr-2 grid h-11 w-11 place-items-center" aria-label={`${label} (${n})`}>
      <IconBag />
      {n > 0 && <span className="tnum absolute right-1 top-1.5 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-[var(--accent-bg)] px-1 text-[10px] font-bold text-white">{n}</span>}
      {s.pulse > 0 && <span key={s.pulse} aria-hidden className="pointer-events-none absolute inset-1 rounded-full border border-current" style={{ animation: "ringpulse .7s var(--ease) both" }} />}
    </button>
  );
}

export function LangToggle({ locale }: { locale: "en" | "bn" }) {
  const path = usePathname() || "/";
  const base = path.startsWith("/bn") ? path.slice(3) || "/" : path;
  const href = locale === "bn" ? base : base === "/" ? "/bn" : `/bn${base}`;
  return (
    <Link href={href} prefetch={false} className="grid h-11 min-w-10 place-items-center px-1 text-[12px] font-medium tracking-wider" hrefLang={locale === "bn" ? "en" : "bn"} aria-label={locale === "bn" ? "Switch to English" : "বাংলায় দেখুন"}>
      {locale === "bn" ? "EN" : "বাং"}
    </Link>
  );
}

export function ThemeToggle() {
  return (
    <button onClick={() => { const r = document.documentElement; const n = r.dataset.theme === "light" ? "dark" : "light"; r.dataset.theme = n; try { localStorage.setItem("argon_theme", n); } catch {} }}
      className="ulink text-[12px] uppercase tracking-[0.16em]" aria-label="Toggle light / dark theme">Light / Dark</button>
  );
}
