"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Muted, looping background video with mobile/desktop sources and a pause control (WCAG 2.2.2).
 * Respects prefers-reduced-motion and Save-Data by staying on the poster.
 */
export function LoopVideo({ mp4, webm, mobileMp4, mobileWebm, poster, posterMobile, className = "", label = "Background video", controlClass = "" }: {
  mp4: string; webm?: string; mobileMp4?: string; mobileWebm?: string; poster: string; posterMobile?: string; className?: string; label?: string; controlClass?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [mobile, setMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const mq = matchMedia("(max-width: 767px)");
    setMobile(mq.matches);
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || nav.connection?.saveData) { setPlaying(false); return; }
    const v = ref.current;
    if (!v) return;
    // Pause when off-screen to save battery/CPU.
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { if (v.dataset.user !== "paused") v.play().catch(() => {}); } else v.pause(); }, { threshold: 0.05 });
    io.observe(v);
    return () => io.disconnect();
  }, []);

  const useMobile = mobile && mobileMp4;
  const src = useMobile ? { mp4: mobileMp4!, webm: mobileWebm } : { mp4, webm };
  const toggle = () => {
    const v = ref.current; if (!v) return;
    if (v.paused) { v.dataset.user = ""; v.play().catch(() => {}); setPlaying(true); } else { v.dataset.user = "paused"; v.pause(); setPlaying(false); }
  };

  return (
    <>
      {mobile !== null && (
        <video key={useMobile ? "m" : "d"} ref={ref} className={className} autoPlay={playing} muted loop playsInline preload="auto" poster={useMobile && posterMobile ? posterMobile : poster} aria-label={label}
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}>
          {src.webm && <source src={src.webm} type="video/webm" />}
          <source src={src.mp4} type="video/mp4" />
        </video>
      )}
      <button onClick={toggle} className={`grid h-9 w-9 place-items-center rounded-full border border-white/40 text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-black ${controlClass}`} aria-label={playing ? "Pause video" : "Play video"}>
        {playing ? <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
          : <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden><path d="M7 4v16l13-8z" /></svg>}
      </button>
    </>
  );
}
