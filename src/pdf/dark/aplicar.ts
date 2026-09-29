import { aLineal, oklab } from "./color";
import { invertirPixeles, type Recoloreado, transformarPixeles } from "./recolor";
import { marcarRegiones, type Paralelogramo, regionesAConservar } from "./regiones";

/**
 * Estrategias que compara el spike (docs/PDF_DARK_MODE_SPIKE.md §5):
 * - `original`: lo que pinta pdf.js.
 * - `invertido`: negativo completo, la referencia de lo que NO se quiere.
 * - `heuristica`: recoloreado por color en toda la página, sin regiones.
 * - `selectivo`: el mismo recoloreado solo FUERA de las regiones de imagen.
 */
export type Modo = "original" | "invertido" | "heuristica" | "selectivo";
export const MODOS: readonly Modo[] = ["original", "invertido", "heuristica", "selectivo"];

/** Filas por franja. 256 filas de un lienzo de 2400 px de ancho son ~2,3 MiB. */
export const FILAS_POR_FRANJA = 256;

export type ResultadoAplicar = {
  /** Milisegundos de la transformación (lectura, cálculo y escritura). */
  ms: number;
  /** Bytes del mayor búfer temporal (una franja de `ImageData` + su máscara). */
  bytesTransitorios: number;
  /** Si no se transformó a propósito, por qué. */
  omitida: "pagina-oscura" | null;
};

/** Fracción de píxeles neutros y oscuros a partir de la cual la página ya es oscura. */
export const FRACCION_PAGINA_OSCURA = 0.5;

/**
 * ¿La página ya es oscura (una diapositiva de fondo negro, una página de
 * código)? Invertirla la dejaría CLARA. Se mide sobre una miniatura: fracción de
 * píxeles neutros (croma < 0,05) y oscuros (L < 0,35). Es una HEURÍSTICA.
 */
export function esPaginaOscura(rgba: Uint8ClampedArray): boolean {
  let oscuros = 0;
  const total = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) {
    const [L, a, b] = oklab(
      aLineal(rgba[i] ?? 0),
      aLineal(rgba[i + 1] ?? 0),
      aLineal(rgba[i + 2] ?? 0),
    );
    if (L < 0.35 && Math.hypot(a, b) < 0.05) oscuros++;
  }
  return total > 0 && oscuros / total > FRACCION_PAGINA_OSCURA;
}

/** Miniatura del lienzo (48 px de ancho) para decidir sobre la página entera. */
function miniatura(lienzo: HTMLCanvasElement): Uint8ClampedArray {
  const ancho = 48;
  const alto = Math.max(1, Math.round((ancho * lienzo.height) / lienzo.width));
  const mini = new OffscreenCanvas(ancho, alto);
  const ctx = mini.getContext("2d", { willReadFrequently: true });
  if (!ctx) return new Uint8ClampedArray();
  ctx.drawImage(lienzo, 0, 0, ancho, alto);
  return ctx.getImageData(0, 0, ancho, alto).data;
}

/**
 * Aplica `modo` sobre un lienzo ya renderizado, en su sitio, por FRANJAS: nunca
 * se copia la página entera a un `ImageData` (a escala 4 una página A4 son
 * ~32 MiB por copia). El lienzo se crea con `willReadFrequently` (ver
 * `render.ts`), así que `getImageData` no baja de la GPU.
 */
export function aplicarModo(
  ctx: CanvasRenderingContext2D,
  modo: Modo,
  { recolorear, regiones }: { recolorear: Recoloreado; regiones: readonly Paralelogramo[] },
  filasPorFranja = FILAS_POR_FRANJA,
): ResultadoAplicar {
  const inicio = performance.now();
  const { width: ancho, height: alto } = ctx.canvas;
  const nada = { ms: 0, bytesTransitorios: 0, omitida: null };
  if (modo === "original" || ancho === 0 || alto === 0) return nada;
  if (modo !== "invertido" && esPaginaOscura(miniatura(ctx.canvas))) {
    return { ...nada, ms: performance.now() - inicio, omitida: "pagina-oscura" };
  }

  const conservar = modo === "selectivo" ? regionesAConservar(regiones, ancho, alto) : [];
  const mascara = conservar.length > 0 ? new Uint8Array(ancho * filasPorFranja) : null;
  let bytesTransitorios = 0;
  for (let y0 = 0; y0 < alto; y0 += filasPorFranja) {
    const filas = Math.min(filasPorFranja, alto - y0);
    const franja = ctx.getImageData(0, y0, ancho, filas);
    const pixeles = new Uint32Array(franja.data.buffer);
    bytesTransitorios = Math.max(
      bytesTransitorios,
      franja.data.byteLength + (mascara?.byteLength ?? 0),
    );
    if (modo === "invertido") {
      invertirPixeles(pixeles);
    } else {
      let vista: Uint8Array | null = null;
      if (mascara) {
        vista = mascara.subarray(0, ancho * filas);
        vista.fill(0);
        marcarRegiones(vista, ancho, y0, filas, conservar);
      }
      transformarPixeles(pixeles, recolorear, vista);
    }
    ctx.putImageData(franja, 0, y0);
  }
  return { ms: performance.now() - inicio, bytesTransitorios, omitida: null };
}
