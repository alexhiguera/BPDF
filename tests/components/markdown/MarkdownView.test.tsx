// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import path from "node:path";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type OpenedMarkdown, SIN_RECURSOS } from "@/documents/types";
import { messages } from "@/i18n/messages";
import { DURACION_AVISO_MS } from "@/markdown/components/BloqueCodigo";
import MarkdownView, { UMBRAL_DIFERIDO } from "@/markdown/MarkdownView";

const t = messages.markdown;
const DIR = path.join(import.meta.dirname, "../../fixtures/markdown");
const fixture = (f: string) => readFileSync(path.join(DIR, f), "utf8");

let siguienteId = 0;
function documento(texto: string, name = "doc.md"): OpenedMarkdown {
  return {
    id: String(++siguienteId),
    name,
    size: texto.length,
    kind: "markdown",
    text: texto,
    resources: SIN_RECURSOS,
  };
}

function montar(texto: string, name?: string) {
  const onClose = vi.fn();
  const onOpenExternal = vi.fn();
  const r = render(
    <MarkdownView
      documento={documento(texto, name)}
      onClose={onClose}
      onOpenExternal={onOpenExternal}
    />,
  );
  const articulo = r.container.querySelector("article") as HTMLElement;
  return { ...r, onClose, onOpenExternal, articulo, en: within(articulo) };
}

