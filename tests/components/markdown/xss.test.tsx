// @vitest-environment jsdom

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type OpenedMarkdown, SIN_RECURSOS } from "@/documents/types";
import MarkdownView from "@/markdown/MarkdownView";
import { opcionesPipeline } from "@/markdown/pipeline";
import { transformarUrl } from "@/markdown/url-policy";
import { CASOS as GENERADOS } from "../../fixtures/markdown/xss/generar.mjs";

/**
 * Corpus de XSS (docs/SEGURIDAD.md §3.3, obligatorio). Cada fichero de
 * `tests/fixtures/markdown/xss/` y el documento hostil completo se pintan con
 * el pipeline REAL y se inspecciona el DOM: ningún elemento, atributo ni URL
 * fuera de lo permitido. Si alguien añade `rehype-raw`, cambia el
 * `urlTransform` o afloja un componente, esto falla.
 */
const DIR = path.join(import.meta.dirname, "../../fixtures/markdown");
const CASOS = [
  ...readdirSync(path.join(DIR, "xss"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => `xss/${f}`),
  "seguridad.md",
];

/** Elementos que un documento jamás puede producir. */
const PROHIBIDOS =
  "script, iframe, frame, object, embed, style, link, meta, base, form, button:not(.md-codigo-copiar), textarea, select, details, audio, video, source, math, template, img";

/** Único `style` en línea que emite el pipeline: la alineación de celdas de tabla. */
const ESTILO_PERMITIDO = /^text-align: (left|right|center);?$/;

function montar(texto: string) {
  const documento: OpenedMarkdown = {
    id: "1",
    name: "x.md",
    size: texto.length,
    kind: "markdown",
    text: texto,
    resources: SIN_RECURSOS,
  };
  const { container } = render(
    <MarkdownView documento={documento} onClose={() => {}} onOpenExternal={() => {}} />,
  );
  return container.querySelector("article") as HTMLElement;
}

describe("corpus de XSS", () => {
  it("hay casos (una carpeta vacía no puede pasar en silencio)", () => {
    expect(CASOS.length).toBeGreaterThanOrEqual(20);
  });

  it("los ficheros del corpus son exactamente los del generador", () => {
    const enDisco = CASOS.filter((c) => c.startsWith("xss/")).map((c) => c.slice(4));
    expect(enDisco.sort()).toEqual(Object.keys(GENERADOS).sort());
    for (const [nombre, texto] of Object.entries(GENERADOS)) {
      expect(readFileSync(path.join(DIR, "xss", nombre), "utf8"), nombre).toBe(texto);
    }
  });

  it.each(CASOS)("%s: nada ejecutable, ninguna URL fuera de la política", (caso) => {
    const alerta = vi.spyOn(window, "alert").mockImplementation(() => {});
    const articulo = montar(readFileSync(path.join(DIR, caso), "utf8"));

    expect(articulo.querySelectorAll(PROHIBIDOS)).toHaveLength(0);
    // Los únicos SVG son los iconos de BPDF (lucide), siempre ocultos a lectores.
    for (const svg of articulo.querySelectorAll("svg")) {
      expect(svg.getAttribute("class")).toMatch(/^lucide\b/);
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
    for (const el of articulo.querySelectorAll("*")) {
      for (const { name, value } of el.attributes) {
        expect(name, `${el.tagName} ${name}`).not.toMatch(/^on/i);
        expect(name).not.toMatch(
          /^(src|srcset|srcdoc|action|formaction|data|xlink:href|background)$/i,
        );
        if (name === "style") expect(value).toMatch(ESTILO_PERMITIDO);
        if (name === "id") expect(value === "footnote-label" || value.startsWith("md-")).toBe(true);
        if (name === "href") {
          expect(value).toMatch(/^(https?:\/\/[^/@]+\/|mailto:|#md-)/i);
        }
      }
    }
    // Solo casillas de tareas, de solo lectura.
    for (const input of articulo.querySelectorAll("input")) {
      expect(input.type).toBe("checkbox");
      expect(input.disabled).toBe(true);
    }
    expect((window as { __bpdfXss?: unknown }).__bpdfXss).toBeUndefined();
    expect(alerta).not.toHaveBeenCalled();
    alerta.mockRestore();
  });

  it("el HTML crudo se ve como texto, no como elementos", () => {
    const articulo = montar(readFileSync(path.join(DIR, "xss/html-script.md"), "utf8"));
    expect(articulo.textContent).toContain('<script>window.__bpdfXss = "script";</script>');
    expect(articulo.querySelector("script")).toBeNull();
  });

  it("los encabezados que pisarían globales llevan prefijo", () => {
    const articulo = montar(readFileSync(path.join(DIR, "xss/encabezados-clobbering.md"), "utf8"));
    const ids = [...articulo.querySelectorAll("h1, h2, h3, h4, h5")].map((h) => h.id);
    expect(ids).toEqual([
      "md-location",
      "md-__proto__",
      "md-contenido",
      "md-titulo-documento",
      "md-constructor",
    ]);
    expect(window.location).toBe(document.location);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
  });
});

describe("configuración del pipeline", () => {
  it("no interpreta HTML: sin plugins de rehype (rehype-raw) y con la política propia de URLs", () => {
    expect("rehypePlugins" in opcionesPipeline).toBe(false);
    expect("skipHtml" in opcionesPipeline).toBe(false);
    expect(opcionesPipeline.urlTransform).toBe(transformarUrl);
    expect(opcionesPipeline.allowedElements).not.toContain("script");
    expect(opcionesPipeline.allowedElements).not.toContain("iframe");
  });
});
