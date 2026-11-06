"use client";
import dynamic from "next/dynamic";

// Keeps three.js out of the initial bundle: the chunk is requested only after hydration + idle.
const Hero3D = dynamic(() => import("./Hero3D").then((m) => m.Hero3D), { ssr: false });
export function HeroLoader() { return <Hero3D />; }
