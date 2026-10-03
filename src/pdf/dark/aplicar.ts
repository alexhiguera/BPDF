import { aLineal, oklab, type Rgb } from "./color";
import { crearRecoloreado, type Recoloreado, transformarPixeles } from "./recolor";
import { marcarRegiones, type Paralelogramo, regionesAConservar } from "./regiones";

/**
 * Aplicación del modo oscuro a una página ya renderizada (docs/PDF_DARK_MODE_SPIKE.md
 * §6 y docs/ARCHITECTURE.md → visor PDF).
 *
 * El visor tiene dos modos de color: `oscuro` (recoloreado selectivo: la
 * heurística de color solo FUERA de las regiones de imagen) y `original` (lo que
 * pinta pdf.js). Las estrategias de referencia del spike (inversión completa,
 * heurística sin regiones) se quedaron en el laboratorio de la Fase 4.
 */
export type ModoColor = "oscuro" | "original";

/** Filas por franja. 256 filas de un lienzo de 2400 px de ancho son ~2,3 MiB. */
export const FILAS_POR_FRANJA = 256;

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
 * Recolorea EN SU SITIO una franja RGBA de `ancho` px que empieza en la fila
 * `y0` del lienzo, sin tocar los píxeles dentro de `conservar`. Pura: la usan
 * el worker y, si no hay worker, el hilo principal.
 */
export function oscurecerFranja(
  datos: Uint8ClampedArray,
  ancho: number,
  y0: number,
  conservar: readonly Paralelogramo[],
  recolorear: Recoloreado,
): void {
  const filas = datos.length / 4 / ancho;
  const pixeles = new Uint32Array(datos.buffer, datos.byteOffset, datos.length / 4);
  let mascara: Uint8Array | null = null;
  if (conservar.length > 0) {
    mascara = new Uint8Array(ancho * filas);
    marcarRegiones(mascara, ancho, y0, filas, conservar);
  }
  transformarPixeles(pixeles, recolorear, mascara);
}

/** Colores de destino del recoloreado: los tokens `--rgb-page` y `--rgb-fg`. */
export type ColoresOscuro = { pagina: Rgb; texto: Rgb };

/**
 * Quien recolorea las franjas: un worker (`trabajador.ts`) o el hilo principal.
 * Recibe una franja y devuelve la franja recoloreada, que puede ser OTRO objeto
 * (el worker transfiere sus bytes y los devuelve en uno nuevo).
 */
export interface Transformador {
  readonly tipo: "worker" | "hilo-principal";
  franja(franja: ImageData, y0: number, conservar: readonly Paralelogramo[]): Promise<ImageData>;
  destruir(): void;
}

/** El recoloreado en el propio hilo: la alternativa si no hay worker. */
export function transformadorLocal(colores: ColoresOscuro): Transformador {
  const recolorear = crearRecoloreado(colores);
  return {
    tipo: "hilo-principal",
    async franja(franja, y0, conservar) {
      oscurecerFranja(franja.data, franja.width, y0, conservar, recolorear);
      return franja;
    },
    destruir() {},
  };
}

export type ResultadoOscuro = {
  /** Milisegundos desde el principio hasta la última franja escrita. */
  ms: number;
  /** De esos, cuántos ocupó el hilo principal (lectura, escritura y, sin worker, el cálculo). */
  msHiloPrincipal: number;
  /** Bytes de la mayor franja (la memoria transitoria, por franja en vuelo). */
  bytesFranja: number;
  /** Si no se transformó a propósito, por qué. */
  omitida: "pagina-oscura" | null;
};

/**
 * Oscurece un lienzo ya renderizado, por FRANJAS: nunca se copia la página
 * entera a un `ImageData` (a 16 Mpx serían 64 MiB por copia). Con worker, la
 * franja siguiente se lee mientras el worker recolorea la anterior (dos en
 * vuelo como máximo).
 *
 * `vigente()` se consulta entre franjas: si devuelve `false` (la página se ha
 * liberado o se ha pedido otro render), se para y devuelve `null`. El lienzo
 * queda a medias, pero es un lienzo que nadie va a mostrar.
 */
