export const BD_PHONE = /^01[3-9]\d{8}$/;

/** Normalise +8801XXXXXXXXX / 8801… / 01… into 01XXXXXXXXX. */
export function normalizePhone(raw: string): string {
  const d = (raw || "").replace(/\D/g, "");
  if (d.startsWith("880")) return "0" + d.slice(3);
  if (d.startsWith("1") && d.length === 10) return "0" + d;
  return d;
}
export const isBdPhone = (raw: string) => BD_PHONE.test(normalizePhone(raw));

const fmt = new Intl.NumberFormat("en-IN");
const fmtBn = new Intl.NumberFormat("bn-BD");
export function taka(n: number, locale: string = "en") {
  return "৳" + (locale === "bn" ? fmtBn : fmt).format(Math.round(n));
}
export function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
export function savingsPct(price: number, compareAt?: number | null) {
  if (!compareAt || compareAt <= price) return 0;
  return Math.round(((compareAt - price) / compareAt) * 100);
}
export function dateTime(d: Date | string) {
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dhaka" });
}
export function dateOnly(d: Date | string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });
}
export function csvEscape(v: unknown) {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  return [keys.join(","), ...rows.map((r) => keys.map((k) => csvEscape(r[k])).join(","))].join("\n");
}
