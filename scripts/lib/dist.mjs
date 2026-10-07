// =============================================================================
// ¿Es publicable esta build? (Fase 15)
// =============================================================================
// Lo que ningún otro test mira en `dist/` tal cual sale de `vite build`:
//
//   - el dominio de ejemplo de la plantilla (`app.example.com`) en cualquier fichero;
//   - `robots.txt` y `sitemap.xml` distintos de los que generan public-site.ts;
//   - URLs de desarrollo (`http://localhost…`, `http://127.0.0.1…`, el cliente de Vite,
//     `/src/`); la palabra «localhost» suelta no: vfile la usa en un mensaje de error;
//   - recursos externos en las páginas HTML (`src`/`href` fuera del propio origen) o
//     en las hojas de estilo (`url(http…)`, `@import`);
//   - restos de la versión de escritorio (D19): la palabra «electron» suelta. La única
//     excepción es la detección de entorno de pdf.js (`process.versions.electron`), que
//     es código de la biblioteca y no pide nada.
//
// Que la app no pide nada fuera del sitio AL USARLA lo comprueban los E2E (vigilancia);
// esto mira los ficheros. Función pura sobre un directorio: el script la llama con
// `dist/` y los tests con uno de prueba.
// =============================================================================

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const TEXTO = /\.(html|js|mjs|css|txt|xml|json|svg|map)$/;
const ELECTRON_PERMITIDO = /process\.versions\.electron/g;

function ficheros(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = path.join(dir, e.name);
    if (e.isDirectory()) return ficheros(ruta, base);
    return [path.relative(base, ruta).split(path.sep).join("/")];
  });
}

/**
 * @param {{ dir: string, robots: string, sitemap: string, site: string }} p
 * @returns {string[]} problemas
 */
export function revisarDist({ dir, robots, sitemap, site }) {
  const problemas = [];
  const todos = ficheros(dir);
  const leer = (rel) => readFileSync(path.join(dir, rel), "utf8");

  for (const [rel, esperado] of [
    ["robots.txt", robots],
    ["sitemap.xml", sitemap],
  ]) {
    if (!todos.includes(rel)) problemas.push(`${rel}: no está en la build`);
    else if (leer(rel) !== esperado) problemas.push(`${rel}: no coincide con public-site.ts`);
  }

  for (const rel of todos.filter((f) => TEXTO.test(f))) {
    const texto = leer(rel);
    if (texto.includes("app.example.com")) problemas.push(`${rel}: contiene app.example.com`);
    if (/https?:\/\/(?:localhost|127\.0\.0\.1)\b|@vite\/client/.test(texto)) {
      problemas.push(`${rel}: contiene una URL de desarrollo`);
    }
    if (/\belectron\b/i.test(texto.replace(ELECTRON_PERMITIDO, ""))) {
      problemas.push(`${rel}: menciona Electron (BPDF es solo web, D19)`);
    }
    if (rel.endsWith(".html")) {
      for (const [, url] of texto.matchAll(/\b(?:src|href)="([^"]*)"/g)) {
        // El canonical absoluto es metadato, no un recurso solicitado por la página.
        if (url === `${site}/`) continue;
        if (!url.startsWith("/") || url.startsWith("//") || url.startsWith("/src/")) {
          problemas.push(`${rel}: recurso fuera de la build: ${url}`);
        }
      }
    }
    if (rel.endsWith(".css") && /url\(\s*['"]?(?:https?:)?\/\/|@import/.test(texto)) {
      problemas.push(`${rel}: la hoja de estilos pide algo fuera de la build`);
    }
  }
  return problemas;
}
