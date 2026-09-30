/**
 * Geometría del visor PDF, sin DOM ni pdf.js: zoom, ajustes, disposición de las
 * páginas y ventana de virtualización. Funciones puras (docs/ARCHITECTURE.md →
 * visor PDF), probadas en `tests/unit/pdf/disposicion.test.ts`.
 *
 * Unidades: los tamaños de página son en PUNTOS PDF a zoom 1 y ya rotados; las
 * posiciones y el área visible, en PÍXELES CSS.
 */
import { PT_A_CSS, resolucionEfectiva } from "../render";

export type Tamano = { ancho: number; alto: number };

/** Zoom: un valor fijo, o ajustado al ancho o a la página entera del área visible. */
export type Ajuste = "ancho" | "pagina";
export type Zoom = { tipo: "fijo"; valor: number } | { tipo: Ajuste };

export const ZOOM_MINIMO = 0.25;
export const ZOOM_MAXIMO = 5;
/** Pasos de los botones y atajos de zoom (como los de los lectores habituales). */
export const PASOS_ZOOM = [
  0.25, 0.33, 0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5,
] as const;

/** Separación vertical entre páginas y margen alrededor, en px CSS. */
export const SEPARACION = 16;

export const acotarZoom = (z: number): number => Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, z));

/** El siguiente paso de zoom estrictamente mayor (o menor) que `actual`. */
export function pasoZoom(actual: number, direccion: 1 | -1): number {
  const eps = 1e-6;
  if (direccion === 1) return PASOS_ZOOM.find((p) => p > actual + eps) ?? ZOOM_MAXIMO;
  return [...PASOS_ZOOM].reverse().find((p) => p < actual - eps) ?? ZOOM_MINIMO;
}

/** Tamaño de la página girada `rotacion` grados (0, 90, 180, 270). */
export const girar = (t: Tamano, rotacion: number): Tamano =>
  rotacion % 180 === 0 ? t : { ancho: t.alto, alto: t.ancho };

/**
 * Zoom numérico que corresponde a `zoom` para una página de `pagina` puntos en
 * un área de `area` px CSS (descontado el margen). Siempre acotado.
 */
export function zoomEfectivo(zoom: Zoom, pagina: Tamano, area: Tamano): number {
  if (zoom.tipo === "fijo") return acotarZoom(zoom.valor);
  const ancho = Math.max(1, area.ancho - 2 * SEPARACION) / (pagina.ancho * PT_A_CSS);
  if (zoom.tipo === "ancho") return acotarZoom(ancho);
  const alto = Math.max(1, area.alto - 2 * SEPARACION) / (pagina.alto * PT_A_CSS);
  return acotarZoom(Math.min(ancho, alto));
}

/**
 * El tamaño «típico» de las páginas: la mediana por ancho. Es la referencia de
 * los ajustes en la vista continua: una sola página apaisada (o una portada
 * de otro tamaño) no cambia el zoom de todo el documento.
 */
export function tamanoTipico(paginas: readonly Tamano[]): Tamano {
  if (paginas.length === 0) return { ancho: 1, alto: 1 };
  const orden = [...paginas].sort((a, b) => a.ancho - b.ancho);
  return orden[Math.floor((orden.length - 1) / 2)] ?? { ancho: 1, alto: 1 };
}

export type Disposicion = {
  /** Borde superior de cada página (índice 0 = página 1), en px CSS. */
  arriba: number[];
  /** Tamaño CSS de cada página. */
  tamanos: Tamano[];
  /** Alto total del contenido. */
  alto: number;
  /** Ancho del contenido (la página más ancha + márgenes). */
  ancho: number;
};

/** Páginas una debajo de otra, con `SEPARACION` entre ellas y alrededor. */
export function disponer(paginas: readonly Tamano[], zoom: number): Disposicion {
  const k = zoom * PT_A_CSS;
  const tamanos = paginas.map((p) => ({
    ancho: Math.floor(p.ancho * k),
    alto: Math.floor(p.alto * k),
  }));
  const arriba: number[] = [];
  let y = SEPARACION;
  let ancho = 0;
  for (const t of tamanos) {
    arriba.push(y);
    y += t.alto + SEPARACION;
    ancho = Math.max(ancho, t.ancho);
  }
  return { arriba, tamanos, alto: y, ancho: ancho + 2 * SEPARACION };
}

