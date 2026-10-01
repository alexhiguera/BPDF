import type { DocumentoAGuardar, ResultadoGuardado } from "./types";

/**
 * Guardar texto en web (Fase 9, `Platform.saveText`).
 *
 * - **Con `showSaveFilePicker`** (File System Access API, Chromium): la
 *   primera vez el usuario elige el destino en el diálogo del sistema; las
 *   siguientes, mientras siga abierto el MISMO documento, se vuelve a escribir
 *   ahí. El `FileSystemFileHandle` vive solo en memoria (este cierre) y solo el
 *   del documento actual (D16): nunca se guarda en ningún almacenamiento. Si
 *   escribir falla, se olvida y el siguiente guardado vuelve a preguntar.
 * - **Sin ella**: una descarga (`<a download>` con una URL `blob:` propia,
 *   revocada después). Siempre una copia; el navegador decide dónde.
 *
 * Nunca se escribe en el fichero que se abrió sin que el usuario lo elija: en
 * web BPDF no tiene acceso a él (un `File` es de solo lectura).
 */

type Escritor = { write(datos: Blob): Promise<void>; close(): Promise<void> };
type Destino = { createWritable(): Promise<Escritor> };
type OpcionesSelector = {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
};
type Selector = (opciones: OpcionesSelector) => Promise<Destino>;

/** Cuánto vive la URL `blob:` de una descarga: lo justo para que empiece. */
export const VIDA_URL_DESCARGA_MS = 30_000;

export function crearGuardadoWeb(ventana: (Window & typeof globalThis) | null) {
  let actual: { id: string; destino: Destino } | null = null;

  return async function guardar(
    documento: DocumentoAGuardar,
    texto: string,
  ): Promise<ResultadoGuardado> {
    const datos = new Blob([texto], { type: "text/markdown;charset=utf-8" });
    const nombre = nombreSugerido(documento.name);
    const selector = (ventana as unknown as { showSaveFilePicker?: Selector } | null)
      ?.showSaveFilePicker;
    if (typeof selector !== "function") {
      if (!ventana) throw new Error("sin ventana");
      descargar(ventana, datos, nombre);
      return "descargado";
    }
    let destino = actual?.id === documento.id ? actual.destino : null;
    if (!destino) {
      try {
        destino = await selector.call(ventana, {
          suggestedName: nombre,
          types: [{ description: "Markdown", accept: { "text/markdown": [".md", ".markdown"] } }],
        });
      } catch (e) {
        // Por el nombre: un `DOMException` no es `instanceof Error` en todos los entornos.
        if ((e as { name?: unknown } | null)?.name === "AbortError") return "cancelado";
        throw e;
      }
      actual = { id: documento.id, destino };
    }
    try {
      const escritor = await destino.createWritable();
      await escritor.write(datos);
      await escritor.close();
    } catch (e) {
      actual = null; // el siguiente intento vuelve a preguntar dónde
      throw e;
    }
    return "guardado";
  };
}

/** El nombre que se propone: el del documento, siempre con extensión de Markdown. */
export function nombreSugerido(nombre: string): string {
  const limpio = nombre.trim() || "documento";
  return /\.(md|markdown)$/i.test(limpio) ? limpio : `${limpio}.md`;
}

function descargar(ventana: Window & typeof globalThis, datos: Blob, nombre: string) {
  const doc = ventana.document;
  const url = ventana.URL.createObjectURL(datos);
  const enlace = doc.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = "noopener";
  enlace.hidden = true;
  doc.body.append(enlace);
  enlace.click();
  enlace.remove();
  ventana.setTimeout(() => ventana.URL.revokeObjectURL(url), VIDA_URL_DESCARGA_MS);
}
