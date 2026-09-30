import type { PDFDocumentProxy } from "pdfjs-dist";

/**
 * Carga de pdf.js y de un documento (docs/PDF_DARK_MODE_SPIKE.md §3, SEGURIDAD §4).
 *
 * - **Build `legacy`** de pdf.js (D18): la moderna exige APIs de JavaScript de
 *   2025–2026 (`Uint8Array.prototype.toHex`, `Map.prototype.getOrInsertComputed`…)
 *   que no tienen los navegadores mínimos de `build.target`. La `legacy` las trae
 *   con polyfills; su detección de `globalThis` con `Function("return this")` no
 *   llega a ejecutarse en ningún navegador objetivo (la CSP lo confirma en E2E).
 * - pdf.js se importa a demanda (`import()`): no entra en el arranque de la app.
 * - Worker, fuentes estándar, cmaps y decodificadores se sirven desde el PROPIO
 *   origen (`public/pdfjs/`, lo copia `scripts/copiar-pdfjs.mjs`). Nada remoto.
 * - `useWasm: false`: pdf.js no compila WebAssembly (usa sus decodificadores en
 *   JavaScript), así que la CSP no necesita `'wasm-unsafe-eval'`.
 * - El documento entra como BYTES (`data`), nunca como URL: pdf.js no hace
 *   ninguna petición para obtenerlo.
 */
export type Pdfjs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");

/** Dónde encuentra pdf.js sus recursos. En el navegador, bajo la base de Vite. */
export type RutasPdfjs = { worker: string; recursos: string };

export const RUTAS_WEB: RutasPdfjs = {
  worker: `${import.meta.env.BASE_URL}pdfjs/pdf.worker.min.mjs`,
  recursos: `${import.meta.env.BASE_URL}pdfjs/`,
};

let modulo: Promise<Pdfjs> | undefined;

/** Importa pdf.js (`legacy`) una sola vez y apunta su worker al del propio origen. */
export function cargarPdfjs(rutas: RutasPdfjs = RUTAS_WEB): Promise<Pdfjs> {
  modulo ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = rutas.worker;
    return pdfjs;
  });
  return modulo;
}

/**
 * Opciones de `getDocument`. Cada una tiene su motivo en SEGURIDAD §4.
 * `password` solo aparece si se da una (Fase 6, D13): nunca se guarda.
 */
export function opcionesDocumento(
  datos: Uint8Array,
  rutas: RutasPdfjs = RUTAS_WEB,
  contrasena?: string,
) {
  return {
    data: datos,
    ...(contrasena === undefined ? {} : { password: contrasena }),
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

/** pdf.js no ha podido abrir el documento (dañado, no es PDF…). */
export class PdfNoLegibleError extends Error {
  constructor(options?: { cause?: unknown }) {
    super("pdf-no-legible", options);
    this.name = "PdfNoLegibleError";
  }
}

/**
 * El PDF está cifrado con contraseña de apertura (D13, Fase 6): la interfaz la
 * pide. `motivo`: si falta o si la que se dio no es la correcta. El mensaje
 * nunca lleva la contraseña.
 */
export class PdfProtegidoError extends Error {
  constructor(
    readonly motivo: "necesita" | "incorrecta" = "necesita",
    options?: { cause?: unknown },
  ) {
    super("pdf-protegido", options);
    this.name = "PdfProtegidoError";
  }
}

/** `PasswordResponses.INCORRECT_PASSWORD` de pdf.js (estable; un test lo vigila). */
export const CONTRASENA_INCORRECTA = 2;

/** La apertura se canceló (se abrió otro documento o se cerró este). */
export class AperturaCanceladaError extends Error {
  constructor() {
    super("apertura-cancelada");
    this.name = "AperturaCanceladaError";
  }
}

/**
 * Abre un PDF a partir del `Blob` que entrega la capa de documentos (Fase 3).
 *
 * `contrasena` (Fase 6): la de apertura, si el usuario la ha escrito. Solo
 * viaja a pdf.js en esta llamada; BPDF no la guarda en ningún sitio. Cada
 * intento hace una copia nueva de los bytes (la anterior se transfirió al
 * worker de pdf.js con la tarea que falló, que se destruye).
 *
 * `blob.arrayBuffer()` crea UNA copia de los bytes en memoria, que pdf.js
 * transfiere a su worker sin volver a copiarla (el `ArrayBuffer` queda
 * desasociado en este hilo). El `Blob` original no se toca.
 *
 * `senal` permite cancelar: se destruye la tarea de pdf.js (y con ella lo que
 * hubiera cargado su worker) y se rechaza con `AperturaCanceladaError`.
 */
export async function abrirPdf(
  blob: Blob,
  pdfjs: Pdfjs,
  rutas: RutasPdfjs = RUTAS_WEB,
  senal?: AbortSignal,
  contrasena?: string,
): Promise<PDFDocumentProxy> {
  if (senal?.aborted) throw new AperturaCanceladaError();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  if (senal?.aborted) throw new AperturaCanceladaError();
  const tarea = pdfjs.getDocument(opcionesDocumento(bytes, rutas, contrasena));
  const cancelar = () => void tarea.destroy();
  senal?.addEventListener("abort", cancelar, { once: true });
  try {
    const documento = await tarea.promise;
    if (senal?.aborted) {
      await tarea.destroy();
      throw new AperturaCanceladaError();
    }
    return documento;
  } catch (cause) {
    await tarea.destroy();
    if (senal?.aborted || cause instanceof AperturaCanceladaError) {
      throw new AperturaCanceladaError();
    }
    if (cause instanceof Error && cause.name === "PasswordException") {
      const codigo = (cause as Error & { code?: unknown }).code;
      // Sin `cause`: el error de pdf.js no lleva la contraseña, pero así ni
      // siquiera puede acabar en un registro por accidente.
      throw new PdfProtegidoError(codigo === CONTRASENA_INCORRECTA ? "incorrecta" : "necesita");
    }
    throw new PdfNoLegibleError({ cause });
  } finally {
    senal?.removeEventListener("abort", cancelar);
  }
}
