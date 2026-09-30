import { type ComponentProps, createElement } from "react";
import type { ExtraProps } from "react-markdown";
import { messages } from "@/i18n/messages";
import { PREFIJO_ID } from "../toc";

/**
 * Elementos sencillos del documento que necesitan algo más que la etiqueta
 * por defecto. Cada uno emite solo atributos conocidos: nada de lo que traiga
 * el árbol pasa sin revisar.
 */

type Nivel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * El título de la sección de notas al pie. Su id lo fija remark-rehype (no
 * sale del documento) y las llamadas a nota lo citan en `aria-describedby`.
 */
const ID_TITULO_NOTAS = "footnote-label";

/**
 * Encabezado con su id (`md-…`, de `toc.ts`) y `tabIndex={-1}`: saltar a una
 * sección desde el índice o un ancla le lleva el foco, y un lector de
 * pantalla sigue leyendo desde ahí. Conserva sus clases solo si es el título
 * de las notas (`sr-only`, lo pone remark-rehype).
 */
export function encabezado(nivel: Nivel) {
  function Encabezado({ id, className, children }: ComponentProps<"h1"> & ExtraProps) {
    const notas = id === ID_TITULO_NOTAS;
    return createElement(
      `h${nivel}`,
      {
        id: notas || id?.startsWith(PREFIJO_ID) ? id : undefined,
        className: notas ? className : undefined,
        tabIndex: -1,
      },
      children,
    );
  }
  Encabezado.displayName = `EncabezadoH${nivel}`;
  return Encabezado;
}

/**
 * Tabla dentro de un contenedor con desplazamiento horizontal: una tabla ancha
 * no ensancha la página. El contenedor es enfocable para poder desplazarlo con
 * el teclado.
 */
export function Tabla({ children }: ComponentProps<"table"> & ExtraProps) {
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: región desplazable
    <div className="md-tabla" tabIndex={0}>
      <table>{children}</table>
    </div>
  );
}

/**
 * Casilla de una lista de tareas (GFM). Solo lectura: BPDF es un lector. Con
 * nombre propio, porque la casilla no tiene `<label>`.
 */
export function Casilla({ checked }: ComponentProps<"input"> & ExtraProps) {
  return (
    <input
      type="checkbox"
      checked={checked === true}
      disabled
      readOnly
      aria-label={checked ? messages.markdown.task.done : messages.markdown.task.pending}
    />
  );
}
