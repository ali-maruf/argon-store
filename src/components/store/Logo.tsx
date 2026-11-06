export function LogoMark({ className = "h-8 w-8", title = "ARGON" }: { className?: string; title?: string }) {
  return (
    <svg viewBox="250 270 490 430" className={className} role="img" aria-label={title}>
      <defs>
        <linearGradient id="lg-chrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FFFFFF" /><stop offset=".22" stopColor="#BFC3C9" /><stop offset=".45" stopColor="#6E737A" />
          <stop offset=".62" stopColor="#E8EBEE" /><stop offset="1" stopColor="#9097A0" />
        </linearGradient>
      </defs>
      <g fill="var(--logo-fill, url(#lg-chrome))">
        <path d="M486 298 L512 298 L670 640 Q682 662 704 668 L596 668 Q612 660 603 640 L466 338 Z" />
        <path d="M468 334 L478 352 L350 638 Q342 660 384 668 L282 668 Q318 660 336 630 Z" />
        <path d="M296 548 C 300 510 420 476 560 446 L 548 462 C 430 488 330 516 318 546 C 312 566 410 562 560 524 C 640 504 680 486 690 470 C 700 452 660 442 596 442 L 604 434 C 690 430 718 448 708 470 C 694 500 620 528 540 548 C 390 586 292 586 296 548 Z" />
        <path d="M684 398 Q688 421 711 425 Q688 429 684 452 Q680 429 657 425 Q680 421 684 398 Z" />
      </g>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`text-[13px] font-medium tracking-[0.5em] ${className}`}>ARGON</span>;
}

export function Sparkle({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12 0 Q13.6 10.4 24 12 Q13.6 13.6 12 24 Q10.4 13.6 0 12 Q10.4 10.4 12 0Z" />
    </svg>
  );
}

export function OrbitRing({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 80" className={className} aria-hidden="true" fill="none">
      <ellipse cx="100" cy="40" rx="96" ry="22" transform="rotate(-12 100 40)" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}
