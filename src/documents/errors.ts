import type { DocumentKind } from "./types";

/**
 * Por qué no se pudo abrir un fichero. Cada código tiene su texto en
 * `messages.documentError` (docs/PLAN.md §9.3): claro y sin detalles técnicos.
 *
 * - `unsupported`: la extensión no es `.pdf`, `.md` ni `.markdown`.
 * - `no-markdown`: se eligieron varios ficheros y ninguno es un Markdown.
 * - `several-markdown`: varios ficheros con más de un Markdown (uno a la vez, D16).
 * - `incompatible`: varios ficheros con alguno que no es Markdown ni imagen
 *   admitida (un PDF se abre solo).
 * - `folder-no-markdown`: una carpeta sin ningún Markdown.
 * - `mixed-drop`: se soltó una carpeta junto con otros ficheros o carpetas.
 * - `folder-too-large`: una carpeta con más de `MAX_FICHEROS_CARPETA` ficheros.
 * - `empty`: 0 bytes.
 * - `too-large`: supera `MAX_BYTES` de su tipo.
 * - `not-pdf`: se llama `.pdf` pero no lleva la firma `%PDF-`.
 * - `not-utf8`: un Markdown que no es texto UTF-8 (binario, UTF-16…).
 * - `unreadable`: el navegador no pudo leerlo (borrado, sin permiso, carpeta…).
 */
export type DocumentErrorCode =
  | "unsupported"
  | "no-markdown"
  | "several-markdown"
  | "incompatible"
  | "folder-no-markdown"
  | "folder-too-large"
  | "mixed-drop"
  | "empty"
  | "too-large"
  | "not-pdf"
  | "not-utf8"
  | "unreadable";

export class DocumentError extends Error {
  readonly code: DocumentErrorCode;
  /** Nombre saneado del fichero, si lo hay (una selección no tiene uno solo). */
  readonly fileName: string | undefined;
  /** Tipo que se intentó abrir; lo necesita `too-large` para decir el límite. */
  readonly kind: DocumentKind | undefined;

  constructor(
    code: DocumentErrorCode,
    detail: { fileName?: string; kind?: DocumentKind; cause?: unknown } = {},
  ) {
    super(code, { cause: detail.cause });
    this.name = "DocumentError";
    this.code = code;
    this.fileName = detail.fileName;
    this.kind = detail.kind;
  }
}
