import { type CSSProperties, type ReactNode, type RefObject, useId, useRef, useState } from "react";
import { messages } from "@/i18n/messages";

const t = messages.markdown.split;

/** Límites del panel izquierdo, en %: ninguno de los dos puede desaparecer. */
export const MINIMO = 20;
export const MAXIMO = 80;
const PASO = 5;

export const acotar = (p: number) => Math.min(MAXIMO, Math.max(MINIMO, Math.round(p)));

/**
 * Dos paneles con un separador redimensionable (Fase 9): el editor y la vista
 * previa. El separador sigue el patrón «window splitter» de WAI-ARIA: es
 * enfocable, dice su valor (`aria-valuenow`, en % del panel izquierdo) y se
 * mueve con ← / → (5 %), Inicio / Fin (mínimo y máximo) o arrastrándolo (ratón,
 * lápiz o dedo: eventos de puntero). Se ve como una línea de 6 px, pero se puede
 * pulsar en 24 px (Fase 13, WCAG 2.5.8).
 *
 * En pantallas estrechas (< 48rem) los paneles se apilan, cada uno con su
 * mitad, y el separador no se muestra: arrastrar en vertical en un móvil
 * compite con el desplazamiento, y apilados ya son usables.
 *
 * `mostrar`: un panel solo (el otro queda oculto, pero MONTADO: cambiar de
 * modo no vuelve a pintar la vista previa ni a crear el editor) o los dos.
 */
export function SplitView({
  izquierda,
  derecha,
  refIzquierda,
  mostrar = "ambos",
}: {
  izquierda: ReactNode;
  derecha: ReactNode;
  refIzquierda?: RefObject<HTMLDivElement | null>;
  mostrar?: "izquierda" | "derecha" | "ambos";
}) {
  const ambos = mostrar === "ambos";
  const [proporcion, setProporcion] = useState(50);
  const contenedor = useRef<HTMLDivElement>(null);
  const idIzquierda = useId();

  const desdePuntero = (x: number) => {
    const caja = contenedor.current?.getBoundingClientRect();
    if (!caja || caja.width <= 0) return;
    setProporcion(acotar(((x - caja.left) / caja.width) * 100));
  };

  // La proporción viaja como propiedad CSS (CSSOM, no un `style` en línea que la
  // CSP tendría que permitir) y solo se aplica en pantalla ancha.
  const estilo = { "--division": `${proporcion}%` } as CSSProperties;

  return (
    <div
      ref={contenedor}
      className="flex min-h-0 flex-1 flex-col md:flex-row"
      style={estilo}
      data-testid="paneles"
      data-mostrar={mostrar}
    >
      <div
        ref={refIzquierda}
        id={idIzquierda}
        hidden={mostrar === "derecha"}
        // Con los dos paneles, el izquierdo (el editor) va por encima en el orden de
        // pintado. Tras cada tecla, Chrome repite el hit test del ratón; recorre las capas
        // de arriba abajo, y con la vista previa encima recorría todo su árbol antes de
        // llegar al editor (1 MB + KaTeX: ~30–50 ms por tecla, aunque sus bloques estén
        // saltados). Los paneles no se solapan: no cambia qué se ve ni dónde se pulsa.
        className={
          ambos
            ? "relative z-1 flex min-h-0 min-w-0 flex-1 flex-col md:flex-none md:basis-(--division)"
            : "flex min-h-0 min-w-0 flex-1 flex-col"
        }
      >
        {izquierda}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: un <hr> no es enfocable ni tiene valor; es el patrón «window splitter» */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={t.separator}
        aria-controls={idIzquierda}
        aria-valuenow={proporcion}
        aria-valuemin={MINIMO}
        aria-valuemax={MAXIMO}
        aria-valuetext={t.value(proporcion)}
        tabIndex={0}
        hidden={!ambos}
        // Fase 13 (WCAG 2.5.8): el área de pulsación mide 24 px de ancho; lo que se ve
        // sigue siendo una línea de 6 px en el centro (`before:`). Sin `touch-action`,
        // arrastrarlo con el dedo desplazaría la página en vez de moverlo.
        className="relative hidden w-6 shrink-0 cursor-col-resize touch-none before:absolute before:inset-y-0 before:left-1/2 before:w-1.5 before:-translate-x-1/2 before:bg-border before:content-[''] hover:before:bg-accent focus-visible:outline-none focus-visible:before:bg-accent md:block"
        onKeyDown={(e) => {
          const nuevo =
            e.key === "ArrowLeft"
              ? proporcion - PASO
              : e.key === "ArrowRight"
                ? proporcion + PASO
                : e.key === "Home"
                  ? MINIMO
                  : e.key === "End"
                    ? MAXIMO
                    : null;
          if (nuevo === null) return;
          e.preventDefault();
          setProporcion(acotar(nuevo));
        }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture?.(e.pointerId);
          e.preventDefault();
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture?.(e.pointerId)) desdePuntero(e.clientX);
        }}
        onPointerUp={(e) => e.currentTarget.releasePointerCapture?.(e.pointerId)}
      />
      <div
        hidden={mostrar === "izquierda"}
        className={
          ambos
            ? "flex min-h-0 min-w-0 flex-1 flex-col border-t border-border md:border-t-0"
            : "flex min-h-0 min-w-0 flex-1 flex-col"
        }
      >
        {derecha}
      </div>
    </div>
  );
}
