import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cabecerasPara,
  cspCabecera,
  cspMarcoCabecera,
  RUTA_MARCO_MERMAID,
  reglasVercel,
} from "@/config/security-headers";
import { contenidoVercel } from "../../scripts/generar-vercel.mjs";
import { diferencias } from "../../scripts/verificar-cabeceras.mjs";

/**
 * Las cabeceras de la web publicada (Vercel). `vercel.json` se genera desde
 * `security-headers.ts`: aquí se comprueba que no se ha quedado atrás y que
 * cada ruta recibe exactamente lo que recibe en `vite preview`.
 */
describe("vercel.json", () => {
  it("es exactamente lo que genera `npm run cabeceras:vercel`", () => {
    expect(readFileSync("vercel.json", "utf8"), "regenera con npm run cabeceras:vercel").toBe(
      contenidoVercel(),
    );
  });

  it("solo define cabeceras (ni reescrituras, ni redirecciones, ni build)", () => {
    const config = JSON.parse(readFileSync("vercel.json", "utf8"));
    expect(Object.keys(config).sort()).toEqual(["$schema", "headers"]);
  });

  // Las fuentes de Vercel son expresiones de path-to-regexp; las de BPDF son
  // también expresiones regulares de JavaScript válidas, así que se prueban así.
  const reglas = reglasVercel().map((r) => ({
    ...r,
    exp: new RegExp(`^${r.source}$`),
    mapa: Object.fromEntries(r.headers.map((h) => [h.key, h.value])),
  }));

  it.each([
    "/",
    "/index.html",
    "/robots.txt",
    "/sitemap.xml",
    "/pdfjs/pdf.worker.min.mjs",
    "/pdfjs/cmaps/UniJIS-UCS2-H.bcmap",
    RUTA_MARCO_MERMAID,
    "/assets/mermaid-AbC123.js",
    "/assets/KaTeX_Main-Regular-x.woff2",
    "/assets/index-x.css",
    "/no-existe",
  ])("%s: exactamente una regla, con las cabeceras de cabecerasPara", (ruta) => {
    const coinciden = reglas.filter((r) => r.exp.test(ruta));
    expect(coinciden).toHaveLength(1);
    expect(coinciden[0]?.mapa).toEqual(cabecerasPara(ruta));
  });

  it("la app y el marco tienen cada uno su CSP (con frame-ancestors, que en <meta> no existe)", () => {
    const [app, marco] = reglas;
    expect(app?.mapa["Content-Security-Policy"]).toBe(cspCabecera());
    expect(app?.mapa["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(app?.mapa["X-Frame-Options"]).toBe("DENY");
    expect(marco?.mapa["Content-Security-Policy"]).toBe(cspMarcoCabecera());
    expect(marco?.mapa["Content-Security-Policy"]).toContain("frame-ancestors 'self'");
    expect(marco?.mapa["X-Frame-Options"]).toBe("SAMEORIGIN");
  });
});

describe("cabeceras:verificar", () => {
  it("detecta cabeceras que faltan o que difieren, sin distinguir mayúsculas", () => {
    const esperadas = { "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" };
    const bien = new Headers({ "x-frame-options": "DENY", "referrer-policy": "no-referrer" });
    expect(diferencias(esperadas, bien)).toEqual([]);
    const mal = new Headers({ "x-frame-options": "SAMEORIGIN" });
    const fallos = diferencias(esperadas, mal);
    expect(fallos).toHaveLength(2);
    expect(fallos[0]).toMatch(/X-Frame-Options distinta/);
    expect(fallos[1]).toBe("falta Referrer-Policy");
  });
});

describe("reglas de Vercel: bordes", () => {
  it("el punto de mermaid.html es literal: otra ruta parecida recibe las cabeceras de la app", () => {
    const [app] = reglasVercel();
    expect(app?.source).toContain("mermaid\\.html");
    expect(new RegExp(`^${app?.source}$`).test("/mermaidXhtml")).toBe(true);
    expect(new RegExp(`^${app?.source}$`).test(RUTA_MARCO_MERMAID)).toBe(false);
  });
});
