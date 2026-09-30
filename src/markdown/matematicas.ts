import type { KatexOptions } from "katex";

/**
 * Fórmulas LaTeX con KaTeX (Fase 8, docs/ARCHITECTURE.md §4 septies).
 *
 * **A demanda.** KaTeX (≈ 270 KB) y su hoja de estilos se importan la primera
 * vez que un documento tiene una fórmula; un Markdown sin fórmulas no los
 * descarga. Las fuentes las pide la hoja de estilos al propio origen
 * (`font-src 'self'`), solo las que se usan.
 *
 * **Sin HTML.** No se usa `renderToString` (daría una cadena para
 * `innerHTML`) ni `rehype-katex` (parsea esa cadena con `innerHTML` en el
 * navegador). Se pide a KaTeX su árbol y se convierte en nodos con su propio
 * `toNode()`, que usa `createElement` y `setAttribute`.
 *
 * **Sin estilos en línea por atributo.** Dos construcciones de KaTeX (la
 * flecha de `\vec` y los óvalos de `\oiint`/`\oiiint`, y `\pmb` en MathML)
 * ponen `style` con `setAttribute`, que la CSP (`style-src 'self'`, sin
 * `'unsafe-inline'`) bloquea con una violación. Antes de crear los nodos se
 * quita ese atributo; `markdown.css` suple el ancho que fijaba. El resto de
 * estilos de KaTeX van por CSSOM (`node.style`), que la CSP permite.
 */

/**
 * Opciones de KaTeX. Cada `render` recibe un objeto `macros` NUEVO: un `\gdef`
 * de una fórmula no puede cambiar las demás.
 */
export function opcionesKatex(bloque: boolean): KatexOptions {
  return {
    displayMode: bloque,
    // Una fórmula inválida lanza y la componente la muestra como código con aviso.
    throwOnError: true,
    // Nada de \href, \url, \includegraphics, \htmlClass, \htmlId, \htmlStyle ni
    // \htmlData: sin `trust` se pintan como error (y lanzan, con throwOnError).
    trust: false,
    // Sin avisos en consola por LaTeX «no estricto» (texto Unicode en fórmulas…).
    strict: "ignore",
    // Tope de tamaño de \rule, \kern… en em, y de expansiones de macros: una
    // macro recursiva se corta en vez de colgar la pestaña.
    maxSize: 20,
    maxExpand: 1000,
    macros: {},
    globalGroup: false,
    // HTML para verla y MathML (oculto) para lectores de pantalla.
    output: "htmlAndMathml",
  };
}

/** Límite de longitud de una fórmula: más larga no es una fórmula escrita a mano. */
export const MAX_FORMULA = 10_000;

type NodoKatex = {
  attributes?: Record<string, string>;
  children?: NodoKatex[];
  toNode(): Node;
};
type Katex = {
  __renderToDomTree(expresion: string, opciones: KatexOptions): NodoKatex;
};

let carga: Promise<Katex> | null = null;

/** KaTeX y su CSS, una sola vez. */
export function cargarKatex(): Promise<Katex> {
  carga ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(
    ([m]) => m.default as unknown as Katex,
  );
  return carga;
}

/**
 * Pinta una fórmula dentro de `destino` (vaciándolo). Lanza si la fórmula no
 * es válida o supera los límites.
 */
export function pintarFormula(katex: Katex, fuente: string, bloque: boolean, destino: Element) {
  if (fuente.length > MAX_FORMULA) throw new Error("fórmula demasiado larga");
  const arbol = katex.__renderToDomTree(fuente, opcionesKatex(bloque));
  quitarEstilosPorAtributo(arbol);
  destino.replaceChildren(arbol.toNode());
}

/** Quita el atributo `style` de todo el árbol (ver arriba). Iterativo. */
export function quitarEstilosPorAtributo(raiz: NodoKatex) {
  const pila = [raiz];
  while (pila.length > 0) {
    const nodo = pila.pop() as NodoKatex;
    if (nodo.attributes && "style" in nodo.attributes) delete nodo.attributes.style;
    if (nodo.children) pila.push(...nodo.children);
  }
}
