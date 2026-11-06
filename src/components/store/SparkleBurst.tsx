const DIRS = [[-46, -38], [44, -42], [-52, 16], [50, 20], [0, -58], [-14, 50], [22, 52]];

/** Brief burst of 4-point stars (transform + opacity only, ~300ms). */
export function SparkleBurst({ className = "left-1/2 top-1/2" }: { className?: string }) {
  return (
    <span aria-hidden className={`pointer-events-none absolute ${className}`}>
      {DIRS.map(([dx, dy], i) => (
        <svg key={i} viewBox="0 0 24 24" className="absolute h-3 w-3 text-[var(--fg)]" fill="currentColor"
          style={{ animation: `burst .45s ${i * 18}ms var(--ease) both`, ["--dx" as string]: `${dx}px`, ["--dy" as string]: `${dy}px` }}>
          <path d="M12 0 Q13.6 10.4 24 12 Q13.6 13.6 12 24 Q10.4 13.6 0 12 Q10.4 10.4 12 0Z" />
        </svg>
      ))}
    </span>
  );
}
