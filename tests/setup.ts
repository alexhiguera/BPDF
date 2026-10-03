import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { afterEach, expect } from "vitest";
import { reiniciarPreferenciasEnMemoria } from "@/preferences/store";

expect.extend(toHaveNoViolations);

// jsdom no implementa el <dialog> modal (`showModal`, `close`): lo mínimo para
// los tests de componentes (Fase 6: ayuda de atajos y contraseña). Lo modal de
// verdad (fondo inerte, Esc, capa superior) se prueba en Playwright.
if (typeof HTMLDialogElement !== "undefined" && !("showModal" in HTMLDialogElement.prototype)) {
  const proto = HTMLDialogElement.prototype as HTMLDialogElement;
  if (!("open" in proto)) {
    Object.defineProperty(proto, "open", {
      get(this: HTMLDialogElement) {
        return this.hasAttribute("open");
      },
    });
  }
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  proto.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
}

// Testing Library solo desmonta sola con `globals: true`; aquí se hace explícito.
// Las preferencias (Fase 10) viven en `localStorage` y en una copia en memoria:
// cada test empieza sin ninguna de las dos.
afterEach(() => {
  if (typeof document !== "undefined") cleanup();
  if (typeof localStorage !== "undefined") localStorage.clear();
  if (typeof sessionStorage !== "undefined") sessionStorage.clear();
  reiniciarPreferenciasEnMemoria();
});
