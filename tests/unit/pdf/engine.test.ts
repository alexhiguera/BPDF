import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import {
  AperturaCanceladaError,
  abrirPdf,
  CONTRASENA_INCORRECTA,
  opcionesDocumento,
  PdfNoLegibleError,
  PdfProtegidoError,
  VERBOSIDAD_SOLO_ERRORES,
} from "@/pdf/engine";
import { ANOTACIONES_EN_LIENZO } from "@/pdf/render";
import { crearPdfModoOscuro, GEOMETRIA } from "../../fixtures/pdf/modo-oscuro/generar.mjs";
import {
  crearPdfFormulario,
  crearPdfProtegido,
  FORMULARIO,
} from "../../fixtures/pdf/visor/generar.mjs";
import { cargarPdfjsNode as cargarPdfjs, RUTAS } from "../../helpers/pdfjs";

const FIXTURE = "tests/fixtures/pdf/modo-oscuro/modo-oscuro.pdf";
const abiertos: { loadingTask: { destroy(): Promise<void> } }[] = [];
afterAll(async () => {
  for (const d of abiertos) await d.loadingTask.destroy();
});

async function abrir(bytes: Uint8Array | Buffer) {
  const pdfjs = await cargarPdfjs();
  const doc = await abrirPdf(new Blob([new Uint8Array(bytes)]), pdfjs, RUTAS);
  abiertos.push(doc);
  return { pdfjs, doc };
}

