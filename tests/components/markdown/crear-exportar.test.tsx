// @vitest-environment jsdom

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearMarkdown } from "@/documents/nuevo";
import { crearRecursos } from "@/documents/recursos";
import type { OpenedMarkdown } from "@/documents/types";
import { GuardarComo } from "@/editor/GuardarComo";
import { messages } from "@/i18n/messages";
import MarkdownView from "@/markdown/MarkdownView";
import type { OpcionesGuardado, ResultadoGuardado } from "@/platform";
import { fichero, markdown } from "../../helpers/documentos";

vi.mock("@/editor/EditorMarkdown", async () => import("../../helpers/editor-falso"));

const t = messages.markdown;
const s = t.saveAs;

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:bpdf/1");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.restoreAllMocks();
});

async function montar(documento: OpenedMarkdown) {
  const onGuardar = vi.fn(
    async (_texto: string, _opciones?: OpcionesGuardado): Promise<ResultadoGuardado> => "guardado",
  );
  const onModificado = vi.fn();
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <MarkdownView
        documento={documento}
        onClose={() => {}}
        onOpenExternal={() => {}}
        onModificado={onModificado}
        onGuardar={onGuardar}
      />,
    );
  });
  return { ...utils, onGuardar, onModificado };
}

const boton = (nombre: string) => screen.getByRole("button", { name: nombre });

async function abrirGuardarComo() {
  await act(async () => fireEvent.click(boton(s.button)));
  return screen.getByRole("dialog", { name: s.title });
}

describe("documento nuevo (Fase 17)", () => {
  it("empieza en «Dividido», con el editor cargado y el foco en él; «Sin título», sin cambios", async () => {
    await montar(crearMarkdown());
    expect(boton(t.mode.dividido)).toHaveAttribute("aria-pressed", "true");
    const editor = await screen.findByRole("textbox", { name: t.editor.label });
    await vi.waitFor(() => expect(editor).toHaveFocus());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.document.newUntitled,
    );
    expect(screen.queryByText(t.modified)).toBeNull();
  });

  it("un Markdown abierto sigue empezando en «Lectura»", async () => {
    await montar(markdown("# Hola"));
    expect(boton(t.mode.lectura)).toHaveAttribute("aria-pressed", "true");
  });

  it("escribir lo marca como modificado; Ctrl+S sigue siendo guardar el Markdown, sin opciones", async () => {
    const { onGuardar, onModificado } = await montar(crearMarkdown());
    const editor = await screen.findByRole("textbox", { name: t.editor.label });
    act(() => {
      fireEvent.change(editor, { target: { value: "# Nuevo" } });
    });
    expect(onModificado).toHaveBeenLastCalledWith(true);
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true })),
    );
    expect(onGuardar).toHaveBeenCalledWith("# Nuevo");
    expect(onModificado).toHaveBeenLastCalledWith(false);
  });
});

