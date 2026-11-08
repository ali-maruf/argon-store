/* Seeds the ARGON catalog (section 12), shipping zones, CMS, templates, roles and the owner account.
   Safe to re-run: everything is upserted by a stable key. Never seeds reviews. */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";

const db = new PrismaClient();
const blur = JSON.parse(readFileSync("src/data/blur.json", "utf8")) as Record<string, string>;

type Opt = { name: string; values: string[] };
type Seed = { sku: string; title: string; titleBn: string; slug: string; category: string; price: number | null; img: number; alt?: number[]; options: Opt[]; mood: string; moodBn: string; badges?: string[]; tags?: string[] };

const SIZES: Opt = { name: "Size", values: ["8", "9", "10", "11"] };
const ADJ: Opt = { name: "Size", values: ["Adjustable"] };
const L2022: Opt = { name: "Length", values: ['20"', '22"'] };
const BRACE: Opt = { name: "Length", values: ["19 cm", "21 cm"] };
const ONE: Opt = { name: "Size", values: ["One size"] };

const P: Seed[] = [
  // Rings
  { sku: "ARG-R01", title: "Dark Crown Ring", titleBn: "ডার্ক ক্রাউন রিং", slug: "dark-crown-ring", category: "rings", price: 550, img: 2, options: [SIZES], mood: "A tall, spiked crown for the ones who don't ask permission.", moodBn: "যারা অনুমতি চায় না, তাদের জন্য উঁচু কাঁটার মুকুট।", tags: ["finish:silver"] },
  { sku: "ARG-R02", title: "Fang Ring", titleBn: "ফ্যাং রিং", slug: "fang-ring", category: "rings", price: 299, img: 3, options: [ADJ], mood: "Vampire teeth, polished to a mirror. Bite back.", moodBn: "আয়নার মতো পালিশ করা ভ্যাম্পায়ার দাঁত।", badges: ["BESTSELLER"], tags: ["bestseller", "y2k", "finish:silver"] },
  { sku: "ARG-R03", title: "Cuban Link Ring", titleBn: "কিউবান লিংক রিং", slug: "cuban-link-ring", category: "rings", price: 399, img: 17, options: [ADJ], mood: "A chunky curb link, wrapped around your finger.", moodBn: "আঙুলে জড়ানো মোটা কার্ব লিংক।", tags: ["finish:silver"] },
  { sku: "ARG-R04", title: "Shield Signet Ring", titleBn: "শিল্ড সিগনেট রিং", slug: "shield-signet-ring", category: "rings", price: 399, img: 18, options: [SIZES], mood: "A gold‑tone cross on a steel shield. Quiet armour.", moodBn: "স্টিলের ঢালে সোনালি ক্রস। নিঃশব্দ বর্ম।", tags: ["finish:two-tone"] },
  { sku: "ARG-R05", title: "Vine Engraved Band", titleBn: "ভাইন এনগ্রেভড ব্যান্ড", slug: "vine-engraved-band", category: "rings", price: 549, img: 20, options: [ADJ], mood: "Hand‑cut vines that never stop growing.", moodBn: "হাতে খোদাই করা লতা, যা কখনো থামে না।", tags: ["finish:silver"] },
  { sku: "ARG-R06", title: "Shard Ring", titleBn: "শার্ড রিং", slug: "shard-ring", category: "rings", price: 499, img: 21, options: [ADJ], mood: "Faceted geometry that catches every light.", moodBn: "প্রতিটি আলো ধরে রাখে এমন জ্যামিতিক কাট।", tags: ["finish:silver"] },
  { sku: "ARG-R07", title: "Jaw Ring", titleBn: "জ রিং", slug: "jaw-ring", category: "rings", price: 499, img: 25, options: [SIZES], mood: "Oxidized teeth on a wide band. Not for the timid.", moodBn: "চওড়া ব্যান্ডে অক্সিডাইজড দাঁত।", tags: ["finish:black"] },
  { sku: "ARG-R08", title: "Fleur Filigree Ring", titleBn: "ফ্লর ফিলিগ্রি রিং", slug: "fleur-filigree-ring", category: "rings", price: null, img: 27, options: [ADJ], mood: "Open filigree with an old‑world bloom.", moodBn: "পুরোনো দিনের ফুলেল ফিলিগ্রি।", tags: ["finish:silver"] },
  // Chains & pendants
  { sku: "ARG-C01", title: "Gothic Script Necklace", titleBn: "গথিক স্ক্রিপ্ট নেকলেস", slug: "gothic-script-necklace", category: "chains", price: 249, img: 5, options: [L2022], mood: "Your name in metal‑font. Loud, without saying a word.", moodBn: "মেটাল ফন্টে আপনার নাম।", tags: ["finish:silver"] },
  { sku: "ARG-C02", title: "Spider Emblem Pendant", titleBn: "স্পাইডার এমব্লেম পেনড্যান্ট", slug: "spider-emblem-pendant", category: "chains", price: 299, img: 6, options: [L2022], mood: "An eight‑legged emblem that sits right over the heart.", moodBn: "বুকের ঠিক উপরে আট পায়ের প্রতীক।", tags: ["finish:silver"] },
  { sku: "ARG-C03", title: "Starlight Pendant", titleBn: "স্টারলাইট পেনড্যান্ট", slug: "starlight-pendant", category: "chains", price: 349, img: 7, options: [{ name: "Style", values: ["North Star ✦", "Triple Star"] }], mood: "A piece of the night sky, forged in steel.", moodBn: "ইস্পাতে গড়া রাতের আকাশের একটুকরো।", tags: ["y2k", "finish:silver"] },
  { sku: "ARG-C04", title: "Gem Spider Pendant", titleBn: "জেম স্পাইডার পেনড্যান্ট", slug: "gem-spider-pendant", category: "chains", price: 349, img: 8, options: [{ name: "Colour", values: ["Ruby", "Onyx"] }], mood: "A jewelled spider with a dark heart.", moodBn: "অন্ধকার হৃদয়ের রত্নখচিত মাকড়সা।", badges: ["BESTSELLER"], tags: ["bestseller", "y2k"] },
  { sku: "ARG-C05", title: "Box Chain", titleBn: "বক্স চেইন", slug: "box-chain", category: "chains", price: 349, img: 13, options: [{ name: "Thickness", values: ["2.0 mm", "2.5 mm", "3.0 mm", "3.5 mm"] }, { name: "Length", values: ['20"', '22"', '24"'] }], mood: "The everyday chain. Clean, square, unbreakable.", moodBn: "প্রতিদিনের চেইন। পরিষ্কার, চৌকো, অটুট।", tags: ["finish:silver"] },
  { sku: "ARG-C06", title: "Herringbone Chain", titleBn: "হেরিংবোন চেইন", slug: "herringbone-chain", category: "chains", price: 349, img: 14, options: [{ name: "Length", values: ['18"', '20"', '22"'] }], mood: "Flat, liquid shine that lies perfectly on the collarbone.", moodBn: "কলারবোনে নিখুঁতভাবে বসে থাকা তরল ঝলক।", tags: ["finish:silver"] },
  { sku: "ARG-C07", title: "Snake Chain", titleBn: "স্নেক চেইন", slug: "snake-chain", category: "chains", price: null, img: 32, options: [{ name: "Length", values: ['20"', '22"', '24"'] }], mood: "Smooth, round and serpentine.", moodBn: "মসৃণ, গোলাকার, সর্পিল।", tags: ["finish:silver"] },
  // Bracelets
  { sku: "ARG-B01", title: "Braided Leather Bracelet", titleBn: "ব্রেইডেড লেদার ব্রেসলেট", slug: "braided-leather-bracelet", category: "bracelets", price: 549, img: 9, alt: [31], options: [{ name: "Wrist", values: ["S", "M", "L"] }], mood: "Black braided leather with a steel magnetic clasp.", moodBn: "স্টিল ম্যাগনেটিক ক্ল্যাস্পসহ কালো লেদার।", tags: ["finish:black"] },
  { sku: "ARG-B02", title: "Fine Foxtail Bracelet", titleBn: "ফাইন ফক্সটেইল ব্রেসলেট", slug: "fine-foxtail-bracelet", category: "bracelets", price: 499, img: 10, alt: [30], options: [BRACE], mood: "Fine foxtail links with a fluid drape.", moodBn: "সূক্ষ্ম ফক্সটেইল লিংক।", tags: ["finish:silver"] },
  { sku: "ARG-B03", title: "Wheat Rope Bracelet", titleBn: "হুইট রোপ ব্রেসলেট", slug: "wheat-rope-bracelet", category: "bracelets", price: 499, img: 11, options: [BRACE], mood: "Woven like wheat, built like rope.", moodBn: "গমের মতো বোনা, দড়ির মতো মজবুত।", tags: ["finish:silver"] },
  { sku: "ARG-B04", title: "Double Franco Bracelet", titleBn: "ডাবল ফ্রাঙ্কো ব্রেসলেট", slug: "double-franco-bracelet", category: "bracelets", price: 699, img: 12, alt: [29, 28], options: [BRACE], mood: "Heavy silver franco links with a box clasp. Pure weight.", moodBn: "বক্স ক্ল্যাস্পসহ ভারী ফ্রাঙ্কো লিংক।", badges: ["BESTSELLER"], tags: ["bestseller", "finish:silver"] },
  { sku: "ARG-B05", title: "Oxidized Curb Bracelet", titleBn: "অক্সিডাইজড কার্ব ব্রেসলেট", slug: "oxidized-curb-bracelet", category: "bracelets", price: 799, img: 15, options: [BRACE], mood: "Two‑tone curb links, darkened by hand.", moodBn: "হাতে কালো করা টু‑টোন কার্ব লিংক।", tags: ["finish:two-tone"] },
  { sku: "ARG-B06", title: "Mesh Cuff", titleBn: "মেশ কাফ", slug: "mesh-cuff", category: "bracelets", price: 699, img: 16, options: [{ name: "Colour", values: ["Silver", "Black"] }], mood: "Woven steel mesh that moves like fabric.", moodBn: "কাপড়ের মতো নড়ে এমন স্টিল মেশ।", tags: ["y2k"] },
  { sku: "ARG-B07", title: "Byzantine Bracelet", titleBn: "বাইজেন্টাইন ব্রেসলেট", slug: "byzantine-bracelet", category: "bracelets", price: 799, img: 19, options: [BRACE], mood: "An ancient weave, cut in modern steel.", moodBn: "আধুনিক স্টিলে প্রাচীন বুনন।", tags: ["finish:silver"] },
  { sku: "ARG-B08", title: "Stone & Steel Double Bracelet", titleBn: "স্টোন অ্যান্ড স্টিল ডাবল ব্রেসলেট", slug: "stone-steel-double-bracelet", category: "bracelets", price: 549, img: 22, options: [ONE], mood: "Jasper, onyx and a steel chain, locked with a toggle clasp.", moodBn: "জ্যাসপার, অনিক্স ও স্টিল চেইন, টগল ক্ল্যাস্পে।", tags: ["finish:two-tone"] },
  { sku: "ARG-B09", title: "Serpent Head Bracelet", titleBn: "সার্পেন্ট হেড ব্রেসলেট", slug: "serpent-head-bracelet", category: "bracelets", price: 799, img: 23, options: [ONE], mood: "Braided steel, twin serpent heads. They never let go.", moodBn: "বিনুনি করা স্টিল, জোড়া সাপের মাথা।", tags: ["finish:silver"] },
  { sku: "ARG-B10", title: "Black Double Franco Bracelet", titleBn: "ব্ল্যাক ডাবল ফ্রাঙ্কো ব্রেসলেট", slug: "black-double-franco-bracelet", category: "bracelets", price: 799, img: 26, options: [BRACE], mood: "The Double Franco, blacked out.", moodBn: "কালো রঙের ডাবল ফ্রাঙ্কো।", tags: ["finish:black"] },
  // Eyewear
  { sku: "ARG-E01", title: "Chrome Wrap Sunglasses", titleBn: "ক্রোম র‍্যাপ সানগ্লাস", slug: "chrome-wrap-sunglasses", category: "eyewear", price: 349, img: 4, options: [ONE], mood: "Y2K shield lenses. The future, as seen in 2001.", moodBn: "Y2K শিল্ড লেন্স।", badges: ["BESTSELLER"], tags: ["bestseller", "y2k"] },
  { sku: "ARG-E02", title: "Rimless Ornate Glasses", titleBn: "রিমলেস অর্নেট গ্লাস", slug: "rimless-ornate-glasses", category: "eyewear", price: 799, img: 24, options: [ONE], mood: "Rimless lenses with ornate metal temples.", moodBn: "নকশা করা মেটাল টেম্পলসহ রিমলেস লেন্স।" },
];

