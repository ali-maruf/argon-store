import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ARGON", short_name: "ARGON", description: "Premium stainless‑steel jewelry. Limited drops.",
    start_url: "/", display: "standalone", background_color: "#0A0A0B", theme_color: "#0A0A0B",
    icons: [
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
