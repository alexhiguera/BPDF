import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAPACIDADES_NEGADAS,
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

// Fase 12: la política definitiva, entera. Cambiarla (abrir una directiva, añadir
// un origen) obliga a cambiar este test y su justificación en SEGURIDAD §2.1.
describe("CSP definitiva (Fase 12)", () => {
  it("la app: exactamente estas directivas, cada una justificada en SEGURIDAD §2.1", () => {
    expect(cspCabecera()).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; " +
        "worker-src 'self'; font-src 'self'; connect-src 'self'; frame-src 'self'; " +
        "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    );
  });

  it("el marco de Mermaid: exactamente estas directivas", () => {
    expect(cspMarcoCabecera()).toBe(
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'none'; font-src 'none'; connect-src 'none'; worker-src 'none'; " +
        "object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'",
    );
  });

  it("cada ruta lleva exactamente estas cabeceras: ni una heredada ni una de más", () => {
    const comunes = [
      "Content-Security-Policy",
      "Cross-Origin-Opener-Policy",
      "Cross-Origin-Resource-Policy",
      "Permissions-Policy",
      "Referrer-Policy",
      "Strict-Transport-Security",
      "X-Content-Type-Options",
      "X-Frame-Options",
    ];
    expect(Object.keys(cabecerasPara("/")).sort()).toEqual(comunes);
    expect(Object.keys(cabecerasPara(RUTA_MARCO_MERMAID)).sort()).toEqual(comunes);
    expect(Object.keys(cabecerasPara("/assets/x.js")).sort()).toEqual(
      ["Access-Control-Allow-Origin", ...comunes].sort(),
    );
  });
});

describe("Permissions-Policy (docs/SEGURIDAD.md §2.2)", () => {
  const politica = () => cabecerasSeguridad()["Permissions-Policy"] ?? "";
  const entradas = () => politica().split(", ");

  it("niega leer el portapapeles (Fase 12): BPDF nunca lo lee", () => {
    expect(entradas()).toContain("clipboard-read=()");
  });

  it("no niega lo que BPDF usa: escribir en el portapapeles y la pantalla completa", () => {
    expect(politica()).not.toMatch(/clipboard-write|fullscreen/);
  });

  it("cada capacidad se niega a todos, también al propio origen, y sin repetir", () => {
    expect(entradas()).toEqual(CAPACIDADES_NEGADAS.map((c) => `${c}=()`));
    expect(new Set(CAPACIDADES_NEGADAS).size).toBe(CAPACIDADES_NEGADAS.length);
    for (const e of entradas()) expect(e).toMatch(/^[a-z-]+=\(\)$/);
  });

  it("el hardware conectado se niega como familia, y lo que un visor no usa", () => {
    for (const c of ["usb", "serial", "hid", "midi"]) {
      expect(CAPACIDADES_NEGADAS).toContain(c);
    }
    for (const c of ["camera", "microphone", "geolocation", "payment", "display-capture"]) {
      expect(CAPACIDADES_NEGADAS).toContain(c);
    }
  });

  it("el marco de Mermaid recibe la misma política", () => {
    expect(cabecerasPara(RUTA_MARCO_MERMAID)["Permissions-Policy"]).toBe(politica());
  });
});
