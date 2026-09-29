#!/usr/bin/env node
/**
 * Tamaño de lo que la app descarga AL ARRANCAR: los scripts, `modulepreload` y
 * hojas de estilo que referencia `dist/index.html`, comprimidos con gzip.
 *
 * Por qué: los motores pesados (pdf.js, KaTeX, Mermaid, CodeMirror) tienen que
 * cargarse bajo demanda (docs/PLAN.md §11). Un `import` estático por descuido
 * los metería en el arranque de todos los usuarios sin que nada fallara; este
 * script sí falla. Lo que se carga con `import()` no cuenta.
 *
 * Uso: npm run build && npm run build:tamano
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const LIMITE_KB = 150;
const DIST = "dist";
const indice = path.join(DIST, "index.html");

if (!existsSync(indice)) {
  console.error("✗ No existe dist/index.html. Ejecuta antes `npm run build`.");
  process.exit(1);
}

const html = readFileSync(indice, "utf8");
const rutas = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="\/([^"]+\.(?:js|css))"/g)]
  .map((m) => m[1])
  .filter((r, i, todas) => todas.indexOf(r) === i);

let total = 0;
for (const r of rutas) {
  const kb = gzipSync(readFileSync(path.join(DIST, r))).length / 1024;
  total += kb;
  console.log(`  ${kb.toFixed(1).padStart(7)} KB  ${r}`);
}
console.log(`  ${total.toFixed(1).padStart(7)} KB  total gzip (límite ${LIMITE_KB} KB)`);

if (rutas.length === 0) {
  console.error("✗ dist/index.html no referencia ningún script ni estilo: ¿cambió el formato?");
  process.exit(1);
}
if (total > LIMITE_KB) {
  console.error(`✗ El arranque pesa más de ${LIMITE_KB} KB gzip. ¿Algo pesado sin import()?`);
  process.exit(1);
}
console.log("✓ Dentro del límite.");
