import type { Nodes, Parent, Root } from "mdast";
import type { Options } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { messages } from "@/i18n/messages";
import { PREFIJO_ID, remarkIdsEncabezados } from "./toc";
import { transformarUrl } from "./url-policy";

/**
 * Configuración del pipeline de Markdown (docs/PLAN.md §7.1):
 *
 *   texto ─► remark-parse (+ GFM) ─► ids de encabezados ─► remark-rehype ─► React
 *
 * react-markdown produce **elementos React, no HTML**: nada pasa por
 * `innerHTML`. Todo lo que afecta a la seguridad está aquí, en un solo sitio,
 * y lo vigila el corpus de XSS (`tests/components/markdown/xss.test.tsx`):
 *
 * - **Sin `rehype-raw`** (D6): el HTML crudo del documento no se interpreta.
 *   react-markdown convierte cada nodo HTML en su texto literal, así que un
 *   `<script>` se ve como texto y nunca llega al DOM como elemento. Los
 *   comentarios HTML se quitan (`remarkQuitarComentarios`).
 * - **`urlTransform` propio** (`url-policy.ts`): vacía las URLs que la política
 *   bloquea antes de que ningún componente las vea.
 * - **Lista blanca de elementos**: solo lo que produce Markdown + GFM. Si un
 *   plugin futuro (Fase 8) introduce otro elemento, tiene que añadirse aquí
 *   a propósito; si no, se descarta (conservando su contenido).
 *
 * Fase 8: `remarkMath` añade la sintaxis de fórmulas, sin elementos nuevos
 * (produce `<code>` y `<pre>`). Las fórmulas (KaTeX) y los diagramas
 * (Mermaid) los pintan componentes propios FUERA de este árbol y de su lista
 * blanca: `Formula` construye nodos con KaTeX y `Diagrama` una `<img>`.
 */
export const pluginsRemark: NonNullable<Options["remarkPlugins"]> = [
  remarkGfm,
  // Fase 8: `$…$` y `$$…$$` como nodos de fórmula (en hast, `<code>` con la
  // clase `math-inline` o `language-math`). Solo la sintaxis: KaTeX se carga
  // aparte y a demanda (`matematicas.ts`), y no se usa `rehype-katex`.
  remarkMath,
  remarkQuitarComentarios,
  remarkIdsEncabezados,
];

/** Un nodo HTML que es solo un comentario (`<!-- … -->`), con espacios alrededor. */
const COMENTARIO_HTML = /^\s*<!--[\s\S]*?-->\s*$/;

/**
 * Quita los comentarios HTML. El resto del HTML crudo se muestra como texto
 * (D6), pero un comentario nunca está pensado para verse (en un README suelen
 * ser notas para quien lo mantiene) y como texto solo estorba. Solo QUITA
 * nodos: no puede hacer aparecer nada.
 */
export function remarkQuitarComentarios() {
  return (arbol: Root) => {
    const pila: Nodes[] = [arbol];
    while (pila.length > 0) {
      const nodo = pila.pop() as Nodes;
      if (!("children" in nodo)) continue;
      const hijos = nodo.children as Nodes[];
      const filtrados = hijos.filter((h) => !(h.type === "html" && COMENTARIO_HTML.test(h.value)));
      if (filtrados.length !== hijos.length) (nodo as Parent).children = filtrados as never;
      pila.push(...filtrados);
    }
  };
}

export const opcionesRemarkRehype: NonNullable<Options["remarkRehypeOptions"]> = {
  // Los ids que genera remark-rehype (notas al pie) llevan el mismo prefijo que
  // los de los encabezados: ninguno puede pisar un id de la app ni de `window`.
  clobberPrefix: PREFIJO_ID,
  footnoteLabel: messages.markdown.footnotes,
  // `referencia` empieza en 0 y `repeticion` en 1 (mdast-util-to-hast).
  footnoteBackLabel: (referencia, repeticion) =>
    messages.markdown.footnoteBack(referencia + 1, repeticion),
};

export const ELEMENTOS_PERMITIDOS: readonly string[] = [
  // Bloques
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
  "ul",
  "ol",
  "li",
  "pre",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "section", // notas al pie (GFM)
  // En línea
  "a",
  "em",
  "strong",
  "del",
  "code",
  "br",
  "img",
  "sup", // llamada a nota al pie
  "input", // casilla de lista de tareas (GFM)
];

export const opcionesPipeline = {
  remarkPlugins: pluginsRemark,
  remarkRehypeOptions: opcionesRemarkRehype,
  allowedElements: ELEMENTOS_PERMITIDOS,
  unwrapDisallowed: true,
  urlTransform: transformarUrl,
} satisfies Partial<Options>;
