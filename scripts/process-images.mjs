// Converts the original 1000x1000 PNGs into optimised WebP + blur placeholders,
// and renders the favicon set, maskable PWA icon and OG image from the vector logo.
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const SRC = "assets/originals";
mkdirSync("public/products", { recursive: true });
mkdirSync("public/brand", { recursive: true });
const blur = {};
for (let i = 1; i <= 32; i++) {
  const src = `${SRC}/${i}.png`;
  if (!existsSync(src)) continue;
  await sharp(src).resize(1200, 1200, { fit: "cover" }).webp({ quality: 80 }).toFile(`public/products/${i}.webp`);
  const tiny = await sharp(src).resize(12, 12).webp({ quality: 40 }).toBuffer();
  blur[`/products/${i}.webp`] = `data:image/webp;base64,${tiny.toString("base64")}`;
}
writeFileSync("src/data/blur.json", JSON.stringify(blur, null, 1));

const mark = readFileSync("public/brand/logo-mark.svg", "utf8");
const flat = mark.replace(/fill="url\(#chrome\)"/, 'fill="#EEE9E6"');
const markBuf = Buffer.from(flat);
const onVoid = async (size, pad) => {
  const inner = Math.round(size * (1 - pad * 2));
  const m = await sharp(markBuf, { density: 600 }).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: "#0A0A0B" } })
    .composite([{ input: m, gravity: "center" }]).png().toBuffer();
};
for (const [name, size, pad] of [["icon-16.png", 16, 0.04], ["icon-32.png", 32, 0.06], ["apple-touch-icon.png", 180, 0.14], ["icon-512.png", 512, 0.12], ["icon-maskable-512.png", 512, 0.24]]) {
  writeFileSync(`public/brand/${name}`, await onVoid(size, pad));
}
writeFileSync("src/app/apple-icon.png", await onVoid(180, 0.14));
writeFileSync("src/app/icon.png", await onVoid(32, 0.06));

// OG image: logo on void with a crimson glow
const glow = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><defs><radialGradient id="g" cx=".5" cy=".55" r=".55"><stop offset="0" stop-color="#6E0414" stop-opacity=".85"/><stop offset=".6" stop-color="#41020B" stop-opacity=".35"/><stop offset="1" stop-color="#0A0A0B" stop-opacity="0"/></radialGradient></defs><rect width="1200" height="630" fill="#0A0A0B"/><rect width="1200" height="630" fill="url(#g)"/><text x="600" y="560" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" letter-spacing="22" fill="#EEE9E6">ARGON</text></svg>`);
const ogMark = await sharp(Buffer.from(mark), { density: 600 }).resize(400, 360, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await sharp(glow).composite([{ input: ogMark, top: 90, left: 400 }]).png().toFile("public/brand/og.png");
console.log("images done:", Object.keys(blur).length);
