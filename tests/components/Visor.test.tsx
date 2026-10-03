// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { createRef, type MutableRefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Visor } from "@/app/pdf/Visor";
import { messages } from "@/i18n/messages";
import type { OpcionesBusqueda } from "@/pdf/visor/busqueda";
import type { ControladorVisor, EstadoBusqueda } from "@/pdf/visor/controlador";
import type { DestinoEnlace } from "@/pdf/visor/enlaces";
import type { ParametrosPintura } from "@/pdf/visor/superficie";

const t = messages.pdf;
const A4 = { ancho: 595, alto: 842 };

/**
 * El visor con un controlador de mentira: la interfaz (barra, estado, teclado,
 * búsqueda, accesibilidad) sin pdf.js ni lienzos. Lo que pinta se comprueba por
 * lo que la interfaz le pide (`mostrar`). El render real va en Playwright.
 */
function controladorFalso(total: number, huella: string | null = null) {
  const pedidos: { paginas: number[]; p: ParametrosPintura }[] = [];
  const busquedas: string[] = [];
  let responder: (e: EstadoBusqueda) => void = () => {};
  const c = {
    total,
    tipoTransformador: "worker",
    documento: { tamanos: vi.fn(async () => {}), huella },
    memoria: () => ({ lienzos: 0, bytes: 0, pintando: 0 }),
    mostrar: vi.fn((marcos: { numero: number }[], p: ParametrosPintura) =>
      pedidos.push({ paginas: marcos.map((m) => m.numero), p }),
    ),
    mostrarMiniaturas: vi.fn(),
    buscar: vi.fn(
      async (
        consulta: string,
        alProgreso: (e: EstadoBusqueda) => void,
        _opciones?: OpcionesBusqueda,
      ) => {
        busquedas.push(consulta);
        responder = alProgreso;
      },
    ),
    cancelarBusqueda: vi.fn(),
    resaltarBusqueda: vi.fn(),
  };
  return {
    c: c as unknown as ControladorVisor,
    falso: c,
    pedidos,
    busquedas,
    responder: (e: EstadoBusqueda) => act(() => responder(e)),
  };
}

function montar(total = 20, huella: string | null = null) {
  const f = controladorFalso(total, huella);
  const alEnlace = createRef() as MutableRefObject<(d: DestinoEnlace) => void>;
  alEnlace.current = () => {};
  const alCambio = createRef() as MutableRefObject<() => void>;
  alCambio.current = () => {};
  const onClose = vi.fn();
  const onOpenExternal = vi.fn();
  const utils = render(
    <Visor
      controlador={f.c}
      primera={A4}
      nombre="informe.pdf"
      onClose={onClose}
      onOpenExternal={onOpenExternal}
      alEnlace={alEnlace}
      alCambio={alCambio}
    />,
  );
  const ultimo = () => f.pedidos.at(-1);
  return { ...utils, ...f, onClose, onOpenExternal, alEnlace, ultimo };
}

const estadoPagina = () => screen.getByTestId("estado-pagina");
const campo = () => screen.getByRole("textbox", { name: t.pageInput });
const boton = (nombre: string) => screen.getByRole("button", { name: nombre });

