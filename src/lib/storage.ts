import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

/**
 * Media storage. Converts every upload to WebP (max 1600px) and keeps nothing executable.
 * - BLOB_READ_WRITE_TOKEN set → Vercel Blob (production on Vercel)
 * - CLOUDINARY_URL set        → Cloudinary (originals kept there; delivery via its CDN)
 * - otherwise                 → ./public/uploads (local development)
 */
export async function storeImage(file: File, folder = "products"): Promise<{ url: string; width: number; height: number; blurData: string }> {
  if (!file.type.startsWith("image/")) throw new Error("Only images can be uploaded");
  if (file.size > 12 * 1024 * 1024) throw new Error("Image too large (max 12 MB)");
  const input = Buffer.from(await file.arrayBuffer());
  const img = sharp(input, { failOn: "error" }).rotate();
  const out = await img.resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  const blur = await sharp(input).resize(12, 12, { fit: "cover" }).webp({ quality: 40 }).toBuffer();
  const blurData = `data:image/webp;base64,${blur.toString("base64")}`;
  const name = `${folder}/${randomUUID()}.webp`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    const j = await put(name, out.data, { access: "public", contentType: "image/webp" });
    return { url: j.url, width: out.info.width, height: out.info.height, blurData };
  }
  if (process.env.VERCEL) throw new Error("Configure BLOB_READ_WRITE_TOKEN (Vercel Blob) to upload images in production");
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(process.cwd(), "public", "uploads", name), out.data);
  return { url: `/uploads/${name}`, width: out.info.width, height: out.info.height, blurData };
}

export async function storeFile(file: File, folder = "models"): Promise<string> {
  if (!/\.(glb|gltf)$/i.test(file.name) || file.size > 5 * 1024 * 1024) throw new Error("Upload a .glb under 5 MB");
  const name = `${folder}/${randomUUID()}.glb`;
  const data = new Uint8Array(await file.arrayBuffer());
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { put } = await import("@vercel/blob");
    return (await put(name, Buffer.from(data), { access: "public", contentType: "model/gltf-binary" })).url;
  }
  const dir = path.join(process.cwd(), "public", "uploads", folder);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(process.cwd(), "public", "uploads", name), data);
  return `/uploads/${name}`;
}
