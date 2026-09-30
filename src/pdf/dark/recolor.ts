import {
  aLineal,
  aSrgb8,
  contraste,
  lineal,
  luminosidad,
  luminosidadMinima,
  oklab,
  type Rgb,
} from "./color";

/**
 * Recoloreado de píxeles para el modo oscuro (docs/PDF_DARK_MODE_SPIKE.md §6).
 *
 * Regla, por píxel, en OKLab (L, a, b):
 *   - Se INVIERTE la luminosidad entre el color de página y el de texto:
 *     L = 1 (blanco) → luminosidad de `pagina`; L = 0 (negro) → la de `texto`.
 *     Papel, tinta, grises y antialiasing quedan oscuros y claros al revés.
 *   - Cuanto más COLOR tiene el píxel (croma = √(a²+b²)), más se CONSERVA su
 *     luminosidad original: un rojo sigue siendo el mismo rojo. Entre
 *     `cromaMin` y `cromaMax` se mezcla con una curva suave, para que los
 *     bordes antialiasados de un color sobre blanco no hagan escalón.
 *   - Si un color conservado queda demasiado oscuro para verse sobre la página
 *     (azul marino), se aclara lo justo hasta `contrasteMin`.
 *   - `a` y `b` (el tono) no se tocan nunca. Solo se recorta a la gama sRGB.
 *
 * Esto es la HEURÍSTICA. Por sí sola invertiría las zonas claras y grises de
 * una foto; por eso el modo selectivo la aplica solo FUERA de las regiones de
 * imagen que registra pdf.js (ver `regiones.ts`).
 */
export type OpcionesRecoloreado = {
  /** Color al que va el blanco: el fondo de página oscuro (`--rgb-page`). */
  pagina: Rgb;
  /** Color al que va el negro: el texto claro (`--rgb-fg`). */
  texto: Rgb;
  /** Croma OKLab por debajo de la cual un píxel se trata como gris (se invierte entero). */
  cromaMin?: number;
  /** Croma OKLab por encima de la cual un píxel conserva su luminosidad. */
  cromaMax?: number;
  /** Contraste WCAG mínimo de un color conservado sobre la página. */
  contrasteMin?: number;
};

/** Valores del spike. Ver la justificación en docs/PDF_DARK_MODE_SPIKE.md §6. */
export const RECOLOREADO_POR_DEFECTO = { cromaMin: 0.03, cromaMax: 0.09, contrasteMin: 3 };

/**
 * Píxel empaquetado como lo guarda un `Uint32Array` sobre `ImageData` en una
 * máquina little-endian (todas las que ejecutan BPDF): 0xAABBGGRR.
 */
export type Empaquetado = number;
export const empaquetar = ([r, g, b]: Rgb): Empaquetado =>
  (0xff000000 | (b << 16) | (g << 8) | r) >>> 0;
export const desempaquetar = (p: Empaquetado): Rgb => [
  p & 0xff,
  (p >>> 8) & 0xff,
  (p >>> 16) & 0xff,
];

/** Una función píxel → píxel (conserva el alfa), con caché interna por color. */
export type Recoloreado = (pixel: Empaquetado) => Empaquetado;

function suave(borde0: number, borde1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - borde0) / (borde1 - borde0)));
  return t * t * (3 - 2 * t);
}

/** Prepara la regla con sus constantes calculadas una sola vez. */
function preparar(opciones: OpcionesRecoloreado): (rgb: Rgb) => Rgb {
  const { cromaMin, cromaMax, contrasteMin } = { ...RECOLOREADO_POR_DEFECTO, ...opciones };
  const lPagina = luminosidad(opciones.pagina);
  const lTexto = luminosidad(opciones.texto);
  const lMin = luminosidadMinima(opciones.pagina, contrasteMin);
  const aRgb = (L: number, a: number, b: number): Rgb => {
    const [r, g, bl] = lineal(L, a, b);
    return [aSrgb8(r), aSrgb8(g), aSrgb8(bl)];
  };
  /**
   * Luminosidad con la que un color (a, b) conservado se ve sobre la página.
   * `lMin` es exacta para un gris y una aproximación para un color, así que se
   * comprueba el contraste real y, si no llega, se sube en pasos pequeños.
   */
  const conservar = (L: number, a: number, b: number): number => {
    let l = Math.max(L, lMin);
    while (l < 1 && contraste(aRgb(l, a, b), opciones.pagina) < contrasteMin) l += 0.01;
    return Math.min(l, 1);
  };
  return (rgb) => {
    const [L, a, b] = oklab(aLineal(rgb[0]), aLineal(rgb[1]), aLineal(rgb[2]));
    const peso = suave(cromaMin, cromaMax, Math.hypot(a, b));
    const invertida = lTexto + (lPagina - lTexto) * L;
    if (peso === 0) return aRgb(invertida, a, b);
    return aRgb(invertida * (1 - peso) + conservar(L, a, b) * peso, a, b);
  };
}

/** Calcula el color de salida de un RGB (sin caché). Exportada para los tests. */
export const recolorearRgb = (rgb: Rgb, opciones: OpcionesRecoloreado): Rgb =>
  preparar(opciones)(rgb);

/**
 * Crea la función de recoloreado. Una página renderizada tiene millones de
 * píxeles pero pocos colores distintos (papel, tinta y el antialiasing entre
 * ellos): se cachean los resultados en una tabla de 64 K entradas de acceso
 * directo, así que casi todos los píxeles cuestan una búsqueda.
 */
export function crearRecoloreado(opciones: OpcionesRecoloreado): Recoloreado {
  const regla = preparar(opciones);
  const TAM = 1 << 16;
  const claves = new Int32Array(TAM).fill(-1);
  const valores = new Uint32Array(TAM);
  return (pixel) => {
    const rgb = pixel & 0xffffff;
    const i = (Math.imul(rgb, 0x9e3779b1) >>> 16) & (TAM - 1);
    if (claves[i] !== rgb) {
      claves[i] = rgb;
      valores[i] = empaquetar(regla(desempaquetar(rgb))) & 0xffffff;
    }
    return ((pixel & 0xff000000) | (valores[i] ?? 0)) >>> 0;
  };
}

/**
 * Recolorea un bloque de píxeles EN SU SITIO. Los píxeles con `mascara[i] ≠ 0`
 * (dentro de una imagen) no se tocan. Sin máscara, se recolorea todo.
 */
export function transformarPixeles(
  pixeles: Uint32Array,
  recolorear: Recoloreado,
  mascara: Uint8Array | null = null,
): void {
  for (let i = 0; i < pixeles.length; i++) {
    if (mascara?.[i]) continue;
    pixeles[i] = recolorear(pixeles[i] ?? 0);
  }
}