function copy(p: Seed) {
  const en = `<p>${p.mood}</p><p><strong>Material:</strong> 316L stainless steel — won't rust, fade or turn your skin green.</p><p><strong>Care:</strong> Wipe with a soft cloth; avoid harsh chemicals.</p><p>Ships in 24h · COD available.</p>`;
  const bn = `<p>${p.moodBn}</p><p><strong>ম্যাটেরিয়াল:</strong> ৩১৬এল স্টেইনলেস স্টিল — মরিচা ধরে না, রং যায় না, ত্বক সবুজ হয় না।</p><p><strong>যত্ন:</strong> নরম কাপড়ে মুছুন; কড়া কেমিক্যাল এড়িয়ে চলুন।</p><p>২৪ ঘণ্টায় শিপিং · ক্যাশ অন ডেলিভারি।</p>`;
  return { en, bn };
}
function combos(opts: Opt[]): Record<string, string>[] {
  return opts.reduce<Record<string, string>[]>((acc, o) => acc.flatMap((a) => o.values.map((v) => ({ ...a, [o.name]: v }))), [{}]);
}
const skuPart = (v: string) => v.replace(/[^0-9A-Za-z.]/g, "").replace(/mm$/, "").toUpperCase() || "X";
// Deterministic launch stock — the owner sets real counts in Admin → Inventory.
const stockFor = (i: number, j: number) => [12, 8, 15, 6, 3, 10, 9, 4, 14, 7][(i * 3 + j) % 10];

