/**
 * Atajos de teclado del visor PDF (documentados en docs/ARCHITECTURE.md →
 * visor PDF, «Teclado», y en la ayuda `?`). `Ctrl/⌘+O` (abrir) lo gestiona la
 * app. Lista cerrada: la de docs/PLAN.md §9.4.
 *
 * | Tecla                  | Acción                                   |
 * | ---------------------- | ---------------------------------------- |
 * | AvPág / RePág          | página siguiente / anterior              |
 * | Espacio / Mayús+Esp.   | página siguiente / anterior (Fase 6)     |
 * | → / ←                  | página siguiente / anterior, solo en     |
 * |                        | «página a página» (Fase 6)               |
 * | Inicio / Fin           | primera / última página                  |
 * | ↓ / ↑                  | desplazar (en «página a página», al      |
 * |                        | llegar al borde pasa de página)          |
 * | Ctrl/⌘ + «+» o «=»     | acercar                                  |
 * | Ctrl/⌘ + «−»           | alejar                                   |
 * | Ctrl/⌘ + 0             | zoom 100 %                               |
 * | Ctrl/⌘ + F             | buscar en el documento                   |
 * | Ctrl/⌘ + G             | al campo de página (Fase 6)              |
 * | F3 / Mayús+F3          | coincidencia siguiente / anterior, con   |
 * |                        | la búsqueda abierta (Fase 6)             |
 * | F · T · R · Mayús+R · ?| de UNA tecla (Fase 6): pantalla completa,|
 * |                        | miniaturas, girar a la derecha / a la    |
 * |                        | izquierda, ayuda. Se pueden desactivar.  |
 *
 * Reglas: mientras se escribe en un campo (el número de página, la búsqueda)
 * no se intercepta nada, salvo `F3` en el campo de búsqueda (no escribe; hace
 * lo mismo que Intro). Nada con un diálogo modal abierto ni con Alt. `Espacio`
 * no actúa sobre un botón, enlace o casilla (ahí los activa). `F3` con la
 * búsqueda cerrada no se toca: es del navegador.
 */
export type Atajo =
  | "siguiente"
  | "anterior"
  | "primera"
  | "ultima"
  | "bajar"
  | "subir"
  | "acercar"
  | "alejar"
  | "zoom-100"
  | "buscar"
  | "ir-a-pagina"
  | "coincidencia-siguiente"
  | "coincidencia-anterior"
  | "pantalla-completa"
  | "miniaturas"
  | "girar-derecha"
  | "girar-izquierda"
  | "ayuda";

/** Lo que el visor sabe en el momento de la tecla y cambia qué hace. */
export type ContextoAtajos = {
  /** ¿Están activados los atajos de una tecla (WCAG 2.1.4)? */
  unaTecla: boolean;
  vista: "continua" | "pagina";
  busquedaAbierta: boolean;
  /** ¿Hay un diálogo modal abierto? Entonces no se intercepta nada. */
  modal: boolean;
};

export const CONTEXTO_INICIAL: ContextoAtajos = {
  unaTecla: true,
  vista: "continua",
  busquedaAbierta: false,
  modal: false,
};

/** Id del campo de búsqueda: el único campo donde actúa un atajo (`F3`). */
export const ID_CAMPO_BUSQUEDA = "busqueda-pdf";
/** Id del campo de página, al que lleva `Ctrl/⌘+G`. */
export const ID_CAMPO_PAGINA = "pagina-pdf";

type Tecla = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"> & {
  target: EventTarget | null;
};

/** ¿El foco está en algo donde se escribe? */
export function esCampoDeTexto(objetivo: EventTarget | null): boolean {
  if (!(objetivo instanceof HTMLElement)) return false;
  // `closest`: también dentro de un editable (y en jsdom, que no calcula
  // `isContentEditable`).
  if (
    objetivo.isContentEditable ||
    objetivo.closest("[contenteditable]:not([contenteditable='false'])")
  )
    return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(objetivo.tagName);
}

/** Controles que usan `Espacio` para activarse: ahí `Espacio` es suyo. */
const USA_ESPACIO =
  "button, a[href], summary, [role='button'], [role='link'], [role='checkbox'], [role='switch'], [role='radio'], [role='menuitem'], [role='tab'], [role='option']";

function usaEspacio(objetivo: EventTarget | null): boolean {
  return objetivo instanceof Element && objetivo.closest(USA_ESPACIO) !== null;
}

/** El atajo que corresponde a la tecla, o `null` si la tecla no es de BPDF. */
export function atajoDe(e: Tecla, contexto: ContextoAtajos = CONTEXTO_INICIAL): Atajo | null {
  if (contexto.modal || e.altKey) return null;

  // F3 / Mayús+F3: solo con la búsqueda abierta, y también desde su campo.
  if (e.key === "F3") {
    if (!contexto.busquedaAbierta || e.ctrlKey || e.metaKey) return null;
    const enCampo = esCampoDeTexto(e.target);
    if (enCampo && !(e.target instanceof HTMLElement && e.target.id === ID_CAMPO_BUSQUEDA))
      return null;
    return e.shiftKey ? "coincidencia-anterior" : "coincidencia-siguiente";
  }

  if (esCampoDeTexto(e.target)) return null;

  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case "+":
      case "=":
        return "acercar";
      case "-":
      case "_":
        return "alejar";
      case "0":
        return "zoom-100";
      case "f":
      case "F":
        return e.shiftKey ? null : "buscar";
      case "g":
      case "G":
        return e.shiftKey ? null : "ir-a-pagina";
      default:
        return null;
    }
  }

  // `?` sale con Mayúsculas en muchas distribuciones (EE. UU.: Mayús+/;
  // España: Mayús+'): se mira el carácter, no la tecla física.
  if (e.key === "?") return contexto.unaTecla ? "ayuda" : null;

  // Mayús+R (girar a la izquierda) es el único atajo con Mayúsculas y letra.
  // Con Bloq Mayús, `key` es «R» sin `shiftKey`: por eso se mira `shiftKey`.
  if (e.key === "r" || e.key === "R") {
    if (!contexto.unaTecla) return null;
    return e.shiftKey ? "girar-izquierda" : "girar-derecha";
  }

  if (e.key === " ") {
    if (usaEspacio(e.target)) return null;
    return e.shiftKey ? "anterior" : "siguiente";
  }

  if (e.shiftKey) return null;
  switch (e.key) {
    case "PageDown":
      return "siguiente";
    case "PageUp":
      return "anterior";
    case "Home":
      return "primera";
    case "End":
      return "ultima";
    case "ArrowDown":
      return "bajar";
    case "ArrowUp":
      return "subir";
    // En la vista continua, las flechas laterales siguen siendo del navegador
    // (desplazamiento horizontal con zoom alto).
    case "ArrowRight":
      return contexto.vista === "pagina" ? "siguiente" : null;
    case "ArrowLeft":
      return contexto.vista === "pagina" ? "anterior" : null;
    case "f":
    case "F":
      return contexto.unaTecla ? "pantalla-completa" : null;
    case "t":
    case "T":
      return contexto.unaTecla ? "miniaturas" : null;
    default:
      return null;
  }
}
