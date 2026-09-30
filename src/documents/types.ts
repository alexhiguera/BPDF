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
 *
 * `resources`: las imágenes que el usuario entregó JUNTO con el `.md` (varios
 * ficheros o una carpeta, Fase 7 bis). Un `.md` abierto solo lleva
 * `SIN_RECURSOS`. BPDF nunca busca nada fuera de este conjunto.
 */
export type OpenedMarkdown = DocumentBase & {
  readonly kind: "markdown";
  readonly text: string;
  readonly resources: RecursosDocumento;
};

export type OpenedDocument = OpenedPdf | OpenedMarkdown;

/** Formatos de imagen que BPDF muestra. */
export type TipoImagen = "png" | "jpeg" | "gif" | "webp" | "svg";

/**
 * Una imagen entregada con el documento. `ruta` es relativa a la RAÍZ de lo
 * que se entregó (la carpeta elegida, o el directorio común de los ficheros
 * elegidos), con `/`, sin `.` ni `..` y en NFC. Nunca una ruta de disco.
 *
 * `blob`: el fichero como `Blob` con el tipo MIME que corresponde a su
 * extensión, sin leerlo (en web, un trozo del propio `File`: no ocupa memoria
 * hasta que el navegador pinta la imagen). En Electron (Fase 14) el main
 * entregará lo mismo, o una URL de su protocolo `bpdf-res://` (ELECTRON.md §5).
 */
export type RecursoLocal = {
  readonly ruta: string;
  readonly tipo: TipoImagen;
  readonly size: number;
  readonly blob: Blob;
};

/**
 * El conjunto de recursos de un Markdown.
 *
 * - `base`: directorio del `.md` dentro de la raíz (`""` si está en ella, o
 *   `"docs"`). Las rutas del documento se resuelven desde aquí.
 * - `ficheros`: ruta normalizada → recurso. Solo imágenes de formato admitido.
 * - `ambiguas`: rutas a las que corresponde más de un fichero entregado (dos
 *   nombres que solo difieren en la forma Unicode). No se resuelven: elegir uno
 *   sería adivinar.
 */
export type RecursosDocumento = {
  readonly base: string;
  readonly ficheros: ReadonlyMap<string, RecursoLocal>;
  readonly ambiguas: ReadonlySet<string>;
};

export const SIN_RECURSOS: RecursosDocumento = {
  base: "",
  ficheros: new Map(),
  ambiguas: new Set(),
};

/**
 * Una carpeta con varios Markdown: el usuario elige cuál es el principal
 * (BPDF no lo adivina). `candidates` son rutas relativas a la carpeta elegida,
 * ya saneadas para mostrarlas; `choose(i)` abre la `i`-ésima con sus
 * recursos (por índice: dos rutas podrían verse iguales una vez saneadas).
 */
export type EleccionMarkdown = {
  readonly kind: "choose-markdown";
  readonly candidates: readonly string[];
  choose(index: number): Promise<OpenedDocument>;
};

/** Lo que devuelve abrir una selección: un documento, o la elección pendiente. */
export type Apertura = OpenedDocument | EleccionMarkdown;
