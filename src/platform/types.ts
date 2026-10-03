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
 * Frontera entre BPDF y la plataforma en la que corre: el navegador (D19: solo
 * web). Solo `src/platform/` toca sus APIs de ficheros; el resto de la app recibe
 * `OpenedDocument` (o una elección de Markdown), nunca rutas ni APIs de la
 * plataforma.
 *
 * Contiene solo lo que la app usa hoy. Cada fase añade el método que necesite
 * cuando lo necesite (guardar, `saveText`, llegó con la Fase 9).
 *
 * Devuelve documentos y no `File`: todo termina en `abrirSeleccion`/
 * `readDocument`, así que la validación es una sola. (Se diseñó así también
 * para una versión Electron, cancelada: D19.)
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
   * `Referer`.
   */
  openExternal(url: string): void;

  /**
   * Guarda el texto de un documento (Fase 9, el editor de Markdown). **El
   * usuario elige siempre el destino**: nunca se sobrescribe en silencio el
   * fichero que se abrió (en web, BPDF ni siquiera tiene acceso a él).
   *
   * - Web con `showSaveFilePicker` (Chromium): la primera vez pide el destino;
   *   las siguientes vuelven a escribir en el que eligió, mientras la sesión
   *   dure (el `FileSystemFileHandle` vive en memoria, nunca se guarda).
   * - Web sin él: una descarga con el nombre del documento (siempre una copia).
   *
   * `"cancelado"` si el usuario cierra el diálogo sin elegir. Rechaza si no se
   * pudo escribir (sin permiso, disco lleno…): el texto sigue sin guardar.
   */
  saveText(documento: DocumentoAGuardar, texto: string): Promise<ResultadoGuardado>;
}

/** Lo que la plataforma necesita saber del documento para guardarlo: nada más. */
export type DocumentoAGuardar = { readonly id: string; readonly name: string };

export type ResultadoGuardado = "guardado" | "descargado" | "cancelado";
