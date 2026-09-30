// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { messages } from "@/i18n/messages";
import { ContextoDiagramas } from "@/markdown/components/acciones";
import { Diagrama } from "@/markdown/components/Diagrama";
import MarkdownView from "@/markdown/MarkdownView";
import {
  DiagramaConImagenesError,
  DiagramaGrandeError,
  DiagramaInvalidoError,
  type MarcoMermaid,
} from "@/markdown/mermaid";
import { markdown } from "../../helpers/documentos";

const t = messages.markdown;
const DIR = path.join(import.meta.dirname, "../../fixtures/markdown");
const fixture = (f: string) => readFileSync(path.join(DIR, f), "utf8");

afterEach(() => vi.restoreAllMocks());

async function montar(texto: string) {
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <MarkdownView documento={markdown(texto)} onClose={() => {}} onOpenExternal={() => {}} />,
    );
  });
  const articulo = utils.container.querySelector("article") as HTMLElement;
  // KaTeX se carga a demanda: se espera a que ninguna fórmula siga cargando.
  await waitFor(
    () => expect(articulo.querySelectorAll('[data-formula="cargando"]')).toHaveLength(0),
    { timeout: 5000 },
  );
  return { ...utils, articulo };
}

describe("fórmulas (KaTeX)", () => {
  it("en línea y en bloque, con MathML para lectores de pantalla", async () => {
    const { articulo } = await montar("La energía $E = mc^2$.\n\n$$\n\\int_0^1 x\\,dx\n$$\n");
    const [enLinea, bloque] = [...articulo.querySelectorAll("[data-formula]")] as HTMLElement[];
    expect(enLinea?.tagName).toBe("SPAN");
    expect(enLinea?.dataset.formula).toBe("lista");
    expect(bloque?.tagName).toBe("DIV");
    expect(bloque?.querySelector(".katex-display")).not.toBeNull();
    expect(enLinea?.querySelector("math annotation")?.textContent).toBe("E = mc^2");
  });

  it("```math también es una fórmula en bloque; ```js sigue siendo código", async () => {
    const { articulo } = await montar("```math\n\\sqrt{2}\n```\n\n```js\nconst a = 1;\n```");
    expect(articulo.querySelector(".md-formula-bloque .katex")).not.toBeNull();
    expect(articulo.querySelector(".md-codigo code.language-js")).not.toBeNull();
  });

  it("una fórmula no válida muestra su código con aviso, y el documento sigue", async () => {
    const { articulo } = await montar("Antes $\\frac{1}{$ después.\n\nOtra $x^2$.");
    const [mala, buena] = [...articulo.querySelectorAll("[data-formula]")] as HTMLElement[];
    expect(mala?.dataset.formula).toBe("error");
    expect(mala?.querySelector("code.md-formula-error")).toHaveTextContent("\\frac{1}{");
    expect(mala).toHaveTextContent(t.math.invalid);
    expect(buena?.dataset.formula).toBe("lista");
    expect(articulo).toHaveTextContent("después.");
  });

  it("un dólar escapado no es una fórmula", async () => {
    const { articulo } = await montar("Cuesta \\$5 y \\$10.");
    expect(articulo.querySelector("[data-formula]")).toBeNull();
    expect(articulo).toHaveTextContent("Cuesta $5 y $10.");
  });

  it("el documento hostil: ni enlaces, ni ids, ni atributos de evento, ni estilos con URL", async () => {
    const { articulo } = await montar(fixture("katex-hostil.md"));
    const katex = [...articulo.querySelectorAll(".katex, .katex *")];
    expect(katex.length).toBeGreaterThan(0);
    for (const el of katex) {
      expect(el.tagName).not.toMatch(/^(A|IMG|SCRIPT|IFRAME|OBJECT|EMBED)$/);
      for (const { name, value } of el.attributes) {
        expect(name).not.toMatch(/^(href|src|id|on\w+|data-\w+)$/i);
        if (name === "style") expect(value).not.toMatch(/url\(|javascript|expression/i);
        if (name === "class") expect(value).not.toMatch(/md-contenido|location/);
      }
    }
    expect((window as { __bpdfXss?: unknown }).__bpdfXss).toBeUndefined();
    expect(articulo.querySelectorAll('[data-formula="error"]').length).toBeGreaterThan(0);
  });

  it("sin violaciones de accesibilidad", async () => {
    const { container } = await montar("# F\n\n$x^2$ y\n\n$$\n\\frac{a}{b}\n$$\n\nMal: $\\frac{$");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("diagramas (Mermaid)", () => {
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect/></svg>';

  function conMarco(dibujar: MarcoMermaid["dibujar"]) {
    const marco = { dibujar: vi.fn(dibujar) } as unknown as MarcoMermaid;
    return { marco, valor: { marco: () => marco } };
  }

  it("un diagrama válido se ve como imagen blob:, con su tipo en el alt y su código plegado", async () => {
    const crear = vi.fn(() => "blob:bpdf/d1");
    const revocar = vi.fn();
    URL.createObjectURL = crear;
    URL.revokeObjectURL = revocar;
    const { valor } = conMarco(async () => SVG);
    const { unmount } = render(
      <ContextoDiagramas value={valor}>
        <Diagrama fuente={"flowchart LR\n  A --> B"} />
      </ContextoDiagramas>,
    );
    const img = await screen.findByRole("img", { name: t.diagram.alt("flowchart") });
    expect(img).toHaveAttribute("src", "blob:bpdf/d1");
    expect((crear.mock.calls[0] as unknown as [Blob])[0].type).toBe("image/svg+xml");
    expect(screen.getByText(t.diagram.source).closest("details")).toHaveTextContent("A --> B");
    expect(document.querySelector("svg:not(.lucide)")).toBeNull();
    unmount();
    expect(revocar).toHaveBeenCalledWith("blob:bpdf/d1");
  });

  it.each([
    [new DiagramaInvalidoError(), t.diagram.errors.invalid],
    [new DiagramaGrandeError(), t.diagram.errors.tooLarge],
    [new DiagramaConImagenesError(), t.diagram.errors.images],
  ])("si falla (%s) se ve el código con su aviso", async (error, aviso) => {
    const { valor } = conMarco(async () => {
      throw error;
    });
    render(
      <ContextoDiagramas value={valor}>
        <Diagrama fuente={"graph TD\n  X -->"} />
      </ContextoDiagramas>,
    );
    expect(await screen.findByRole("note")).toHaveTextContent(aviso);
    expect(screen.getByText(/X -->/).closest("pre")).not.toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("en el visor, un bloque mermaid usa el marco del visor, y al cerrar se destruye", async () => {
    const { articulo, unmount } = await montar("```mermaid\ngraph TD\n  A --> B\n```");
    // jsdom no tiene IntersectionObserver: se dibuja en el acto, y el marco se crea.
    const iframe = document.querySelector("iframe.bpdf-marco-mermaid");
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute("sandbox")).toBe("allow-scripts");
    expect(within(articulo).getByText(/A --> B/)).toBeInTheDocument();
    unmount();
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("un documento sin diagramas no crea el marco", async () => {
    const { unmount } = await montar("# Sin diagramas\n\n```js\nx\n```");
    expect(document.querySelector("iframe")).toBeNull();
    unmount();
  });
});
