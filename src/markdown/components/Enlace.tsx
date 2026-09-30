import type { ComponentProps } from "react";
import type { ExtraProps } from "react-markdown";
import { messages } from "@/i18n/messages";
import { idsCandidatos } from "../toc";
import { clasificarEnlace } from "../url-policy";
import { useAcciones } from "./acciones";

const t = messages.markdown.link;

type Props = ComponentProps<"a"> & ExtraProps;

/**
 * Enlace de un documento (docs/SEGURIDAD.md §3.2). Solo dos casos llevan
 * `href`, y los dos los construye BPDF:
 *
 * - **Externo** (`http:`, `https:`, `mailto:`, validado por `url-policy.ts`):
 *   `target="_blank"` y `rel="noopener noreferrer"` como red, pero el clic se
 *   intercepta y lo abre la plataforma (`Platform.openExternal`: en web, una
 *   pestaña nueva sin `opener` ni `Referer`; en Electron, el navegador del
 *   sistema desde el main). El clic central se anula: abriría la URL fuera de
 *   ese mecanismo. Igual que los enlaces del PDF.
 * - **Ancla** (`#seccion`): `href` al id con prefijo; el clic desplaza dentro
 *   del documento y mueve el foco, sin tocar la URL de la app.
 *
 * Una ruta relativa (`otro.md`) o una URL bloqueada (`javascript:`…) se pinta
 * como texto, con el motivo para lectores de pantalla y como información
 * emergente.
 */
export function Enlace({ node: _node, href, children, title, ...resto }: Props) {
  const { abrirExterno, irASeccion } = useAcciones();
  const destino = clasificarEnlace(href);

  if (destino.tipo === "externo") {
    return (
      <a
        {...resto}
        href={destino.url}
        target="_blank"
        rel="noopener noreferrer"
        title={title ?? t.external(destino.url)}
        onClick={(e) => {
          e.preventDefault();
          abrirExterno(destino.url);
        }}
        onAuxClick={(e) => e.preventDefault()}
      >
        {children}
      </a>
    );
  }

  if (destino.tipo === "ancla") {
    return (
      <a
        {...resto}
        href={`#${idsCandidatos(destino.fragmento)[0]}`}
        title={title}
        onClick={(e) => {
          e.preventDefault();
          irASeccion(destino.fragmento);
        }}
      >
        {children}
      </a>
    );
  }

  const motivo = destino.tipo === "relativo" ? t.local : t.blocked;
  return (
    <span className="md-enlace-inerte" title={motivo} data-enlace={destino.tipo}>
      {children}
      <span className="sr-only"> ({motivo})</span>
    </span>
  );
}
