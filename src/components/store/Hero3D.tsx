"use client";
import { useEffect, useRef, useState } from "react";

/**
 * The one real 3D moment: a chrome extruded "A" with a spinning orbit ring.
 * three.js is code-split and only fetched after idle, on capable devices, with motion allowed
 * and a non-2G connection. Otherwise the static SVG poster (rendered by the parent) stays.
 */
export function Hero3D() {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (nav.connection?.saveData || /2g/.test(nav.connection?.effectiveType ?? "")) return;
    if ((nav.deviceMemory ?? 4) < 2) return;
    const c = document.createElement("canvas");
    if (!(c.getContext("webgl2") || c.getContext("webgl"))) return;

    let dispose = () => {};
    let cancelled = false;
    const start = async () => {
      const THREE = await import("three");
      const { RoomEnvironment } = await import("three/examples/jsm/environments/RoomEnvironment.js");
      if (cancelled || !host.current) return;
      const el = host.current;
      const w = el.clientWidth, h = el.clientHeight;
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
      renderer.setSize(w, h);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      el.appendChild(renderer.domElement);
      const scene = new THREE.Scene();
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 100);
      camera.position.set(0, 0, 9);

      const chrome = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 });
      const crimsonLight = new THREE.PointLight(0x6e0414, 40, 20); crimsonLight.position.set(-3, -2, 3); scene.add(crimsonLight);

      // Serif "A": thick right stroke, thin left stroke, flared feet (same proportions as the logo).
      const extrude = (pts: [number, number][], depth = 0.45) => {
        const s = new THREE.Shape(); s.moveTo(...pts[0]); pts.slice(1).forEach((p) => s.lineTo(...p));
        const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 4, curveSegments: 8 });
        g.translate(0, 0, -depth / 2); return g;
      };
      const group = new THREE.Group();
      group.add(new THREE.Mesh(extrude([[-0.12, 2], [0.18, 2], [1.75, -1.75], [2.05, -1.95], [0.85, -1.95], [1.05, -1.75], [-0.25, 1.55]]), chrome));
      group.add(new THREE.Mesh(extrude([[-0.28, 1.6], [-0.18, 1.4], [-1.45, -1.72], [-1.15, -1.95], [-2.1, -1.95], [-1.78, -1.75]], 0.35), chrome));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.07, 24, 160), chrome);
      ring.scale.set(1, 0.32, 1);
      const ringPivot = new THREE.Group(); ringPivot.rotation.z = 0.22; ringPivot.position.y = -0.35; ringPivot.add(ring);
      const star = new THREE.Mesh(extrude([[0, 0.38], [0.07, 0.07], [0.38, 0], [0.07, -0.07], [0, -0.38], [-0.07, -0.07], [-0.38, 0], [-0.07, 0.07]], 0.08), chrome);
      star.position.set(2.2, 1.15, 0.2);
      group.add(ringPivot, star);
      scene.add(group);

      let raf = 0; let t0 = performance.now(); let visible = true;
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); });
      io.observe(el);
      const loop = () => {
        if (!visible) return;
        const t = (performance.now() - t0) / 1000;
        group.rotation.y = Math.sin(t * 0.35) * 0.55;
        group.rotation.x = Math.sin(t * 0.25) * 0.06;
        ring.rotation.z = t * 0.6;
        star.rotation.z = t * 0.8;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      const onResize = () => { const W = el.clientWidth, H = el.clientHeight; renderer.setSize(W, H); camera.aspect = W / H; camera.updateProjectionMatrix(); };
      window.addEventListener("resize", onResize);
      renderer.domElement.style.opacity = "0"; renderer.domElement.style.transition = "opacity .3s";
      loop();
      requestAnimationFrame(() => { renderer.domElement.style.opacity = "1"; setReady(true); });
      dispose = () => { cancelAnimationFrame(raf); io.disconnect(); window.removeEventListener("resize", onResize); renderer.dispose(); pmrem.dispose(); renderer.domElement.remove(); };
      t0 = performance.now();
    };
    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const id = ric ? ric(start, { timeout: 2500 }) : window.setTimeout(start, 1200);
    return () => { cancelled = true; dispose(); if (!ric) clearTimeout(id); };
  }, []);

  return <div ref={host} className="absolute inset-0" data-ready={ready} aria-hidden="true" />;
}
