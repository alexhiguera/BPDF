import { useEffect, useRef, useState } from "react";
import { messages } from "@/i18n/messages";
import { cargarKatex, pintarFormula } from "../matematicas";

const t = messages.markdown.math;

type Estado = "cargando" | "lista" | "error";

/**
 * Una fórmula LaTeX (Fase 8): `$…$` en línea, o `$$…$$` y ```` ```math ````
 * en bloque.
 *
 * Mientras KaTeX carga, y si la fórmula no es válida, se ve su fuente como
 * código (con aviso si falla): el documento nunca se rompe por una fórmula.
 *
 * KaTeX pinta en un nodo que React no gestiona (`destino`, sin hijos de
 * React); el texto de reserva es un hermano que React sí gestiona. Así ninguno
 * de los dos toca los nodos del otro.
 */
export function Formula({ fuente, bloque }: { fuente: string; bloque: boolean }) {
  const destino = useRef<HTMLSpanElement>(null);
  const [estado, setEstado] = useState<Estado>("cargando");

  useEffect(() => {
    let vigente = true;
    setEstado("cargando");
    cargarKatex().then(
      (katex) => {
        if (!vigente || !destino.current) return;
        try {
          pintarFormula(katex, fuente, bloque, destino.current);
          setEstado("lista");
        } catch {
          destino.current.replaceChildren();
          setEstado("error");
        }
      },
      () => vigente && setEstado("error"),
    );
    return () => {
      vigente = false;
    };
  }, [fuente, bloque]);

  const Contenedor = bloque ? "div" : "span";
  return (
    <Contenedor
      className={bloque ? "md-formula md-formula-bloque" : "md-formula"}
      data-formula={estado}
    >
      <span ref={destino} hidden={estado !== "lista"} />
      {estado !== "lista" && (
        <code
          className={estado === "error" ? "md-formula-error" : undefined}
          title={estado === "error" ? t.invalid : undefined}
        >
          {fuente}
        </code>
      )}
      {estado === "error" && <span className="sr-only"> ({t.invalid})</span>}
    </Contenedor>
  );
}
