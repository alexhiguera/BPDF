import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CSP,
  CSP_MARCO_MERMAID,
  cabecerasPara,
  cabecerasSeguridad,
  cspCabecera,
  cspMarcoCabecera,
  cspMarcoMeta,
  cspMeta,
  RUTA_MARCO_MERMAID,
} from "@/config/security-headers";

/** Todos los ficheros de código de `src/`. */
function codigo(dir = "src"): string[] {
  return readdirSync(dir).flatMap((f) => {
    const ruta = path.join(dir, f);
    if (statSync(ruta).isDirectory()) return codigo(ruta);
    return /\.(tsx?|mjs|js)$/.test(f) ? [ruta] : [];
  });
}

describe("CSP (docs/SEGURIDAD.md §2.1)", () => {
  it("deniega por defecto", () => {
    expect(CSP["default-src"]).toEqual(["'none'"]);
  });

  it("no permite nada en línea, eval ni orígenes externos", () => {
    const politica = cspCabecera();
    expect(politica).not.toMatch(/'unsafe-inline'|'unsafe-eval'|'unsafe-hashes'/);
    expect(politica).not.toMatch(/https?:|\*|data:/);
    // `blob:` solo en img-src (imágenes locales de Markdown, Fase 7 bis).
    const conBlob = Object.entries(CSP).filter(([, v]) => v.includes("blob:"));
    expect(conBlob.map(([k]) => k)).toEqual(["img-src"]);
    expect(CSP["img-src"]).toEqual(["'self'", "blob:"]);
    // pdf.js va con `useWasm: false`: no compila WebAssembly.
    expect(politica).not.toContain("'wasm-unsafe-eval'");
  });

  it("pdf.js solo puede pedir al propio origen: su worker, sus fuentes y sus cmaps", () => {
    expect(CSP["worker-src"]).toEqual(["'self'"]);
    expect(CSP["font-src"]).toEqual(["'self'"]);
    expect(CSP["connect-src"]).toEqual(["'self'"]);
  });

  it("impide enmarcar la app, cambiar la base y enviar formularios", () => {
    expect(CSP["frame-ancestors"]).toEqual(["'none'"]);
    expect(CSP["base-uri"]).toEqual(["'none'"]);
    expect(CSP["form-action"]).toEqual(["'none'"]);
  });

  it("la versión <meta> es la misma política sin lo que <meta> no admite", () => {
    expect(cspMeta()).not.toContain("frame-ancestors");
    expect(cspCabecera()).toContain(cspMeta().split("; ")[0]);
    expect(cspCabecera().replace("; frame-ancestors 'none'", "")).toBe(cspMeta());
  });

  it("va en las cabeceras junto con el resto de protecciones", () => {
    const h = cabecerasSeguridad();
    expect(h["Content-Security-Policy"]).toBe(cspCabecera());
    expect(h).toMatchObject({
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Cross-Origin-Opener-Policy": "same-origin",
    });
  });
});

describe("inyección de HTML (docs/SEGURIDAD.md §2.3)", () => {
  it("ningún fichero de src/ usa APIs que interpretan HTML", () => {
    const prohibido =
      /dangerouslySetInnerHTML|\.innerHTML|\.outerHTML|insertAdjacentHTML|document\.write/;
    const culpables = codigo().filter((f) => prohibido.test(readFileSync(f, "utf8")));
    expect(culpables).toEqual([]);
  });

  it("ningún fichero de src/ lleva marcas bidireccionales invisibles (Trojan Source)", () => {
    // Hacen que el código se lea distinto de como se ejecuta. Donde hagan falta
    // (p. ej. para quitarlas de un nombre), se escriben como escapes \uXXXX.
    const invisibles = /[\u202A-\u202E\u2066-\u2069\u200E\u200F\u061C]/u;
    const culpables = codigo().filter((f) => invisibles.test(readFileSync(f, "utf8")));
    expect(culpables).toEqual([]);
  });
});

describe("CSP del marco aislado de Mermaid (Fase 8)", () => {
  it("la app solo gana frame-src 'self' (y sigue sin nada en línea)", () => {
    expect(CSP["frame-src"]).toEqual(["'self'"]);
    expect(CSP["style-src"]).toEqual(["'self'"]);
  });

  it("el marco: estilos en línea (lo único que Mermaid necesita), sin red, sin eval", () => {
    expect(CSP_MARCO_MERMAID["style-src"]).toEqual(["'self'", "'unsafe-inline'"]);
    expect(CSP_MARCO_MERMAID["script-src"]).toEqual(["'self'"]);
    for (const d of ["connect-src", "img-src", "font-src", "worker-src", "object-src"]) {
      expect(CSP_MARCO_MERMAID[d]).toEqual(["'none'"]);
    }
    expect(CSP_MARCO_MERMAID["frame-ancestors"]).toEqual(["'self'"]);
    const politica = cspMarcoCabecera();
    expect(politica).not.toMatch(/'unsafe-eval'|'wasm-unsafe-eval'|https?:|\*|data:|blob:/);
    // 'unsafe-inline' solo en style-src.
    expect(politica.match(/'unsafe-inline'/g)).toHaveLength(1);
    expect(cspMarcoMeta()).not.toContain("frame-ancestors");
  });

  it("cada ruta recibe su política", () => {
    expect(cabecerasPara("/")["Content-Security-Policy"]).toBe(cspCabecera());
    expect(cabecerasPara("/index.html")["X-Frame-Options"]).toBe("DENY");
    const marco = cabecerasPara(`${RUTA_MARCO_MERMAID}?v=1`);
    expect(marco["Content-Security-Policy"]).toBe(cspMarcoCabecera());
    expect(marco["X-Frame-Options"]).toBe("SAMEORIGIN");
    expect(cabecerasPara("/assets/x.js")["Access-Control-Allow-Origin"]).toBe("*");
    expect(cabecerasPara("/")["Access-Control-Allow-Origin"]).toBeUndefined();
    expect(cabecerasPara("/mermaid.html.x")["Content-Security-Policy"]).toBe(cspCabecera());
  });
});
