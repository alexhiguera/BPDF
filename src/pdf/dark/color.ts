/**
 * Matemática de color para el modo oscuro de PDF (docs/PDF_DARK_MODE_SPIKE.md).
 * Funciones puras, sin DOM: se prueban con números concretos.
 *
 * Se trabaja en OKLab (Björn Ottosson, 2020) porque separa bien la
 * luminosidad (L) del color (a, b): se puede invertir la luminosidad de un
 * píxel sin tocar su tono, y la «croma» (distancia a los grises) es una medida
 * perceptual razonable de «esto es un color, no tinta ni papel».
 */

export type Rgb = readonly [number, number, number];

/** sRGB 8 bits → lineal, precalculado (se consulta millones de veces por página). */
const SRGB_A_LINEAL = new Float32Array(256);
for (let i = 0; i < 256; i++) {
  const c = i / 255;
  SRGB_A_LINEAL[i] = c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export const aLineal = (canal8: number): number => SRGB_A_LINEAL[canal8] ?? 0;

export function aSrgb8(lineal: number): number {
  const c = lineal <= 0 ? 0 : lineal >= 1 ? 1 : lineal;
  const s = c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;
  return Math.round(s * 255);
}

/** sRGB lineal → OKLab. */
export function oklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** OKLab → sRGB lineal (puede salirse de [0, 1]: quien lo usa recorta). */
export function lineal(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Luminosidad OKLab (0 negro, 1 blanco) de un color sRGB de 8 bits. */
export const luminosidad = ([r, g, b]: Rgb): number => oklab(aLineal(r), aLineal(g), aLineal(b))[0];

/** Luminancia relativa WCAG 2.x de un color sRGB de 8 bits. */
export const luminancia = ([r, g, b]: Rgb): number =>
  0.2126 * aLineal(r) + 0.7152 * aLineal(g) + 0.0722 * aLineal(b);

/** Contraste WCAG 2.x entre dos colores (1 a 21). */
export function contraste(x: Rgb, y: Rgb): number {
  const [a, b] = [luminancia(x), luminancia(y)];
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Luminosidad OKLab mínima que necesita un gris para alcanzar `ratio` de
 * contraste sobre `fondo` (que debe ser oscuro). Para un gris, L = ∛Y, así que
 * sale de despejar la fórmula de contraste. Para un color es una aproximación
 * (los tests comprueban el resultado real con `contraste`).
 */
export function luminosidadMinima(fondo: Rgb, ratio: number): number {
  const y = Math.min(1, ratio * (luminancia(fondo) + 0.05) - 0.05);
  return Math.cbrt(Math.max(0, y));
}
