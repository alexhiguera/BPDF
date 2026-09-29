import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * Carga de pdf.js y de un documento (docs/PDF_DARK_MODE_SPIKE.md §3, SEGURIDAD §4).
 *
 * - pdf.js se importa a demanda (`import()`): no entra en el arranque de la app.
 * - Worker, fuentes estándar, cmaps y decodificadores se sirven desde el PROPIO
 *   origen (`public/pdfjs/`, lo copia `scripts/copiar-pdfjs.mjs`). Nada remoto.
 * - `useWasm: false`: pdf.js no compila WebAssembly (usa sus decodificadores en
 *   JavaScript), así que la CSP no necesita `'wasm-unsafe-eval'`.
 * - El documento entra como BYTES (`data`), nunca como URL: pdf.js no hace
 *   ninguna petición para obtenerlo.
 */
export type Pdfjs = typeof import("pdfjs-dist");

/** Dónde encuentra pdf.js sus recursos. En el navegador, bajo la base de Vite. */
export type RutasPdfjs = { worker: string; recursos: string };

export const RUTAS_WEB: RutasPdfjs = {
  worker: `${import.meta.env.BASE_URL}pdfjs/pdf.worker.min.mjs`,
  recursos: `${import.meta.env.BASE_URL}pdfjs/`,
};

let modulo: Promise<Pdfjs> | undefined;

/** Importa pdf.js una sola vez y apunta su worker al del propio origen. */
export function cargarPdfjs(rutas: RutasPdfjs = RUTAS_WEB): Promise<Pdfjs> {
  modulo ??= import("pdfjs-dist").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = rutas.worker;
    return pdfjs;
  });
  return modulo;
}

/** Opciones de `getDocument`. Cada una tiene su motivo en SEGURIDAD §4. */
export function opcionesDocumento(datos: Uint8Array, rutas: RutasPdfjs = RUTAS_WEB) {
  return {
    data: datos,
    useWasm: false,
    // Solo para cargar los decodificadores en JavaScript (`*_nowasm_fallback.js`).
    wasmUrl: `${rutas.recursos}wasm/`,
    cMapUrl: `${rutas.recursos}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${rutas.recursos}standard_fonts/`,
    // XFA son formularios dinámicos con su propio motor: no se interpretan.
    enableXfa: false,
    // Solo errores en consola: los avisos de diagnóstico de pdf.js (fuentes,
    // reindexado de un PDF dañado…) no dicen nada a quien usa la app.
    verbosity: VERBOSIDAD_SOLO_ERRORES,
  };
}

/** `VerbosityLevel.ERRORS` de pdf.js (su valor es estable y un test lo vigila). */
export const VERBOSIDAD_SOLO_ERRORES = 0;

/** pdf.js no ha podido abrir el documento (dañado, cifrado sin clave, no es PDF…). */
export class PdfNoLegibleError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("pdf-no-legible", options);
    this.name = "PdfNoLegibleError";
  }
}

/**
 * Abre un PDF a partir del `Blob` que entrega la capa de documentos (Fase 3).
 *
 * `blob.arrayBuffer()` crea UNA copia de los bytes en memoria, que pdf.js
 * transfiere a su worker sin volver a copiarla (el `ArrayBuffer` queda
 * desasociado en este hilo). El `Blob` original no se toca.
 */
export async function abrirPdf(
  blob: Blob,
  pdfjs: Pdfjs,
  rutas: RutasPdfjs = RUTAS_WEB,
): Promise<PDFDocumentProxy> {
  const tarea = pdfjs.getDocument(
    opcionesDocumento(new Uint8Array(await blob.arrayBuffer()), rutas),
  );
  try {
    return await tarea.promise;
  } catch (cause) {
    await tarea.destroy();
    throw new PdfNoLegibleError({ cause });
  }
}
