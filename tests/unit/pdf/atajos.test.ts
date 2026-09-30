// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  atajoDe,
  atajosDeUnaTecla,
  CONTEXTO_INICIAL,
  type ContextoAtajos,
  esCampoDeTexto,
  ID_CAMPO_BUSQUEDA,
} from "@/app/pdf/atajos";

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

const con = (c: Partial<ContextoAtajos>): ContextoAtajos => ({ ...CONTEXTO_INICIAL, ...c });

describe("atajos del visor (Fase 5)", () => {
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
    editable.setAttribute("contenteditable", "true");
    const dentro = document.createElement("span");
    editable.append(dentro);
    for (const campo of [input, area, select, editable, dentro]) {
      expect(esCampoDeTexto(campo)).toBe(true);
      expect(atajoDe(tecla("PageDown", {}, campo))).toBeNull();
      expect(atajoDe(tecla("Home", {}, campo))).toBeNull();
      expect(atajoDe(tecla("0", { ctrlKey: true }, campo))).toBeNull();
      for (const k of ["f", "t", "r", "R", "?", " ", "ArrowRight"]) {
        expect(atajoDe(tecla(k, {}, campo), con({ vista: "pagina" }))).toBeNull();
      }
      expect(atajoDe(tecla("g", { ctrlKey: true }, campo))).toBeNull();
    }
    expect(esCampoDeTexto(document.createElement("button"))).toBe(false);
    expect(esCampoDeTexto(null)).toBe(false);
  });
});

describe("atajos de una tecla (Fase 6)", () => {
  it.each([
    ["f", {}, "pantalla-completa"],
    ["F", {}, "pantalla-completa"], // Bloq Mayús
    ["t", {}, "miniaturas"],
    ["T", {}, "miniaturas"],
    ["r", {}, "girar-derecha"],
    ["R", {}, "girar-derecha"], // Bloq Mayús: sin shiftKey sigue siendo a la derecha
    ["R", { shiftKey: true }, "girar-izquierda"],
    ["?", {}, "ayuda"],
    ["?", { shiftKey: true }, "ayuda"], // sale con Mayús en la mayoría de teclados
  ])("%s %o → %s", (key, mod, atajo) => {
    expect(atajoDe(tecla(key, mod))).toBe(atajo);
  });

  it("desactivados, ninguno actúa (y el resto de atajos sigue)", () => {
    const sin = con({ unaTecla: false });
    for (const [k, mod] of [
      ["f", {}],
      ["t", {}],
      ["r", {}],
      ["R", { shiftKey: true }],
      ["?", {}],
    ] as const) {
      expect(atajoDe(tecla(k, mod), sin)).toBeNull();
    }
    expect(atajoDe(tecla("PageDown"), sin)).toBe("siguiente");
    expect(atajoDe(tecla(" "), sin)).toBe("siguiente");
    expect(atajoDe(tecla("g", { ctrlKey: true }), sin)).toBe("ir-a-pagina");
  });

  it("Mayús con F o T no es atajo; ni Ctrl/⌘ o Alt con una letra", () => {
    expect(atajoDe(tecla("F", { shiftKey: true }))).toBeNull();
    expect(atajoDe(tecla("T", { shiftKey: true }))).toBeNull();
    expect(atajoDe(tecla("r", { ctrlKey: true }))).toBeNull();
    expect(atajoDe(tecla("t", { metaKey: true }))).toBeNull();
    expect(atajoDe(tecla("f", { altKey: true }))).toBeNull();
  });

  it("actúan con el foco en un botón (no es un campo de texto)", () => {
    const b = document.createElement("button");
    expect(atajoDe(tecla("t", {}, b))).toBe("miniaturas");
  });
});

