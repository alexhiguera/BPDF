/**
 * Regiones de imagen de una página (docs/PDF_DARK_MODE_SPIKE.md §6).
 *
 * pdf.js las registra él mismo si se renderiza con `recordImages: true`: deja
 * en `page.imageCoordinates` seis números por imagen, normalizados al tamaño
 * del lienzo, ya recortados por el clip de la página. Son tres esquinas de un
 * paralelogramo: A, B y C, con la cuarta en B + C − A.
 */

/** Paralelogramo en píxeles del lienzo: origen A y esquinas B y C (lados AB y AC). */
export type Paralelogramo = readonly [number, number, number, number, number, number];

/** Convierte las coordenadas normalizadas de pdf.js a píxeles del lienzo actual. */
export function paralelogramos(
  coordenadas: ArrayLike<number> | null | undefined,
  ancho: number,
  alto: number,
): Paralelogramo[] {
  const regiones: Paralelogramo[] = [];
  if (!coordenadas) return regiones;
  for (let i = 0; i + 5 < coordenadas.length; i += 6) {
    const c = (k: number) => coordenadas[i + k] ?? 0;
    regiones.push([
      c(0) * ancho,
      c(1) * alto,
      c(2) * ancho,
      c(3) * alto,
      c(4) * ancho,
      c(5) * alto,
    ]);
  }
  return regiones;
}

/** Fracción del lienzo a partir de la cual una imagen se trata como página escaneada. */
export const FRACCION_ESCANEO = 0.9;

const area = ([ax, ay, bx, by, cx, cy]: Paralelogramo): number =>
  Math.abs((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));

/**
 * Qué regiones se CONSERVAN con sus colores. Todas salvo las que cubren casi la
 * página entera: eso es una página escaneada (una foto del papel), y
 * conservarla deja la página blanca. Se recolorea con la heurística, que trata
 * bien el papel y la tinta. Es una HEURÍSTICA: una foto a página completa
 * (portada de revista) también se recolorearía (docs/PDF_DARK_MODE_SPIKE.md §10).
 */
export function regionesAConservar(
  regiones: readonly Paralelogramo[],
  ancho: number,
  alto: number,
): Paralelogramo[] {
  return regiones.filter((r) => area(r) < FRACCION_ESCANEO * ancho * alto);
}

/**
 * Marca con 1 en `mascara` (de `ancho × filas`, que empieza en la fila `y0` del
 * lienzo) los píxeles cuyo centro cae dentro de alguna región, ampliada
 * `margen` píxeles por cada lado (negativo: reducida). Por defecto 0: con más
 * margen se conserva el papel blanco del borde y la imagen queda con un filo
 * claro (se vio en el spike); los píxeles mezclados del borde los resuelve la
 * heurística, que conserva lo que tiene color.
 */
export function marcarRegiones(
  mascara: Uint8Array,
  ancho: number,
  y0: number,
  filas: number,
  regiones: readonly Paralelogramo[],
  margen = 0,
): void {
  for (const [ax, ay, bx, by, cx, cy] of regiones) {
    const [ux, uy, vx, vy] = [bx - ax, by - ay, cx - ax, cy - ay];
    const det = ux * vy - uy * vx;
    if (Math.abs(det) < 1e-9) continue;
    const [lu, lv] = [Math.hypot(ux, uy), Math.hypot(vx, vy)];
    const [ms, mt] = [margen / lu, margen / lv];
    const xs = [ax, bx, cx, bx + cx - ax];
    const ys = [ay, by, cy, by + cy - ay];
    const xMin = Math.max(0, Math.floor(Math.min(...xs) - margen));
    const xMax = Math.min(ancho - 1, Math.ceil(Math.max(...xs) + margen));
    const yMin = Math.max(y0, Math.floor(Math.min(...ys) - margen));
    const yMax = Math.min(y0 + filas - 1, Math.ceil(Math.max(...ys) + margen));
    for (let y = yMin; y <= yMax; y++) {
      const py = y + 0.5 - ay;
      for (let x = xMin; x <= xMax; x++) {
        const px = x + 0.5 - ax;
        // p = s·u + t·v  ⇒  (s, t) por la inversa de [u v].
        const s = (px * vy - py * vx) / det;
        const t = (ux * py - uy * px) / det;
        if (s >= -ms && s <= 1 + ms && t >= -mt && t <= 1 + mt) {
          mascara[(y - y0) * ancho + x] = 1;
        }
      }
    }
  }
}
