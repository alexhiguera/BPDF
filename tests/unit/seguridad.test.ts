import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CSP, cabecerasSeguridad, cspCabecera, cspMeta } from "@/config/security-headers";

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
    expect(politica).not.toMatch(/https?:|\*|data:|blob:/);
    // pdf.js lo necesitará (Fase 4/5); hasta que esté, no.
    expect(politica).not.toContain("'wasm-unsafe-eval'");
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
});