describe("fixtures", () => {
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
    const pdfjs = await cargarPdfjs();
    abiertos.push(await abrirPdf(blob, pdfjs, RUTAS));
    const despues = new Uint8Array(await blob.arrayBuffer());
    expect(blob.size).toBe(bytes.length);
    expect(Buffer.compare(antes, despues)).toBe(0);
  });

  it("un PDF dañado se rechaza con PdfNoLegibleError (y no queda nada abierto)", async () => {
    const pdfjs = await cargarPdfjs();
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

describe("abrirPdf: protegido y cancelación", () => {
  it("un PDF con contraseña de apertura se rechaza con PdfProtegidoError", async () => {
    const pdfjs = await cargarPdfjs();
    await expect(
      abrirPdf(new Blob([new Uint8Array(crearPdfProtegido())]), pdfjs, RUTAS),
    ).rejects.toBeInstanceOf(PdfProtegidoError);
  });

  it("sin contraseña dice que la necesita; con una incorrecta, que no es; con la buena, abre (Fase 6)", async () => {
    const pdfjs = await cargarPdfjs();
    const blob = new Blob([new Uint8Array(crearPdfProtegido())]);
    const motivo = (contrasena?: string) =>
      abrirPdf(blob, pdfjs, RUTAS, undefined, contrasena).then(
        () => "abierto",
        (e: unknown) => (e instanceof PdfProtegidoError ? e.motivo : String(e)),
      );
    expect(await motivo()).toBe("necesita");
    expect(await motivo("mala")).toBe("incorrecta");
    expect(await motivo("")).toBe("necesita");
    // Reintentos con el mismo Blob: cada uno hace su propia copia de los bytes.
    const doc = await abrirPdf(blob, pdfjs, RUTAS, undefined, "bpdf");
    expect(doc.numPages).toBe(1);
    await doc.loadingTask.destroy();
  });

  it("el error de contraseña no lleva la contraseña ni el error de pdf.js", async () => {
    const pdfjs = await cargarPdfjs();
    const blob = new Blob([new Uint8Array(crearPdfProtegido())]);
    const error = await abrirPdf(blob, pdfjs, RUTAS, undefined, "secreta-123").catch((e) => e);
    expect(error).toBeInstanceOf(PdfProtegidoError);
    expect(error.cause).toBeUndefined();
    expect(JSON.stringify({ ...error, m: error.message, s: String(error.stack) })).not.toContain(
      "secreta-123",
    );
  });

  it("un PDF con solo contraseña de permisos (propietario) abre sin pedir nada", async () => {
    const pdfjs = await cargarPdfjs();
    const doc = await abrirPdf(new Blob([new Uint8Array(crearPdfProtegido(""))]), pdfjs, RUTAS);
    expect(doc.numPages).toBe(1);
    await doc.loadingTask.destroy();
  });

  it("abortar mientras se comprueba una contraseña cancela la apertura", async () => {
    const pdfjs = await cargarPdfjs();
    const c = new AbortController();
    const abriendo = abrirPdf(
      new Blob([new Uint8Array(crearPdfProtegido())]),
      pdfjs,
      RUTAS,
      c.signal,
      "bpdf",
    );
    queueMicrotask(() => c.abort());
    await expect(abriendo).rejects.toBeInstanceOf(AperturaCanceladaError);
  });

  it("con la señal ya abortada no llega a pedir nada a pdf.js", async () => {
    const pdfjs = await cargarPdfjs();
    const c = new AbortController();
    c.abort();
    await expect(
      abrirPdf(new Blob([new Uint8Array(readFileSync(FIXTURE))]), pdfjs, RUTAS, c.signal),
    ).rejects.toBeInstanceOf(AperturaCanceladaError);
  });

  it("abortar durante la carga destruye la tarea y rechaza con AperturaCanceladaError", async () => {
    const pdfjs = await cargarPdfjs();
    const c = new AbortController();
    const abriendo = abrirPdf(
      new Blob([new Uint8Array(crearPdfModoOscuro())]),
      pdfjs,
      RUTAS,
      c.signal,
    );
    queueMicrotask(() => c.abort());
    await expect(abriendo).rejects.toBeInstanceOf(AperturaCanceladaError);
  });

  it("un documento abierto se destruye y deja de responder", async () => {
    const pdfjs = await cargarPdfjs();
    const doc = await abrirPdf(new Blob([new Uint8Array(readFileSync(FIXTURE))]), pdfjs, RUTAS);
    await doc.loadingTask.destroy();
    // pdf.js lanza en el acto: ya no hay transporte con su worker.
    await expect(Promise.resolve().then(() => doc.getPage(1))).rejects.toThrow();
  });
});

describe("configuración segura (docs/SEGURIDAD.md §4)", () => {
  const op = opcionesDocumento(new Uint8Array(), {
    worker: "/pdfjs/pdf.worker.min.mjs",
    recursos: "/pdfjs/",
  });

  it("la contraseña solo aparece en las opciones si se da una (Fase 6)", () => {
    expect(op).not.toHaveProperty("password");
    expect(opcionesDocumento(new Uint8Array(), undefined, "x")).toHaveProperty("password", "x");
  });

  it("CONTRASENA_INCORRECTA es el código de pdf.js", async () => {
    const pdfjs = await cargarPdfjs();
    expect(pdfjs.PasswordResponses.INCORRECT_PASSWORD).toBe(CONTRASENA_INCORRECTA);
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

  it("las anotaciones se pintan en el lienzo sin capa interactiva (AnnotationMode.ENABLE)", async () => {
    const pdfjs = await cargarPdfjs();
    expect(ANOTACIONES_EN_LIENZO).toBe(pdfjs.AnnotationMode.ENABLE);
    expect(VERBOSIDAD_SOLO_ERRORES).toBe(pdfjs.VerbosityLevel.ERRORS);
  });

  // Premisa del E2E de D14 (e2e/specs/seguridad.spec.ts): pdf.js ve los dos campos
  // del formulario de prueba con su apariencia; si no los viera, que no se puedan
  // rellenar en el visor no demostraría nada.
  it("el formulario de prueba (D14): pdf.js ve sus dos campos y su JavaScript", async () => {
    const { doc } = await abrir(crearPdfFormulario());
    const anotaciones = await (await doc.getPage(1)).getAnnotations();
    const campos = anotaciones.filter((a) => a.subtype === "Widget");
    expect(campos.map((a) => [a.fieldType, a.fieldName])).toEqual([
      ["Tx", "nombre"],
      ["Btn", "acepto"],
    ]);
    expect(campos[0]?.fieldValue).toBe(FORMULARIO.valor);
    expect(campos.map((a) => a.hasAppearance)).toEqual([true, true]);
    expect(await doc.getJSActions()).not.toBeNull();
  });
});
