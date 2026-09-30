// @vitest-environment jsdom

import { act, fireEvent, render, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearRecursos } from "@/documents/recursos";
import type { RecursosDocumento } from "@/documents/types";
import { messages } from "@/i18n/messages";
import MarkdownView from "@/markdown/MarkdownView";
import { fichero, markdown } from "../../helpers/documentos";

const t = messages.markdown.image;

/** jsdom no implementa las URL de objeto: se cuentan las que se crean y revocan. */
let creadas: Blob[] = [];
let revocadas: string[] = [];
beforeEach(() => {
  creadas = [];
  revocadas = [];
  URL.createObjectURL = vi.fn((b: Blob) => {
    creadas.push(b);
    return `blob:bpdf/${creadas.length}`;
  });
  URL.revokeObjectURL = vi.fn((u: string) => {
    revocadas.push(u);
  });
});
afterEach(() => vi.restoreAllMocks());

function recursos(rutas: string[], base = ""): RecursosDocumento {
  return crearRecursos(
    rutas.map((ruta) => ({ ruta, file: fichero(ruta.slice(ruta.lastIndexOf("/") + 1), "x") })),
    base,
  );
}

async function montar(texto: string, r: RecursosDocumento) {
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <MarkdownView
        documento={markdown(texto, "doc.md", r)}
        onClose={() => {}}
        onOpenExternal={() => {}}
      />,
    );
  });
  const articulo = utils.container.querySelector("article") as HTMLElement;
  return { ...utils, articulo, en: within(articulo) };
}

const imagenes = (a: HTMLElement) => [...a.querySelectorAll("img")];

describe("imágenes locales entregadas", () => {
  it("se pintan como <img> con una URL blob:, su texto alternativo y carga diferida", async () => {
    const { articulo, en } = await montar(
      "![Imagen](./imagen.png)\n\n![Logo](logo.svg)",
      recursos(["imagen.png", "logo.svg"]),
    );
    const [png, svg] = imagenes(articulo);
    expect(png).toHaveAttribute("src", "blob:bpdf/1");
    expect(png).toHaveAttribute("loading", "lazy");
    expect(en.getByRole("img", { name: "Imagen" })).toBe(png);
    expect(png?.dataset.recurso).toBe("imagen.png");
    // SVG: como <img>, nunca en línea; su Blob va con el tipo de su extensión.
    expect(svg?.tagName).toBe("IMG");
    expect(creadas.map((b) => b.type)).toEqual(["image/png", "image/svg+xml"]);
    expect(articulo.querySelectorAll("svg:not(.lucide)")).toHaveLength(0);
  });

  it("varias referencias al mismo recurso comparten una URL; lo no usado no tiene ninguna", async () => {
    const { articulo } = await montar(
      "![a](imagen.png) ![b](./imagen.png) ![c](imagen.png?v=1)",
      recursos(["imagen.png", "no-usada.png", "tampoco.jpg"]),
    );
    expect(imagenes(articulo).map((i) => i.getAttribute("src"))).toEqual([
      "blob:bpdf/1",
      "blob:bpdf/1",
      "blob:bpdf/1",
    ]);
    expect(creadas).toHaveLength(1);
  });

  it("subdirectorios, espacios y Unicode, relativos al directorio del .md", async () => {
    const { articulo } = await montar(
      "![1](images/foto.jpg) ![2](foto%20grande.png) ![3](<año 🙂.png>) ![4](../comun/logo.png)",
      recursos(
        ["docs/images/foto.jpg", "docs/foto grande.png", "docs/año 🙂.png", "comun/logo.png"],
        "docs",
      ),
    );
    expect(imagenes(articulo).map((i) => i.dataset.recurso)).toEqual([
      "docs/images/foto.jpg",
      "docs/foto grande.png",
      "docs/año 🙂.png",
      "comun/logo.png",
    ]);
  });

  it("lo que no se entregó o sale del conjunto es un marcador que dice por qué, sin URL", async () => {
    const { articulo } = await montar(
      [
        "![falta](otra.png)",
        "![sube](../../secreto.png)",
        "![codificado](%2e%2e/secreto.png)",
        "![absoluta](/etc/passwd.png)",
        "![bmp](dibujo.bmp)",
      ].join("\n\n"),
      recursos(["imagen.png"]),
    );
    expect(imagenes(articulo)).toHaveLength(0);
    expect(creadas).toHaveLength(0);
    expect(articulo).toHaveTextContent(`falta (${t.local["no-encontrado"]})`);
    expect(articulo).toHaveTextContent(`sube (${t.local.fuera})`);
    expect(articulo).toHaveTextContent(`codificado (${t.local.fuera})`);
    expect(articulo).toHaveTextContent(`bmp (${t.local["no-soportado"]})`);
    // La ruta absoluta la bloquea antes la política de URLs.
    expect(articulo).toHaveTextContent(`absoluta (${t.blocked})`);
    expect(articulo.querySelector('[data-imagen="fuera"]')).toHaveAttribute(
      "title",
      t.localHint.fuera,
    );
  });

  it("una imagen que el navegador no puede decodificar pasa a marcador «rota»", async () => {
    const { articulo } = await montar("![rota](imagen.png)", recursos(["imagen.png"]));
    fireEvent.error(imagenes(articulo)[0] as HTMLImageElement);
    expect(imagenes(articulo)).toHaveLength(0);
    expect(articulo).toHaveTextContent(`rota (${t.local.rota})`);
  });

  it("sin violaciones de accesibilidad", async () => {
    const { container } = await montar(
      "# Doc\n\n![Imagen](imagen.png)\n\n![](decorativa.png)\n\n![falta](otra.png)",
      recursos(["imagen.png", "decorativa.png"]),
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("imágenes locales: ciclo de vida de las URL", () => {
  it("al desmontar (cerrar) se revocan todas las URL creadas", async () => {
    const { unmount } = await montar(
      "![a](a.png) ![b](b.png) ![a otra vez](a.png)",
      recursos(["a.png", "b.png"]),
    );
    expect(creadas).toHaveLength(2);
    unmount();
    expect(revocadas.sort()).toEqual(["blob:bpdf/1", "blob:bpdf/2"]);
  });

  it("al sustituir el documento, las del anterior se revocan y el nuevo no las reutiliza", async () => {
    const r1 = recursos(["a.png"]);
    const r2 = recursos(["a.png"]);
    const d1 = markdown("![a](a.png)", "uno.md", r1);
    const d2 = markdown("![a](a.png)", "dos.md", r2);
    const props = { onClose: () => {}, onOpenExternal: () => {} };
    let utils!: ReturnType<typeof render>;
    await act(async () => {
      utils = render(<MarkdownView key={d1.id} documento={d1} {...props} />);
    });
    await act(async () => {
      utils.rerender(<MarkdownView key={d2.id} documento={d2} {...props} />);
    });
    expect(revocadas).toEqual(["blob:bpdf/1"]);
    expect(utils.container.querySelector("img")).toHaveAttribute("src", "blob:bpdf/2");
    expect(creadas[1]).toBe(r2.ficheros.get("a.png")?.blob);
  });

  it("un Markdown sin recursos no crea ninguna URL", async () => {
    const { unmount } = await montar("![a](a.png) ![r](https://example.com/r.png)", recursos([]));
    unmount();
    expect(creadas).toEqual([]);
    expect(revocadas).toEqual([]);
  });
});
