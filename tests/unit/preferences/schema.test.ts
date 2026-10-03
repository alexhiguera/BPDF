import { describe, expect, it } from "vitest";
import {
  ANCHOS,
  esHuella,
  MAX_POSICIONES,
  preferenciasPorDefecto,
  TAMANOS_LETRA,
  VERSION,
  validarPosiciones,
  validarPreferencias,
} from "@/preferences/schema";

/** Esquemas de `bpdf:prefs` y `bpdf:positions` (Fase 10, docs/FASES.md → Fase 10). */

describe("bpdf:prefs: valores por defecto", () => {
  it("son el comportamiento de antes de la Fase 10 (17 px y 72 ch incluidos)", () => {
    expect(preferenciasPorDefecto()).toEqual({
      v: 1,
      pdf: { modo: "oscuro", zoom: { tipo: "ancho" }, vista: "continua", miniaturas: false },
      markdown: { tamanoLetra: 17, ancho: "normal" },
      atajosUnaTecla: true,
      recordarPosicion: true,
    });
    expect(ANCHOS.normal).toBe(72);
    expect(TAMANOS_LETRA).toEqual([15, 16, 17, 18, 20, 22]);
    expect(Object.values(ANCHOS)).toEqual([60, 72, 90]);
    expect(VERSION).toBe(1);
    expect(MAX_POSICIONES).toBe(50);
  });

  it("cada llamada da un objeto nuevo (nadie comparte y muta los valores por defecto)", () => {
    const a = preferenciasPorDefecto();
    a.pdf.miniaturas = true;
    expect(preferenciasPorDefecto().pdf.miniaturas).toBe(false);
  });
});

describe("bpdf:prefs: validación campo a campo", () => {
  it("unas preferencias válidas pasan tal cual", () => {
    const p = {
      v: 1,
      pdf: {
        modo: "original",
        zoom: { tipo: "fijo", valor: 1.25 },
        vista: "pagina",
        miniaturas: true,
      },
      markdown: { tamanoLetra: 22, ancho: "estrecho" },
      atajosUnaTecla: false,
      recordarPosicion: false,
    };
    expect(validarPreferencias(p)).toEqual(p);
  });

  it("un campo inválido vuelve a su valor por defecto sin arrastrar a los demás", () => {
    const p = validarPreferencias({
      v: 1,
      pdf: { modo: "rosa", zoom: { tipo: "fijo", valor: 99 }, vista: "pagina", miniaturas: "sí" },
      markdown: { tamanoLetra: 19, ancho: "ancho" },
      atajosUnaTecla: 0,
      recordarPosicion: false,
    });
    expect(p).toEqual({
      v: 1,
      pdf: { modo: "oscuro", zoom: { tipo: "ancho" }, vista: "pagina", miniaturas: false },
      markdown: { tamanoLetra: 17, ancho: "ancho" },
      atajosUnaTecla: true,
      recordarPosicion: false,
    });
  });

  it("grupos que faltan o no son objetos: sus valores por defecto", () => {
    expect(validarPreferencias({ v: 1 })).toEqual(preferenciasPorDefecto());
    expect(validarPreferencias({ v: 1, pdf: "x", markdown: [1, 2] })).toEqual(
      preferenciasPorDefecto(),
    );
  });

  it("los zooms: ajustes, y fijo solo entre 25 % y 500 %", () => {
    const zoom = (z: unknown) => validarPreferencias({ v: 1, pdf: { zoom: z } })?.pdf.zoom;
    expect(zoom({ tipo: "pagina" })).toEqual({ tipo: "pagina" });
    expect(zoom({ tipo: "fijo", valor: 0.25 })).toEqual({ tipo: "fijo", valor: 0.25 });
    expect(zoom({ tipo: "fijo", valor: 5 })).toEqual({ tipo: "fijo", valor: 5 });
    expect(zoom({ tipo: "fijo", valor: 0.2 })).toEqual({ tipo: "ancho" });
    expect(zoom({ tipo: "fijo", valor: Number.NaN })).toEqual({ tipo: "ancho" });
    expect(zoom({ tipo: "fijo" })).toEqual({ tipo: "ancho" });
    expect(zoom({ tipo: "lupa" })).toEqual({ tipo: "ancho" });
  });

  it("lo que no es del esquema se descarta, también `__proto__`", () => {
    const datos = JSON.parse(
      '{"v":1,"nombre":"secreto.pdf","__proto__":{"contaminado":true},"pdf":{"extra":1}}',
    );
    const p = validarPreferencias(datos);
    expect(p).toEqual(preferenciasPorDefecto());
    expect(JSON.stringify(p)).not.toContain("secreto");
    expect(({} as { contaminado?: boolean }).contaminado).toBeUndefined();
  });

  it("otra versión (o ninguna) no es de este esquema", () => {
    expect(validarPreferencias({ v: 2 })).toBeNull();
    expect(validarPreferencias({})).toBeNull();
    expect(validarPreferencias(null)).toBeNull();
    expect(validarPreferencias("v1")).toBeNull();
  });
});

describe("bpdf:positions", () => {
  const H = "0123456789abcdef0123456789abcdef";

  it("la huella es hexadecimal: ni nombres, ni rutas, ni claves raras", () => {
    expect(esHuella(H)).toBe(true);
    for (const malo of ["", "informe.pdf", "__proto__", "constructor", "../a", "g".repeat(10)]) {
      expect(esHuella(malo)).toBe(false);
    }
    expect(esHuella("a".repeat(65))).toBe(false);
    expect(esHuella(42)).toBe(false);
  });

  it("valida cada entrada por separado: las inválidas se descartan y el resto se conserva", () => {
    const r = validarPosiciones({
      v: 1,
      docs: {
        [H]: { page: 3, zoom: { tipo: "ancho" }, t: 10 },
        aaaa: { page: 0, zoom: { tipo: "ancho" }, t: 1 },
        bbbb: { page: 2.5, zoom: { tipo: "ancho" }, t: 1 },
        cccc: { page: 2, zoom: { tipo: "fijo", valor: 9 }, t: 1 },
        dddd: { page: 2, zoom: { tipo: "ancho" }, t: -1 },
        "nombre.pdf": { page: 2, zoom: { tipo: "ancho" }, t: 1 },
      },
    });
    expect(r).toEqual({ v: 1, docs: { [H]: { page: 3, zoom: { tipo: "ancho" }, t: 10 } } });
  });

  it("un registro que no es de la versión actual, o sin `docs`, no vale", () => {
    expect(validarPosiciones({ v: 2, docs: {} })).toBeNull();
    expect(validarPosiciones({ v: 1 })).toBeNull();
    expect(validarPosiciones({ v: 1, docs: [] })).toBeNull();
    expect(validarPosiciones(null)).toBeNull();
  });
});
