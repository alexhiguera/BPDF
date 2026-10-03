import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { revisarDist } from "../../scripts/lib/dist.mjs";

/** Una build mínima y publicable, que cada test estropea de una forma. */
const ROBOTS = "User-agent: *\nAllow: /\n\nSitemap: https://bpdf.test/sitemap.xml\n";
const SITEMAP = "<urlset><url><loc>https://bpdf.test/</loc></url></urlset>\n";
const BASE: Record<string, string> = {
  "index.html":
    '<link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/assets/i.css"><script type="module" src="/assets/i.js"></script>',
  "assets/i.js":
    'const n=typeof process<"u"&&!(process.versions.electron&&process.type);fetch("/x")',
  "assets/i.css": "body{background:url(/assets/f.woff2)}",
  "robots.txt": ROBOTS,
  "sitemap.xml": SITEMAP,
};

let dir = "";
function build(cambios: Record<string, string | null> = {}) {
  dir = mkdtempSync(path.join(tmpdir(), "bpdf-dist-"));
  for (const [rel, texto] of Object.entries({ ...BASE, ...cambios })) {
    if (texto === null) continue;
    mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    writeFileSync(path.join(dir, rel), texto);
  }
  return revisarDist({ dir, robots: ROBOTS, sitemap: SITEMAP }).join("\n");
}
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("revisarDist", () => {
  it("nada en una build publicable (la detección de Electron de pdf.js se acepta)", () => {
    expect(build()).toBe("");
  });

  it.each([
    [
      "el dominio de ejemplo",
      { "assets/i.js": 'const u="https://app.example.com"' },
      /app\.example\.com/,
    ],
    [
      "robots.txt de otro dominio",
      { "robots.txt": "Sitemap: https://app.example.com/sitemap.xml\n" },
      /robots\.txt: no coincide/,
    ],
    ["sin sitemap.xml", { "sitemap.xml": null }, /sitemap\.xml: no está/],
    ["una URL de desarrollo", { "assets/i.js": 'fetch("http://localhost:5173/x")' }, /desarrollo/],
    ["el cliente de Vite", { "index.html": '<script src="/@vite/client"></script>' }, /desarrollo/],
    [
      "la entrada de desarrollo",
      { "index.html": '<script src="/src/main.tsx"></script>' },
      /fuera de la build: \/src/,
    ],
    [
      "un script externo",
      { "index.html": '<script src="https://cdn.test/a.js"></script>' },
      /fuera de la build/,
    ],
    [
      "un recurso sin protocolo",
      { "index.html": '<link href="//cdn.test/a.css">' },
      /fuera de la build/,
    ],
    [
      "una fuente externa en CSS",
      { "assets/i.css": "@font-face{src:url(https://f.test/a.woff2)}" },
      /hoja de estilos/,
    ],
    ["un @import en CSS", { "assets/i.css": '@import "x.css";' }, /hoja de estilos/],
    ["código de escritorio", { "assets/i.js": "window.electron.abrir()" }, /Electron/],
  ])("detecta %s", (_caso, cambios, patron) => {
    expect(build(cambios)).toMatch(patron);
  });

  it("no confunde «electronic» de una licencia con Electron", () => {
    expect(build({ "pdfjs/LICENSE.txt": "in electronic form" })).toBe("");
  });

  it("no confunde la palabra «localhost» de un mensaje de error con una URL", () => {
    expect(build({ "assets/i.js": 'TypeError(`File URL host must be "localhost"`)' })).toBe("");
  });
});