describe("Visor: estructura y accesibilidad", () => {
  it("título, barra de herramientas con nombre y barra de estado en texto", () => {
    montar(148);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("informe.pdf");
    expect(screen.getByRole("toolbar", { name: t.toolbar })).toBeInTheDocument();
    expect(estadoPagina()).toHaveTextContent(t.status.page(1, 148));
    expect(screen.getByText(t.pageTotal(148))).toBeInTheDocument();
  });

  it("cada botón tiene nombre accesible (no depende solo del icono) y los modos dicen su estado", () => {
    montar();
    for (const b of screen.getAllByRole("button")) expect(b).toHaveAccessibleName();
    expect(boton(t.modeDark)).toHaveAttribute("aria-pressed", "true");
    expect(boton(t.modeOriginal)).toHaveAttribute("aria-pressed", "false");
    expect(boton(t.viewContinuous)).toHaveAttribute("aria-pressed", "true");
    expect(boton(t.fitWidth)).toHaveAttribute("aria-pressed", "true");
  });

  it("no tiene violaciones de accesibilidad (también con búsqueda y miniaturas)", async () => {
    const { container } = montar();
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(boton(t.search));
    fireEvent.click(boton(t.showThumbnails));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("cerrar el documento avisa a la app", () => {
    const { onClose } = montar();
    fireEvent.click(boton(t.close));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("Visor: navegación", () => {
  it("anterior/siguiente con sus límites", () => {
    montar(3);
    expect(boton(t.previous)).toBeDisabled();
    fireEvent.click(boton(t.next));
    fireEvent.click(boton(t.next));
    expect(estadoPagina()).toHaveTextContent(t.status.page(3, 3));
    expect(boton(t.next)).toBeDisabled();
  });

  it.each(["", "abc", "0", "-1", "1.5", "21"])(
    "el campo de página rechaza «%s» con un aviso y no se mueve",
    (texto) => {
      montar(20);
      fireEvent.change(campo(), { target: { value: texto } });
      fireEvent.keyDown(campo(), { key: "Enter" });
      expect(estadoPagina()).toHaveTextContent(t.status.page(1, 20));
      expect(screen.getByRole("alert")).toHaveTextContent(t.invalidPage(20));
      expect(campo()).toHaveAttribute("aria-invalid", "true");
    },
  );

  it("un número válido lleva a esa página y al salir del campo con uno no válido se restaura", () => {
    montar(20);
    fireEvent.change(campo(), { target: { value: "12" } });
    fireEvent.keyDown(campo(), { key: "Enter" });
    expect(estadoPagina()).toHaveTextContent(t.status.page(12, 20));
    fireEvent.change(campo(), { target: { value: "xx" } });
    fireEvent.blur(campo());
    expect(campo()).toHaveValue("12");
  });

  it("en página a página solo hay un marco; en continua, los vivos", () => {
    const { ultimo } = montar(20);
    expect(ultimo()?.paginas[0]).toBe(1);
    fireEvent.click(boton(t.viewSingle));
    expect(ultimo()?.paginas).toEqual([1]);
    expect(screen.getAllByRole("group", { name: /Página/ })).toHaveLength(1);
    fireEvent.click(boton(t.next));
    expect(ultimo()?.paginas).toEqual([2]);
    fireEvent.click(boton(t.viewContinuous));
    expect(estadoPagina()).toHaveTextContent(t.status.page(2, 20));
  });
});

describe("Visor: zoom, giro y colores", () => {
  it("acercar, alejar y volver al 100 % (el porcentaje se ve)", () => {
    const { ultimo } = montar();
    fireEvent.click(boton(t.zoomReset(Math.round((ultimo()?.p.zoom ?? 0) * 100))));
    expect(ultimo()?.p.zoom).toBe(1);
    expect(screen.getByText(t.zoomPercent(100))).toBeInTheDocument();
    fireEvent.click(boton(t.zoomIn));
    expect(ultimo()?.p.zoom).toBe(1.1);
    fireEvent.click(boton(t.zoomOut));
    fireEvent.click(boton(t.zoomOut));
    expect(ultimo()?.p.zoom).toBe(0.9);
    expect(boton(t.fitWidth)).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(boton(t.fitPage));
    expect(boton(t.fitPage)).toHaveAttribute("aria-pressed", "true");
  });

  it("girar suma 90° y lo dice la barra de estado", () => {
    const { ultimo } = montar();
    fireEvent.click(boton(t.rotate));
    expect(ultimo()?.p.rotacion).toBe(90);
    expect(screen.getByText(t.status.rotation(90))).toBeInTheDocument();
  });

  it("oscuro ↔ original conserva página y zoom", () => {
    const { ultimo } = montar();
    fireEvent.click(boton(t.next));
    const antes = ultimo();
    fireEvent.click(boton(t.modeOriginal));
    expect(ultimo()?.p).toEqual({ ...antes?.p, modo: "original" });
    expect(estadoPagina()).toHaveTextContent(t.status.page(2, 20));
    fireEvent.click(boton(t.modeDark));
    expect(ultimo()?.p.modo).toBe("oscuro");
  });

  it("anuncia los cambios por una región de estado", () => {
    montar();
    fireEvent.click(boton(t.modeOriginal));
    expect(screen.getAllByRole("status").at(-1)).toHaveTextContent(t.announce.mode(t.modeOriginal));
  });
});

describe("Visor: teclado", () => {
  it("AvPág, RePág, Fin, Inicio y Ctrl+0 / Ctrl++", () => {
    const { ultimo } = montar(20);
    fireEvent.keyDown(window, { key: "PageDown" });
    expect(estadoPagina()).toHaveTextContent(t.status.page(2, 20));
    fireEvent.keyDown(window, { key: "End" });
    expect(estadoPagina()).toHaveTextContent(t.status.page(20, 20));
    fireEvent.keyDown(window, { key: "PageUp" });
    fireEvent.keyDown(window, { key: "Home" });
    expect(estadoPagina()).toHaveTextContent(t.status.page(1, 20));
    fireEvent.keyDown(window, { key: "0", ctrlKey: true });
    expect(ultimo()?.p.zoom).toBe(1);
    fireEvent.keyDown(window, { key: "+", ctrlKey: true });
    expect(ultimo()?.p.zoom).toBe(1.1);
  });

  it("no intercepta las teclas mientras se escribe en el campo de página", () => {
    montar(20);
    campo().focus();
    fireEvent.keyDown(campo(), { key: "PageDown" });
    fireEvent.keyDown(campo(), { key: "End" });
    expect(estadoPagina()).toHaveTextContent(t.status.page(1, 20));
  });

  it("Ctrl+F abre la búsqueda con el foco en el campo", () => {
    montar();
    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
    expect(screen.getByRole("searchbox", { name: t.searchLabel })).toHaveFocus();
  });
});

describe("Visor: búsqueda", () => {
  it("busca al escribir, cuenta, va a la primera y recorre con Intro / Mayús+Intro", async () => {
    const { busquedas, responder, falso } = montar(20);
    fireEvent.click(boton(t.search));
    const caja = screen.getByRole("searchbox", { name: t.searchLabel });
    fireEvent.change(caja, { target: { value: "búho" } });
    await waitFor(() => expect(busquedas).toEqual(["búho"]));
    const coincidencias = [4, 9, 9].map((pagina) => ({ pagina, tramos: [] }));
    responder({
      consulta: "búho",
      coincidencias,
      revisadas: 20,
      total: 20,
      terminada: true,
      sinTexto: false,
    });
    expect(screen.getByTestId("estado-busqueda")).toHaveTextContent(t.searchCount(1, 3));
    expect(estadoPagina()).toHaveTextContent(t.status.page(4, 20));
    fireEvent.keyDown(caja, { key: "Enter" });
    expect(screen.getByTestId("estado-busqueda")).toHaveTextContent(t.searchCount(2, 3));
    expect(estadoPagina()).toHaveTextContent(t.status.page(9, 20));
    fireEvent.keyDown(caja, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(caja, { key: "Enter", shiftKey: true });
    expect(screen.getByTestId("estado-busqueda")).toHaveTextContent(t.searchCount(3, 3));
    expect(falso.resaltarBusqueda).toHaveBeenLastCalledWith(coincidencias, 2, true);
  });

  it("sin resultados lo dice; en un documento sin texto explica que no hay OCR", async () => {
    const { responder, busquedas } = montar(2);
    fireEvent.click(boton(t.search));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "x" } });
    await waitFor(() => expect(busquedas).toHaveLength(1));
    responder({
      consulta: "x",
      coincidencias: [],
      revisadas: 2,
      total: 2,
      terminada: true,
      sinTexto: false,
    });
    expect(screen.getByTestId("estado-busqueda")).toHaveTextContent(t.searchNone);
    responder({
      consulta: "x",
      coincidencias: [],
      revisadas: 2,
      total: 2,
      terminada: true,
      sinTexto: true,
    });
    expect(screen.getByTestId("estado-busqueda")).toHaveTextContent(t.searchNoText);
  });

  it("Esc cierra la búsqueda y quita el resaltado", async () => {
    const { falso } = montar();
    fireEvent.click(boton(t.search));
    fireEvent.keyDown(screen.getByRole("searchbox"), { key: "Escape" });
    expect(screen.queryByRole("searchbox")).toBeNull();
    expect(falso.cancelarBusqueda).toHaveBeenCalled();
  });
});

describe("Visor: enlaces del documento", () => {
  it("un enlace interno navega; uno externo se abre por la plataforma", () => {
    const { alEnlace, onOpenExternal } = montar(20);
    act(() => alEnlace.current({ tipo: "interno", pagina: 7 }));
    expect(estadoPagina()).toHaveTextContent(t.status.page(7, 20));
    act(() => alEnlace.current({ tipo: "externo", url: "https://example.com/" }));
    expect(onOpenExternal).toHaveBeenCalledWith("https://example.com/");
  });
});

describe("Visor: atajos de la Fase 6", () => {
  const tecla = (key: string, mod: Partial<KeyboardEvent> = {}) =>
    fireEvent.keyDown(window, { key, ...mod });

  it("T muestra y oculta las miniaturas; R y Mayús+R giran", () => {
    const { ultimo } = montar();
    tecla("t");
    expect(screen.getByRole("navigation", { name: t.thumbnails })).toBeInTheDocument();
    tecla("t");
    expect(screen.queryByRole("navigation", { name: t.thumbnails })).toBeNull();
    tecla("r");
    expect(ultimo()?.p.rotacion).toBe(90);
    tecla("R", { shiftKey: true });
    tecla("R", { shiftKey: true });
    expect(ultimo()?.p.rotacion).toBe(270);
  });

  it("el botón «Girar a la izquierda» resta 90°", () => {
    const { ultimo } = montar();
    fireEvent.click(boton(t.rotateLeft));
    expect(ultimo()?.p.rotacion).toBe(270);
    expect(screen.getByText(t.status.rotation(270))).toBeInTheDocument();
  });

  it("Espacio y Mayús+Espacio pasan de página; sobre un botón, Espacio es del botón", () => {
    montar(20);
    tecla(" ");
    tecla(" ");
    expect(estadoPagina()).toHaveTextContent(t.status.page(3, 20));
    tecla(" ", { shiftKey: true });
    expect(estadoPagina()).toHaveTextContent(t.status.page(2, 20));
    fireEvent.keyDown(boton(t.zoomIn), { key: " " });
    expect(estadoPagina()).toHaveTextContent(t.status.page(2, 20));
  });

  it("→ / ← pasan de página solo en «página a página»", () => {
    montar(20);
    tecla("ArrowRight");
    expect(estadoPagina()).toHaveTextContent(t.status.page(1, 20));
    fireEvent.click(boton(t.viewSingle));
    tecla("ArrowRight");
    tecla("ArrowRight");
    tecla("ArrowLeft");
    expect(estadoPagina()).toHaveTextContent(t.status.page(2, 20));
  });

  it("Ctrl+G lleva el foco al campo de página con su contenido seleccionado", () => {
    montar(20);
    tecla("g", { ctrlKey: true });
    expect(campo()).toHaveFocus();
    const c = campo() as HTMLInputElement;
    expect([c.selectionStart, c.selectionEnd]).toEqual([0, c.value.length]);
  });

  it("F3 / Mayús+F3 recorren las coincidencias, también desde el campo; con la búsqueda cerrada no hacen nada", async () => {
    const { busquedas, responder } = montar(20);
    tecla("F3");
    expect(screen.queryByRole("searchbox")).toBeNull();
    fireEvent.click(boton(t.search));
    const caja = screen.getByRole("searchbox", { name: t.searchLabel });
    fireEvent.change(caja, { target: { value: "x" } });
    await waitFor(() => expect(busquedas).toEqual(["x"]));
    const coincidencias = [4, 9, 12].map((pagina) => ({ pagina, tramos: [] }));
    responder({
      consulta: "x",
      coincidencias,
      revisadas: 20,
      total: 20,
      terminada: true,
      sinTexto: false,
    });
    expect(screen.getByTestId("estado-busqueda")).toHaveTextContent(t.searchCount(1, 3));
    fireEvent.keyDown(caja, { key: "F3" });
    expect(screen.getByTestId("estado-busqueda")).toHaveTextContent(t.searchCount(2, 3));
    tecla("F3");
    expect(estadoPagina()).toHaveTextContent(t.status.page(12, 20));
    tecla("F3", { shiftKey: true });
    tecla("F3", { shiftKey: true });
    expect(screen.getByTestId("estado-busqueda")).toHaveTextContent(t.searchCount(1, 3));
  });

  it("las opciones de búsqueda se ven con aria-pressed y relanzan la búsqueda con ellas", async () => {
    const { falso } = montar(20);
    fireEvent.click(boton(t.search));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Rosa" } });
    await waitFor(() => expect(falso.buscar).toHaveBeenCalledTimes(1));
    expect(falso.buscar.mock.lastCall?.[2]).toEqual({ mayusculas: false, palabraCompleta: false });
    fireEvent.click(boton(t.searchMatchCase));
    expect(boton(t.searchMatchCase)).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(falso.buscar).toHaveBeenCalledTimes(2));
    expect(falso.buscar.mock.lastCall?.[2]).toEqual({ mayusculas: true, palabraCompleta: false });
    fireEvent.click(boton(t.searchWholeWord));
    await waitFor(() => expect(falso.buscar).toHaveBeenCalledTimes(3));
    expect(falso.buscar.mock.lastCall?.[2]).toEqual({ mayusculas: true, palabraCompleta: true });
    expect(boton(t.searchWholeWord)).toHaveAttribute("aria-pressed", "true");
  });

  it("? abre la ayuda; con el diálogo abierto no actúa ningún atajo; se cierra y el foco vuelve", async () => {
    const { container, ultimo } = montar(20);
    const origen = boton(t.zoomIn);
    origen.focus();
    tecla("?", { shiftKey: true });
    const ayuda = screen.getByRole("dialog", { name: t.help.title });
    expect(within(ayuda).getByRole("table", { name: t.help.table })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
    tecla("r");
    tecla("PageDown");
    expect(ultimo()?.p.rotacion).toBe(0);
    expect(estadoPagina()).toHaveTextContent(t.status.page(1, 20));
    fireEvent.click(within(ayuda).getByRole("button", { name: t.help.close }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(origen).toHaveFocus();
  });

  it("el interruptor desactiva los de una tecla (preferencia guardada, Fase 10); el botón de la barra reabre la ayuda", () => {
    const { ultimo, unmount } = montar(20);
    fireEvent.click(boton(t.shortcuts));
    const casilla = screen.getByRole("checkbox", { name: t.help.singleKey });
    expect(casilla).toBeChecked();
    fireEvent.click(casilla);
    expect(casilla).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: t.help.close }));
    for (const k of ["r", "t", "f", "?"]) tecla(k);
    expect(ultimo()?.p.rotacion).toBe(0);
    expect(screen.queryByRole("navigation", { name: t.thumbnails })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    // La navegación sigue.
    tecla(" ");
    expect(estadoPagina()).toHaveTextContent(t.status.page(2, 20));
    // Se guarda en `bpdf:prefs`, y nada más: ni el nombre del documento.
    expect(Object.keys(localStorage)).toEqual(["bpdf:prefs"]);
    expect(JSON.parse(localStorage.getItem("bpdf:prefs") ?? "{}").atajosUnaTecla).toBe(false);
    expect(localStorage.getItem("bpdf:prefs")).not.toContain("informe");
    expect(sessionStorage.length).toBe(0);
    // Otro documento (el visor se monta de nuevo): siguen desactivados.
    unmount();
    montar(20);
    tecla("r");
    expect(screen.queryByText(t.status.rotation(90))).toBeNull();
    fireEvent.click(boton(t.shortcuts));
    fireEvent.click(screen.getByRole("checkbox", { name: t.help.singleKey }));
    fireEvent.click(screen.getByRole("button", { name: t.help.close }));
    tecla("r");
    expect(screen.getByText(t.status.rotation(90))).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("bpdf:prefs") ?? "{}").atajosUnaTecla).toBe(true);
  });
});

describe("Visor: pantalla completa (Fase 6)", () => {
  function conPantallaCompleta() {
    let elemento: Element | null = null;
    const pedir = vi.fn(async function (this: Element) {
      elemento = this;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    const salir = vi.fn(async () => {
      elemento = null;
      document.dispatchEvent(new Event("fullscreenchange"));
    });
    Object.defineProperty(document, "fullscreenEnabled", { configurable: true, value: true });
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => elemento,
    });
    Object.defineProperty(document, "exitFullscreen", { configurable: true, value: salir });
    HTMLElement.prototype.requestFullscreen = pedir as never;
    return { pedir, salir };
  }
  afterEach(() => {
    for (const p of ["fullscreenEnabled", "fullscreenElement", "exitFullscreen"]) {
      delete (document as unknown as Record<string, unknown>)[p];
    }
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).requestFullscreen;
  });

  it("sin soporte del navegador no hay botón y F no hace nada", () => {
    montar();
    expect(screen.queryByRole("button", { name: t.fullscreen })).toBeNull();
    expect(() => fireEvent.keyDown(window, { key: "f" })).not.toThrow();
  });

  it("F y el botón entran y salen; solo el área de lectura; se anuncia", async () => {
    const { pedir, salir } = conPantallaCompleta();
    montar();
    const b = boton(t.fullscreen);
    expect(b).toHaveAttribute("aria-pressed", "false");
    await act(async () => fireEvent.keyDown(window, { key: "f" }));
    expect(pedir).toHaveBeenCalledOnce();
    expect(pedir.mock.contexts[0]).toBe(screen.getByTestId("lector-pdf"));
    expect(b).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("status").at(-1)).toHaveTextContent(t.announce.fullscreen(true));
    await act(async () => fireEvent.click(b));
    expect(salir).toHaveBeenCalledOnce();
    expect(b).toHaveAttribute("aria-pressed", "false");
  });
});

