import "server-only";
import type { Order } from "@prisma/client";
import { db } from "./db";
import { getSettings } from "./settings";

/* ---------------- SMS (pluggable) ---------------- */
export interface SmsProvider { name: string; send(to: string, text: string): Promise<{ ok: boolean; id?: string; error?: string }> }

const toIntl = (p: string) => (p.startsWith("0") ? "88" + p : p);

const consoleSms: SmsProvider = { name: "console", async send(to, text) { console.log(`[SMS → ${to}] ${text}`); return { ok: true }; } };

const bulkSmsBd: SmsProvider = {
  name: "bulksmsbd",
  async send(to, text) {
    const u = new URL("https://bulksmsbd.net/api/smsapi");
    u.searchParams.set("api_key", process.env.BULKSMSBD_API_KEY ?? "");
    u.searchParams.set("type", "text"); u.searchParams.set("senderid", process.env.BULKSMSBD_SENDER_ID ?? "");
    u.searchParams.set("number", toIntl(to)); u.searchParams.set("message", text);
    const r = await fetch(u, { method: "POST" }); const j = await r.json().catch(() => ({}));
    return { ok: j?.response_code === 202, error: j?.error_message };
  },
};
const sslWireless: SmsProvider = {
  name: "sslwireless",
  async send(to, text) {
    const r = await fetch("https://smsplus.sslwireless.com/api/v3/send-sms", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_token: process.env.SSL_SMS_API_TOKEN, sid: process.env.SSL_SMS_SID, msisdn: toIntl(to), sms: text, csms_id: Date.now().toString() }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: j?.status === "SUCCESS", error: j?.error_message };
  },
};
const alphaSms: SmsProvider = {
  name: "alphasms",
  async send(to, text) {
    const body = new URLSearchParams({ api_key: process.env.ALPHA_SMS_API_KEY ?? "", msg: text, to: toIntl(to) });
    if (process.env.ALPHA_SMS_SENDER_ID) body.set("sender_id", process.env.ALPHA_SMS_SENDER_ID);
    const r = await fetch("https://api.sms.net.bd/sendsms", { method: "POST", body });
    const j = await r.json().catch(() => ({}));
    return { ok: j?.error === 0, error: j?.msg };
  },
};
const providers: Record<string, SmsProvider> = { console: consoleSms, bulksmsbd: bulkSmsBd, sslwireless: sslWireless, alphasms: alphaSms };
export const sms = () => providers[process.env.SMS_PROVIDER ?? "console"] ?? consoleSms;

export async function sendSms(to: string, text: string) {
  try { return await sms().send(to, text); } catch (e) { console.error("sms error", e); return { ok: false, error: String(e) }; }
}

/* ---------------- Email (Resend) ---------------- */
export async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) { console.log(`[EMAIL → ${to}] ${subject}`); return { ok: true }; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "ARGON <orders@argon.com.bd>", to, subject, html }),
  });
  return { ok: r.ok };
}

/* ---------------- Templates ---------------- */
export const TEMPLATE_KEYS = ["order_placed", "order_confirmed", "order_shipped", "order_delivered", "order_cancelled", "abandoned_1", "abandoned_2", "review_request", "otp"] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];
export const TEMPLATE_VARS = ["{{name}}", "{{order_number}}", "{{total}}", "{{tracking_link}}", "{{link}}", "{{code}}", "{{store}}"];

export function render(tpl: string, vars: Record<string, string | number>) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => String(vars[k] ?? ""));
}
const site = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export function orderVars(o: Order) {
  return {
    name: o.customerName.split(" ")[0], order_number: o.orderNumber, total: `৳${o.total}`, store: "ARGON",
    tracking_link: `${site()}/track?o=${encodeURIComponent(o.orderNumber)}&p=${o.customerPhone}`,
    link: `${site()}/track?o=${encodeURIComponent(o.orderNumber)}&p=${o.customerPhone}`,
  };
}

export async function renderTemplate(key: TemplateKey, channel: "sms" | "email", vars: Record<string, string | number>, locale = "en") {
  const t = (await db.notificationTemplate.findUnique({ where: { key_channel_locale: { key, channel, locale } } }))
    ?? (await db.notificationTemplate.findUnique({ where: { key_channel_locale: { key, channel, locale: "en" } } }));
  if (!t || !t.enabled) return null;
  return { subject: t.subject ? render(t.subject, vars) : "", body: render(t.body, vars) };
}

export async function notifyCustomer(key: TemplateKey, o: Order, extra: Record<string, string | number> = {}) {
  const vars = { ...orderVars(o), ...extra };
  const s = await renderTemplate(key, "sms", vars);
  if (s) await sendSms(o.customerPhone, s.body);
  if (o.customerEmail) {
    const e = await renderTemplate(key, "email", vars);
    if (e) await sendEmail(o.customerEmail, e.subject || `ARGON · ${o.orderNumber}`, emailShell(e.body));
  }
}

export async function notifyOwner(text: string) {
  const s = await getSettings();
  const tasks: Promise<unknown>[] = [];
  if (s.notifications.ownerPhone) tasks.push(sendSms(s.notifications.ownerPhone, text));
  if (process.env.TELEGRAM_BOT_TOKEN && s.notifications.telegramChatId) {
    tasks.push(fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: s.notifications.telegramChatId, text }),
    }));
  }
  if (s.notifications.ownerEmail) tasks.push(sendEmail(s.notifications.ownerEmail, text.slice(0, 80), emailShell(`<p>${text}</p>`)));
  await Promise.allSettled(tasks);
}

export function emailShell(body: string) {
  return `<div style="background:#0A0A0B;padding:32px;font-family:Arial,sans-serif;color:#EEE9E6"><div style="max-width:520px;margin:auto"><p style="letter-spacing:8px;font-size:13px">ARGON</p><div style="line-height:1.6;font-size:15px">${body.replace(/\n/g, "<br>")}</div><p style="color:#8C9198;font-size:12px;margin-top:32px">Forged in steel. Built to last. ✦</p></div></div>`;
}
