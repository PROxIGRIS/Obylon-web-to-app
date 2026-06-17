#!/usr/bin/env node
/**
 * Build a static SPA bundle for Capacitor (Android APK).
 *
 * TanStack Start (with the Cloudflare plugin) emits a Worker bundle by
 * default — Capacitor needs a flat folder containing `index.html` + assets.
 *
 * This script runs `vite build` then locates the prerendered client output
 * and copies it to `dist-mobile/`. Point capacitor.config.ts at that folder
 * (`webDir: "dist-mobile"`) and run `npx cap sync android`.
 */
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, cpSync, rmSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.cwd());
const OUT = join(ROOT, "dist-mobile");

console.log("→ vite build (SPA mode)");
execSync("vite build", { stdio: "inherit", env: { ...process.env, CAPACITOR_BUILD: "1" } });

// Candidate locations TanStack Start / Vite may write the prerendered SPA to.
const candidates = [
  "dist/client",
  ".output/public",
  "dist",
  ".output/client",
  "build/client",
];

const findIndex = () => {
  for (const c of candidates) {
    const p = join(ROOT, c, "index.html");
    if (existsSync(p)) return join(ROOT, c);
  }
  // Fallback: shallow scan for any directory containing index.html
  const scan = (dir, depth) => {
    if (depth > 3 || !existsSync(dir)) return null;
    for (const entry of readdirSync(dir)) {
      if (entry === "node_modules" || entry.startsWith(".git")) continue;
      const full = join(dir, entry);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        if (existsSync(join(full, "index.html"))) return full;
        const found = scan(full, depth + 1);
        if (found) return found;
      }
    }
    return null;
  };
  return scan(join(ROOT, "dist"), 0) || scan(join(ROOT, ".output"), 0);
};

const src = findIndex();
if (!src) {
  console.error(
    "\n✗ Could not find a built index.html.\n" +
      "  TanStack Start did not emit a static SPA. Ensure vite.config.ts has\n" +
      "  `tanstackStart.prerender.routes` covering the routes you want bundled\n" +
      "  and `vite.build.ssr = false`.\n",
  );
  process.exit(1);
}

console.log(`→ staging ${src} → ${OUT}`);
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(src, OUT, { recursive: true });

console.log("✓ mobile bundle ready at dist-mobile/");
console.log("  Next:  npx cap sync android  &&  npx cap open android");
