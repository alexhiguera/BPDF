import { ImageOff } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useState } from "react";
import type { ExtraProps } from "react-markdown";
import { project } from "@/config/project";
import { MAX_BYTES_IMAGEN } from "@/documents/limits";
import { type Resolucion, resolverRecurso } from "@/documents/recursos";
import type { RecursoLocal } from "@/documents/types";
import { messages } from "@/i18n/messages";
import { formatBytes } from "@/lib/format";
import { clasificarImagen } from "../url-policy";
import { useAcciones, useDentroDeEnlace, useImagenes, useImpresion } from "./acciones";

const t = messages.markdown.image;

type Props = ComponentProps<"img"> & ExtraProps;
type Fallo = Exclude<Resolucion["estado"], "ok"> | "rota";

/**
 * Imagen de un documento (docs/PLAN.md §7.2, ARCHITECTURE §4 sexies).
 *
 * - **Local** (`./logo.png`): se resuelve SOLO contra lo que el usuario
 *   entregó con el `.md` (`resolverRecurso`). Si está, un `<img>` con una URL
 *   `blob:` del almacén del visor; si no, un marcador que dice por qué.
 * - **Remota** (`https://…`): bloqueada (D7). Marcador con el texto
 *   alternativo y un enlace para abrirla fuera de BPDF.
 * - Cualquier otra (`data:`, `javascript:`, `file:`): bloqueada.
 *
 * Es un `span` porque las imágenes de Markdown van dentro de un párrafo.
 */
export function Imagen({ src, alt, title }: Props) {
  const { abrirExterno } = useAcciones();
  const dentroDeEnlace = useDentroDeEnlace();
  const { recursos } = useImagenes();
  const destino = clasificarImagen(src);
  const descripcion = alt?.trim() || t.noAlt;

  if (destino.tipo === "local") {
    const resolucion = resolverRecurso(destino.ruta, recursos);
    if (resolucion.estado === "ok") {
      return <ImagenLocal recurso={resolucion.recurso} alt={alt ?? ""} title={title} />;
    }
    return <Marcador descripcion={descripcion} fallo={resolucion.estado} title={title} />;
  }

  if (destino.tipo === "remota") {
    return (
      <Marcador
        descripcion={descripcion}
        motivo={t.remote}
        ayuda={title ?? t.remoteHint}
        tipo="remota"
      >
        {!dentroDeEnlace && (
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
      </Marcador>
    );
  }
  return <Marcador descripcion={descripcion} motivo={t.blocked} ayuda={title} tipo="bloqueada" />;
}

/**
 * Una imagen local entregada. La URL se pide al almacén al montarse y se
 * devuelve al desmontarse (efecto con limpieza: correcto también con el doble
 * montaje de React en desarrollo). `loading="lazy"`: el navegador solo
 * decodifica las que se acercan a la vista.
 *
 * SVG: solo como `<img>`. En una imagen, un SVG no ejecuta scripts ni pide
 * recursos externos; y si alguien abriera la URL `blob:` como página, hereda
 * la CSP de BPDF (`script-src 'self'`), que bloquea los scripts en línea.
 */
function ImagenLocal({
  recurso,
  alt,
  title,
}: {
  recurso: RecursoLocal;
  alt: string;
  title?: string;
}) {
  const { almacen } = useImagenes();
  const impresion = useImpresion();
  const [url, setUrl] = useState<string | null>(null);
  const [rota, setRota] = useState(false);

  useEffect(() => {
    if (!almacen) return;
    setUrl(almacen.adquirir(recurso));
    return () => almacen.liberar(recurso);
  }, [almacen, recurso]);

  if (rota) return <Marcador descripcion={alt.trim() || t.noAlt} fallo="rota" title={title} />;
  if (!url) return null;
  return (
    <img
      src={url}
      alt={alt}
      title={title}
      // En la copia para imprimir (Fase 17) no se ve nada: `lazy` no la cargaría nunca.
      loading={impresion ? "eager" : "lazy"}
      decoding="async"
      data-imagen="local"
      data-recurso={recurso.ruta}
      onError={() => setRota(true)}
    />
  );
}

function Marcador({
  descripcion,
  fallo,
  motivo,
  ayuda,
  tipo,
  title,
  children,
}: {
  descripcion: string;
  fallo?: Fallo;
  motivo?: string;
  ayuda?: string;
  tipo?: string;
  title?: string;
  children?: ReactNode;
}) {
  const razon = fallo ? t.local[fallo] : motivo;
  const pista = fallo ? (title ?? pistaDe(fallo)) : ayuda;
  return (
    <span className="md-imagen-ausente" data-imagen={fallo ?? tipo} title={pista}>
      <ImageOff aria-hidden="true" className="size-4 shrink-0" />
      <span>
        {descripcion} ({razon})
      </span>
      {children}
    </span>
  );
}

function pistaDe(fallo: Fallo): string {
  const pistas = t.localHint;
  return fallo === "demasiado-grande"
    ? pistas[fallo](formatBytes(MAX_BYTES_IMAGEN, project.locale))
    : pistas[fallo];
}
