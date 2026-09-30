// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { atajoDe, esCampoDeTexto } from "@/app/pdf/atajos";

const tecla = (
  key: string,
  mod: Partial<KeyboardEvent> = {},
  target: EventTarget | null = document.body,
) => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  shiftKey: false,
  target,
  ...mod,
});

describe("atajos del visor", () => {
  it.each([
    ["PageDown", "siguiente"],
    ["PageUp", "anterior"],
    ["Home", "primera"],
    ["End", "ultima"],
    ["ArrowDown", "bajar"],
    ["ArrowUp", "subir"],
  ])("%s → %s", (key, atajo) => {
    expect(atajoDe(tecla(key))).toBe(atajo);
  });

  it.each([
    [{ ctrlKey: true }, "+", "acercar"],
    [{ ctrlKey: true }, "=", "acercar"],
    [{ metaKey: true }, "+", "acercar"],
    [{ ctrlKey: true }, "-", "alejar"],
    [{ metaKey: true }, "-", "alejar"],
    [{ ctrlKey: true }, "0", "zoom-100"],
    [{ ctrlKey: true }, "f", "buscar"],
    [{ metaKey: true }, "f", "buscar"],
  ])("Ctrl/⌘ %o + %s → %s", (mod, key, atajo) => {
    expect(atajoDe(tecla(key, mod))).toBe(atajo);
  });

  it("no toca Ctrl+O (lo gestiona la app), ni otras combinaciones, ni Alt", () => {
    expect(atajoDe(tecla("o", { ctrlKey: true }))).toBeNull();
    expect(atajoDe(tecla("PageDown", { altKey: true }))).toBeNull();
    expect(atajoDe(tecla("PageDown", { shiftKey: true }))).toBeNull();
    expect(atajoDe(tecla("f", { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(atajoDe(tecla("a"))).toBeNull();
  });

  it("no intercepta NADA mientras se escribe en un campo", () => {
    const input = document.createElement("input");
    const area = document.createElement("textarea");
    const select = document.createElement("select");
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    for (const campo of [input, area, select]) {
      expect(esCampoDeTexto(campo)).toBe(true);
      expect(atajoDe(tecla("PageDown", {}, campo))).toBeNull();
      expect(atajoDe(tecla("Home", {}, campo))).toBeNull();
      expect(atajoDe(tecla("0", { ctrlKey: true }, campo))).toBeNull();
    }
    // jsdom no calcula isContentEditable: se comprueba el caso con el atributo real en E2E.
    expect(esCampoDeTexto(document.createElement("button"))).toBe(false);
    expect(esCampoDeTexto(null)).toBe(false);
  });
});
