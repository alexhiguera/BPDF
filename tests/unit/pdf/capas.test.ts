// @vitest-environment jsdom
import type { PageViewport } from "pdfjs-dist";
import { describe, expect, it, vi } from "vitest";
import { type CapaTexto, construirCapaEnlaces, resaltar } from "@/pdf/visor/capas";

/**
 * Capas HTML del visor sin pdf.js: el resaltado de la búsqueda sobre los
 * elementos de la capa de texto y los enlaces. (La capa de texto de pdf.js
 * mide fuentes con un lienzo: se prueba en Playwright, con selección y copia.)
 */
function capa(...textos: string[]): CapaTexto {
  const elemento = document.createElement("div");
  const trozos = textos.map((t) => {
    const span = document.createElement("span");
    span.textContent = t;
    elemento.append(span);
    return span;
  });
  return { elemento, trozos, cancelar: () => {} };
}

describe("resaltar", () => {
  it("envuelve solo los caracteres de cada coincidencia y marca la activa", () => {
    const c = capa("Primera búsqueda.", "otra búsqueda");
    const { activa } = resaltar(c, {
      tramos: [
        { trozo: 0, desde: 8, hasta: 16, activa: false },
        { trozo: 1, desde: 5, hasta: 13, activa: true },
      ],
    });
    const marks = c.elemento.querySelectorAll("mark");
    expect([...marks].map((m) => m.textContent)).toEqual(["búsqueda", "búsqueda"]);
    expect(activa).toBe(marks[1]);
    expect(activa?.className).toBe("coincidencia activa");
    // El texto del trozo no cambia: lo que se copia es lo mismo.
    expect(c.trozos[0]?.textContent).toBe("Primera búsqueda.");
  });

  it("quitar deja la capa exactamente como estaba", () => {
    const c = capa("abc abc");
    const { quitar } = resaltar(c, {
      tramos: [
        { trozo: 0, desde: 0, hasta: 3, activa: false },
        { trozo: 0, desde: 4, hasta: 7, activa: false },
      ],
    });
    expect(c.elemento.querySelectorAll("mark")).toHaveLength(2);
    quitar();
    expect(c.elemento.querySelectorAll("mark")).toHaveLength(0);
    expect(c.trozos[0]?.textContent).toBe("abc abc");
    expect(c.trozos[0]?.childNodes).toHaveLength(1);
  });

  it("el texto del documento entra como texto, nunca como HTML", () => {
    const c = capa('<img src=x onerror="alert(1)">');
    resaltar(c, { tramos: [{ trozo: 0, desde: 0, hasta: 4, activa: true }] });
    expect(c.elemento.querySelector("img")).toBeNull();
    expect(c.elemento.textContent).toBe('<img src=x onerror="alert(1)">');
  });

  it("ignora tramos de trozos que no existen o vacíos", () => {
    const c = capa("hola");
    const r = resaltar(c, {
      tramos: [
        { trozo: 7, desde: 0, hasta: 2, activa: true },
        { trozo: 0, desde: 2, hasta: 2, activa: false },
      ],
    });
    expect(r.activa).toBeNull();
    expect(c.elemento.querySelectorAll("mark")).toHaveLength(0);
  });
});

/** Viewport de mentira: 1 punto = 2 px y el eje Y hacia abajo (alto 200). */
const viewport = {
  width: 200,
  height: 200,
  convertToViewportPoint: (x: number, y: number) => [x * 2, 200 - y * 2],
} as unknown as PageViewport;

describe("construirCapaEnlaces", () => {
  const etiqueta = (d: { tipo: string }) => (d.tipo === "interno" ? "Ir" : "Abrir fuera");

  it("pone un enlace por destino, en su sitio, con nombre accesible", () => {
    const alActivar = vi.fn();
    const div = construirCapaEnlaces(
      [
        { rect: [10, 80, 60, 90], destino: { tipo: "interno", pagina: 3 } },
        { rect: [10, 60, 60, 70], destino: { tipo: "externo", url: "https://example.com/" } },
      ],
      viewport,
      { alActivar, etiqueta },
    );
    const [interno, externo] = [...div.querySelectorAll("a")];
    expect(interno?.getAttribute("href")).toBe("#pagina-3");
    expect(interno?.style.left).toBe("20px");
    expect(interno?.style.top).toBe("20px");
    expect(interno?.style.width).toBe("100px");
    expect(interno?.style.height).toBe("20px");
    expect(interno?.getAttribute("aria-label")).toBe("Ir");
    expect(externo?.getAttribute("href")).toBe("https://example.com/");
    expect(externo?.rel).toBe("noopener noreferrer");
  });

  it("el clic nunca navega la app: lo decide alActivar", () => {
    const alActivar = vi.fn();
    const div = construirCapaEnlaces(
      [{ rect: [10, 60, 60, 70], destino: { tipo: "externo", url: "https://example.com/" } }],
      viewport,
      { alActivar, etiqueta },
    );
    const a = div.querySelector("a");
    const clic = new MouseEvent("click", { bubbles: true, cancelable: true });
    a?.dispatchEvent(clic);
    expect(clic.defaultPrevented).toBe(true);
    expect(alActivar).toHaveBeenCalledWith({ tipo: "externo", url: "https://example.com/" });
    const central = new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 });
    a?.dispatchEvent(central);
    expect(central.defaultPrevented).toBe(true);
  });

  it("descarta rectángulos sin área o fuera de la página", () => {
    const div = construirCapaEnlaces(
      [
        { rect: [10, 10, 10, 50], destino: { tipo: "interno", pagina: 1 } },
        { rect: [500, 500, 600, 600], destino: { tipo: "interno", pagina: 1 } },
      ],
      viewport,
      { alActivar: () => {}, etiqueta },
    );
    expect(div.querySelectorAll("a")).toHaveLength(0);
  });
});