/** Índice de la última página cuyo borde superior está en `y` o antes (búsqueda binaria). */
function paginaEn(d: Disposicion, y: number): number {
  let [lo, hi] = [0, d.arriba.length - 1];
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if ((d.arriba[mid] ?? 0) <= y) lo = mid;
    else hi = mid - 1;
  }
  return Math.max(0, lo);
}

export type Ventana = {
  /** Páginas (1-based) que se ven, aunque sea en parte. */
  visibles: { desde: number; hasta: number };
  /** Páginas con lienzo: las visibles más `margen` a cada lado. */
  vivas: { desde: number; hasta: number };
  /** La página «actual»: la que ocupa el primer tercio del área visible. */
  actual: number;
};

/**
 * Qué páginas se ven con el desplazamiento `arriba` y un área de `alto` px, y
 * cuáles deben tener lienzo (±`margen`). Es la política de memoria del visor:
 * solo esas páginas tienen lienzo; el resto son marcos vacíos del tamaño justo.
 */
export function ventana(d: Disposicion, arriba: number, alto: number, margen = 1): Ventana {
  const n = d.arriba.length;
  if (n === 0)
    return { visibles: { desde: 0, hasta: 0 }, vivas: { desde: 0, hasta: 0 }, actual: 0 };
  let desde = paginaEn(d, arriba);
  // Si el hueco entre páginas queda arriba, la primera visible es la siguiente.
  const finDesde = (d.arriba[desde] ?? 0) + (d.tamanos[desde]?.alto ?? 0);
  if (finDesde < arriba && desde < n - 1) desde++;
  const hasta = paginaEn(d, arriba + alto);
  const actual = paginaEn(d, arriba + alto / 3);
  return {
    visibles: { desde: desde + 1, hasta: hasta + 1 },
    vivas: { desde: Math.max(1, desde + 1 - margen), hasta: Math.min(n, hasta + 1 + margen) },
    actual: actual + 1,
  };
}

/**
 * Memoria máxima para los lienzos de las páginas VECINAS (docs/ARCHITECTURE.md
 * → visor PDF, «Memoria»). Las visibles se pintan siempre; una vecina solo si,
 * sumada a lo anterior, no pasa de aquí. 160 MiB caben cuatro páginas A4 a lo
 * ancho de una pantalla HiDPI (DPR 2, ~34 MiB cada una); a zoom muy alto, las
 * vecinas se dejan sin pintar hasta que se acercan.
 */
export const PRESUPUESTO_LIENZOS = 160 * 2 ** 20;

/** Bytes del lienzo de una página de `tamano` px CSS (4 por píxel físico). */
export function bytesLienzo(tamano: Tamano, dpr: number): number {
  const r = resolucionEfectiva(tamano.ancho, tamano.alto, dpr);
  return Math.floor(tamano.ancho * r) * Math.floor(tamano.alto * r) * 4;
}

/**
 * Qué páginas de `orden` (por prioridad) tienen lienzo: las `obligatorias`
 * primeras siempre, y las siguientes mientras quepan en `presupuesto`.
 */
export function dentroDePresupuesto(
  orden: readonly number[],
  obligatorias: number,
  bytesDe: (pagina: number) => number,
  presupuesto = PRESUPUESTO_LIENZOS,
): number[] {
  const salida: number[] = [];
  let total = 0;
  for (const [i, pagina] of orden.entries()) {
    const bytes = bytesDe(pagina);
    if (i >= obligatorias && total + bytes > presupuesto) continue;
    salida.push(pagina);
    total += bytes;
  }
  return salida;
}

/**
 * Interpreta lo escrito en el campo «ir a página». Solo un entero entre 1 y
 * `total`; cualquier otra cosa (vacío, texto, 0, negativo, decimal, mayor que el
 * total) devuelve `null` y el visor no se mueve.
 */
export function leerPagina(texto: string, total: number): number | null {
  const limpio = texto.trim();
  if (!/^\d+$/.test(limpio)) return null;
  const n = Number(limpio);
  return Number.isSafeInteger(n) && n >= 1 && n <= total ? n : null;
}
