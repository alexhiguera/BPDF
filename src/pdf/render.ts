import type { PageViewport, PDFPageProxy, RenderTask } from "pdfjs-dist";
import { type Paralelogramo, paralelogramos } from "./dark/regiones";

/**
 * `AnnotationMode.ENABLE` de pdf.js (su valor es estable y un test lo vigila):
 * las apariencias de las anotaciones y de los campos de formulario se pintan en
 * el lienzo, **sin** capa interactiva (D14: se ven, no se rellenan). Los
 * enlaces los pone BPDF encima, con su propia política (`enlaces.ts`).
 */
export const ANOTACIONES_EN_LIENZO = 1;

/** Conversión de puntos PDF (1/72 in) a píxeles CSS (1/96 in): zoom 100 % = tamaño real. */
export const PT_A_CSS = 96 / 72;

/**
 * Política de resolución (docs/ARCHITECTURE.md → visor PDF):
 * - el DPR se usa como mucho hasta 2: una pantalla de DPR 3 no necesita un lienzo
 *   9 veces mayor que el CSS para leer texto nítido;
 * - un lienzo no supera 16,7 Mpx (4096²): a partir de ahí se baja la resolución
 *   (se ve algo menos nítido a zoom muy alto) en vez de gastar 64 MiB por página.
 */
export const DPR_MAXIMO = 2;
export const PIXELES_MAXIMOS = 4096 * 4096;

/**
 * Píxeles físicos por píxel CSS para una página de `anchoCss × altoCss` px:
 * el DPR real (recortado a `DPR_MAXIMO`), reducido si el lienzo superaría
 * `PIXELES_MAXIMOS`.
 */
export function resolucionEfectiva(anchoCss: number, altoCss: number, dpr: number): number {
  const deseada = Math.min(Math.max(dpr, 1), DPR_MAXIMO);
  const pixeles = anchoCss * altoCss * deseada * deseada;
  return pixeles <= PIXELES_MAXIMOS ? deseada : Math.sqrt(PIXELES_MAXIMOS / (anchoCss * altoCss));
}

export type OpcionesRender = {
  /** Zoom (1 = 100 %, tamaño real). */
  zoom: number;
  /** Rotación de VISTA en grados (0, 90, 180, 270), que se suma a la de la página. */
  rotacion: number;
  /** `devicePixelRatio` de la pantalla. */
  dpr: number;
};

/** El viewport CSS de una página con el zoom y la rotación de vista. */
export function viewportCss(pagina: PDFPageProxy, zoom: number, rotacion: number): PageViewport {
  return pagina.getViewport({
    scale: zoom * PT_A_CSS,
    rotation: (pagina.rotate + rotacion) % 360,
  });
}

export type PaginaRenderizada = {
  msRender: number;
  /** Tamaño del lienzo en píxeles físicos. */
  ancho: number;
  alto: number;
  /** Resolución usada (px físicos por px CSS). */
  resolucion: number;
  /** Dónde ha pintado pdf.js imágenes rasterizadas, en píxeles del lienzo. */
  regiones: Paralelogramo[];
};

/**
 * Renderiza una página en `canvas` con pdf.js y devuelve dónde quedaron sus
 * imágenes. `recordImages: true` es una opción pública de pdf.js 6.3: registra
 * cada imagen que pinta, ya recortada por el clip, en coordenadas normalizadas
 * al lienzo (`page.imageCoordinates`). Solo se registra en el primer render de
 * cada página; al estar normalizadas, valen para cualquier escala. (Con la
 * rotación de vista el lienzo gira, pero las coordenadas se toman del render
 * que las registró: por eso se descartan si la rotación cambió; ver
 * `regionesDe`.)
 *
 * El lienzo se deja con su tamaño CSS en `style` y su resolución física en
 * `width`/`height`. Devuelve la tarea para poder cancelarla.
 */
export function renderizarPagina(
  pagina: PDFPageProxy,
  canvas: HTMLCanvasElement,
  { zoom, rotacion, dpr }: OpcionesRender,
): { tarea: RenderTask; hecho: Promise<PaginaRenderizada> } {
  const viewport = viewportCss(pagina, zoom, rotacion);
  const resolucion = resolucionEfectiva(viewport.width, viewport.height, dpr);
  // El contexto se crea ANTES que pdf.js (que reutiliza el existente) para que
  // el lienzo no sea opaco: sobre un lienzo opaco (`alpha: false`, lo que pedi-
  // ría pdf.js) Chromium suaviza el texto con subpíxel LCD, y esos bordes de
  // color la recoloración los conservaría como color (flecos). pdf.js pinta el
  // fondo blanco igualmente, así que el resultado es opaco.
  canvas.getContext("2d", { alpha: true, willReadFrequently: true });
  canvas.width = Math.floor(viewport.width * resolucion);
  canvas.height = Math.floor(viewport.height * resolucion);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;

  const inicio = performance.now();
  const tarea = pagina.render({
    canvas,
    viewport,
    transform: resolucion === 1 ? undefined : [resolucion, 0, 0, resolucion, 0, 0],
    annotationMode: ANOTACIONES_EN_LIENZO,
    recordImages: true,
  });
  const hecho = tarea.promise.then(() => ({
    msRender: performance.now() - inicio,
    ancho: canvas.width,
    alto: canvas.height,
    resolucion,
    regiones: regionesDe(pagina, rotacion, canvas.width, canvas.height),
  }));
  return { tarea, hecho };
}

/**
 * Regiones de imagen de la página en el lienzo actual. pdf.js las registra una
 * vez por página (en el primer render) normalizadas a ESE lienzo: valen para
 * cualquier zoom, pero no si después cambia la rotación. Se recuerda con qué
 * rotación se registraron y, con otra, se rotan en el espacio normalizado.
 */
const rotacionRegistro = new WeakMap<PDFPageProxy, number>();

function regionesDe(
  pagina: PDFPageProxy,
  rotacion: number,
  ancho: number,
  alto: number,
): Paralelogramo[] {
  const coords = pagina.imageCoordinates as ArrayLike<number> | null;
  if (!coords) return [];
  if (!rotacionRegistro.has(pagina)) rotacionRegistro.set(pagina, rotacion);
  const delta = (((rotacion - (rotacionRegistro.get(pagina) ?? 0)) % 360) + 360) % 360;
  return paralelogramos(rotarNormalizadas(coords, delta), ancho, alto);
}

/** Gira `delta` grados (múltiplo de 90, en sentido horario) coordenadas normalizadas [0,1]². */
export function rotarNormalizadas(coords: ArrayLike<number>, delta: number): number[] {
  const salida: number[] = [];
  for (let i = 0; i + 1 < coords.length; i += 2) {
    const [x, y] = [coords[i] ?? 0, coords[i + 1] ?? 0];
    const [rx, ry] =
      delta === 90
        ? [1 - y, x]
        : delta === 180
          ? [1 - x, 1 - y]
          : delta === 270
            ? [y, 1 - x]
            : [x, y];
    salida.push(rx, ry);
  }
  return salida;
}
