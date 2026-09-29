import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { aplicarModo, type Modo } from "@/pdf/dark/aplicar";
import type { Recoloreado } from "@/pdf/dark/recolor";
import type { Paralelogramo } from "@/pdf/dark/regiones";
import { renderizarPagina } from "@/pdf/render";

/**
 * Un documento abierto en el laboratorio del spike (Fase 4). TEMPORAL: la
 * Fase 5 lo sustituye por el visor. Sin React, para poder probar el ciclo de
 * vida (cancelar y liberar) sin montar nada.
 */

/** Lo que la sesión usa de un documento de pdf.js (los tests pasan un doble). */
export type DocumentoPdf = Pick<PDFDocumentProxy, "numPages" | "getPage"> & {
  loadingTask: { destroy(): Promise<void> };
};

export type OpcionesPintar = {
  pagina: number;
  escala: number;
  dpr: number;
  modo: Modo;
  recolorear: Recoloreado;
  /** Si se da, se dibuja el contorno de cada región de imagen con este color CSS. */
  colorRegiones?: string;
};

export type ResultadoPintar = {
  msRender: number;
  msTransformacion: number;
  ancho: number;
  alto: number;
  regiones: number;
  bytesTransitorios: number;
  /** Si la transformación se omitió a propósito (página ya oscura). */
  omitida: "pagina-oscura" | null;
};

export class SesionPdf {
  #tarea: RenderTask | null = null;
  #enCurso: Promise<unknown> = Promise.resolve();
  #lienzos = new Set<HTMLCanvasElement>();
  #cerrada = false;

  constructor(
    readonly documento: DocumentoPdf,
    /** Milisegundos que tardó pdf.js en abrir el documento. */
    readonly msCarga = 0,
  ) {}

  get paginas(): number {
    return this.documento.numPages;
  }

  /**
   * Renderiza la página y le aplica `modo`. Si llega otra petición antes de
   * terminar, la anterior se cancela y resuelve `null`.
   */
  async pintar(canvas: HTMLCanvasElement, op: OpcionesPintar): Promise<ResultadoPintar | null> {
    if (this.#cerrada) return null;
    this.#tarea?.cancel();
    await this.#enCurso.catch(() => {});
    if (this.#cerrada) return null;

    const pagina = await this.documento.getPage(op.pagina);
    const { tarea, hecho } = renderizarPagina(pagina, canvas, op);
    this.#tarea = tarea;
    this.#enCurso = hecho;
    this.#lienzos.add(canvas);
    let render: Awaited<typeof hecho>;
    try {
      render = await hecho;
    } catch (error) {
      if (esCancelacion(error)) return null;
      throw error;
    } finally {
      if (this.#tarea === tarea) this.#tarea = null;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const { ms, bytesTransitorios, omitida } = aplicarModo(ctx, op.modo, {
      recolorear: op.recolorear,
      regiones: render.regiones,
    });
    if (op.colorRegiones) dibujarRegiones(ctx, render.regiones, op.colorRegiones);
    return {
      msRender: render.msRender,
      msTransformacion: ms,
      ancho: render.ancho,
      alto: render.alto,
      regiones: render.regiones.length,
      bytesTransitorios,
      omitida,
    };
  }

  /**
   * Libera todo: cancela el render en curso, destruye el documento de pdf.js
   * (su worker y sus cachés) y deja a 0×0 los lienzos usados, que es lo que
   * devuelve su memoria al navegador sin esperar al recolector.
   */
  async cerrar(): Promise<void> {
    if (this.#cerrada) return;
    this.#cerrada = true;
    this.#tarea?.cancel();
    await this.#enCurso.catch(() => {});
    for (const lienzo of this.#lienzos) {
      lienzo.width = 0;
      lienzo.height = 0;
    }
    this.#lienzos.clear();
    await this.documento.loadingTask.destroy();
  }
}

const esCancelacion = (error: unknown): boolean =>
  error instanceof Error && error.name === "RenderingCancelledException";

function dibujarRegiones(
  ctx: CanvasRenderingContext2D,
  regiones: readonly Paralelogramo[],
  color: string,
) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  for (const [ax, ay, bx, by, cx, cy] of regiones) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx + cx - ax, by + cy - ay);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}
