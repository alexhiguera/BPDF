#!/usr/bin/env node
// Comprueba que `dist/` es publicable (Fase 15; detalle en scripts/lib/dist.mjs):
// dominio oficial, robots y sitemap de public-site.ts, sin URLs de desarrollo, sin
// recursos externos y sin restos de escritorio. Tras `npm run build`; corre en CI.
//
// Uso: npm run build:verificar

import { existsSync } from "node:fs";
import { revisarDist } from "./lib/dist.mjs";

// Node 24 ejecuta TypeScript sin compilar: la fuente es la misma que usa la build.
const { robotsTxt, sitemapXml } = await import("../src/config/public-site.ts");

if (!existsSync("dist/index.html")) {
  console.error("✗ No hay build: ejecuta antes `npm run build`.");
  process.exit(1);
}
const problemas = revisarDist({ dir: "dist", robots: robotsTxt(), sitemap: sitemapXml() });
if (problemas.length === 0) {
  console.log("✓ dist/ es publicable: dominio, robots, sitemap y recursos del propio sitio.");
  process.exit(0);
}
console.error(`✗ ${problemas.length} problema(s) en dist/:\n`);
for (const p of problemas) console.error(`  · ${p}`);
process.exit(1);
