import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import {
  abrirPdf,
  opcionesDocumento,
  type Pdfjs,
  PdfNoLegibleError,
  type RutasPdfjs,
  VERBOSIDAD_SOLO_ERRORES,
} from "@/pdf/engine";
import { ANOTACIONES_DESACTIVADAS } from "@/pdf/render";
import { crearPdfModoOscuro, GEOMETRIA } from "../../fixtures/pdf/modo-oscuro/generar.mjs";

/**
 * pdf.js real, en Node (sin lienzo: el render se prueba en Playwright). En Node
 * pdf.js corre su worker en el mismo hilo y lee los recursos del disco.
 *
 * Se usa la build `legacy/`: la moderna exige APIs de JavaScript que Node 24 aún
 * no trae (`Uint8Array.prototype.toHex`, `Map.prototype.getOrInsertComputed`…,
 * docs/PDF_DARK_MODE_SPIKE.md §9). `abrirPdf` recibe el módulo por parámetro, así
 * que la función probada es la misma que usa el navegador.
 */
const DIST = path.resolve("node_modules/pdfjs-dist");
const RUTAS: RutasPdfjs = {
  worker: pathToFileURL(path.join(DIST, "legacy/build/pdf.worker.mjs")).href,
  recursos: `${DIST}/`,
};
let modulo: Promise<Pdfjs> | undefined;
function cargarPdfjs(rutas: RutasPdfjs): Promise<Pdfjs> {
  modulo ??= import("pdfjs-dist/legacy/build/pdf.mjs").then((pdfjs) => {
    pdfjs.GlobalWorkerOptions.workerSrc = rutas.worker;
    return pdfjs as unknown as Pdfjs;
  });
  return modulo;
}
const FIXTURE = "tests/fixtures/pdf/modo-oscuro/modo-oscuro.pdf";
const abiertos: { loadingTask: { destroy(): Promise<void> } }[] = [];
afterAll(async () => {
  for (const d of abiertos) await d.loadingTask.destroy();
});

async function abrir(bytes: Uint8Array | Buffer) {
  const pdfjs = await cargarPdfjs(RUTAS);
  const doc = await abrirPdf(new Blob([new Uint8Array(bytes)]), pdfjs, RUTAS);
  abiertos.push(doc);
  return { pdfjs, doc };
}

describe("fixture del spike", () => {
  it("el fichero versionado es exactamente lo que produce el generador", () => {
    expect(Buffer.compare(readFileSync(FIXTURE), crearPdfModoOscuro())).toBe(0);
  });
});

describe("abrirPdf", () => {
  it("carga el fixture con pdf.js y tiene las páginas esperadas", async () => {
    const { doc } = await abrir(readFileSync(FIXTURE));
    expect(doc.numPages).toBe(GEOMETRIA.paginas);
  });

  it("la página de imágenes lleva dos imágenes rasterizadas y la de texto ninguna", async () => {
    const { pdfjs, doc } = await abrir(readFileSync(FIXTURE));
    const cuenta = async (n: number) =>
      (await (await doc.getPage(n)).getOperatorList()).fnArray.filter(
        (f) => f === pdfjs.OPS.paintImageXObject,
      ).length;
    expect(await cuenta(GEOMETRIA.imagen.pagina)).toBe(2);
    expect(await cuenta(GEOMETRIA.texto.pagina)).toBe(0);
  });

  it("no modifica el Blob de partida (pdf.js recibe una copia de sus bytes)", async () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE));
    const blob = new Blob([bytes]);
    const antes = new Uint8Array(await blob.arrayBuffer());
    const pdfjs = await cargarPdfjs(RUTAS);
    abiertos.push(await abrirPdf(blob, pdfjs, RUTAS));
    const despues = new Uint8Array(await blob.arrayBuffer());
    expect(blob.size).toBe(bytes.length);
    expect(Buffer.compare(antes, despues)).toBe(0);
  });

  it("un PDF dañado se rechaza con PdfNoLegibleError (y no queda nada abierto)", async () => {
    const pdfjs = await cargarPdfjs(RUTAS);
    const truncado = readFileSync(FIXTURE).subarray(0, 300);
    await expect(
      abrirPdf(new Blob([new Uint8Array(truncado)]), pdfjs, RUTAS),
    ).rejects.toBeInstanceOf(PdfNoLegibleError);
    const basura = new TextEncoder().encode("%PDF-1.7\nesto no es un PDF");
    await expect(abrirPdf(new Blob([basura]), pdfjs, RUTAS)).rejects.toBeInstanceOf(
      PdfNoLegibleError,
    );
  });
});

describe("configuración segura (docs/SEGURIDAD.md §4)", () => {
  const op = opcionesDocumento(new Uint8Array(), {
    worker: "/pdfjs/pdf.worker.min.mjs",
    recursos: "/pdfjs/",
  });

  it("sin WebAssembly: la CSP no necesita 'wasm-unsafe-eval'", () => {
    expect(op.useWasm).toBe(false);
  });

  it("el documento entra como bytes, nunca como URL, y sin XFA", () => {
    expect(op).not.toHaveProperty("url");
    expect(op.enableXfa).toBe(false);
  });

  it("todos los recursos se piden al propio origen", () => {
    for (const url of [op.wasmUrl, op.cMapUrl, op.standardFontDataUrl]) {
      expect(url.startsWith("/pdfjs/")).toBe(true);
    }
  });

  it("el render sin anotaciones usa el valor real de AnnotationMode.DISABLE", async () => {
    const pdfjs = await cargarPdfjs(RUTAS);
    expect(ANOTACIONES_DESACTIVADAS).toBe(pdfjs.AnnotationMode.DISABLE);
    expect(VERBOSIDAD_SOLO_ERRORES).toBe(pdfjs.VerbosityLevel.ERRORS);
  });
});
