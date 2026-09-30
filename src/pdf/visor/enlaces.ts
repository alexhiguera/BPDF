/**
 * Política de enlaces de un PDF (docs/SEGURIDAD.md §4 y docs/ARCHITECTURE.md →
 * visor PDF, «Enlaces»). BPDF no usa la capa de anotaciones interactiva de
 * pdf.js: lee las anotaciones `Link` con `getAnnotations()` y decide aquí qué
 * hace cada una. Nada más de un PDF es interactivo.
 *
 * - Enlace externo: solo `http:`, `https:` y `mailto:`, y siempre por el
 *   mecanismo controlado de la plataforma (`Platform.openExternal`), nunca
 *   navegando la app. `javascript:`, `file:`, `data:`, rutas relativas y todo lo
 *   demás se descartan: la zona no es un enlace.
 * - Enlace interno (destino con nombre o explícito, o las acciones con nombre
 *   de página siguiente/anterior/primera/última): mueve el visor a esa página.
 * - Acciones JavaScript, de formulario, de lanzar ficheros, de adjuntos, de
 *   «ir a otro PDF» (GoToR)…: se ignoran.
 */

import { urlPermitida } from "@/lib/url-externa";

export { urlPermitida };

export type DestinoEnlace = { tipo: "externo"; url: string } | { tipo: "interno"; pagina: number };

/** Lo que el visor usa de una anotación de pdf.js (`getAnnotations()`). */
export type AnotacionPdf = {
  subtype?: string;
  rect?: number[];
  url?: unknown;
  dest?: unknown;
  action?: unknown;
};

/** Lo que el visor usa del documento para resolver destinos internos. */
export type ResolutorDestinos = {
  numPages: number;
  getDestination(nombre: string): Promise<unknown[] | null>;
  getPageIndex(ref: { num: number; gen: number }): Promise<number>;
};

const ACCIONES: Record<string, (actual: number, total: number) => number> = {
  NextPage: (a) => a + 1,
  PrevPage: (a) => a - 1,
  FirstPage: () => 1,
  LastPage: (_, t) => t,
};

const esRef = (x: unknown): x is { num: number; gen: number } =>
  typeof x === "object" &&
  x !== null &&
  Number.isInteger((x as { num?: unknown }).num) &&
  Number.isInteger((x as { gen?: unknown }).gen);

/**
 * A dónde lleva una anotación, o `null` si no es un enlace que BPDF siga. Un
 * destino que no se puede resolver (roto, fuera del documento) también es
 * `null`: mejor una zona inerte que un salto a una página que no existe.
 */
export async function resolverEnlace(
  anotacion: AnotacionPdf,
  documento: ResolutorDestinos,
  paginaActual: number,
): Promise<DestinoEnlace | null> {
  if (anotacion.subtype !== "Link") return null;
  const total = documento.numPages;
  const valida = (n: number): DestinoEnlace | null =>
    Number.isInteger(n) && n >= 1 && n <= total ? { tipo: "interno", pagina: n } : null;

  if (anotacion.url !== undefined) {
    const url = urlPermitida(anotacion.url);
    return url ? { tipo: "externo", url } : null;
  }
  if (typeof anotacion.action === "string") {
    const accion = ACCIONES[anotacion.action];
    return accion ? valida(accion(paginaActual, total)) : null;
  }
  try {
    let destino = anotacion.dest;
    if (typeof destino === "string") destino = await documento.getDestination(destino);
    if (!Array.isArray(destino)) return null;
    const [ref] = destino;
    if (Number.isInteger(ref)) return valida((ref as number) + 1);
    if (esRef(ref)) return valida((await documento.getPageIndex(ref)) + 1);
  } catch {
    // Destino con nombre inexistente o referencia rota.
  }
  return null;
}

export type Caja = { izquierda: number; arriba: number; ancho: number; alto: number };

/**
 * La caja de un rectángulo PDF `[x1, y1, x2, y2]` en píxeles CSS de la página,
 * con `convertir` = las dos esquinas por `viewport.convertToViewportPoint` (que
 * ya aplica zoom y rotación). `null` si el rectángulo no es válido o no tiene área.
 */
export function cajaDe(
  rect: unknown,
  convertir: (r: number[]) => number[],
  limite: { ancho: number; alto: number },
): Caja | null {
  if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite)) return null;
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = convertir(rect as number[]);
  const izquierda = Math.max(0, Math.min(x1, x2));
  const arriba = Math.max(0, Math.min(y1, y2));
  const derecha = Math.min(limite.ancho, Math.max(x1, x2));
  const abajo = Math.min(limite.alto, Math.max(y1, y2));
  if (derecha - izquierda < 1 || abajo - arriba < 1) return null;
  return { izquierda, arriba, ancho: derecha - izquierda, alto: abajo - arriba };
}
