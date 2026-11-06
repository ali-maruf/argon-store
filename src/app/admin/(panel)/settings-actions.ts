"use server";
import { redirect } from "next/navigation";
import { revalidatePath, revalidateTag } from "next/cache";
import { adminMutation } from "@/lib/admin";
import { getSettingsFresh, saveSetting, type SettingKey, type Settings } from "@/lib/settings";
import type { Permission } from "@/lib/auth";

const PERM: Partial<Record<SettingKey, Permission>> = {
  store: "settings.edit", seo: "settings.edit", announcement: "content.edit", hero: "content.edit", ugc: "content.edit", nav: "content.edit",
  shipping: "shipping.edit", couriers: "shipping.edit", payments: "payments.edit", conversion: "marketing.edit", marketing: "marketing.edit",
  abandoned: "marketing.edit", reviews: "reviews.edit", notifications: "notifications.edit",
};

/**
 * Generic settings form handler. Field names are dotted paths inside one settings section,
 * with a type suffix: "name" (string), "rate:n" (number), "enabled:b" (checkbox), "zones:l" (comma list).
 * Checkbox keys are listed in "__bools" so unchecked boxes save as false.
 */
export async function saveSettingsForm(fd: FormData) {
  const section = String(fd.get("__section")) as SettingKey;
  const back = String(fd.get("__back") ?? "/admin/settings");
  const perm = PERM[section];
  if (!perm) throw new Error("Unknown section");
  await adminMutation(perm, "update_settings", "setting", section, async () => {
    const all = await getSettingsFresh();
    const cur = structuredClone(all[section]) as Record<string, unknown>;
    const setPath = (obj: Record<string, unknown>, path: string, val: unknown) => {
      const parts = path.split("."); let o = obj;
      for (const p of parts.slice(0, -1)) { o[p] = (o[p] as Record<string, unknown>) ?? {}; o = o[p] as Record<string, unknown>; }
      o[parts.at(-1)!] = val;
    };
    const bools = String(fd.get("__bools") ?? "").split(",").filter(Boolean);
    for (const b of bools) setPath(cur, b, false);
    for (const [k, v] of fd.entries()) {
      if (k.startsWith("__") || k.startsWith("$ACTION")) continue;
      const [path, type] = k.split(":");
      const s = String(v);
      setPath(cur, path, type === "n" ? Number(s) || 0 : type === "b" ? true : type === "l" ? s.split(",").map((x) => x.trim()).filter(Boolean) : s.trim());
    }
    await saveSetting(section, cur as Settings[typeof section]);
  }, { details: { section } });
  revalidateTag("settings");
  revalidatePath("/", "layout");
  redirect(`${back}${back.includes("?") ? "&" : "?"}msg=Saved`);
}

/** Saves a JSON-valued section (lists like UGC grid and navigation). */
export async function saveSettingsJson(section: "ugc" | "nav", value: unknown) {
  await adminMutation("content.edit", "update_settings", "setting", section, async () => saveSetting(section, value as Settings[typeof section]));
  revalidatePath("/", "layout");
}