const abrirIndice = () => fireEvent.click(screen.getByRole("button", { name: t.toc }));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("MarkdownView: Markdown básico", () => {
  it("muestra el nombre como título, con el foco, y el contenido con su semántica", () => {
    const { en } = montar(fixture("basico.md"), "basico.md");
    const titulo = screen.getAllByRole("heading", { level: 1 })[0];
    expect(titulo).toHaveTextContent("basico.md");
    expect(titulo).toHaveFocus();

    expect(
      en.getByRole("heading", { level: 1, name: "Documento de prueba de BPDF" }),
    ).toHaveAttribute("id", "md-documento-de-prueba-de-bpdf");
    expect(en.getByRole("heading", { level: 2, name: "Lista" })).toBeInTheDocument();
    expect(en.getByText("negrita").tagName).toBe("STRONG");
    expect(en.getByText("cursiva").tagName).toBe("EM");
    // Listas: la anidada dentro de su elemento, y la ordenada.
    const listas = en.getAllByRole("list");
    expect(listas.map((l) => l.tagName)).toEqual(["UL", "UL", "UL", "OL"]);
    expect(en.getByText("Y de tercero").closest("ul")?.parentElement?.closest("ul")).not.toBeNull();
    expect(en.getByRole("table")).toBeInTheDocument();
    expect(en.getAllByRole("columnheader").map((c) => c.textContent)).toEqual(["Columna", "Valor"]);
    expect(en.getByText(/Leer de noche/).closest("blockquote")).not.toBeNull();
    expect(en.getByRole("separator")).toBeInTheDocument();
    expect(en.getAllByText("código en línea")[0]?.tagName).toBe("CODE");
  });

  it("sin accesibilidad rota (axe)", async () => {
    const { container } = montar(fixture("basico.md"));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("GFM: tablas alineadas, tareas de solo lectura con nombre, tachado, autoenlaces y notas", async () => {
    const { container, en } = montar(fixture("gfm.md"));
    const [alineada] = en.getAllByRole("table");
    const celdas = within(alineada as HTMLElement).getAllByRole("cell");
    expect(celdas[1]).toHaveStyle({ textAlign: "center" });
    expect(celdas[2]).toHaveStyle({ textAlign: "right" });

    const casillas = en.getAllByRole("checkbox");
    expect(casillas).toHaveLength(3);
    expect(casillas[0]).toBeChecked();
    expect(casillas[0]).toBeDisabled();
    expect(casillas[0]).toHaveAccessibleName(t.task.done);
    expect(casillas[1]).toHaveAccessibleName(t.task.pending);

    expect(en.getByText("tachado").tagName).toBe("DEL");
    expect(en.getByRole("link", { name: "https://example.com/autoenlace" })).toHaveAttribute(
      "href",
      "https://example.com/autoenlace",
    );
    expect(en.getByRole("link", { name: "hola@example.com" })).toHaveAttribute(
      "href",
      "mailto:hola@example.com",
    );
    // Notas al pie: ids con prefijo y textos de BPDF.
    expect(container.querySelector("#footnote-label")).toHaveTextContent(t.footnotes);
    const llamada = en.getByRole("link", { name: "1" });
    expect(llamada).toHaveAttribute("href", "#md-fn-1");
    expect(container.querySelector("#md-fn-1")).not.toBeNull();
    expect(en.getAllByRole("link", { name: t.footnoteBack(1, 1) })).toHaveLength(1);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("un documento vacío de encabezados o casi vacío se muestra sin romper nada", () => {
    const { articulo } = montar("solo texto, sin encabezados");
    expect(articulo).toHaveTextContent("solo texto, sin encabezados");
    expect(screen.queryByRole("button", { name: t.toc })).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it.each([
    ["enlace sin cerrar", "[texto](https://example.com"],
    ["énfasis sin cerrar", "**negrita _cursiva"],
    ["tabla rota", "| a | b |\n|---|\n| 1 | 2 | 3 |"],
    ["bloque sin cerrar", "```js\nconst a = 1;"],
    ["lista con saltos raros", "- a\n    - b\n  - c\n\t- d"],
    ["anidamiento extremo", `${">".repeat(500)} cita\n\n${"- ".repeat(200)}x`],
    ["controles y NUL escapados", "texto \u0001\u0007 � fin"],
  ])("Markdown mal formado (%s) se muestra como texto sin fallar", (_caso, texto) => {
    const { articulo } = montar(texto);
    expect(articulo.textContent?.length).toBeGreaterThan(0);
  });
});

describe("MarkdownView: HTML crudo", () => {
  it("se ve como texto, salvo los comentarios, que se quitan", () => {
    const { articulo } = montar(
      "<!-- nota para quien mantiene -->\n\n# Título\n\nAntes <!-- en línea --> después.\n\n<details><summary>x</summary>y</details>\n\n> <!--\n> varias líneas\n> -->\n> cita",
    );
    expect(articulo).not.toHaveTextContent("nota para quien mantiene");
    expect(articulo).not.toHaveTextContent("en línea");
    expect(articulo).not.toHaveTextContent("varias líneas");
    expect(articulo).toHaveTextContent("Antes después.");
    expect(articulo).toHaveTextContent("<details><summary>x</summary>y</details>");
    expect(articulo.querySelector("details, summary")).toBeNull();
    expect(articulo.querySelector("blockquote")).toHaveTextContent("cita");
  });

  it("un comentario sin cerrar no se quita (sería ocultar texto): se ve", () => {
    const { articulo } = montar("<!-- sin cerrar\n\ntexto");
    expect(articulo).toHaveTextContent("<!-- sin cerrar");
  });
});

describe("MarkdownView: enlaces", () => {
  it("un externo se abre por la plataforma, en pestaña nueva y sin opener ni referer", () => {
    const { en, onOpenExternal } = montar(fixture("basico.md"));
    const enlace = en.getByRole("link", { name: "enlace externo" });
    expect(enlace).toHaveAttribute("href", "https://example.com/bpdf");
    expect(enlace).toHaveAttribute("target", "_blank");
    expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
    expect(enlace).toHaveAttribute("title", "Web de ejemplo");

    const noCancelado = fireEvent.click(enlace);
    expect(noCancelado).toBe(false); // la navegación del navegador se cancela
    expect(onOpenExternal).toHaveBeenCalledWith("https://example.com/bpdf");
    expect(
      screen.getByText(t.link.announceExternal("https://example.com/bpdf")),
    ).toBeInTheDocument();

    // El clic central no abre nada por su cuenta.
    expect(
      fireEvent(enlace, new MouseEvent("auxclick", { button: 1, bubbles: true, cancelable: true })),
    ).toBe(false);
    expect(onOpenExternal).toHaveBeenCalledTimes(1);
  });

  it("mailto también es externo", () => {
    const { en, onOpenExternal } = montar(fixture("basico.md"));
    fireEvent.click(en.getByRole("link", { name: "soporte" }));
    expect(onOpenExternal).toHaveBeenCalledWith("mailto:soporte@example.com");
  });

  it("un ancla desplaza dentro del documento y lleva el foco al encabezado", () => {
    const { en, onOpenExternal } = montar(fixture("basico.md"));
    const ancla = en.getByRole("link", { name: "tabla" });
    expect(ancla).toHaveAttribute("href", "#md-tabla");
    fireEvent.click(ancla);
    expect(en.getByRole("heading", { level: 2, name: "Tabla" })).toHaveFocus();
    expect(onOpenExternal).not.toHaveBeenCalled();
  });

  it("un enlace a otro fichero o bloqueado se pinta como texto, con el motivo", () => {
    const { articulo, en } = montar("[otro](otro.md) y [malo](javascript:alert(1))");
    expect(en.queryAllByRole("link")).toHaveLength(0);
    expect(articulo.querySelector("[href]")).toBeNull();
    expect(articulo).toHaveTextContent(`otro (${t.link.local})`);
    expect(articulo).toHaveTextContent(`malo (${t.link.blocked})`);
  });
});

describe("MarkdownView: imágenes remotas y sin recursos", () => {
  it("remota: marcador con su texto alternativo y enlace para abrirla fuera", () => {
    const { articulo, en, onOpenExternal } = montar(
      "![logo del proyecto](https://example.com/logo.png)",
    );
    expect(articulo.querySelector("img")).toBeNull();
    expect(articulo).toHaveTextContent(`logo del proyecto (${t.image.remote})`);
    fireEvent.click(en.getByRole("link", { name: t.image.openRemote }));
    expect(onOpenExternal).toHaveBeenCalledWith("https://example.com/logo.png");
  });

  it("local sin recursos entregados: marcador que explica cómo verla", () => {
    const { articulo } = montar("![Logo](./logo.png)\n\n![](images/example.jpg)");
    expect(articulo.querySelector("img")).toBeNull();
    const local = t.image.local["no-encontrado"];
    expect(articulo).toHaveTextContent(`Logo (${local})`);
    expect(articulo).toHaveTextContent(`${t.image.noAlt} (${local})`);
    expect(articulo.querySelector('[data-imagen="no-encontrado"]')).toHaveAttribute(
      "title",
      t.image.localHint["no-encontrado"],
    );
  });
});

describe("MarkdownView: índice", () => {
  it("lista los encabezados h1–h6 con ids únicos y salta a cada uno", () => {
    montar(fixture("indice.md"));
    abrirIndice();
    const indice = screen.getByRole("navigation", { name: t.tocLabel });
    const entradas = within(indice).getAllByRole("link");
    expect(entradas.map((e) => e.textContent)).toEqual([
      "Guía larga",
      "Instalación",
      "Requisitos",
      "Requisitos",
      "Uso",
      "Opciones avanzadas",
      "Nivel cuatro",
      "Nivel cinco",
      "Nivel seis",
      "Uso",
      "¿Preguntas? ¡Frecuentes!",
      "código y énfasis en el título",
      "Sección final",
    ]);
    const hrefs = entradas.map((e) => e.getAttribute("href"));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    expect(hrefs.slice(2, 4)).toEqual(["#md-requisitos", "#md-requisitos-1"]);
    expect(hrefs[10]).toBe("#md-preguntas-frecuentes");

    fireEvent.click(entradas[3] as HTMLElement);
    expect(document.activeElement).toHaveTextContent("Requisitos");
    expect(document.activeElement?.id).toBe("md-requisitos-1");
  });

  it("los enlaces del documento a secciones funcionan con acentos y repetidos", () => {
    const { en } = montar(fixture("indice.md"));
    fireEvent.click(en.getByRole("link", { name: "segundos requisitos" }));
    expect(document.activeElement?.id).toBe("md-requisitos-1");
    fireEvent.click(en.getByRole("link", { name: "instalación" }));
    expect(document.activeElement?.id).toBe("md-instalación");
  });

  it("el botón del índice dice si está abierto y a qué controla", () => {
    montar(fixture("indice.md"));
    const boton = screen.getByRole("button", { name: t.toc });
    expect(boton).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(boton);
    expect(boton).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(boton.getAttribute("aria-controls") ?? "")).toBe(
      screen.getByRole("navigation"),
    );
    fireEvent.click(boton);
    expect(screen.queryByRole("navigation")).toBeNull();
  });

  it("con un solo encabezado no hay índice", () => {
    montar("# Único\n\ntexto");
    expect(screen.queryByRole("button", { name: t.toc })).toBeNull();
  });

  it("con el índice abierto, sin violaciones de accesibilidad", async () => {
    const { container } = montar(fixture("indice.md"));
    abrirIndice();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("MarkdownView: código", () => {
  it("resalta los lenguajes soportados y deja el resto como texto", async () => {
    const { articulo, container } = montar(fixture("codigo.md"));
    const bloques = [...articulo.querySelectorAll(".md-codigo")];
    expect(bloques).toHaveLength(14);
    const lenguajes = bloques.map((b) => b.querySelector(".md-codigo-lenguaje")?.textContent);
    expect(lenguajes.slice(0, 11)).toEqual([
      "js",
      "ts",
      "jsx",
      "tsx",
      "json",
      "html",
      "css",
      "bash",
      "python",
      "markdown",
      "sql",
    ]);
    for (const b of bloques.slice(0, 11)) {
      expect(b.querySelector("code")?.className).toMatch(/^hljs language-/);
      expect(b.querySelector("code span[class^='hljs-']")).not.toBeNull();
    }
    // Sin lenguaje, desconocido o `text`: texto tal cual, sin spans.
    for (const b of bloques.slice(11)) {
      expect(b.querySelector("code span")).toBeNull();
    }
    expect(lenguajes[11]).toBe(t.code.noLanguage);
    expect(bloques[11]?.querySelector("code")?.textContent).toBe(
      "Texto preformateado    con   espacios\n\ty un tabulador.",
    );
    // El HTML de un bloque es texto, no elementos.
    expect(articulo.querySelector("pre script, pre a")).toBeNull();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("copiar escribe exactamente el código, avisa y vuelve al estado inicial", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const { en } = montar("```ts\nconst a = 1;\n\nconst b = 2;\n```");
    const boton = en.getByRole("button", { name: t.code.copy });

    await act(async () => fireEvent.click(boton));
    expect(writeText).toHaveBeenCalledWith("const a = 1;\n\nconst b = 2;");
    expect(boton).toHaveTextContent(t.code.copied);
    expect(en.getByText(t.code.announceCopied)).toBeInTheDocument();
    // El código mostrado no ha cambiado.
    expect(boton.closest(".md-codigo")?.querySelector("code")?.textContent).toBe(
      "const a = 1;\n\nconst b = 2;",
    );

    await act(async () => vi.advanceTimersByTime(DURACION_AVISO_MS));
    expect(boton).toHaveTextContent(t.code.copy);
  });

  it("sin API de portapapeles, o si falla, lo dice sin romper", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: undefined });
    const { en } = montar("```\nx\n```");
    await act(async () => fireEvent.click(en.getByRole("button", { name: t.code.copy })));
    expect(en.getByRole("button", { name: t.code.copyFailed })).toBeInTheDocument();
    expect(en.getByText(t.code.announceFailed)).toBeInTheDocument();
  });

  it("si el navegador rechaza la escritura, también lo dice", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn(async () => Promise.reject(new Error("denegado"))) },
    });
    const { en } = montar("```\nx\n```");
    await act(async () => fireEvent.click(en.getByRole("button", { name: t.code.copy })));
    expect(en.getByRole("button", { name: t.code.copyFailed })).toBeInTheDocument();
  });
});

describe("MarkdownView: ciclo de vida", () => {
  it("al desmontar no deja temporizadores pendientes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn(async () => {}) } });
    const { en, unmount } = montar("```\nx\n```\n\n```\ny\n```");
    for (const b of en.getAllByRole("button", { name: t.code.copy })) {
      await act(async () => fireEvent.click(b));
    }
    // Los dos avisos de «Copiado», más lo que tenga pendiente React.
    const conAvisos = vi.getTimerCount();
    expect(conAvisos).toBeGreaterThanOrEqual(2);
    unmount();
    expect(vi.getTimerCount()).toBe(conAvisos - 2);
  });

  it("no deja listeners globales ni crea URL de objeto", () => {
    const enVentana = vi.spyOn(window, "addEventListener");
    const quitaDeVentana = vi.spyOn(window, "removeEventListener");
    const enDocumento = vi.spyOn(document, "addEventListener");
    const crearUrl = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: crearUrl }));
    const { unmount } = montar(fixture("gfm.md"));
    // El único global: el `storage` de las preferencias (Fase 10, la tipografía al día
    // con otras pestañas), que se quita al desmontar con el mismo manejador.
    expect(enVentana.mock.calls.map(([tipo]) => tipo)).toEqual(["storage"]);
    unmount();
    expect(quitaDeVentana.mock.calls.map(([tipo]) => tipo)).toEqual(["storage"]);
    expect(quitaDeVentana.mock.calls[0]?.[1]).toBe(enVentana.mock.calls[0]?.[1]);
    expect(enDocumento).not.toHaveBeenCalled();
    expect(crearUrl).not.toHaveBeenCalled();
    enVentana.mockRestore();
    quitaDeVentana.mockRestore();
    enDocumento.mockRestore();
  });

  it("cambiar de documento (otro key) sustituye el contenido y el índice", () => {
    const onClose = vi.fn();
    const primero = documento(fixture("indice.md"), "uno.md");
    const segundo = documento("# Otro\n\n## Distinto\n\ntexto", "dos.md");
    const props = { onClose, onOpenExternal: () => {} };
    const { rerender } = render(<MarkdownView key={primero.id} documento={primero} {...props} />);
    abrirIndice();
    rerender(<MarkdownView key={segundo.id} documento={segundo} {...props} />);
    expect(screen.getAllByRole("heading", { level: 1 })[0]).toHaveTextContent("dos.md");
    expect(screen.queryByText("Guía larga")).toBeNull();
    abrirIndice();
    const entradas = within(screen.getByRole("navigation")).getAllByRole("link");
    expect(entradas.map((e) => e.textContent)).toEqual(["Otro", "Distinto"]);
  });

  it("un documento grande pinta primero el aviso y después el contenido y su índice", async () => {
    let texto = "# Grande\n\n";
    for (let i = 0; texto.length <= UMBRAL_DIFERIDO; i++) texto += `## Parte ${i}\n\ntexto\n\n`;
    const { articulo } = montar(texto);
    expect(within(articulo).getByRole("status")).toHaveTextContent(t.loading);
    expect(articulo.querySelector(".md-contenido")).toHaveAttribute("aria-busy", "true");
    expect(screen.getAllByRole("heading", { level: 1 })[0]).toHaveFocus();

    expect(
      await within(articulo).findByRole("heading", { name: "Grande" }, { timeout: 10000 }),
    ).toBeInTheDocument();
    expect(within(articulo).queryByRole("status")).toBeNull();
    expect(articulo.querySelector(".md-contenido")).toHaveAttribute("aria-busy", "false");
    expect(screen.getByRole("button", { name: t.toc })).toBeInTheDocument();
  }, 15000);

  it("uno pequeño se pinta a la primera, sin aviso", () => {
    const { articulo } = montar("# Pequeño");
    expect(within(articulo).queryByRole("status")).toBeNull();
    expect(within(articulo).getByRole("heading", { name: "Pequeño" })).toBeInTheDocument();
  });

  it("cerrar un documento grande antes de pintarlo no deja nada pendiente", () => {
    vi.useFakeTimers();
    const { unmount } = montar("x".repeat(UMBRAL_DIFERIDO + 1));
    const pendientes = vi.getTimerCount();
    expect(pendientes).toBeGreaterThanOrEqual(1); // el requestAnimationFrame
    unmount();
    expect(vi.getTimerCount()).toBe(pendientes - 1);
  });

  it("cerrar llama a onClose", () => {
    const { onClose } = montar("# a");
    fireEvent.click(screen.getByRole("button", { name: t.close }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
