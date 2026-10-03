import { type KeyboardEvent, type RefObject, useLayoutEffect, useRef } from "react";

/**
 * Teclado de la barra del visor PDF (Fase 13): el patrón «toolbar» de WAI-ARIA.
 *
 * - **Una sola parada de Tab** para toda la barra (`tabindex` itinerante): el
 *   control que la tiene es el último que tuvo el foco; al principio, el primero.
 * - **← / →** pasan al control anterior o siguiente, y dan la vuelta en los
 *   extremos. En el campo de página mueven el cursor como siempre y solo salen
 *   del campo desde su principio (←) o su final (→).
 * - **Inicio / Fin no son de la barra**: siguen siendo los atajos del visor
 *   (primera y última página), que ya existían. ↑ / ↓, Espacio e Intro tampoco
 *   cambian.
 * - Los botones desactivados no reciben el foco (`disabled` nativo): se saltan.
 *
 * Las flechas que mueve la barra no llegan a los atajos del visor (que en «página a
 * página» cambian de página con ← / →): se paran aquí.
 */
const ELEMENTOS = "button:not(:disabled), input:not(:disabled)";

/** Los controles de la barra que pueden recibir el foco, en orden. */
export function elementosDeBarra(barra: HTMLElement): HTMLElement[] {
  return [...barra.querySelectorAll<HTMLElement>(ELEMENTOS)].filter(
    (e) => e.closest("[hidden]") === null,
  );
}

/** ¿Debe salir la flecha del campo de texto? Solo desde su borde y sin selección. */
function saleDelCampo(campo: HTMLInputElement, tecla: "ArrowLeft" | "ArrowRight"): boolean {
  const { selectionStart: inicio, selectionEnd: fin, value } = campo;
  if (inicio === null || fin === null || inicio !== fin) return false;
  return tecla === "ArrowLeft" ? inicio === 0 : fin === value.length;
}

export function useBarraHerramientas(barra: RefObject<HTMLElement | null>) {
  /** El control que tiene la parada de Tab, y su posición (por si desaparece). */
  const actual = useRef<HTMLElement | null>(null);
  const posicion = useRef(0);

  const repartir = (elementos: HTMLElement[]) => {
    for (const e of elementos) e.tabIndex = e === actual.current ? 0 : -1;
  };

  // Tras cada render: un botón puede haberse desactivado (p. ej. «Página anterior» en
  // la 1) o aparecido (pantalla completa). La parada pasa al más cercano.
  useLayoutEffect(() => {
    const el = barra.current;
    if (!el) return;
    const elementos = elementosDeBarra(el);
    if (!actual.current || !elementos.includes(actual.current)) {
      actual.current = elementos[Math.min(posicion.current, elementos.length - 1)] ?? null;
    }
    repartir(elementos);
  });

  const onFocus = (e: { target: EventTarget | null }) => {
    const el = barra.current;
    if (!el || !(e.target instanceof HTMLElement)) return;
    const elementos = elementosDeBarra(el);
    const i = elementos.indexOf(e.target);
    if (i < 0) return;
    actual.current = e.target;
    posicion.current = i;
    repartir(elementos);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const el = barra.current;
    if (!el || !(e.target instanceof HTMLElement)) return;
    if (e.target instanceof HTMLInputElement && !saleDelCampo(e.target, e.key)) return;
    const elementos = elementosDeBarra(el);
    const i = elementos.indexOf(e.target);
    if (i < 0 || elementos.length === 0) return;
    const paso = e.key === "ArrowRight" ? 1 : -1;
    const siguiente = elementos[(i + paso + elementos.length) % elementos.length];
    e.preventDefault();
    e.stopPropagation();
    siguiente?.focus();
  };

  return { onFocus, onKeyDown };
}