describe("Guardar como… (Fase 17)", () => {
  it("es un diálogo con nombre, formato y colores agrupados, sin violaciones de axe", async () => {
    const { container } = await montar(markdown("# Hola"));
    const dialogo = await abrirGuardarComo();
    expect(within(dialogo).getByRole("group", { name: s.format })).toBeInTheDocument();
    expect(within(dialogo).getByRole("radio", { name: s.markdown })).toBeChecked();
    // Los colores solo cuentan para PDF: desactivados con Markdown.
    expect(within(dialogo).getByRole("radio", { name: s.light })).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Markdown: guarda el texto actual pidiendo destino (nuevoDestino)", async () => {
    const { onGuardar } = await montar(markdown("# Hola"));
    const dialogo = await abrirGuardarComo();
    await act(async () =>
      fireEvent.click(within(dialogo).getByRole("button", { name: s.confirm })),
    );
    expect(onGuardar).toHaveBeenCalledWith("# Hola", { nuevoDestino: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Cancelar y Esc cierran sin guardar nada", async () => {
    const { onGuardar } = await montar(markdown("# Hola"));
    let dialogo = await abrirGuardarComo();
    await act(async () => fireEvent.click(within(dialogo).getByRole("button", { name: s.cancel })));
    expect(screen.queryByRole("dialog")).toBeNull();
    dialogo = await abrirGuardarComo();
    await act(async () => fireEvent(dialogo, new Event("cancel", { cancelable: true })));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onGuardar).not.toHaveBeenCalled();
  });
});

describe("Exportar a PDF (Fase 17)", () => {
  /** Exporta con el tema dado y devuelve lo que vio `window.print` al llamarse. */
  async function exportar(tema: "claro" | "oscuro") {
    const visto: { tema?: string | null; texto?: string; preparando?: boolean }[] = [];
    window.print = vi.fn(() => {
      const raiz = document.querySelector(".bpdf-impresion");
      visto.push({
        tema: raiz?.getAttribute("data-tema"),
        texto: raiz?.textContent ?? "",
        preparando: screen.queryByText(t.pdf.preparing) !== null,
      });
    });
    const dialogo = await abrirGuardarComo();
    await act(async () => fireEvent.click(within(dialogo).getByRole("radio", { name: s.pdf })));
    await act(async () =>
      fireEvent.click(
        within(dialogo).getByRole("radio", { name: tema === "claro" ? s.light : s.dark }),
      ),
    );
    await act(async () =>
      fireEvent.click(within(dialogo).getByRole("button", { name: s.confirm })),
    );
    return visto;
  }

  it("muestra «Preparando PDF…», imprime la copia del documento con su tema y la quita al terminar", async () => {
    await montar(markdown("# Informe\n\nTexto del documento."));
    const visto = await exportar("oscuro");
    expect(screen.getByRole("status")).toHaveTextContent(t.pdf.preparing);
    await vi.waitFor(() => expect(window.print).toHaveBeenCalledOnce());
    expect(visto[0]).toMatchObject({ tema: "oscuro", preparando: false });
    expect(visto[0]?.texto).toContain("Texto del documento.");
    // Solo el documento: nada de la interfaz de BPDF en la copia.
    expect(visto[0]?.texto).not.toContain(s.button);
    expect(visto[0]?.texto).not.toContain(t.mode.dividido);
    // Sigue montada hasta que el navegador cierra el diálogo.
    expect(document.querySelector(".bpdf-impresion")).not.toBeNull();
    await act(async () => window.dispatchEvent(new Event("afterprint")));
    expect(document.querySelector(".bpdf-impresion")).toBeNull();
  });

  it("exporta el texto editado, también desde «Edición» (sin vista previa montada)", async () => {
    await montar(markdown("# Original"));
    await act(async () => fireEvent.click(boton(t.mode.edicion)));
    const editor = await screen.findByRole("textbox", { name: t.editor.label });
    act(() => {
      fireEvent.change(editor, { target: { value: "# Editado en edición" } });
    });
    const visto = await exportar("claro");
    await vi.waitFor(() => expect(window.print).toHaveBeenCalledOnce());
    expect(visto[0]).toMatchObject({ tema: "claro" });
    expect(visto[0]?.texto).toContain("Editado en edición");
    await act(async () => window.dispatchEvent(new Event("afterprint")));
  });

  it("no guarda la elección de colores en ningún sitio", async () => {
    await montar(markdown("# Hola"));
    await exportar("oscuro");
    await vi.waitFor(() => expect(window.print).toHaveBeenCalledOnce());
    await act(async () => window.dispatchEvent(new Event("afterprint")));
    expect([localStorage.length, sessionStorage.length, document.cookie]).toEqual([0, 0, ""]);
  });

  it("sin window.print avisa y no deja nada montado", async () => {
    await montar(markdown("# Hola"));
    const dialogo = await abrirGuardarComo();
    Object.defineProperty(window, "print", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    await act(async () => fireEvent.click(within(dialogo).getByRole("radio", { name: s.pdf })));
    await act(async () =>
      fireEvent.click(within(dialogo).getByRole("button", { name: s.confirm })),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(t.pdf.unavailable);
    expect(document.querySelector(".bpdf-impresion")).toBeNull();
  });
});

describe("Exportar a PDF: la copia temporal no deja rastro (Fase 17)", () => {
  /** Lanza la exportación (PDF, claro) y espera a que se llame a `window.print`. */
  async function exportarHastaImprimir() {
    const dialogo = await abrirGuardarComo();
    await act(async () => fireEvent.click(within(dialogo).getByRole("radio", { name: s.pdf })));
    await act(async () =>
      fireEvent.click(within(dialogo).getByRole("button", { name: s.confirm })),
    );
    await vi.waitFor(() => expect(window.print).toHaveBeenCalled());
  }
  /** Oyentes de `afterprint` que siguen puestos en `window`. */
  function oyentesAfterprint() {
    const vivos = new Set<unknown>();
    // Los métodos de verdad, antes de espiarlos (en jsdom, `window` no admite los de EventTarget.prototype).
    const poner = window.addEventListener.bind(window);
    const quitar = window.removeEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation((tipo, oyente, opciones) => {
      if (tipo === "afterprint") vivos.add(oyente);
      poner(tipo, oyente, opciones);
    });
    vi.spyOn(window, "removeEventListener").mockImplementation((tipo, oyente, opciones) => {
      if (tipo === "afterprint") vivos.delete(oyente);
      quitar(tipo, oyente, opciones);
    });
    return vivos;
  }

  it("cerrar el documento con el diálogo de impresión aún abierto quita la copia y su oyente", async () => {
    window.print = vi.fn();
    const vivos = oyentesAfterprint();
    const { unmount } = await montar(markdown("# Hola"));
    await exportarHastaImprimir();
    expect(document.querySelector(".bpdf-impresion")).not.toBeNull();
    expect(vivos.size).toBe(1);
    unmount();
    expect(document.querySelector(".bpdf-impresion")).toBeNull();
    expect(vivos.size).toBe(0);
  });

  it("exportar otra vez antes de `afterprint` deja una sola copia y un solo oyente", async () => {
    window.print = vi.fn();
    const vivos = oyentesAfterprint();
    await montar(markdown("# Hola"));
    await exportarHastaImprimir();
    await exportarHastaImprimir();
    await vi.waitFor(() => expect(window.print).toHaveBeenCalledTimes(2));
    expect(document.querySelectorAll(".bpdf-impresion")).toHaveLength(1);
    expect(vivos.size).toBe(1);
    await act(async () => window.dispatchEvent(new Event("afterprint")));
    expect(document.querySelector(".bpdf-impresion")).toBeNull();
    expect(vivos.size).toBe(0);
  });

  it("no toca los cambios sin guardar ni el documento de la vista", async () => {
    window.print = vi.fn();
    const { onModificado, container } = await montar(markdown("# Hola\n\nTexto."));
    const antes = container.querySelector("article")?.textContent;
    await exportarHastaImprimir();
    await act(async () => window.dispatchEvent(new Event("afterprint")));
    expect(onModificado).not.toHaveBeenCalled();
    expect(screen.queryByText(t.modified)).toBeNull();
    expect(container.querySelector("article")?.textContent).toBe(antes);
  });

  it("las imágenes locales comparten la URL `blob:` de la vista y no se revoca ninguna de más", async () => {
    window.print = vi.fn();
    // jsdom no carga una URL `blob:` falsa: sin esto, la exportación esperaría a la imagen (bien).
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    const recursos = crearRecursos([{ ruta: "foto.png", file: fichero("foto.png", "x") }], "");
    await montar(markdown("![Foto](foto.png)", "doc.md", recursos));
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    await exportarHastaImprimir();
    await act(async () => window.dispatchEvent(new Event("afterprint")));
    // La copia usó la misma URL (el almacén cuenta usos) y al irse no la revocó: la vista la usa.
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    expect(document.querySelectorAll('img[data-imagen="local"]')).toHaveLength(1);
  });
});

describe("GuardarComo, suelto", () => {
  it("con el teclado: el formulario envía la opción elegida", async () => {
    const onPdf = vi.fn();
    const onMarkdown = vi.fn();
    render(<GuardarComo onMarkdown={onMarkdown} onPdf={onPdf} onCancelar={() => {}} />);
    const dialogo = screen.getByRole("dialog", { name: s.title });
    fireEvent.click(within(dialogo).getByRole("radio", { name: s.pdf }));
    fireEvent.click(within(dialogo).getByRole("radio", { name: s.dark }));
    fireEvent.submit(dialogo.querySelector("form") as HTMLFormElement);
    expect(onPdf).toHaveBeenCalledWith("oscuro");
    expect(onMarkdown).not.toHaveBeenCalled();
  });
});
