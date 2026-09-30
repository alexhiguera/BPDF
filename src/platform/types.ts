import type { Apertura } from "@/documents/types";

/**
 * Lo que se soltó en la ventana, capturado DENTRO del evento `drop`: el
 * navegador invalida `DataTransfer` (y sus entradas de carpeta) en cuanto el
 * evento termina, así que quien lo recibe lo copia ahí mismo, sin `await`
 * por medio (lo hace `DropZone`).
 *
 * - `ficheros`: `dataTransfer.files` (siempre planos, sin carpetas).
 * - `entradas`: `webkitGetAsEntry()` de cada elemento, o `null` si el navegador
 *   no la da. Es lo único que dice si se soltó una carpeta.
 */
export type Soltado = {
  readonly ficheros: readonly File[];
  readonly entradas: readonly (FileSystemEntry | null)[];
};

/**
 * Frontera entre BPDF y la plataforma en la que corre (docs/ELECTRON.md §3).
 * Solo `src/platform/` sabe si es web o Electron; el resto de la app recibe
 * `OpenedDocument` (o una elección de Markdown), nunca rutas ni APIs de la
 * plataforma.
 *
 * Contiene solo lo que la app usa hoy. Cada fase añade el método que necesite
 * cuando lo necesite: guardar (`saveText`, Fase 9) y «Abrir con…» del sistema
 * (`onExternalOpen`, Fase 14).
 *
 * Por qué devuelve documentos y no `File`: en Electron el diálogo lo abre el
 * proceso main, que lee los ficheros y asigna un id ligado a su ruta (para
 * poder guardar después sin que el renderer la vea). Las dos implementaciones
 * terminan en `abrirSeleccion`/`readDocument`, así que la validación es la
 * misma.
 */
export interface Platform {
  /**
   * Selector de archivos del sistema, con selección múltiple: un documento
   * suelto, o un Markdown junto con sus imágenes. Resuelve `null` si se
   * cancela. Rechaza con `DocumentError` si no vale.
   */
  pickDocument(): Promise<Apertura | null>;

  /**
   * Selector de CARPETA: el Markdown que contenga y sus imágenes. Con varios
   * Markdown resuelve una elección (`EleccionMarkdown`). `null` si se cancela.
   */
  pickFolder(): Promise<Apertura | null>;

  /** Lo que se soltó en la ventana: un fichero, varios, o una carpeta. */
  openDropped(soltado: Soltado): Promise<Apertura | null>;

  /**
   * Abre un enlace de un documento FUERA de BPDF (docs/SEGURIDAD.md §4). Solo
   * recibe URLs que ya han pasado la política del motor (`http:`, `https:`,
   * `mailto:`), y aun así la plataforma no se fía: vuelve a comprobarla. Nunca
   * navega la ventana de la app. En web, una pestaña nueva sin `opener` ni
   * `Referer`; en Electron (Fase 14), `shell.openExternal` desde el main.
   */
  openExternal(url: string): void;
}
