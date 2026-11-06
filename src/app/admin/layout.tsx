import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "../globals.css";
import "./admin.css";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
export const metadata: Metadata = { title: { default: "ARGON Admin", template: "%s · ARGON Admin" }, robots: { index: false, follow: false } };

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" className={grotesk.variable} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("argon_admin_theme");if(t)document.documentElement.dataset.theme=t}catch(e){}` }} /></head>
      <body className="admin min-h-dvh">{children}</body>
    </html>
  );
}