describe("Visor: miniaturas con teclado (Fase 6)", () => {
  it("un solo elemento tabulable; ↑/↓ mueven el foco sin mover el documento", () => {
    montar(5);
    fireEvent.click(boton(t.showThumbnails));
    const panel = screen.getByRole("navigation", { name: t.thumbnails });
    const mini = (n: number) => within(panel).getByRole("button", { name: t.thumbnail(n) });
    expect(
      within(panel)
        .getAllByRole("button")
        .filter((b) => b.tabIndex === 0),
    ).toEqual([mini(1)]);
    mini(1).focus();
    fireEvent.keyDown(mini(1), { key: "ArrowDown" });
    expect(mini(2)).toHaveFocus();
    fireEvent.keyDown(mini(2), { key: "ArrowDown" });
    fireEvent.keyDown(mini(3), { key: "ArrowUp" });
    expect(mini(2)).toHaveFocus();
    expect(mini(2).tabIndex).toBe(0);
    expect(mini(1).tabIndex).toBe(-1);
    // Las flechas del panel no desplazan ni cambian la página del visor.
    expect(estadoPagina()).toHaveTextContent(t.status.page(1, 5));
    // En los extremos, se queda.
    fireEvent.keyDown(mini(2), { key: "ArrowUp" });
    fireEvent.keyDown(mini(1), { key: "ArrowUp" });
    expect(mini(1)).toHaveFocus();
    // Intro/Espacio: es un botón; al activarlo va a su página.
    fireEvent.click(mini(1));
    fireEvent.keyDown(mini(1), { key: "ArrowDown" });
    fireEvent.click(mini(2));
    expect(estadoPagina()).toHaveTextContent(t.status.page(2, 5));
  });
});

