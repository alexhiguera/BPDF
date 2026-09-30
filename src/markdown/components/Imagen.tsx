import { ImageOff } from "lucide-react";
import type { ComponentProps } from "react";
import type { ExtraProps } from "react-markdown";
import { messages } from "@/i18n/messages";
import { clasificarImagen } from "../url-policy";
import { useAcciones } from "./acciones";

const t = messages.markdown.image;

type Props = ComponentProps<"img"> & ExtraProps;

/**
 * Imagen de un documento (docs/PLAN.md §7.2). **En la Fase 7 no se carga
 * ninguna**: no hay `<img>` en el DOM, así que ninguna imagen puede provocar
 * una petición.
 *
 * - **Remota** (`https://…`): bloqueada (D7). Pedirla revelaría a un tercero
 *   la IP y el momento de lectura (píxel espía). Se muestra el texto
 *   alternativo y un enlace para abrirla fuera de BPDF, si la persona quiere.
 * - **Local** (`./img/a.png`): en web un fichero suelto no da acceso a sus
 *   hermanos. Cargarlas exige abrir el `.md` junto con sus imágenes (varios
 *   ficheros o una carpeta); se aplazó (docs/TAREAS_PENDIENTES.md). Hasta
 *   entonces, marcador con el texto alternativo.
 * - Cualquier otra (`data:`, `javascript:`, `file:`, rutas absolutas):
 *   bloqueada.
 *
 * Es un `span` porque las imágenes de Markdown van dentro de un párrafo.
 */
export function Imagen({ src, alt, title }: Props) {
  const { abrirExterno } = useAcciones();
  const destino = clasificarImagen(src);
  const descripcion = alt?.trim() || t.noAlt;
  const motivo =
    destino.tipo === "remota" ? t.remote : destino.tipo === "local" ? t.local : t.blocked;
  const ayuda =
    destino.tipo === "remota" ? t.remoteHint : destino.tipo === "local" ? t.localHint : undefined;

  return (
    <span className="md-imagen-ausente" data-imagen={destino.tipo} title={title ?? ayuda}>
      <ImageOff aria-hidden="true" className="size-4 shrink-0" />
      <span>
        {descripcion} ({motivo})
      </span>
      {destino.tipo === "remota" && (
        <a
          href={destino.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.preventDefault();
            abrirExterno(destino.url);
          }}
          onAuxClick={(e) => e.preventDefault()}
        >
          {t.openRemote}
        </a>
      )}
    </span>
  );
}
