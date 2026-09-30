import type { Element, ElementContent } from "hast";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ExtraProps } from "react-markdown";
import { messages } from "@/i18n/messages";
import { lenguajeDe, resaltar } from "../resaltado";

const t = messages.markdown.code;

/** Cuánto dura «Copiado» antes de volver a «Copiar código». */
export const DURACION_AVISO_MS = 2000;

type EstadoCopia = "reposo" | "copiado" | "error";

/**
 * Bloque de código: resaltado (si su lenguaje está soportado) y botón de
 * copiar. Sustituye al `<pre>` de react-markdown y lee el código del árbol
 * (`node`), no de los hijos ya pintados: se copia exactamente el texto del
 * documento, no lo que haya dejado el resaltado.
 *
 * Portapapeles: solo `navigator.clipboard.writeText`, tras el clic (gesto del
 * usuario). No se pide ningún permiso ni se lee el portapapeles. Si el
 * navegador no lo ofrece (contexto no seguro, política que lo niega) o falla,
 * se dice en el botón y en la región viva.
 */
export function BloqueCodigo({ node }: ExtraProps) {
  const codigo = useMemo(() => codigoDe(node), [node]);
  const lenguaje = lenguajeDe(codigo.clase);
  const resaltado = useMemo(() => resaltar(codigo.texto, lenguaje), [codigo.texto, lenguaje]);
  const [estado, setEstado] = useState<EstadoCopia>("reposo");
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(temporizador.current), []);

  const mostrar = (nuevo: EstadoCopia) => {
    setEstado(nuevo);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEstado("reposo"), DURACION_AVISO_MS);
  };

  const copiar = async () => {
    const portapapeles = typeof navigator === "undefined" ? undefined : navigator.clipboard;
    if (!portapapeles?.writeText) return mostrar("error");
    try {
      await portapapeles.writeText(codigo.texto);
      mostrar("copiado");
    } catch {
      mostrar("error");
    }
  };

  const Icono = estado === "copiado" ? Check : estado === "error" ? TriangleAlert : Copy;
  return (
    <div className="md-codigo">
      <div className="md-codigo-cabecera">
        <span className="md-codigo-lenguaje">{lenguaje ?? t.noLanguage}</span>
        <button type="button" className="md-codigo-copiar" onClick={copiar}>
          <Icono aria-hidden="true" className="size-3.5 shrink-0" />
          {estado === "copiado" ? t.copied : estado === "error" ? t.copyFailed : t.copy}
        </button>
      </div>
      {/* Enfocable: un bloque ancho se desplaza con el teclado. */}
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: región desplazable */}
      <pre tabIndex={0}>
        <code className={resaltado ? `hljs language-${lenguaje}` : undefined}>
          {resaltado ?? codigo.texto}
        </code>
      </pre>
      <span className="sr-only" aria-live="polite">
        {estado === "copiado" ? t.announceCopied : estado === "error" ? t.announceFailed : ""}
      </span>
    </div>
  );
}

/**
 * El `<code>` dentro del `<pre>` del árbol: su texto y su clase. El texto
 * pierde el salto de línea final que añade remark-rehype (no está en el
 * documento: se copiaría de más).
 */
export function codigoDe(pre: Element | undefined): { texto: string; clase: string } {
  const code = pre?.children.find(
    (h): h is Element => h.type === "element" && h.tagName === "code",
  );
  const clase = code?.properties.className;
  return {
    texto: code ? textoHast(code.children).replace(/\n$/, "") : "",
    clase: Array.isArray(clase) ? clase.join(" ") : typeof clase === "string" ? clase : "",
  };
}

function textoHast(nodos: ElementContent[]): string {
  return nodos
    .map((n) => (n.type === "text" ? n.value : n.type === "element" ? textoHast(n.children) : ""))
    .join("");
}
