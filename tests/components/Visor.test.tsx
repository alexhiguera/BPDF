// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { axe } from "jest-axe";
import { createRef, type MutableRefObject } from "react";
import { describe, expect, it, vi } from "vitest";
import { Visor } from "@/app/pdf/Visor";
import { messages } from "@/i18n/messages";
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
function controladorFalso(total: number) {
  const pedidos: { paginas: number[]; p: ParametrosPintura }[] = [];
  const busquedas: string[] = [];
  let responder: (e: EstadoBusqueda) => void = () => {};
  const c = {
    total,
    tipoTransformador: "worker",
    documento: { tamanos: vi.fn(async () => {}) },
    memoria: () => ({ lienzos: 0, bytes: 0, pintando: 0 }),
    mostrar: vi.fn((marcos: { numero: number }[], p: ParametrosPintura) =>
      pedidos.push({ paginas: marcos.map((m) => m.numero), p }),
    ),
    mostrarMiniaturas: vi.fn(),
    buscar: vi.fn(async (consulta: string, alProgreso: (e: EstadoBusqueda) => void) => {
      busquedas.push(consulta);
      responder = alProgreso;
    }),
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

function montar(total = 20) {
  const f = controladorFalso(total);
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
