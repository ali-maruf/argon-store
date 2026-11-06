"use client";
import { useEffect } from "react";

/** Browser-side Purchase, deduplicated against the Conversions API with eventID = order id. Fires once per order. */
export function PurchaseEvent({ orderId, value, paid }: { orderId: string; value: number; paid: boolean }) {
  useEffect(() => {
    if (!paid) return;
    const key = `argon_purchase_${orderId}`;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch {}
    const w = window as unknown as { fbq?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; ttq?: { track: (...a: unknown[]) => void } };
    const fire = () => {
      w.fbq?.("track", "Purchase", { value, currency: "BDT" }, { eventID: orderId });
      w.gtag?.("event", "purchase", { transaction_id: orderId, value, currency: "BDT" });
      w.ttq?.track("CompletePayment", { value, currency: "BDT", event_id: orderId });
    };
    // Pixels load lazily; give them a moment.
    const t = setTimeout(fire, 1500);
    return () => clearTimeout(t);
  }, [orderId, value, paid]);
  return null;
}
