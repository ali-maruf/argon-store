// Cuts "clean" product shots and wide editorial crops out of the flyer-style originals
// (the baked-in text sits around the edges), then renders the looping hero videos with ffmpeg.
// Run: npm i --no-save ffmpeg-static && node scripts/editorial.mjs
import sharp from "sharp";
// Needs ffmpeg: `npm i --no-save ffmpeg-static` before running this script.
const ffmpeg = (await import("ffmpeg-static")).default;
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const SRC = "assets/originals";
mkdirSync("public/products/clean", { recursive: true });
mkdirSync("public/editorial", { recursive: true });
mkdirSync("public/video", { recursive: true });

// Per-image square crop (left, top, size) inside the 1000×1000 original. Default avoids title, price and side labels.
const DEF = { left: 188, top: 182, size: 598 };
const SQ = {
  2: { left: 160, top: 190, size: 610 }, 4: { left: 175, top: 195, size: 590 }, 13: { left: 140, top: 160, size: 600 },
  24: { left: 170, top: 195, size: 600 }, 28: { left: 195, top: 190, size: 595 }, 29: { left: 195, top: 195, size: 595 }, 32: { left: 170, top: 180, size: 610 },
};
// Wide 16:9 crops for editorial banners and the video.
const WIDE = { left: 0, top: 290, width: 780, height: 439 };
const WIDE_OVR = {
  2: { left: 40, top: 300, width: 720, height: 405 }, 4: { left: 60, top: 260, width: 760, height: 428 }, 13: { left: 0, top: 330, width: 720, height: 405 },
  28: { left: 175, top: 290, width: 780, height: 439 }, 29: { left: 175, top: 290, width: 780, height: 439 }, 30: { left: 175, top: 290, width: 780, height: 439 },
};

const blur = JSON.parse(readFileSync("src/data/blur.json", "utf8"));
for (let i = 2; i <= 32; i++) {
  const src = `${SRC}/${i}.png`;
  if (!existsSync(src)) continue;
  const c = SQ[i] ?? DEF;
  const sq = sharp(src).extract({ left: c.left, top: c.top, width: c.size, height: c.size }).resize(1000, 1000, { kernel: "lanczos3" }).sharpen({ sigma: 0.6 });
  await sq.clone().webp({ quality: 82 }).toFile(`public/products/clean/${i}.webp`);
  const tiny = await sharp(src).extract({ left: c.left, top: c.top, width: c.size, height: c.size }).resize(12, 12).webp({ quality: 40 }).toBuffer();
  blur[`/products/clean/${i}.webp`] = `data:image/webp;base64,${tiny.toString("base64")}`;
  const w = WIDE_OVR[i] ?? WIDE;
  await sharp(src).extract(w).resize(1600, 900, { kernel: "lanczos3" }).sharpen({ sigma: 0.6 }).webp({ quality: 80 }).toFile(`public/editorial/${i}.webp`);
}
writeFileSync("src/data/blur.json", JSON.stringify(blur, null, 1));
console.log("crops done");

// ---------- Hero video: slow push-ins on wide crops with crossfades, seamless loop ----------
const run = (args) => execFileSync(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });
const tmp = path.join(tmpdir(), "argon-video"); rmSync(tmp, { recursive: true, force: true }); mkdirSync(tmp, { recursive: true });

async function reel(name, frames, W, H, kind) {
  const SEG = 3.2, FADE = 0.8, FPS = 30;
  const clips = [];
  for (const [k, n] of frames.entries()) {
    const img = path.join(tmp, `${name}-${k}.png`);
    if (kind === "wide") await sharp(`public/editorial/${n}.webp`).resize(W * 2, H * 2).png().toFile(img);
    else await sharp(`public/products/clean/${n}.webp`).resize(H * 2, H * 2).extract({ left: Math.round(H - W), top: 0, width: W * 2, height: H * 2 }).png().toFile(img);
    const out = path.join(tmp, `${name}-${k}.mp4`);
    const d = Math.round(SEG * FPS);
    // Alternate zoom-in / zoom-out with a gentle drift for a "camera push" feel.
    const z = k % 2 === 0 ? `min(1+0.10*on/${d},1.10)` : `max(1.10-0.10*on/${d},1.0)`;
    run(["-loop", "1", "-i", img, "-vf", `zoompan=z='${z}':x='iw/2-(iw/zoom/2)+(${k % 2 ? 1 : -1})*on*0.4':y='ih/2-(ih/zoom/2)':d=${d}:s=${W}x${H}:fps=${FPS},eq=contrast=1.06:saturation=1.05,format=yuv420p`, "-t", String(SEG), "-an", out]);
    clips.push(out);
  }
  // Crossfade chain, then append the first clip again so the loop point matches.
  const inputs = [...clips, clips[0]].flatMap((c) => ["-i", c]);
  let filter = ""; let last = "[0:v]";
  for (let k = 1; k < clips.length + 1; k++) {
    const off = (SEG - FADE) * k;
    filter += `${last}[${k}:v]xfade=transition=fade:duration=${FADE}:offset=${off.toFixed(2)}[v${k}];`;
    last = `[v${k}]`;
  }
  const total = (SEG - FADE) * clips.length;
  const mp4 = `public/video/${name}.mp4`, webm = `public/video/${name}.webm`;
  run([...inputs, "-filter_complex", filter.slice(0, -1), "-map", last, "-t", total.toFixed(2), "-c:v", "libx264", "-preset", "slow", "-crf", "28", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", mp4]);
  run(["-i", mp4, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "40", "-row-mt", "1", "-an", webm]);
  await sharp(clips.length ? path.join(tmp, `${name}-0.png`) : "").resize(W, H).webp({ quality: 70 }).toFile(`public/video/${name}-poster.webp`);
  console.log(name, "done");
}

await reel("hero", [12, 3, 7, 4, 19, 8], 1280, 720, "wide");
await reel("hero-mobile", [3, 12, 8, 4, 19, 7], 540, 960, "square");
await reel("lookbook", [29, 31, 28, 30], 1280, 720, "wide");
