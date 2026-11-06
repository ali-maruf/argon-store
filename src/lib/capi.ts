import "server-only";
import { createHash } from "node:crypto";
import type { Order } from "@prisma/client";
import { getSettings } from "./settings";

const sha = (s: string) => createHash("sha256").update(s.trim().toLowerCase()).digest("hex");

/** Meta Conversions API "Purchase", deduplicated with the browser pixel via event_id = order.id. */
export async function sendPurchaseCapi(o: Order) {
  const { marketing } = await getSettings();
  const token = process.env.META_CAPI_TOKEN;
  if (!marketing.metaPixelId || !token) return;
  const phone = "88" + o.customerPhone;
  const body = {
    data: [{
      event_name: "Purchase", event_time: Math.floor(o.createdAt.getTime() / 1000), event_id: o.id, action_source: "website",
      event_source_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order/${o.id}/thank-you`,
      user_data: { ph: [sha(phone)], ...(o.customerEmail ? { em: [sha(o.customerEmail)] } : {}), ct: [sha(o.district)], country: [sha("bd")], ...(o.ip ? { client_ip_address: o.ip } : {}) },
      custom_data: { currency: "BDT", value: o.total, order_id: o.orderNumber },
    }],
    ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
  };
  await fetch(`https://graph.facebook.com/v21.0/${marketing.metaPixelId}/events?access_token=${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
}
