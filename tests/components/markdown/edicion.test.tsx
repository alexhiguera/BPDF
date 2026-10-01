// @vitest-environment jsdom

import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { crearRecursos } from "@/documents/recursos";
import type { OpenedMarkdown, RecursosDocumento } from "@/documents/types";
import { ModeSwitch } from "@/editor/ModeSwitch";
import { acotar, MAXIMO, MINIMO, SplitView } from "@/editor/SplitView";
import { messages } from "@/i18n/messages";
import MarkdownView, { ESPERA_VISTA_PREVIA_MS } from "@/markdown/MarkdownView";
import type { ResultadoGuardado } from "@/platform";
import { fichero, markdown } from "../../helpers/documentos";

vi.mock("@/editor/EditorMarkdown", async () => import("../../helpers/editor-falso"));

const t = messages.markdown;

let urls = 0;
beforeEach(() => {
  urls = 0;
  URL.createObjectURL = vi.fn(() => `blob:bpdf/${++urls}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

type Opciones = {
  documento?: OpenedMarkdown;
  onGuardar?: (texto: string) => Promise<ResultadoGuardado>;
  umbralPausaMs?: number;
};

async function montar(texto: string, opciones: Opciones = {}) {
  const onModificado = vi.fn();
  const onGuardar = vi.fn(opciones.onGuardar ?? (async () => "guardado" as const));
  let utils!: ReturnType<typeof render>;
  await act(async () => {
    utils = render(
      <MarkdownView
        documento={opciones.documento ?? markdown(texto)}
        onClose={() => {}}
        onOpenExternal={() => {}}
        onModificado={onModificado}
        onGuardar={onGuardar}
        umbralPausaMs={opciones.umbralPausaMs}
      />,
    );
  });
  const articulo = () => utils.container.querySelector("article") as HTMLElement;
  return { ...utils, onModificado, onGuardar, articulo };
}

const boton = (nombre: string) => screen.getByRole("button", { name: nombre });
const editor = () => screen.findByRole("textbox", { name: t.editor.label });
async function modo(m: "lectura" | "edicion" | "dividido") {
  await act(async () => fireEvent.click(boton(t.mode[m])));
}
/** Sustituye el texto del editor (ya cargado: síncrono, vale con temporizadores falsos). */
async function escribir(texto: string) {
  await editor();
  teclear(texto);
}
function teclear(texto: string) {
  const area = screen.getByRole("textbox", { name: t.editor.label });
  act(() => {
    fireEvent.change(area, { target: { value: texto } });
  });
}

describe("modos: lectura, edición y dividido", () => {
  it("empieza en lectura, sin cargar el editor; el modo se ve y se anuncia", async () => {
    const { container, articulo } = await montar("# Hola");
    expect(boton(t.mode.lectura)).toHaveAttribute("aria-pressed", "true");
    expect(boton(t.mode.edicion)).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("group", { name: t.mode.label })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: t.editor.label })).toBeNull();
    expect(articulo()).toBeVisible();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("edición: solo el editor; la vista previa no está montada (no cuesta nada al teclear)", async () => {
    const { articulo } = await montar("# Hola");
    await modo("edicion");
    expect(await editor()).toHaveValue("# Hola");
    expect(articulo()).toBeNull();
  });

  it("lectura ↔ dividido comparten la vista previa sin volver a montarla", async () => {
    const { articulo } = await montar("# Hola");
    const vista = articulo();
    await modo("dividido");
    await editor();
    expect(articulo()).toBe(vista);
    await modo("lectura");
    expect(articulo()).toBe(vista);
    // El editor ya cargado se queda (oculto) en lectura.
    expect(screen.getByRole("textbox", { name: t.editor.label, hidden: true })).not.toBeVisible();
  });

  it("cambiar de modo no pierde el texto editado y la lectura lo muestra al instante", async () => {
    const { articulo } = await montar("# Hola");
    await modo("edicion");
    await escribir("# Adiós\n\nNuevo párrafo.");
    await modo("lectura");
    expect(within(articulo()).getByRole("heading", { name: "Adiós" })).toBeInTheDocument();
    await modo("dividido");
    expect(await editor()).toHaveValue("# Adiós\n\nNuevo párrafo.");
  });

  it("sin accesibilidad rota en dividido (editor, separador y vista previa)", async () => {
    const { container } = await montar("# Hola\n\ntexto");
    await modo("dividido");
    await editor();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("vista previa: 200 ms después de la última tecla", () => {
  it("no se refresca en cada tecla; sí al pasar la espera", async () => {
    const { articulo } = await montar("# Hola");
    await modo("dividido");
    await editor();
    vi.useFakeTimers();
    teclear("# Uno");
    teclear("# Uno dos");
    act(() => vi.advanceTimersByTime(ESPERA_VISTA_PREVIA_MS - 1));
    expect(within(articulo()).getByRole("heading", { level: 1 })).toHaveTextContent("Hola");
    act(() => vi.advanceTimersByTime(1));
    expect(within(articulo()).getByRole("heading", { level: 1 })).toHaveTextContent("Uno dos");
  });

  it("en «Edición» no hay vista previa que refrescar: se pone al día al volver", async () => {
    const { articulo } = await montar("# Hola");
    await modo("edicion");
    await editor();
    vi.useFakeTimers();
    teclear("# Cambiado");
    act(() => vi.advanceTimersByTime(ESPERA_VISTA_PREVIA_MS * 5));
    expect(articulo()).toBeNull();
    vi.useRealTimers();
    await modo("lectura");
    expect(within(articulo()).getByRole("heading", { level: 1 })).toHaveTextContent("Cambiado");
  });

  it("documento caro de pintar: en «Dividido» se pausa, avisa y se actualiza a mano", async () => {
    // Umbral negativo: cualquier pintado cuenta como caro (lo que pasa con 1 MB).
    const { articulo } = await montar("# Hola", { umbralPausaMs: -1 });
    await modo("dividido");
    await editor();
    vi.useFakeTimers();
    // El primer refresco se hace y se mide (en un documento pequeño, abrir no cuenta:
    // incluiría el arranque en frío de la página)…
    teclear("# Uno");
    act(() => vi.advanceTimersByTime(ESPERA_VISTA_PREVIA_MS));
    expect(within(articulo()).getByRole("heading", { level: 1 })).toHaveTextContent("Uno");
    expect(screen.queryByText(t.previewPaused)).toBeNull();
    // …y, como fue caro, los siguientes ya no se hacen solos.
    teclear("# Pausado");
    act(() => vi.advanceTimersByTime(ESPERA_VISTA_PREVIA_MS * 10));
    expect(within(articulo()).getByRole("heading", { level: 1 })).toHaveTextContent("Uno");
    const aviso = screen.getByText(t.previewPaused);
    expect(aviso.closest('[role="status"]')).not.toBeNull();
    vi.useRealTimers();
    await act(async () => fireEvent.click(boton(t.previewRefresh)));
    expect(within(articulo()).getByRole("heading", { level: 1 })).toHaveTextContent("Pausado");
    expect(screen.queryByText(t.previewPaused)).toBeNull();
  });
});

describe("cambios y guardar", () => {
  it("la primera tecla marca «modificado» (una vez) y se ve en la barra", async () => {
    const { onModificado } = await montar("# Hola");
    await modo("edicion");
    expect(screen.queryByText(t.modified)).toBeNull();
    await escribir("# Hola!");
    await escribir("# Hola!!");
    expect(onModificado.mock.calls).toEqual([[true]]);
    expect(screen.getByText(t.modified)).toBeInTheDocument();
  });

  it("guardar (botón) entrega el texto actual y deja el documento limpio", async () => {
    const { onGuardar, onModificado, container } = await montar("# Hola");
    await modo("edicion");
    await escribir("# Guardado");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: t.save })));
    expect(onGuardar).toHaveBeenCalledWith("# Guardado");
    expect(onModificado).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText(t.modified)).toBeNull();
    expect(container.querySelector("[aria-live]")).toHaveTextContent(t.saved);
  });

  it("Ctrl+S y ⌘+S guardan (y no dejan pasar el «Guardar página» del navegador)", async () => {
    const { onGuardar } = await montar("# Hola");
    const ctrl = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true });
    await act(async () => window.dispatchEvent(ctrl));
    expect(ctrl.defaultPrevented).toBe(true);
    await act(async () =>
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", metaKey: true })),
    );
    expect(onGuardar).toHaveBeenCalledTimes(2);
    // Con Mayúsculas o Alt no es guardar.
    await act(async () =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "S", ctrlKey: true, shiftKey: true }),
      ),
    );
    expect(onGuardar).toHaveBeenCalledTimes(2);
  });

  it("con un diálogo modal abierto, Ctrl+S no guarda (ni abre el «Guardar página» del navegador)", async () => {
    const { onGuardar } = await montar("# Hola");
    const dialogo = document.createElement("dialog");
    dialogo.setAttribute("open", "");
    document.body.append(dialogo);
    const ctrl = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true });
    await act(async () => window.dispatchEvent(ctrl));
    expect(ctrl.defaultPrevented).toBe(true);
    expect(onGuardar).not.toHaveBeenCalled();
    dialogo.remove();
  });

  it("si falla, lo dice y el documento sigue modificado", async () => {
    const { onModificado } = await montar("# Hola", {
      onGuardar: async () => {
        throw new Error("disco lleno");
      },
    });
    await modo("edicion");
    await escribir("# Cambio");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: t.save })));
    expect(screen.getByRole("alert")).toHaveTextContent(t.saveFailed);
    expect(onModificado).not.toHaveBeenCalledWith(false);
    expect(screen.getByText(t.modified)).toBeInTheDocument();
  });

  it("cancelar el diálogo de guardar no cambia nada; una descarga cuenta como guardado", async () => {
    const respuestas: ResultadoGuardado[] = ["cancelado", "descargado"];
    const { onModificado, container } = await montar("# Hola", {
      onGuardar: async () => respuestas.shift() ?? "guardado",
    });
    await modo("edicion");
    await escribir("# Cambio");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: t.save })));
    expect(screen.getByText(t.modified)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: t.save })));
    expect(onModificado).toHaveBeenLastCalledWith(false);
    expect(container.querySelector("[aria-live]")).toHaveTextContent(t.downloaded);
  });

  it("lo escrito mientras se guardaba sigue sin guardar", async () => {
    let terminar: (r: ResultadoGuardado) => void = () => {};
    const { onModificado } = await montar("# Hola", {
      onGuardar: () =>
        new Promise<ResultadoGuardado>((r) => {
          terminar = r;
        }),
    });
    await modo("edicion");
    await escribir("# Uno");
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: t.save }));
    });
    await escribir("# Uno dos");
    await act(async () => terminar("guardado"));
    expect(onModificado).not.toHaveBeenCalledWith(false);
    expect(screen.getByText(t.modified)).toBeInTheDocument();
  });
});

describe("la vista previa aplica las mismas políticas que el lector", () => {
  function recursos(rutas: string[]): RecursosDocumento {
    return crearRecursos(
      rutas.map((ruta) => ({ ruta, file: fichero(ruta.split("/").pop() ?? ruta, "x") })),
      "",
    );
  }

  it("HTML, javascript: y controladores escritos en el editor no se ejecutan", async () => {
    const { articulo } = await montar("# Hola");
    await modo("dividido");
    await escribir(
      '<script>window.__xss = 1</script>\n\n<img src=x onerror="window.__xss=2">\n\n[pulsa](javascript:alert(1))\n\n<svg onload="alert(1)"></svg>',
    );
    await modo("lectura");
    const a = articulo();
    expect(a.querySelector("script, img, svg:not(.lucide), iframe")).toBeNull();
    expect(a.querySelector('[href^="javascript"]')).toBeNull();
    expect(a).toHaveTextContent("<script>window.__xss = 1</script>");
    expect((window as unknown as { __xss?: number }).__xss).toBeUndefined();
  });

  it("recursos: solo los entregados al abrir; nada fuera ni nada nuevo", async () => {
    const documento = markdown("# Doc", "doc.md", recursos(["img/foto.png"]));
    const { articulo } = await montar("", { documento });
    await modo("edicion");
    await escribir("![foto](img/foto.png)\n\n![secreto](../fuera.png)\n\n![nueva](nueva.png)");
    await modo("lectura");
    const a = articulo();
    const [foto] = [...a.querySelectorAll("img")];
    expect(foto).toHaveAttribute("src", "blob:bpdf/1");
    expect(a.querySelectorAll("img")).toHaveLength(1);
    expect(a).toHaveTextContent(t.image.local.fuera);
    expect(a).toHaveTextContent(t.image.local["no-encontrado"]);
    expect(urls).toBe(1);
  });

  it("fórmulas y diagramas escritos se pintan con el mismo pipeline", async () => {
    const { articulo } = await montar("# Hola");
    await modo("edicion");
    await escribir("Fórmula $x^2$\n\n```mermaid\nflowchart LR\n  A --> B\n```");
    await modo("lectura");
    const a = articulo();
    await vi.waitFor(() => expect(a.querySelector("[data-formula]")).not.toBeNull());
    expect(a.querySelector("[data-diagrama]")).not.toBeNull();
    expect(a.querySelector("[data-diagrama] code")).toHaveTextContent("flowchart LR");
  });
});

describe("ModeSwitch y SplitView sueltos", () => {
  it("ModeSwitch: botones con texto y aria-pressed dentro de un grupo con nombre", async () => {
    const onModo = vi.fn();
    const { container } = render(<ModeSwitch modo="dividido" onModo={onModo} />);
    expect(boton(t.mode.dividido)).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(boton(t.mode.edicion));
    expect(onModo).toHaveBeenCalledWith("edicion");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("separador: con el teclado, entre los límites, y dice su valor", async () => {
    const { container } = render(<SplitView izquierda={<p>a</p>} derecha={<p>b</p>} />);
    const sep = screen.getByRole("separator", { name: t.split.separator });
    expect(sep).toHaveAttribute("aria-valuenow", "50");
    expect(sep).toHaveAttribute("aria-valuetext", t.split.value(50));
    fireEvent.keyDown(sep, { key: "ArrowRight" });
    expect(sep).toHaveAttribute("aria-valuenow", "55");
    fireEvent.keyDown(sep, { key: "End" });
    expect(sep).toHaveAttribute("aria-valuenow", String(MAXIMO));
    fireEvent.keyDown(sep, { key: "ArrowRight" });
    expect(sep).toHaveAttribute("aria-valuenow", String(MAXIMO));
    fireEvent.keyDown(sep, { key: "Home" });
    expect(sep).toHaveAttribute("aria-valuenow", String(MINIMO));
    fireEvent.keyDown(sep, { key: "ArrowLeft" });
    expect(sep).toHaveAttribute("aria-valuenow", String(MINIMO));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("acotar: ningún panel desaparece", () => {
    expect(acotar(0)).toBe(MINIMO);
    expect(acotar(100)).toBe(MAXIMO);
    expect(acotar(42.4)).toBe(42);
  });

  it("con un solo panel, el separador y el otro panel quedan ocultos", () => {
    render(<SplitView mostrar="derecha" izquierda={<p>izq</p>} derecha={<p>der</p>} />);
    expect(screen.queryByRole("separator")).toBeNull();
    expect(screen.getByText("izq").closest("[hidden]")).not.toBeNull();
    expect(screen.getByText("der").closest("[hidden]")).toBeNull();
  });
});
