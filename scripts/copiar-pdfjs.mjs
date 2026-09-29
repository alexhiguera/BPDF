#!/usr/bin/env node
/**
 * Copia a `public/pdfjs/` los recursos de `pdfjs-dist` que el navegador pide en
 * tiempo de ejecución, para servirlos desde el PROPIO origen (CSP `'self'`, sin
 * CDN: docs/SEGURIDAD.md §4). `public/pdfjs/` no se versiona: se regenera en
 * `predev` y `prebuild` desde la versión exacta instalada.
 *
 * Se copia solo lo que BPDF usa, y se deja fuera a propósito:
 * - `*.wasm`: BPDF carga pdf.js con `useWasm: false` (docs/PDF_DARK_MODE_SPIKE.md),
 *   así que no hay WebAssembly que compilar ni `'wasm-unsafe-eval'` en la CSP.
 * - `quickjs-eval.*`: el motor para ejecutar el JavaScript de un PDF. BPDF no lo
 *   ejecuta nunca (SEGURIDAD §4).
 * - `pdf.sandbox*`: el sandbox de scripting, por lo mismo.
 * - `iccs/`: perfiles ICC, que solo se usan con WASM.
 *
 * Uso: node scripts/copiar-pdfjs.mjs
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const ORIGEN = path.join("node_modules", "pdfjs-dist");
const DESTINO = path.join("public", "pdfjs");

if (!existsSync(ORIGEN)) {
  console.error("✗ No está instalado pdfjs-dist (npm ci).");
  process.exit(1);
}

const COPIAS = [
  // El worker donde pdf.js parsea el documento, aislado del DOM de la app.
  ["build/pdf.worker.min.mjs", "pdf.worker.min.mjs"],
  // Decodificadores JPEG 2000 y JBIG2 en JavaScript (se usan con useWasm: false).
  ["wasm/openjpeg_nowasm_fallback.js", "wasm/openjpeg_nowasm_fallback.js"],
  ["wasm/jbig2_nowasm_fallback.js", "wasm/jbig2_nowasm_fallback.js"],
  ["wasm/LICENSE_OPENJPEG", "wasm/LICENSE_OPENJPEG"],
  ["wasm/LICENSE_PDFJS_OPENJPEG", "wasm/LICENSE_PDFJS_OPENJPEG"],
  ["wasm/LICENSE_JBIG2", "wasm/LICENSE_JBIG2"],
  ["wasm/LICENSE_PDFJS_JBIG2", "wasm/LICENSE_PDFJS_JBIG2"],
  // Mapas de caracteres (fuentes CID, p. ej. CJK) y fuentes estándar sin incrustar.
  ["cmaps", "cmaps"],
  ["standard_fonts", "standard_fonts"],
  ["LICENSE", "LICENSE"],
];

rmSync(DESTINO, { recursive: true, force: true });
for (const [de, a] of COPIAS) {
  const destino = path.join(DESTINO, a);
  mkdirSync(path.dirname(destino), { recursive: true });
  cpSync(path.join(ORIGEN, de), destino, { recursive: true });
}
console.log(`✓ Recursos de pdf.js copiados a ${DESTINO}/`);
