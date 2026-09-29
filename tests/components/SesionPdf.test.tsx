// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { axe } from "jest-axe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { messages } from "@/i18n/messages";
import { crearRecoloreado } from "@/pdf/dark/recolor";
import { SpikeApp } from "@/pdf-spike/SpikeApp";
import { type DocumentoPdf, SesionPdf } from "@/pdf-spike/sesion";

/**
 * Ciclo de vida del laboratorio sin pdf.js ni lienzo reales (jsdom no pinta):
 * un documento falso cuyas tareas de render solo terminan cuando el test lo
 * decide. El render y los píxeles reales se prueban en Playwright.
 */

type TareaFalsa = { promise: Promise<void>; cancel: () => void; terminar: () => void };

function tareaFalsa(): TareaFalsa {
  let terminar = () => {};
  let cancelar = (_: Error) => {};
  const promise = new Promise<void>((resolve, reject) => {
    terminar = resolve;
    cancelar = reject;
  });
  return {
    promise,
    terminar,
    cancel: () => {
      const e = new Error("cancelado");
      e.name = "RenderingCancelledException";
      cancelar(e);
    },
  };
}

function documentoFalso() {
  const tareas: TareaFalsa[] = [];
  const destroy = vi.fn(async () => {});
  const pagina = {
    getViewport: () => ({ width: 100, height: 50 }),
    render: () => {
      const t = tareaFalsa();
      tareas.push(t);
      return t;
    },
    imageCoordinates: null,
  };
  const documento = {
    numPages: 3,
    getPage: async () => pagina,
    loadingTask: { destroy },
  } as unknown as DocumentoPdf;
  return { documento, tareas, destroy };
}

const op = {
  pagina: 1,
  escala: 1,
  dpr: 1,
  modo: "original" as const,
  recolorear: crearRecoloreado({ pagina: [43, 43, 43], texto: [236, 236, 236] }),
};

beforeEach(() => {
  // jsdom no implementa el lienzo: basta un contexto que exista.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return { canvas: this } as unknown as CanvasRenderingContext2D;
  } as never);
});
afterEach(() => vi.restoreAllMocks());

describe("SesionPdf", () => {
  it("pinta una página y devuelve el tamaño del lienzo", async () => {
    const { documento, tareas } = documentoFalso();
    const sesion = new SesionPdf(documento);
    const lienzo = document.createElement("canvas");
    const pintado = sesion.pintar(lienzo, op);
    await vi.waitFor(() => expect(tareas).toHaveLength(1));
    tareas[0]?.terminar();
    expect(await pintado).toMatchObject({ ancho: 100, alto: 50, regiones: 0 });
  });

  it("una petición nueva cancela la anterior, que resuelve null", async () => {
    const { documento, tareas } = documentoFalso();
    const sesion = new SesionPdf(documento);
    const lienzo = document.createElement("canvas");
    const primera = sesion.pintar(lienzo, op);
    await vi.waitFor(() => expect(tareas).toHaveLength(1));
    const segunda = sesion.pintar(lienzo, { ...op, pagina: 2 });
    expect(await primera).toBeNull();
    await vi.waitFor(() => expect(tareas).toHaveLength(2));
    tareas[1]?.terminar();
    expect(await segunda).not.toBeNull();
  });

  it("cerrar cancela el render en curso, destruye el documento y libera los lienzos", async () => {
    const { documento, tareas, destroy } = documentoFalso();
    const sesion = new SesionPdf(documento);
    const lienzo = document.createElement("canvas");
    const pintado = sesion.pintar(lienzo, op);
    await vi.waitFor(() => expect(tareas).toHaveLength(1));
    await sesion.cerrar();
    expect(await pintado).toBeNull();
    expect(destroy).toHaveBeenCalledTimes(1);
    expect(lienzo.width).toBe(0);
    expect(lienzo.height).toBe(0);
  });

  it("tras cerrar no vuelve a pintar ni a destruir", async () => {
    const { documento, tareas, destroy } = documentoFalso();
    const sesion = new SesionPdf(documento);
    await sesion.cerrar();
    await sesion.cerrar();
    expect(await sesion.pintar(document.createElement("canvas"), op)).toBeNull();
    expect(tareas).toHaveLength(0);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

describe("SpikeApp (laboratorio)", () => {
  it("presenta sus controles con etiqueta y sin violaciones de accesibilidad", async () => {
    const { container } = render(<SpikeApp />);
    const t = messages.pdfSpike;
    expect(screen.getByRole("heading", { level: 1, name: t.title })).toBeInTheDocument();
    expect(screen.getByLabelText(t.file)).toHaveAttribute("type", "file");
    expect(screen.getByRole("radio", { name: t.modes.selectivo })).toBeChecked();
    expect(screen.getByRole("button", { name: t.benchmark })).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });
});
