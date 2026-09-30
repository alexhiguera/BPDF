import { type ComponentProps, type ReactNode, useMemo } from "react";
import type { ExtraProps } from "react-markdown";
import { lenguajeDe } from "../resaltado";
import { BloqueCodigo, codigoDe } from "./BloqueCodigo";
import { Diagrama } from "./Diagrama";
import { Formula } from "./Formula";

/**
 * Qué es un bloque `<pre>` del documento (Fase 8):
 *
 * - `$$…$$` o ```` ```math ````: una fórmula en bloque (remark-math le pone
 *   la clase `language-math`).
 * - ```` ```mermaid ````: un diagrama.
 * - Cualquier otro: un bloque de código con resaltado y copiar.
 */
export function Preformateado({ node }: ExtraProps) {
  const codigo = useMemo(() => codigoDe(node), [node]);
  const lenguaje = lenguajeDe(codigo.clase);
  if (lenguaje === "math") return <Formula fuente={codigo.texto} bloque />;
  if (lenguaje === "mermaid") return <Diagrama fuente={codigo.texto} />;
  return <BloqueCodigo node={node} />;
}

/**
 * `<code>` en línea: `$…$` es una fórmula (clase `math-inline` de
 * remark-math); el resto, código en línea normal. Los `<code>` de dentro de
 * un `<pre>` no llegan aquí: los pinta `Preformateado`.
 */
export function CodigoEnLinea({ className, children }: ComponentProps<"code"> & ExtraProps) {
  if (typeof className === "string" && className.split(" ").includes("math-inline")) {
    return <Formula fuente={textoDe(children)} bloque={false} />;
  }
  return <code className={className}>{children}</code>;
}

function textoDe(hijos: ReactNode): string {
  if (typeof hijos === "string" || typeof hijos === "number") return String(hijos);
  if (Array.isArray(hijos)) return hijos.map(textoDe).join("");
  return "";
}
