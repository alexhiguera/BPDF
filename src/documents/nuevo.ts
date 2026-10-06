import { messages } from "@/i18n/messages";
import { nextDocumentId } from "./read";
import { type OpenedMarkdown, SIN_RECURSOS } from "./types";

/**
 * Un Markdown nuevo, vacío, creado en memoria (Fase 17, «Crear Markdown»).
 *
 * - Su identidad es el id opaco de la sesión, como cualquier documento; el
 *   nombre es solo lo que se muestra («Sin título»), y como todo nombre de
 *   documento no se guarda en ningún sitio (CLAUDE.md §4).
 * - Sin recursos: un documento nuevo no gana acceso a ninguna imagen del disco.
 * - Sin fichero detrás: guardarlo es siempre elegir un destino (o descargar).
 */
export function crearMarkdown(): OpenedMarkdown {
  return {
    id: nextDocumentId(),
    kind: "markdown",
    name: messages.document.newUntitled,
    size: 0,
    text: "",
    resources: SIN_RECURSOS,
    nuevo: true,
  };
}
