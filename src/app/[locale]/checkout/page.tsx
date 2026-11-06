import type { Metadata } from "next";
import { Suspense } from "react";
import { getDict, type Locale } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { getShippingZones } from "@/lib/catalog";
import { DISTRICTS, AREAS } from "@/lib/districts";
import { CheckoutForm } from "@/components/store/CheckoutForm";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function Checkout({ params }: { params: Promise<{ locale: Locale }> }) {
  const { locale } = await params;
  const d = getDict(locale);
  const [settings, zones] = await Promise.all([getSettings(), getShippingZones()]);
  const bn = locale === "bn";
  const s = {
    ...d,
    errName: bn ? "আপনার নাম লিখুন" : "Please enter your name",
    errPhone: bn ? "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)" : "Enter a valid BD mobile number (01XXXXXXXXX)",
    errEmail: bn ? "সঠিক ইমেইল দিন" : "Enter a valid email or leave it empty",
    errAddress: bn ? "সম্পূর্ণ ঠিকানা লিখুন" : "Please enter your full address (house, road, area)",
    errDistrict: bn ? "জেলা নির্বাচন করুন" : "Choose your district from the list",
    addressPh: bn ? "বাসা, রোড, এলাকা" : "House, road, area",
    searchDistrict: bn ? "জেলা খুঁজুন" : "Type to search",
    chooseDistrict: bn ? "জেলা দিন" : "Enter district",
    zoneHint: bn ? "জেলা ও এলাকা থেকে স্বয়ংক্রিয়ভাবে নির্ধারিত। পরিবর্তনে জেলা/এলাকা বদলান।" : "Detected from your district and area — change those to update it.",
    bkashSub: bn ? "বিকাশ অ্যাপ/পিন দিয়ে পেমেন্ট" : "Pay instantly with your bKash wallet",
    nagadSub: bn ? "নগদ অ্যাকাউন্ট দিয়ে পেমেন্ট" : "Pay instantly with your Nagad wallet",
    codAdvance: bn ? "ঢাকার বাইরে: ডেলিভারি চার্জ বিকাশে অগ্রিম, বাকিটা ডেলিভারিতে" : "Outside Dhaka: pay the delivery charge in advance via bKash, the rest on delivery",
    otp: bn ? "ফোনে পাঠানো ৬ সংখ্যার কোড" : "6‑digit code sent to your phone",
    placing: bn ? "অর্ডার হচ্ছে…" : "Placing order…",
    secureNote: bn ? "কোনো অ্যাকাউন্ট লাগবে না · পেমেন্ট সার্ভারে যাচাই হয়" : "No account needed · Payments are verified securely on our server",
  };
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="mb-8 font-[family-name:var(--font-display)] text-4xl md:text-5xl">{d.checkout}</h1>
      <Suspense fallback={<div className="grid place-items-center py-24"><span className="orbit" aria-label="Loading" /></div>}>
        <CheckoutForm
          locale={locale} districts={DISTRICTS} areas={AREAS} s={s}
          zones={zones.map((z) => ({ key: z.key, name: bn && z.nameBn ? z.nameBn : z.name, rate: z.rate, eta: z.eta }))}
          methods={{ cod: settings.payments.cod.enabled, bkash: settings.payments.bkash.enabled, nagad: settings.payments.nagad.enabled, sslcommerz: settings.payments.sslcommerz.enabled, advanceOutsideDhaka: settings.payments.cod.advanceOutsideDhaka }}
        />
      </Suspense>
    </div>
  );
}
