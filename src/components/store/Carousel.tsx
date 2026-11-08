"use client";
import { useEffect, useRef, useState } from "react";
import { IconArrow } from "./Icons";

/** Native scroll-snap carousel with arrow buttons and a progress bar. Children are the slides. */
export function Carousel({ children, label, itemClass = "w-[72%] sm:w-[44%] lg:w-[calc(25%-15px)]" }: { children: React.ReactNode[]; label: string; itemClass?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: false });
  useEffect(() => {
    const el = track.current; if (!el) return;
    const on = () => {
      const max = el.scrollWidth - el.clientWidth;
      setProgress(max > 0 ? el.scrollLeft / max : 1);
      setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft > max - 8 });
    };
    on(); el.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { el.removeEventListener("scroll", on); window.removeEventListener("resize", on); };
  }, []);
  const go = (dir: number) => { const el = track.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" }); };
  return (
    <div role="region" aria-roledescription="carousel" aria-label={label}>
      <div ref={track} className="no-scrollbar flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-px-4 px-4 md:scroll-px-10 md:px-10">
        {children.map((c, i) => <div key={i} className={`shrink-0 snap-start ${itemClass}`} data-reveal style={{ ["--i" as string]: Math.min(i, 5) }}>{c}</div>)}
      </div>
      <div className="mx-4 mt-8 flex items-center gap-6 md:mx-10">
        <div className="relative h-px flex-1 bg-[var(--line)]"><div className="absolute inset-y-0 left-0 bg-[var(--fg)] transition-[width] duration-300" style={{ width: `${Math.max(12, progress * 100)}%` }} /></div>
        <div className="flex gap-2">
          <button onClick={() => go(-1)} disabled={edges.start} className="grid h-11 w-11 rotate-180 place-items-center border border-[var(--line)] transition-colors hover:border-[var(--fg)] disabled:opacity-30" aria-label="Previous"><IconArrow /></button>
          <button onClick={() => go(1)} disabled={edges.end} className="grid h-11 w-11 place-items-center border border-[var(--line)] transition-colors hover:border-[var(--fg)] disabled:opacity-30" aria-label="Next"><IconArrow /></button>
        </div>
      </div>
    </div>
  );
}
