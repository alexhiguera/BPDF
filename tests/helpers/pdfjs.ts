import path from "node:path";
import { pathToFileURL } from "node:url";
import { abrirPdf, type Pdfjs, type RutasPdfjs } from "@/pdf/engine";

/**
 * pdf.js real, en Node (sin lienzo: el render se prueba en Playwright). En Node
 * pdf.js corre su worker en el mismo hilo y lee los recursos del disco.
 *
 * Build `legacy/` (D18), la misma que usa el navegador. `abrirPdf` recibe el
 * módulo por parámetro, así que la función probada es la misma que usa la app.
 */
const DIST = path.resolve("node_modules/pdfjs-dist");
export const RUTAS: RutasPdfjs = {
  worker: pathToFileURL(path.join(DIST, "legacy/build/pdf.worker.mjs")).href,
  recursos: `${DIST}/`,
};

let modulo: Promise<Pdfjs> | undefined;
export function cargarPdfjsNode(): Promise<Pdfjs> {
  modulo ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = RUTAS.worker;
    return pdfjs as unknown as Pdfjs;
  });
  return modulo;
}

/** Abre unos bytes con pdf.js; el llamador destruye el documento. */
export async function abrirBytes(bytes: Uint8Array, senal?: AbortSignal) {
  const pdfjs = await cargarPdfjsNode();
  return { pdfjs, doc: await abrirPdf(new Blob([new Uint8Array(bytes)]), pdfjs, RUTAS, senal) };
}
