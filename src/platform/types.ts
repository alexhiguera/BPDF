import type { OpenedDocument } from "@/documents/types";

/**
 * Frontera entre BPDF y la plataforma en la que corre (docs/ELECTRON.md §3).
 * Solo `src/platform/` sabe si es web o Electron; el resto de la app recibe
 * `OpenedDocument`, nunca rutas ni APIs de la plataforma.
 *
 * Contiene solo lo que la app usa hoy. Cada fase añade el método que necesite
 * cuando lo necesite: guardar (`saveText`, Fase 9), enlaces externos
 * (`openExternal`, Fases 5 y 7) y «Abrir con…» del sistema (`onExternalOpen`,
 * Fase 14).
 *
 * Por qué devuelve documentos y no `File`: en Electron el diálogo lo abre el
 * proceso main, que lee el fichero y asigna un id ligado a su ruta (para poder
 * guardar después sin que el renderer la vea). Las dos implementaciones
 * terminan en `readDocument`, así que la validación es la misma.
 */
export interface Platform {
  /**
   * Muestra el selector de archivos del sistema y abre el que se elija.
   * Resuelve `null` si se cancela. Rechaza con `DocumentError` si no vale.
   */
  pickDocument(): Promise<OpenedDocument | null>;

  /**
   * Abre un fichero soltado en la ventana. En web basta con leerlo; en
   * Electron, además, el preload lo registrará en el main para obtener su id.
   */
  openDroppedFile(file: File): Promise<OpenedDocument>;
}
