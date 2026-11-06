import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { adminMutation, fdBool, fdStr } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { TEMPLATE_KEYS, TEMPLATE_VARS } from "@/lib/notify";
import { Notice, PageHeader } from "@/components/admin/ui";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Notifications" };

async function saveTemplate(fd: FormData) {
  "use server";
  const key = fdStr(fd, "key"); const channel = fdStr(fd, "channel"); const locale = fdStr(fd, "locale");
  if (!(TEMPLATE_KEYS as readonly string[]).includes(key) || !["sms", "email"].includes(channel) || !["en", "bn"].includes(locale)) throw new Error("Invalid template");
  const data = { body: fdStr(fd, "body").slice(0, 2000), subject: fdStr(fd, "subject") || null, enabled: fdBool(fd, "enabled") };
  await adminMutation("notifications.edit", "update_template", "template", `${key}/${channel}/${locale}`, async () =>
    db.notificationTemplate.upsert({ where: { key_channel_locale: { key, channel, locale } }, create: { key, channel, locale, ...data }, update: data }));
  revalidatePath("/admin/notifications");
}

export default async function Notifications({ searchParams }: { searchParams: Promise<{ msg?: string; ch?: string }> }) {
  await requireAdmin("notifications.edit");
  const sp = await searchParams;
  const ch = sp.ch === "email" ? "email" : "sms";
  const [tpls, s] = await Promise.all([db.notificationTemplate.findMany({ where: { channel: ch } }), getSettings()]);
  const get = (key: string, locale: string) => tpls.find((t) => t.key === key && t.locale === locale);
  return (
    <>
      <PageHeader title="Notifications">
        <div className="tabs flex gap-1 rounded-xl bg-[var(--panel2)] p-1"><a href="/admin/notifications?ch=sms" aria-current={ch === "sms" ? "page" : undefined}>SMS</a><a href="/admin/notifications?ch=email" aria-current={ch === "email" ? "page" : undefined}>Email</a></div>
      </PageHeader>
      <Notice msg={sp.msg} />
      <p className="mb-4 text-[13px] text-[var(--muted)]">Variables: {TEMPLATE_VARS.map((v) => <code key={v} className="mr-2 rounded bg-[var(--panel2)] px-1">{v}</code>)} · SMS provider: <b>{process.env.SMS_PROVIDER ?? "console"}</b> · Email: <b>{process.env.RESEND_API_KEY ? "Resend" : "console (set RESEND_API_KEY)"}</b></p>
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {TEMPLATE_KEYS.map((key) => (
            <div key={key} className="card">
              <div className="card-h">{key.replace(/_/g, " ")}</div>
              <div className="card-b grid gap-3 md:grid-cols-2">
                {(["en", "bn"] as const).map((locale) => {
                  const t = get(key, locale);
                  return (
                    <form key={locale} action={saveTemplate} className="space-y-2">
                      <input type="hidden" name="key" value={key} /><input type="hidden" name="channel" value={ch} /><input type="hidden" name="locale" value={locale} />
                      <p className="text-[12px] font-medium uppercase text-[var(--muted)]">{locale === "en" ? "English" : "বাংলা"}</p>
                      {ch === "email" && <input name="subject" defaultValue={t?.subject ?? ""} placeholder="Subject" className="input" />}
                      <textarea name="body" defaultValue={t?.body ?? ""} className="input" rows={3} />
                      <div className="flex items-center justify-between"><label className="flex items-center gap-2 text-[12px]"><input type="checkbox" name="enabled" defaultChecked={t?.enabled ?? true} /> Enabled</label><button className="btn btn-ghost">Save</button></div>
                    </form>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-5">
          <SettingsForm section="notifications" title="Owner alerts" back="/admin/notifications" cols={1} fields={[
            { name: "ownerPhone", label: "Owner phone (SMS on new order)", value: s.notifications.ownerPhone },
            { name: "ownerEmail", label: "Owner email", type: "email", value: s.notifications.ownerEmail },
            { name: "telegramChatId", label: "Telegram chat ID (needs TELEGRAM_BOT_TOKEN)", value: s.notifications.telegramChatId },
            { name: "lowStockAlerts", label: "Low‑stock alerts", type: "bool", value: s.notifications.lowStockAlerts },
          ]} />
          <SettingsForm section="abandoned" title="Abandoned checkout recovery" back="/admin/notifications" cols={1} fields={[
            { name: "enabled", label: "Send recovery reminders", type: "bool", value: s.abandoned.enabled },
            { name: "firstAfterHours", label: "1st SMS after (hours)", type: "number", value: s.abandoned.firstAfterHours },
            { name: "secondAfterHours", label: "2nd SMS with discount after (hours)", type: "number", value: s.abandoned.secondAfterHours },
            { name: "secondDiscountCode", label: "Discount code in 2nd reminder", value: s.abandoned.secondDiscountCode },
          ]} />
          <p className="text-[12px] text-[var(--muted)]">Browser alerts and a chime for new orders are available on every admin page (top bar → “Enable order alerts”).</p>
        </div>
      </div>
    </>
  );
}