describe("navegación (Fase 6)", () => {
  it("→ / ← solo en «página a página»; en la continua son del navegador", () => {
    expect(atajoDe(tecla("ArrowRight"), con({ vista: "pagina" }))).toBe("siguiente");
    expect(atajoDe(tecla("ArrowLeft"), con({ vista: "pagina" }))).toBe("anterior");
    expect(atajoDe(tecla("ArrowRight"), con({ vista: "continua" }))).toBeNull();
    expect(atajoDe(tecla("ArrowLeft"), con({ vista: "continua" }))).toBeNull();
    expect(atajoDe(tecla("ArrowRight", { shiftKey: true }), con({ vista: "pagina" }))).toBeNull();
  });

  it("Espacio / Mayús+Espacio pasan de página en las dos vistas", () => {
    for (const vista of ["continua", "pagina"] as const) {
      expect(atajoDe(tecla(" "), con({ vista }))).toBe("siguiente");
      expect(atajoDe(tecla(" ", { shiftKey: true }), con({ vista }))).toBe("anterior");
    }
  });

  it("Espacio no actúa sobre botones, enlaces, casillas ni controles con rol", () => {
    const enlace = document.createElement("a");
    enlace.href = "#x";
    const resumen = document.createElement("summary");
    const conRol = document.createElement("div");
    conRol.setAttribute("role", "switch");
    const icono = document.createElement("span");
    const boton = document.createElement("button");
    boton.append(icono);
    for (const objetivo of [boton, icono, enlace, resumen, conRol]) {
      expect(atajoDe(tecla(" ", {}, objetivo))).toBeNull();
    }
  });

  it("Ctrl/⌘+G lleva al campo de página (sin Mayús)", () => {
    expect(atajoDe(tecla("g", { ctrlKey: true }))).toBe("ir-a-pagina");
    expect(atajoDe(tecla("g", { metaKey: true }))).toBe("ir-a-pagina");
    expect(atajoDe(tecla("G", { ctrlKey: true, shiftKey: true }))).toBeNull();
  });
});

describe("F3 / Mayús+F3 (Fase 6)", () => {
  const abierta = con({ busquedaAbierta: true });

  it("con la búsqueda abierta: siguiente / anterior coincidencia", () => {
    expect(atajoDe(tecla("F3"), abierta)).toBe("coincidencia-siguiente");
    expect(atajoDe(tecla("F3", { shiftKey: true }), abierta)).toBe("coincidencia-anterior");
  });

  it("con la búsqueda cerrada no se intercepta (es del navegador)", () => {
    expect(atajoDe(tecla("F3"))).toBeNull();
    expect(atajoDe(tecla("F3", { shiftKey: true }))).toBeNull();
  });

  it("actúa en el campo de búsqueda, pero no en otro campo", () => {
    const busqueda = document.createElement("input");
    busqueda.id = ID_CAMPO_BUSQUEDA;
    const otro = document.createElement("input");
    expect(atajoDe(tecla("F3", {}, busqueda), abierta)).toBe("coincidencia-siguiente");
    expect(atajoDe(tecla("F3", {}, otro), abierta)).toBeNull();
  });

  it("no depende de los atajos de una tecla, pero sí de Ctrl, Alt y del modal", () => {
    expect(atajoDe(tecla("F3"), con({ busquedaAbierta: true, unaTecla: false }))).toBe(
      "coincidencia-siguiente",
    );
    expect(atajoDe(tecla("F3", { ctrlKey: true }), abierta)).toBeNull();
    expect(atajoDe(tecla("F3", { altKey: true }), abierta)).toBeNull();
    expect(atajoDe(tecla("F3"), con({ busquedaAbierta: true, modal: true }))).toBeNull();
  });
});

describe("con un diálogo modal abierto", () => {
  it("no se intercepta ninguna tecla", () => {
    const modal = con({ modal: true, vista: "pagina" });
    for (const k of ["PageDown", "Home", "ArrowDown", "ArrowRight", " ", "f", "t", "r", "?"]) {
      expect(atajoDe(tecla(k), modal)).toBeNull();
    }
    expect(atajoDe(tecla("f", { ctrlKey: true }), modal)).toBeNull();
  });
});

describe("interruptor de los atajos de una tecla", () => {
  afterEach(() => atajosDeUnaTecla.fijar(true));

  it("empieza activado y guarda el cambio en memoria (sin almacenamiento)", () => {
    expect(atajosDeUnaTecla.activos()).toBe(true);
    atajosDeUnaTecla.fijar(false);
    expect(atajosDeUnaTecla.activos()).toBe(false);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
