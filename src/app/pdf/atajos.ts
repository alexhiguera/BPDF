/**
 * Atajos de teclado del visor PDF (documentados en docs/ARCHITECTURE.md →
 * visor PDF, «Teclado»). `Ctrl/⌘+O` (abrir) lo gestiona la app.
 *
 * | Tecla                  | Acción                                   |
 * | ---------------------- | ---------------------------------------- |
 * | AvPág / RePág          | página siguiente / anterior              |
 * | Inicio / Fin           | primera / última página                  |
 * | ↓ / ↑                  | desplazar (en «página a página», al      |
 * |                        | llegar al borde pasa de página)          |
 * | Ctrl/⌘ + «+» o «=»     | acercar                                  |
 * | Ctrl/⌘ + «−»           | alejar                                   |
 * | Ctrl/⌘ + 0             | zoom 100 %                               |
 * | Ctrl/⌘ + F             | buscar en el documento                   |
 *
 * Mientras se escribe en un campo (el número de página, la búsqueda) no se
 * intercepta NADA: las teclas son del campo.
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
  | "buscar";

type Tecla = Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey" | "shiftKey"> & {
  target: EventTarget | null;
};

/** ¿El foco está en algo donde se escribe? */
export function esCampoDeTexto(objetivo: EventTarget | null): boolean {
  if (!(objetivo instanceof HTMLElement)) return false;
  if (objetivo.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(objetivo.tagName);
}

export function atajoDe(e: Tecla): Atajo | null {
  if (esCampoDeTexto(e.target) || e.altKey) return null;
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
      default:
        return null;
    }
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
    default:
      return null;
  }
}