describe("Visor: miniaturas", () => {
  it("una por página, la actual marcada, y al pulsarla va a su página", () => {
    montar(5);
    fireEvent.click(boton(t.showThumbnails));
    const panel = screen.getByRole("navigation", { name: t.thumbnails });
    const minis = within(panel).getAllByRole("button");
    expect(minis).toHaveLength(5);
    expect(minis[0]).toHaveAttribute("aria-current", "page");
    fireEvent.click(within(panel).getByRole("button", { name: t.thumbnail(4) }));
    expect(estadoPagina()).toHaveTextContent(t.status.page(4, 5));
    expect(within(panel).getByRole("button", { name: t.thumbnail(4) })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("Visor: preferencias y posición (Fase 10)", () => {
  const HUELLA = "0123456789abcdef0123456789abcdef";
  const tecla = (key: string) => fireEvent.keyDown(window, { key });
  const guardadas = () => JSON.parse(localStorage.getItem("bpdf:positions") ?? "null");
  const prefs = (pdf: object, extra: object = {}) =>
    localStorage.setItem("bpdf:prefs", JSON.stringify({ v: 1, pdf, ...extra }));
  afterEach(() => vi.useRealTimers());

  it("abre con los valores por defecto guardados: colores, zoom, vista y miniaturas", () => {
    prefs({
      modo: "original",
      zoom: { tipo: "fijo", valor: 1.5 },
      vista: "pagina",
      miniaturas: true,
    });
    const { ultimo } = montar(20);
    expect(ultimo()?.p.modo).toBe("original");
    expect(ultimo()?.p.zoom).toBe(1.5);
    expect(screen.getByTestId("lector-pdf")).toHaveAttribute("data-vista", "pagina");
    expect(screen.getByRole("navigation", { name: t.thumbnails })).toBeInTheDocument();
  });

  it("sin nada guardado, lo de siempre (y abrir no escribe nada)", () => {
    const { ultimo } = montar(20, HUELLA);
    expect(ultimo()?.p.modo).toBe("oscuro");
    expect(screen.getByTestId("lector-pdf")).toHaveAttribute("data-vista", "continua");
    expect(screen.queryByRole("navigation", { name: t.thumbnails })).toBeNull();
    expect(localStorage.length).toBe(0);
  });

  it("restaura la página y el zoom guardados para esa huella, por encima del zoom por defecto", () => {
    prefs({ zoom: { tipo: "pagina" } });
    localStorage.setItem(
      "bpdf:positions",
      JSON.stringify({
        v: 1,
        docs: { [HUELLA]: { page: 7, zoom: { tipo: "fijo", valor: 2 }, t: 1 } },
      }),
    );
    const { ultimo } = montar(20, HUELLA);
    expect(estadoPagina()).toHaveTextContent(t.status.page(7, 20));
    expect(ultimo()?.p.zoom).toBe(2);
    // Recuperarla cuenta como uso: su `t` se actualiza.
    expect(guardadas().docs[HUELLA].t).toBeGreaterThan(1);
  });

  it("una página guardada mayor que el documento se acota a la última", () => {
    localStorage.setItem(
      "bpdf:positions",
      JSON.stringify({ v: 1, docs: { [HUELLA]: { page: 99, zoom: { tipo: "ancho" }, t: 1 } } }),
    );
    montar(20, HUELLA);
    expect(estadoPagina()).toHaveTextContent(t.status.page(20, 20));
  });

  it("guarda la posición 1 s después del último cambio, con la huella y sin el nombre", () => {
    vi.useFakeTimers();
    montar(20, HUELLA);
    tecla("PageDown");
    tecla("PageDown");
    act(() => vi.advanceTimersByTime(999));
    expect(guardadas()).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(guardadas().docs[HUELLA]).toMatchObject({ page: 3, zoom: { tipo: "ancho" } });
    expect(Object.keys(localStorage)).toEqual(["bpdf:positions"]);
    expect(localStorage.getItem("bpdf:positions")).not.toContain("informe");
  });

  it("al cerrar el documento (desmontar) guarda lo pendiente sin esperar", () => {
    vi.useFakeTimers();
    const { unmount } = montar(20, HUELLA);
    tecla("End");
    expect(guardadas()).toBeNull();
    unmount();
    expect(guardadas().docs[HUELLA].page).toBe(20);
  });

  it("al salir de la página (`pagehide`) guarda lo pendiente", () => {
    vi.useFakeTimers();
    montar(20, HUELLA);
    tecla("PageDown");
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(guardadas().docs[HUELLA].page).toBe(2);
  });

  it("con «recordar» desactivado no restaura ni guarda posiciones", () => {
    vi.useFakeTimers();
    prefs({}, { recordarPosicion: false });
    const antes = JSON.stringify({
      v: 1,
      docs: { [HUELLA]: { page: 7, zoom: { tipo: "ancho" }, t: 1 } },
    });
    localStorage.setItem("bpdf:positions", antes);
    const { unmount } = montar(20, HUELLA);
    expect(estadoPagina()).toHaveTextContent(t.status.page(1, 20));
    tecla("PageDown");
    act(() => vi.advanceTimersByTime(5000));
    unmount();
    // Desactivar no borra lo guardado: no lo toca.
    expect(localStorage.getItem("bpdf:positions")).toBe(antes);
  });

  it("un PDF sin huella no guarda posición", () => {
    vi.useFakeTimers();
    const { unmount } = montar(20, null);
    tecla("PageDown");
    act(() => vi.advanceTimersByTime(5000));
    unmount();
    expect(localStorage.getItem("bpdf:positions")).toBeNull();
  });

  it("abrir o cerrar las miniaturas se recuerda para el siguiente PDF", () => {
    const { unmount } = montar(5);
    fireEvent.click(boton(t.showThumbnails));
    expect(JSON.parse(localStorage.getItem("bpdf:prefs") ?? "{}").pdf.miniaturas).toBe(true);
    unmount();
    montar(5);
    expect(screen.getByRole("navigation", { name: t.thumbnails })).toBeInTheDocument();
    fireEvent.click(boton(t.hideThumbnails));
    expect(JSON.parse(localStorage.getItem("bpdf:prefs") ?? "{}").pdf.miniaturas).toBe(false);
  });

  it("las opciones de búsqueda no se guardan", () => {
    montar(20);
    fireEvent.click(boton(t.search));
    fireEvent.click(boton(t.searchMatchCase));
    fireEvent.click(boton(t.searchWholeWord));
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
