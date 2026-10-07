import { messages } from "@/i18n/messages";
import { decodeMarkdown, displayName, hasPdfSignature, kindFromName } from "./detect";
import { DocumentError } from "./errors";
import { MAX_BYTES, PDF_SIGNATURE_WINDOW } from "./limits";
import { type OpenedDocument, SIN_RECURSOS } from "./types";

let lastId = 0;

/**
 * Id opaco para un documento de esta sesión. Un contador basta (solo tiene que
 * ser único y no derivar del nombre ni de la ruta) y, a diferencia de
 * `crypto.randomUUID()`, funciona también fuera de un contexto seguro.
 */
export const nextDocumentId = (): string => `doc-${++lastId}`;

/** Lo mínimo de un `File` que hace falta leer. En web es el propio `File`. */
export type LocalFile = Pick<File, "name" | "size" | "slice" | "arrayBuffer">;

/**
 * Valida un fichero local y lo convierte en `OpenedDocument`, en este orden:
 * extensión → vacío → tamaño → contenido. Lo que falla se rechaza con un
 * `DocumentError` antes de leer más de lo necesario.
 *
 * - PDF: solo se leen los primeros `PDF_SIGNATURE_WINDOW` bytes para buscar la
 *   firma; el documento conserva el `File` sin leerlo entero.
 * - Markdown: se lee entero, se decodifica y solo se conserva el texto.
 *
 * Nada del contenido se interpreta ni se ejecuta aquí, y nada sale del
 * dispositivo. La plataforma solo aporta el fichero. El identificador es
 * siempre interno y opaco: la antigua entrada opcional para Electron se retiró
 * al cerrar v1 porque no tenía ningún consumidor web.
 */
export async function readDocument(file: LocalFile): Promise<OpenedDocument> {
  const id = nextDocumentId();
  const name = displayName(file.name, messages.document.untitled);
  const kind = kindFromName(name);
  if (!kind) throw new DocumentError("unsupported", { fileName: name });
  if (file.size === 0) throw new DocumentError("empty", { fileName: name, kind });
  if (file.size > MAX_BYTES[kind]) throw new DocumentError("too-large", { fileName: name, kind });

  if (kind === "pdf") {
    const head = await readBytes(file.slice(0, PDF_SIGNATURE_WINDOW), name);
    if (!hasPdfSignature(new Uint8Array(head))) {
      throw new DocumentError("not-pdf", { fileName: name, kind });
    }
    // `slice` sin argumentos: el mismo contenido como `Blob`, sin copiarlo ni
    // guardar en el documento el `File` (con su `lastModified`, que no hace falta).
    return { id, kind, name, size: file.size, blob: file.slice() };
  }

  const text = decodeMarkdown(await readBytes(file, name), name);
  return { id, kind, name, size: file.size, text, resources: SIN_RECURSOS };
}

/** Lee un `Blob` y convierte cualquier fallo de lectura en `unreadable`. */
async function readBytes(blob: Pick<Blob, "arrayBuffer">, fileName: string): Promise<ArrayBuffer> {
  try {
    return await blob.arrayBuffer();
  } catch (cause) {
    throw new DocumentError("unreadable", { fileName, cause });
  }
}
