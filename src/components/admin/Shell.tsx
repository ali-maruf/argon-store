"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function AdminNav({ items }: { items: { href: string; label: string; icon: string }[] }) {
  const path = usePathname();
  return (
    <nav className="no-scrollbar flex-1 space-y-0.5 overflow-y-auto" aria-label="Admin">
      {items.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return <Link key={i.href} href={i.href} className="navlink" aria-current={active ? "page" : undefined} onClick={() => document.getElementById("admin-nav")?.setAttribute("data-open", "false")}><span className="w-4 text-center opacity-70" aria-hidden>{i.icon}</span>{i.label}</Link>;
      })}
    </nav>
  );
}

export function MobileNavToggle() {
  return (
    <button className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--line)] md:hidden" aria-label="Menu"
      onClick={() => { const el = document.getElementById("admin-nav"); el?.setAttribute("data-open", el.dataset.open === "true" ? "false" : "true"); }}>☰</button>
  );
}

export function AdminThemeToggle() {
  return (
    <button aria-label="Toggle dark mode" className="rounded px-1" onClick={() => {
      const r = document.documentElement; const n = r.dataset.theme === "dark" ? "light" : "dark"; r.dataset.theme = n;
      try { localStorage.setItem("argon_admin_theme", n); } catch {}
    }}>◐</button>
  );
}

type Hit = { type: string; label: string; sub: string; href: string };
export function CommandK() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [sel, setSel] = useState(0);
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen(true); } if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", on); return () => window.removeEventListener("keydown", on);
  }, []);
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 10); }, [open]);
  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const c = new AbortController();
    const t = setTimeout(() => fetch(`/api/admin/search?q=${encodeURIComponent(q)}`, { signal: c.signal }).then((r) => r.json()).then((j) => { setHits(j.hits ?? []); setSel(0); }).catch(() => {}), 150);
    return () => { clearTimeout(t); c.abort(); };
  }, [q]);
  const go = (h?: Hit) => { if (!h) return; setOpen(false); setQ(""); router.push(h.href); };
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--panel)] px-3 text-left text-[13px] text-[var(--muted)] md:max-w-md">
        ⌕ Search orders, products, customers <kbd className="ml-auto hidden rounded border border-[var(--line)] px-1.5 text-[11px] sm:inline">⌘K</kbd>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh]" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-xl overflow-hidden" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Search">
            <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order number, phone, product, customer…" className="w-full border-b border-[var(--line)] bg-transparent px-4 py-3.5 text-[15px] outline-none"
              onKeyDown={(e) => { if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(hits.length - 1, s + 1)); } if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); } if (e.key === "Enter") go(hits[sel]); }} />
            <ul className="max-h-[50vh] overflow-y-auto p-1.5">
              {hits.map((h, i) => (
                <li key={h.href}><button onMouseEnter={() => setSel(i)} onClick={() => go(h)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left ${i === sel ? "bg-[var(--panel2)]" : ""}`}>
                  <span className="chip">{h.type}</span><span className="flex-1 truncate">{h.label}</span><span className="text-[12px] text-[var(--muted)]">{h.sub}</span>
                </button></li>
              ))}
              {q.length >= 2 && hits.length === 0 && <li className="px-3 py-6 text-center text-[var(--muted)]">No results</li>}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

/** Polls for new orders: plays a chime and shows a browser notification. */
export function AdminLive({ enabled }: { enabled: boolean }) {
  const since = useRef<string>(new Date().toISOString());
  const [count, setCount] = useState(0);
  const [perm, setPerm] = useState<string>("default");
  useEffect(() => { if ("Notification" in window) setPerm(Notification.permission); }, []);
  useEffect(() => {
    if (!enabled) return;
    const tick = async () => {
      const r = await fetch(`/api/admin/new-orders?since=${encodeURIComponent(since.current)}`).then((r) => r.json()).catch(() => null);
      if (!r?.orders?.length) return;
      since.current = r.now;
      setCount((c) => c + r.orders.length);
      try {
        const ctx = new AudioContext(); const o = ctx.createOscillator(); const g = ctx.createGain();
        o.frequency.value = 880; o.type = "sine"; g.gain.setValueAtTime(0.15, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.6);
      } catch {}
      if ("Notification" in window && Notification.permission === "granted") for (const o of r.orders) new Notification(`New order ${o.orderNumber}`, { body: `৳${o.total} · ${o.customerName}, ${o.district}` });
    };
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [enabled]);
  if (!enabled) return null;
  return (
    <div className="ml-auto flex items-center gap-2">
      {perm === "default" && <button className="hidden text-[12px] text-[var(--muted)] underline sm:block" onClick={() => Notification.requestPermission().then(setPerm)}>Enable order alerts</button>}
      {count > 0 && <Link href="/admin/orders?tab=new" onClick={() => setCount(0)} className="chip chip-green">● {count} new</Link>}
    </div>
  );
}
