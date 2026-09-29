import type { PDFPageProxy, RenderTask } from "pdfjs-dist";
import { type Paralelogramo, paralelogramos } from "./dark/regiones";

/**
 * `AnnotationMode.DISABLE` de pdf.js (su valor es estable y un test lo vigila).
 * El spike renderiza sin anotaciones: sus apariencias reinician la matriz de
 * transformación y no pasan por el registro de imágenes. La Fase 5 las pinta
 * aparte (capa de anotaciones), ver docs/PDF_DARK_MODE_SPIKE.md §10.
 */
export const ANOTACIONES_DESACTIVADAS = 0;

export type OpcionesRender = {
  /** Escala respecto a 72 ppp (1 = tamaño real en puntos CSS). */
  escala: number;
  /** `devicePixelRatio`: píxeles físicos por píxel CSS. */
  dpr: number;
};

export type PaginaRenderizada = {
  msRender: number;
  ancho: number;
  alto: number;
  /** Dónde ha pintado pdf.js imágenes rasterizadas, en píxeles del lienzo. */
  regiones: Paralelogramo[];
};

/**
 * Renderiza una página en `canvas` con pdf.js y devuelve dónde quedaron sus
 * imágenes. `recordImages: true` es una opción pública de pdf.js 6.3: registra
 * cada imagen que pinta, ya recortada por el clip, en coordenadas normalizadas
 * al lienzo (`page.imageCoordinates`). Solo se registra en el primer render de
 * cada página; al estar normalizadas, valen para cualquier escala posterior.
 *
 * Devuelve la tarea para poder cancelarla (cambio de página o de escala).
 */
export function renderizarPagina(
  pagina: PDFPageProxy,
  canvas: HTMLCanvasElement,
  { escala, dpr }: OpcionesRender,
): { tarea: RenderTask; hecho: Promise<PaginaRenderizada> } {
  const viewport = pagina.getViewport({ scale: escala });
  // El contexto se crea ANTES que pdf.js (que reutiliza el existente) para que
  // el lienzo no sea opaco: sobre un lienzo opaco (`alpha: false`, lo que pedi-
  // ría pdf.js) Chromium suaviza el texto con subpíxel LCD, y esos bordes de
  // color la recoloración los conservaría como color (flecos). pdf.js pinta el
  // fondo blanco igualmente, así que el resultado es opaco.
  canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const inicio = performance.now();
  const tarea = pagina.render({
    canvas,
    viewport,
    transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0],
    annotationMode: ANOTACIONES_DESACTIVADAS,
    recordImages: true,
  });
  const hecho = tarea.promise.then(() => ({
    msRender: performance.now() - inicio,
    ancho: canvas.width,
    alto: canvas.height,
    regiones: paralelogramos(pagina.imageCoordinates, canvas.width, canvas.height),
  }));
  return { tarea, hecho };
}