export async function oscurecerLienzo(
  ctx: CanvasRenderingContext2D,
  regiones: readonly Paralelogramo[],
  transformador: Transformador,
  {
    vigente = () => true,
    filasPorFranja = FILAS_POR_FRANJA,
    yaOscura = (lienzo: HTMLCanvasElement) => esPaginaOscura(miniatura(lienzo)),
  }: {
    vigente?: () => boolean;
    filasPorFranja?: number;
    /** Se inyecta en los tests (jsdom no tiene `OffscreenCanvas`). */
    yaOscura?: (lienzo: HTMLCanvasElement) => boolean;
  } = {},
): Promise<ResultadoOscuro | null> {
  const inicio = performance.now();
  const { width: ancho, height: alto } = ctx.canvas;
  let principal = 0;
  const medir = <T>(f: () => T): T => {
    const t0 = performance.now();
    const r = f();
    principal += performance.now() - t0;
    return r;
  };
  const resultado = (omitida: ResultadoOscuro["omitida"], bytesFranja = 0): ResultadoOscuro => ({
    ms: performance.now() - inicio,
    msHiloPrincipal: principal,
    bytesFranja,
    omitida,
  });
  if (ancho === 0 || alto === 0) return resultado(null);
  if (medir(() => yaOscura(ctx.canvas))) return resultado("pagina-oscura");

  const conservar = regionesAConservar(regiones, ancho, alto);
  let bytesFranja = 0;
  const enVuelo: { y0: number; hecha: Promise<ImageData> }[] = [];
  const escribirPrimera = async (): Promise<boolean> => {
    const primera = enVuelo.shift();
    if (!primera) return true;
    let franja: ImageData;
    try {
      franja = await primera.hecha;
    } catch (error) {
      // Con la página ya cancelada (liberada, otro render, o el documento cerrado:
      // `destruir()` del worker rechaza lo pendiente con `worker-destruido`), que la
      // franja no llegue no es un fallo: no hay nada que pintar. Con la página
      // vigente, sí lo es, y quien llama repinta con el transformador local.
      if (!vigente()) return false;
      throw error;
    }
    if (!vigente()) return false;
    medir(() => ctx.putImageData(franja, 0, primera.y0));
    return true;
  };
  try {
    for (let y0 = 0; y0 < alto; y0 += filasPorFranja) {
      if (!vigente()) return null;
      const filas = Math.min(filasPorFranja, alto - y0);
      const franja = medir(() => ctx.getImageData(0, y0, ancho, filas));
      bytesFranja = Math.max(bytesFranja, franja.data.byteLength);
      const t0 = performance.now();
      const hecha = transformador.franja(franja, y0, conservar);
      // Sin worker, `franja()` calcula antes de devolver: ese tiempo es del hilo principal.
      if (transformador.tipo === "hilo-principal") principal += performance.now() - t0;
      enVuelo.push({ y0, hecha });
      if (enVuelo.length >= 2 && !(await escribirPrimera())) return null;
    }
    while (enVuelo.length > 0) if (!(await escribirPrimera())) return null;
    return resultado(null, bytesFranja);
  } finally {
    // Ninguna franja enviada queda sin esperar, termine como termine (completa,
    // cancelada o con error). Antes solo se esperaba la primera: si la página se
    // cancelaba o fallaba con dos en vuelo, la segunda quedaba suelta, y al cerrar el
    // PDF `destruir()` la rechazaba sin que nadie la observara («Uncaught (in
    // promise) worker-destruido»). Así tampoco queda trabajo de esta página en vuelo
    // cuando `oscurecerLienzo` vuelve. En el camino normal no espera nada: ya están
    // todas escritas.
    await Promise.allSettled(enVuelo.map((e) => e.hecha));
  }
}
