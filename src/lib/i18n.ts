export const LOCALES = ["en", "bn"] as const;
export type Locale = (typeof LOCALES)[number];
export const isLocale = (s: string): s is Locale => (LOCALES as readonly string[]).includes(s);

/** Build a storefront href. English lives at the root, Bangla under /bn. */
export function lhref(locale: Locale, path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return locale === "bn" ? (p === "/" ? "/bn" : `/bn${p}`) : p;
}

const en = {
  shop: "Shop", rings: "Rings", chains: "Chains", bracelets: "Bracelets", eyewear: "Eyewear",
  search: "Search", cart: "Cart", menu: "Menu", close: "Close",
  heroSub: "Premium stainless‑steel jewelry. Limited drops.",
  viewBestsellers: "View Bestsellers", bestsellers: "Bestsellers", limitedDrop: "Limited Stock", limitedSub: "When it's gone, it's gone.",
  shopBy: "Shop by category", onlyLeft: "Only {n} left", soldOut: "Sold out", addToCart: "Add to Cart", add: "Add",
  orderNow: "Order Now — Cash on Delivery", orderNowShort: "Order Now", quantity: "Quantity",
  trust1: "316L Stainless Steel", trust1s: "Won't rust or tarnish", trust2: "Cash on Delivery", trust2s: "Pay when it arrives",
  trust3: "24–72h Delivery", trust3s: "Nationwide", trust4: "7‑Day Easy Exchange", trust4s: "No questions",
  reviews: "Reviews", verifiedBuyer: "Verified buyer", basedOn: "Based on {n} reviews",
  joinDrop: "Join the drop list", joinDropSub: "First to know about new drops. 10% off your first order.", subscribe: "Join",
  phoneOrEmail: "Phone or email", subscribed: "You're on the list ✦",
  details: "Details & material", sizeGuide: "Size guide", deliveryPayment: "Delivery & payment", care: "Care", exchange: "Exchange policy",
  completeLook: "Complete the look", youMayLike: "You may also like",
  freeDeliveryAway: "You're {amt} away from free delivery inside Dhaka", freeDeliveryUnlocked: "Free delivery inside Dhaka unlocked ✦",
  subtotal: "Subtotal", discount: "Discount", delivery: "Delivery", total: "Total", checkout: "Checkout", emptyCart: "Your cart is empty.",
  continueShopping: "Continue shopping", remove: "Remove", discountCode: "Discount code", apply: "Apply", estDelivery: "Est. delivery",
  insideDhaka: "Inside Dhaka", outsideDhaka: "Outside Dhaka",
  contactDelivery: "Contact & delivery", fullName: "Full name", mobile: "Mobile number", emailOpt: "Email (optional)",
  address: "Full address", district: "District", area: "Area / Thana", note: "Order note (optional)",
  deliveryZone: "Delivery zone", payment: "Payment", cod: "Cash on Delivery", codSub: "Pay in cash when your order arrives",
  bkash: "bKash", nagad: "Nagad", card: "Card / Mobile / Net banking", cardSub: "Visa, Mastercard, Rocket, Upay via SSLCommerz",
  placeOrder: "Place Order", orderSummary: "Order summary", showSummary: "Show order summary", hideSummary: "Hide order summary",
  thankYou: "Order placed", thankYouSub: "Thank you! We'll call to confirm shortly.", orderNumber: "Order number",
  expectedDelivery: "Expected delivery", paymentStatus: "Payment status", trackOrder: "Track your order", whatsappUs: "Message us on WhatsApp",
  track: "Track order", trackSub: "Enter your order number and phone.", notFound: "Lost in orbit.", backHome: "Back to home",
  filters: "Filters", sort: "Sort", featured: "Featured", newest: "Newest", priceAsc: "Price ↑", priceDesc: "Price ↓", bestselling: "Bestselling",
  loadMore: "Load more", inStock: "In stock", price: "Price", finish: "Finish", category: "Category", all: "All", applyFilters: "Show results", clear: "Clear",
  account: "Account", signIn: "Sign in", sendCode: "Send code", verify: "Verify", orders: "Orders", reorder: "Reorder", signOut: "Sign out",
  noResults: "Nothing here yet.", searchPlaceholder: "Search rings, chains…",
};
type Dict = typeof en;
const bn: Dict = {
  shop: "শপ", rings: "রিং", chains: "চেইন", bracelets: "ব্রেসলেট", eyewear: "সানগ্লাস",
  search: "খুঁজুন", cart: "কার্ট", menu: "মেনু", close: "বন্ধ",
  heroSub: "প্রিমিয়াম স্টেইনলেস স্টিল জুয়েলারি। লিমিটেড ড্রপ।",
  viewBestsellers: "বেস্টসেলার দেখুন", bestsellers: "বেস্টসেলার", limitedDrop: "লিমিটেড স্টক", limitedSub: "শেষ হলে আর পাবেন না।",
  shopBy: "ক্যাটাগরি অনুযায়ী", onlyLeft: "মাত্র {n}টি বাকি", soldOut: "স্টক শেষ", addToCart: "কার্টে যোগ করুন", add: "যোগ",
  orderNow: "অর্ডার করুন — ক্যাশ অন ডেলিভারি", orderNowShort: "অর্ডার করুন", quantity: "পরিমাণ",
  trust1: "৩১৬এল স্টেইনলেস স্টিল", trust1s: "মরিচা ধরে না, রং যায় না", trust2: "ক্যাশ অন ডেলিভারি", trust2s: "পণ্য হাতে পেয়ে টাকা দিন",
  trust3: "২৪–৭২ ঘণ্টায় ডেলিভারি", trust3s: "সারা দেশে", trust4: "৭ দিনের এক্সচেঞ্জ", trust4s: "ঝামেলা ছাড়াই",
  reviews: "রিভিউ", verifiedBuyer: "ভেরিফাইড ক্রেতা", basedOn: "{n}টি রিভিউ",
  joinDrop: "ড্রপ লিস্টে যোগ দিন", joinDropSub: "নতুন ড্রপের খবর সবার আগে। প্রথম অর্ডারে ১০% ছাড়।", subscribe: "যোগ দিন",
  phoneOrEmail: "ফোন বা ইমেইল", subscribed: "আপনি লিস্টে আছেন ✦",
  details: "বিস্তারিত ও ম্যাটেরিয়াল", sizeGuide: "সাইজ গাইড", deliveryPayment: "ডেলিভারি ও পেমেন্ট", care: "যত্ন", exchange: "এক্সচেঞ্জ পলিসি",
  completeLook: "লুকটি সম্পূর্ণ করুন", youMayLike: "আরও দেখুন",
  freeDeliveryAway: "ঢাকার ভিতরে ফ্রি ডেলিভারির জন্য আর {amt}", freeDeliveryUnlocked: "ঢাকার ভিতরে ফ্রি ডেলিভারি ✦",
  subtotal: "সাবটোটাল", discount: "ছাড়", delivery: "ডেলিভারি", total: "মোট", checkout: "চেকআউট", emptyCart: "আপনার কার্ট খালি।",
  continueShopping: "শপিং চালিয়ে যান", remove: "সরান", discountCode: "ডিসকাউন্ট কোড", apply: "প্রয়োগ", estDelivery: "আনুমানিক ডেলিভারি",
  insideDhaka: "ঢাকার ভিতরে", outsideDhaka: "ঢাকার বাইরে",
  contactDelivery: "যোগাযোগ ও ঠিকানা", fullName: "পূর্ণ নাম", mobile: "মোবাইল নম্বর", emailOpt: "ইমেইল (ঐচ্ছিক)",
  address: "সম্পূর্ণ ঠিকানা", district: "জেলা", area: "এলাকা / থানা", note: "অর্ডার নোট (ঐচ্ছিক)",
  deliveryZone: "ডেলিভারি জোন", payment: "পেমেন্ট", cod: "ক্যাশ অন ডেলিভারি", codSub: "পণ্য হাতে পেয়ে নগদ টাকা দিন",
  bkash: "বিকাশ", nagad: "নগদ", card: "কার্ড / মোবাইল / নেট ব্যাংকিং", cardSub: "ভিসা, মাস্টারকার্ড, রকেট, উপায় — SSLCommerz",
  placeOrder: "অর্ডার নিশ্চিত করুন", orderSummary: "অর্ডার সারাংশ", showSummary: "সারাংশ দেখুন", hideSummary: "সারাংশ লুকান",
  thankYou: "অর্ডার সম্পন্ন", thankYouSub: "ধন্যবাদ! নিশ্চিত করতে আমরা শীঘ্রই কল করব।", orderNumber: "অর্ডার নম্বর",
  expectedDelivery: "আনুমানিক ডেলিভারি", paymentStatus: "পেমেন্ট স্ট্যাটাস", trackOrder: "অর্ডার ট্র্যাক করুন", whatsappUs: "হোয়াটসঅ্যাপে মেসেজ দিন",
  track: "অর্ডার ট্র্যাক", trackSub: "অর্ডার নম্বর ও ফোন নম্বর দিন।", notFound: "কক্ষপথে হারিয়ে গেছে।", backHome: "হোমে ফিরুন",
  filters: "ফিল্টার", sort: "সাজান", featured: "ফিচার্ড", newest: "নতুন", priceAsc: "দাম ↑", priceDesc: "দাম ↓", bestselling: "বেস্টসেলিং",
  loadMore: "আরও দেখুন", inStock: "স্টকে আছে", price: "দাম", finish: "ফিনিশ", category: "ক্যাটাগরি", all: "সব", applyFilters: "ফলাফল দেখুন", clear: "মুছুন",
  account: "অ্যাকাউন্ট", signIn: "সাইন ইন", sendCode: "কোড পাঠান", verify: "যাচাই", orders: "অর্ডার", reorder: "আবার অর্ডার", signOut: "সাইন আউট",
  noResults: "এখনো কিছু নেই।", searchPlaceholder: "রিং, চেইন খুঁজুন…",
};
const dicts = { en, bn };
export type TKey = keyof Dict;
export function getDict(locale: Locale) { return dicts[locale]; }
export function t(locale: Locale, key: TKey, vars?: Record<string, string | number>) {
  let s = dicts[locale][key] ?? en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}
export const CATEGORIES: { key: string; label: TKey; image: string }[] = [
  { key: "rings", label: "rings", image: "/products/clean/3.webp" },
  { key: "chains", label: "chains", image: "/products/clean/8.webp" },
  { key: "bracelets", label: "bracelets", image: "/products/clean/12.webp" },
  { key: "eyewear", label: "eyewear", image: "/products/clean/4.webp" },
];