async function main() {
  console.log("Seeding ARGON…");
  // Roles + owner
  const ROLES: Record<string, string[]> = {
    Owner: ["orders.view", "orders.edit", "orders.create", "orders.export", "products.view", "products.edit", "inventory.edit", "collections.edit", "customers.view", "customers.edit", "discounts.edit", "content.edit", "reviews.edit", "shipping.edit", "payments.edit", "notifications.edit", "reports.view", "marketing.edit", "staff.manage", "settings.edit", "audit.view"],
  };
  ROLES.Admin = ROLES.Owner.filter((p) => p !== "staff.manage");
  ROLES["Order Manager"] = ["orders.view", "orders.edit", "orders.create", "orders.export", "customers.view", "customers.edit", "products.view"];
  ROLES["Inventory Manager"] = ["products.view", "products.edit", "inventory.edit", "collections.edit", "orders.view"];
  ROLES["Content Editor"] = ["content.edit", "reviews.edit", "products.view", "collections.edit"];
  ROLES.Viewer = ["orders.view", "products.view", "customers.view", "reports.view"];
  for (const [name, permissions] of Object.entries(ROLES)) await db.role.upsert({ where: { name }, create: { name, permissions }, update: { permissions } });
  const owner = await db.role.findUniqueOrThrow({ where: { name: "Owner" } });
  const email = (process.env.OWNER_EMAIL ?? "owner@argon.local").toLowerCase();
  if (!(await db.adminUser.findUnique({ where: { email } }))) {
    const pw = process.env.OWNER_PASSWORD;
    if (!pw || pw.length < 10) throw new Error("Set OWNER_PASSWORD (10+ chars) before seeding");
    await db.adminUser.create({ data: { email, name: "Owner", passwordHash: await bcrypt.hash(pw, 12), roleId: owner.id } });
    console.log(`Owner account created: ${email} (2FA setup is required on first login)`);
  }

  // Products
  for (const [i, p] of P.entries()) {
    const { en, bn } = copy(p);
    const draft = p.price == null;
    const badges = ["LIMITED STOCK", ...(p.badges ?? [])];
    const data = {
      title: p.title, titleBn: p.titleBn, description: en, descriptionBn: bn, category: p.category, tags: p.tags ?? [], badges,
      status: (draft ? "draft" : "active") as "draft" | "active", featured: !!p.badges?.includes("BESTSELLER"), sortOrder: i,
      seoTitle: `${p.title} — Stainless Steel | ARGON`, seoDescription: `${p.mood} 316L stainless steel. Cash on Delivery across Bangladesh.`,
    };
    const prod = await db.product.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...data }, update: data });
    await db.productImage.deleteMany({ where: { productId: prod.id } });
    // Clean product shot first, then the wide editorial crop (the hover image on cards), then clean alternates.
    const imgs = [`/products/clean/${p.img}.webp`, `/editorial/${p.img}.webp`, ...(p.alt ?? []).map((n) => `/products/clean/${n}.webp`)];
    await db.productImage.createMany({ data: imgs.map((url, k) => ({ productId: prod.id, url, alt: `${p.title}${k ? ` — view ${k + 1}` : ""}`, position: k, blurData: blur[url] ?? null, width: url.startsWith("/editorial") ? 1600 : 1000, height: url.startsWith("/editorial") ? 900 : 1000 })) });
    await db.productOption.deleteMany({ where: { productId: prod.id } });
    const realOpts = p.options.filter((o) => !(o.values.length === 1 && ["One size"].includes(o.values[0])));
    await db.productOption.createMany({ data: realOpts.map((o, k) => ({ productId: prod.id, name: o.name, values: o.values, position: k })) });
    const cs = realOpts.length ? combos(realOpts) : [{}];
    for (const [j, c] of cs.entries()) {
      const vals = Object.values(c);
      const sku = vals.length ? `${p.sku}-${vals.map(skuPart).join("-")}` : p.sku;
      const title = vals.length ? vals.join(" / ") : "Default";
      await db.productVariant.upsert({
        where: { sku },
        create: { productId: prod.id, sku, title, optionValues: c as Prisma.InputJsonValue, price: p.price ?? 0, stock: draft ? 0 : stockFor(i, j), position: j, lowStockThreshold: 3, weightGrams: p.category === "eyewear" ? 60 : 40 },
        update: { productId: prod.id, title, optionValues: c as Prisma.InputJsonValue, price: p.price ?? 0, position: j },
      });
    }
  }
  console.log(`Products: ${P.length}`);

  // Collections
  const bySlug = async (slugs: string[]) => (await db.product.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true } })).sort((a, b) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug));
  const y2k = await db.collection.upsert({ where: { slug: "y2k-edit" }, create: { slug: "y2k-edit", title: "Y2K Edit", titleBn: "Y2K এডিট", description: "Chrome, shields and stars. The millennium, re‑forged." }, update: {} });
  await db.collectionProduct.deleteMany({ where: { collectionId: y2k.id } });
  for (const [k, p] of (await bySlug(["chrome-wrap-sunglasses", "starlight-pendant", "gem-spider-pendant", "fang-ring", "mesh-cuff"])).entries())
    await db.collectionProduct.create({ data: { collectionId: y2k.id, productId: p.id, position: k } });
  await db.collection.upsert({ where: { slug: "bestsellers" }, create: { slug: "bestsellers", title: "Bestsellers", titleBn: "বেস্টসেলার", type: "automated", rules: [{ field: "tag", value: "bestseller" }] }, update: {} });

  // Shipping zones
  const zones = [
    { key: "inside_dhaka", name: "Inside Dhaka", nameBn: "ঢাকার ভিতরে", districts: ["Dhaka"], areas: [], rate: 70, eta: "1–2 days", position: 0, courier: "steadfast" },
    { key: "sub_dhaka", name: "Dhaka sub‑area", nameBn: "ঢাকা সাব‑এরিয়া", districts: ["Gazipur", "Narayanganj"], areas: ["Savar", "Ashulia", "Keraniganj", "Dhamrai", "Dohar", "Nawabganj"], rate: 100, eta: "2–3 days", position: 1, courier: "steadfast" },
    { key: "outside_dhaka", name: "Outside Dhaka", nameBn: "ঢাকার বাইরে", districts: [], areas: [], rate: 130, eta: "2–4 days", position: 2, courier: "steadfast" },
  ];
  for (const z of zones) await db.shippingZone.upsert({ where: { key: z.key }, create: z, update: {} });

  // Discounts (no fake urgency: these are real, owner-editable offers)
  const discounts = [
    { code: "ORBIT10", title: "10% off your first order", type: "percent" as const, value: 10, perCustomerLimit: 1 },
    { code: "COMEBACK10", title: "Come back: 10% off", type: "percent" as const, value: 10, perCustomerLimit: 1 },
    { code: "FREESHIP", title: "Free delivery", type: "free_shipping" as const, value: 0, minOrder: 999, active: false },
  ];
  for (const d of discounts) await db.discount.upsert({ where: { code: d.code }, create: d, update: {} });
  if (!(await db.discount.findFirst({ where: { title: "Any 2 rings for ৳699" } })))
    await db.discount.create({ data: { title: "Any 2 rings for ৳699", automatic: true, type: "bundle", bundleQty: 2, bundlePrice: 699, appliesTo: { categories: ["rings"] } } });

  // Home sections
  const sections = ["hero", "marquee", "categories", "bestsellers", "story", "lookbook", "limited", "mosaic", "reviews", "ugc"];
  // Replace legacy section types from the first design; keep admin ordering otherwise.
  await db.homeSection.deleteMany({ where: { type: { in: ["trust", "newsletter"] } } });
  for (const [position, type] of sections.entries()) if (!(await db.homeSection.findFirst({ where: { type } }))) await db.homeSection.create({ data: { type, position, enabled: true } });

  // Pages
  const pages: { slug: string; title: string; titleBn: string; body: string }[] = [
    { slug: "about", title: "About ARGON", titleBn: "আরগন সম্পর্কে", body: "<p>ARGON is a Bangladeshi label making premium stainless‑steel jewelry and eyewear in small, limited drops. Every piece is 316L steel: it won't rust, fade or turn your skin green.</p><p>We started on Instagram as <a href=\"https://instagram.com/argon.go_\">@argon.go_</a>. Forged in steel. Built to last.</p>" },
    { slug: "contact", title: "Contact", titleBn: "যোগাযোগ", body: "<p>WhatsApp and phone: 01700000000<br>Email: hello@argon.com.bd<br>Instagram: @argon.go_</p><p>We reply 10am–10pm, every day.</p>" },
    { slug: "faq", title: "FAQ", titleBn: "প্রশ্নোত্তর", body: "<h3>Will it rust or turn my skin green?</h3><p>No. Everything is 316L stainless steel.</p><h3>Can I pay cash on delivery?</h3><p>Yes, anywhere in Bangladesh.</p><h3>How long does delivery take?</h3><p>1–2 days inside Dhaka, 2–4 days outside Dhaka.</p><h3>Can I exchange?</h3><p>Yes, within 7 days of delivery if the item is unused.</p>" },
    { slug: "shipping-policy", title: "Shipping Policy", titleBn: "শিপিং পলিসি", body: "<p>Inside Dhaka ৳70 (1–2 days). Dhaka sub‑areas ৳100 (2–3 days). Outside Dhaka ৳130 (2–4 days). Free delivery inside Dhaka on orders over ৳1,500.</p><p>Orders placed before 6pm ship the same day.</p>" },
    { slug: "return-exchange-policy", title: "Return & Exchange Policy", titleBn: "রিটার্ন ও এক্সচেঞ্জ পলিসি", body: "<p>Exchange any unused item within 7 days of delivery. Message us on WhatsApp with your order number. If the item arrives damaged or wrong, we cover delivery both ways.</p>" },
    { slug: "privacy-policy", title: "Privacy Policy", titleBn: "প্রাইভেসি পলিসি", body: "<p>We collect your name, phone, address and email only to deliver your order and, if you agree, to tell you about new drops. We never sell your data. Payments are processed by bKash, Nagad and SSLCommerz; we never see your card details.</p>" },
    { slug: "terms", title: "Terms of Service", titleBn: "শর্তাবলি", body: "<p>Prices are in BDT and may change without notice. Orders are confirmed by phone call. We may cancel orders that cannot be verified.</p>" },
  ];
  for (const pg of pages) await db.page.upsert({ where: { slug: pg.slug }, create: pg, update: {} });

  // Notification templates (EN/BN)
  const T: [string, string, string, string?][] = [
    ["order_placed", "en", "Hi {{name}}, your ARGON order {{order_number}} ({{total}}) is placed. We'll call to confirm. Track: {{tracking_link}}", "Order {{order_number}} placed"],
    ["order_placed", "bn", "প্রিয় {{name}}, আপনার ARGON অর্ডার {{order_number}} ({{total}}) গ্রহণ করা হয়েছে। নিশ্চিত করতে কল করব। ট্র্যাক: {{tracking_link}}"],
    ["order_confirmed", "en", "{{name}}, your order {{order_number}} is confirmed and being packed ✦"],
    ["order_confirmed", "bn", "{{name}}, আপনার অর্ডার {{order_number}} নিশ্চিত হয়েছে ✦"],
    ["order_shipped", "en", "{{name}}, order {{order_number}} is on the way. Track: {{tracking_link}}", "Your ARGON order has shipped"],
    ["order_shipped", "bn", "{{name}}, অর্ডার {{order_number}} পাঠানো হয়েছে। ট্র্যাক: {{tracking_link}}"],
    ["order_delivered", "en", "Delivered ✦ Thanks for wearing the orbit, {{name}}. Tag us @argon.go_"],
    ["order_delivered", "bn", "ডেলিভারি সম্পন্ন ✦ ধন্যবাদ {{name}}। আমাদের ট্যাগ করুন @argon.go_"],
    ["order_cancelled", "en", "{{name}}, your order {{order_number}} was cancelled. Questions? WhatsApp us."],
    ["order_cancelled", "bn", "{{name}}, আপনার অর্ডার {{order_number}} বাতিল হয়েছে।"],
    ["abandoned_1", "en", "{{name}}, you left something in your ARGON cart. Finish your order (COD available): {{link}}"],
    ["abandoned_1", "bn", "{{name}}, আপনার ARGON কার্টে পণ্য রয়ে গেছে। অর্ডার শেষ করুন: {{link}}"],
    ["abandoned_2", "en", "Still thinking? Use {{code}} for 10% off your ARGON order today: {{link}}"],
    ["abandoned_2", "bn", "এখনো ভাবছেন? আজ {{code}} কোডে ১০% ছাড়: {{link}}"],
    ["review_request", "en", "{{name}}, how's your ARGON piece? Leave a review (photos welcome): {{link}}"],
    ["review_request", "bn", "{{name}}, আপনার ARGON পণ্য কেমন লাগছে? রিভিউ দিন: {{link}}"],
    ["otp", "en", "Your ARGON code is {{code}}. It expires in 5 minutes."],
    ["otp", "bn", "আপনার ARGON কোড {{code}}। ৫ মিনিটে মেয়াদ শেষ।"],
  ];
  for (const [key, locale, body, subject] of T) await db.notificationTemplate.upsert({ where: { key_channel_locale: { key, channel: "sms", locale } }, create: { key, channel: "sms", locale, body }, update: {} });
  for (const [key, locale, body, subject] of T.filter((t) => t[3])) await db.notificationTemplate.upsert({ where: { key_channel_locale: { key, channel: "email", locale } }, create: { key, channel: "email", locale, body, subject }, update: {} });

  await db.counter.upsert({ where: { key: "order" }, create: { key: "order", value: 10000 }, update: {} });
  console.log("Seed complete ✦");
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => db.$disconnect());
