import Link from "next/link";

export function PageHeader({ title, back, children }: { title: React.ReactNode; back?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      {back && <Link href={back} className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--line)]" aria-label="Back">←</Link>}
      <h1 className="page">{title}</h1>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

const COLORS: Record<string, string> = {
  paid: "green", delivered: "green", completed: "green", active: "green", approved: "green", confirmed: "blue", shipped: "blue", processing: "blue",
  pending: "yellow", new: "yellow", unfulfilled: "yellow", on_hold: "yellow", draft: "yellow", partially_paid: "yellow",
  failed: "red", cancelled: "red", returned: "red", refunded: "red", archived: "", hidden: "red", blocked: "red",
};
export function Chip({ v, label }: { v: string; label?: string }) {
  const c = COLORS[v];
  return <span className={`chip ${c ? `chip-${c}` : ""}`}>{label ?? v.replace(/_/g, " ")}</span>;
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center justify-between px-4 py-3 text-[13px]" aria-label="Pagination">
      <span className="text-[var(--muted)]">Page {page} of {pages}</span>
      <div className="flex gap-2">
        {page > 1 && <Link className="btn btn-ghost" href={href(page - 1)}>← Prev</Link>}
        {page < pages && <Link className="btn btn-ghost" href={href(page + 1)}>Next →</Link>}
      </div>
    </nav>
  );
}

export function Notice({ msg, error }: { msg?: string; error?: string }) {
  if (!msg && !error) return null;
  return <p role="status" className={`mb-4 rounded-lg px-4 py-2.5 text-[13px] ${error ? "chip-red" : "chip-green"}`}>{error ?? msg}</p>;
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="card p-4">
      <p className="text-[12px] text-[var(--muted)]">{label}</p>
      <p className="tnum mt-1 text-[22px] font-bold">{value}</p>
      {sub && <p className="mt-0.5 text-[12px] text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

export const tk = (n: number) => "৳" + Math.round(n).toLocaleString("en-IN");

/** Tiny dependency-free SVG bar/line chart. */
export function BarChart({ data, height = 160 }: { data: { label: string; value: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / Math.max(1, data.length);
  return (
    <svg viewBox={`0 0 100 ${height / 4}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="Chart">
      {data.map((d, i) => {
        const h = (d.value / max) * (height / 4 - 2);
        return <rect key={i} x={i * w + w * 0.15} y={height / 4 - h} width={w * 0.7} height={h} rx={0.6} fill="currentColor" opacity={0.85}><title>{`${d.label}: ${d.value.toLocaleString("en-IN")}`}</title></rect>;
      })}
    </svg>
  );
}
