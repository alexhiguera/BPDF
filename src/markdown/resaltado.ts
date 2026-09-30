import type { ElementContent, Root } from "hast";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { createLowlight } from "lowlight";
import { createElement, type ReactNode } from "react";

/**
 * Resaltado de sintaxis de los bloques de código (docs/PLAN.md §7.1).
 *
 * **lowlight** (highlight.js que devuelve un árbol hast en vez de una cadena
 * HTML): el resultado son nodos `span` con clases `hljs-*` y texto, que aquí
 * se convierten en elementos React. Nunca pasa por `innerHTML`, y un nodo que
 * no sea texto o `span` se descarta.
 *
 * **Solo estos lenguajes**, registrados a mano: el paquete `common` de
 * highlight.js son ~37 gramáticas que casi nadie usa en un documento. Cada
 * gramática nueva es código que procesa contenido no confiable (y
 * highlight.js ha tenido fallos de ReDoS en algunas): se añade cuando haga
 * falta, no por si acaso.
 *
 * **Sin detección automática**: un bloque sin lenguaje (o con uno que no está
 * aquí) se muestra sin resaltar. Adivinar cuesta ejecutar todas las
 * gramáticas sobre el bloque y a menudo se equivoca.
 */
const lowlight = createLowlight({
  bash,
  css,
  javascript,
  json,
  markdown,
  python,
  sql,
  typescript,
  xml,
});
// Nombres habituales que las gramáticas no traen como alias (`jsx`, `tsx`,
// `html`, `svg`, `sh`, `py`, `md`… ya los traen).
lowlight.registerAlias({ bash: ["shell", "console"] });

/** Lenguaje de un bloque según su clase (`language-ts` → `ts`). */
export function lenguajeDe(clase: unknown): string | null {
  if (typeof clase !== "string") return null;
  const m = /(?:^|\s)language-([^\s]+)/.exec(clase);
  return m?.[1]?.toLowerCase() ?? null;
}

export function lenguajeSoportado(lenguaje: string | null): lenguaje is string {
  return lenguaje !== null && lowlight.registered(lenguaje);
}

/**
 * El código resaltado como elementos React, o `null` si el lenguaje no está
 * soportado (el llamador pinta el texto tal cual). Nunca lanza: si la
 * gramática fallara, se muestra sin resaltar.
 */
export function resaltar(codigo: string, lenguaje: string | null): ReactNode[] | null {
  if (!lenguajeSoportado(lenguaje)) return null;
  let arbol: Root;
  try {
    arbol = lowlight.highlight(lenguaje, codigo);
  } catch {
    return null;
  }
  return aReact(arbol.children as ElementContent[]);
}

/**
 * hast → React con lista blanca: texto y `span` con clases `hljs-*`. Recorrido
 * recursivo acotado: highlight.js anida pocos niveles (un subidioma dentro de
 * otro), no según el contenido.
 */
function aReact(nodos: ElementContent[]): ReactNode[] {
  return nodos.map((nodo, i) => {
    if (nodo.type === "text") return nodo.value;
    if (nodo.type !== "element" || nodo.tagName !== "span") return null;
    const clases = (nodo.properties.className as string[] | undefined) ?? [];
    return createElement(
      "span",
      { key: i, className: clases.filter((c) => c.startsWith("hljs-")).join(" ") || undefined },
      ...aReact(nodo.children),
    );
  });
}
