/**
 * Modelo del documento abierto (docs/PLAN.md §4.2). Es lo único que el resto de
 * la app sabe de un fichero: nunca una ruta de disco, un `FileSystemHandle` ni
 * nada de la plataforma (docs/ELECTRON.md: el renderer no ve rutas).
 *
 * BPDF abre un documento a la vez (D16). El modelo no lo impone: la regla vive
 * en `DocumentProvider`, que guarda uno solo. Así, unas pestañas futuras
 * cambiarían el estado, no el modelo.
 */

export type DocumentKind = "pdf" | "markdown";

type DocumentBase = {
  /** Opaco y válido solo en esta sesión. No deriva del nombre ni de la ruta. */
  readonly id: string;
  /** Nombre para mostrar, ya saneado (`displayName`). Solo se usa como texto. */
  readonly name: string;
  /** Bytes del fichero. */
  readonly size: number;
};

/**
 * PDF: se conserva el `Blob` (en web, el propio `File`) sin leerlo entero. En
 * web un `File` apunta al disco y no ocupa memoria hasta que alguien lo lee; el
 * visor (Fase 5) hará `await blob.arrayBuffer()` y pasará los bytes a pdf.js,
 * que los transfiere a su worker sin copiarlos. Nunca como URL (SEGURIDAD §4).
 */
export type OpenedPdf = DocumentBase & {
  readonly kind: "pdf";
  readonly blob: Blob;
};

/**
 * Markdown: el texto ya decodificado (UTF-8 estricto). Los bytes de partida no
 * se guardan: una sola copia del contenido en memoria.
 */
export type OpenedMarkdown = DocumentBase & {
  readonly kind: "markdown";
  readonly text: string;
};

export type OpenedDocument = OpenedPdf | OpenedMarkdown;
