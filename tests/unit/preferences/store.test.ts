// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CLAVE_PREFERENCIAS, preferenciasPorDefecto } from "@/preferences/schema";
import {
  almacenamiento,
  cambiarPreferencias,
  escribir,
  leerVersionado,
  type Migraciones,
  obtenerPreferencias,
  reiniciarPreferenciasEnMemoria,
  restablecerPreferencias,
  suscribirPreferencias,
} from "@/preferences/store";

/** Almacén versionado y preferencias en memoria (Fase 10, docs/FASES.md → Fase 10). */

const guardar = (valor: unknown) =>
  localStorage.setItem(
    CLAVE_PREFERENCIAS,
    typeof valor === "string" ? valor : JSON.stringify(valor),
  );
const guardado = () => localStorage.getItem(CLAVE_PREFERENCIAS);

afterEach(() => vi.restoreAllMocks());

describe("leerVersionado", () => {
  const validar = (d: unknown) =>
    typeof d === "object" && d !== null && "ok" in d ? (d as { ok: unknown }) : null;

  it("sin clave: vacío", () => {
    expect(leerVersionado("k", validar, {})).toEqual({ estado: "vacio", valor: null });
  });

  it("JSON roto, sin `v`, `v` no entero o menor que 1: corrupto", () => {
    for (const crudo of [
      "{",
      "null",
      "42",
      '"v"',
      "[]",
      '{"ok":1}',
      '{"v":"1","ok":1}',
      '{"v":1.5,"ok":1}',
      '{"v":0,"ok":1}',
    ]) {
      localStorage.setItem("k", crudo);
      expect(leerVersionado("k", validar, {}).estado, crudo).toBe("corrupto");
    }
  });

  it("válido en la versión actual", () => {
    localStorage.setItem("k", '{"v":1,"ok":true}');
    expect(leerVersionado("k", validar, {})).toEqual({
      estado: "valido",
      valor: { v: 1, ok: true },
    });
  });

  it("que no valida: corrupto", () => {
    localStorage.setItem("k", '{"v":1}');
    expect(leerVersionado("k", validar, {}).estado).toBe("corrupto");
  });

  it("versión futura: se marca y no se valida ni se toca", () => {
    localStorage.setItem("k", '{"v":7,"ok":true}');
    expect(leerVersionado("k", validar, {})).toEqual({ estado: "futuro", valor: null });
    expect(localStorage.getItem("k")).toBe('{"v":7,"ok":true}');
  });

  describe("migraciones (tabla sintética: la v1 es la primera y no tiene ninguna)", () => {
    const orden: number[] = [];
    const tabla: Migraciones = {
      1: (d) => {
        orden.push(1);
        return { ...(d as object), v: 2, b: (d as { a: number }).a * 2 };
      },
      2: (d) => {
        orden.push(2);
        return { ...(d as object), v: 3, ok: true };
      },
    };

    it("aplica los pasos en orden desde la versión guardada y valida el resultado", () => {
      orden.length = 0;
      localStorage.setItem("k", '{"v":1,"a":21}');
      expect(leerVersionado("k", validar, tabla, 3)).toEqual({
        estado: "migrado",
        valor: { v: 3, a: 21, b: 42, ok: true },
      });
      expect(orden).toEqual([1, 2]);
      orden.length = 0;
      localStorage.setItem("k", '{"v":2,"a":1}');
      expect(leerVersionado("k", validar, tabla, 3).estado).toBe("migrado");
      expect(orden).toEqual([2]);
    });

    it("un paso que falta o que lanza: corrupto (valores por defecto)", () => {
      localStorage.setItem("k", '{"v":1,"a":1}');
      expect(leerVersionado("k", validar, { 2: tabla[2]! }, 3).estado).toBe("corrupto");
      const lanza: Migraciones = {
        1: () => {
          throw new Error("migración rota");
        },
      };
      expect(leerVersionado("k", validar, lanza, 2).estado).toBe("corrupto");
    });

    it("migrar no reescribe la clave por su cuenta", () => {
      localStorage.setItem("k", '{"v":1,"a":1}');
      leerVersionado("k", validar, tabla, 3);
      expect(localStorage.getItem("k")).toBe('{"v":1,"a":1}');
    });
  });

  it("un `localStorage` que lanza al leer: vacío; al escribir: `false`, sin lanzar", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("lleno", "QuotaExceededError");
    });
    expect(leerVersionado("k", validar, {}).estado).toBe("vacio");
    expect(escribir("k", { v: 1 })).toBe(false);
  });

  it("sin almacenamiento (`localStorage` lanza al nombrarlo): nada se rompe", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    expect(almacenamiento()).toBeNull();
    expect(leerVersionado("k", validar, {}).estado).toBe("vacio");
    expect(escribir("k", 1)).toBe(false);
    expect(obtenerPreferencias()).toEqual(preferenciasPorDefecto());
    cambiarPreferencias((p) => ({ ...p, atajosUnaTecla: false }));
    expect(obtenerPreferencias().atajosUnaTecla).toBe(false);
  });
});

describe("preferencias: lectura y escritura", () => {
  it("sin nada guardado: valores por defecto, y leer no escribe", () => {
    expect(obtenerPreferencias()).toEqual(preferenciasPorDefecto());
    expect(localStorage.length).toBe(0);
  });

  it("lee unas válidas, y siempre el mismo objeto mientras nada cambie", () => {
    guardar({ ...preferenciasPorDefecto(), atajosUnaTecla: false });
    const a = obtenerPreferencias();
    expect(a.atajosUnaTecla).toBe(false);
    expect(obtenerPreferencias()).toBe(a);
  });

  it("corruptas: valores por defecto, y no se reescriben hasta que el usuario cambia algo", () => {
    guardar("{no es json");
    expect(obtenerPreferencias()).toEqual(preferenciasPorDefecto());
    expect(guardado()).toBe("{no es json");
  });

  it("versión futura: valores por defecto en memoria, sin sobrescribirla; un cambio del usuario sí escribe la v1", () => {
    const futura = JSON.stringify({ v: 2, algoNuevo: true, atajosUnaTecla: false });
    guardar(futura);
    expect(obtenerPreferencias()).toEqual(preferenciasPorDefecto());
    expect(guardado()).toBe(futura);
    cambiarPreferencias((p) => ({ ...p, recordarPosicion: false }));
    expect(JSON.parse(guardado() ?? "{}")).toEqual({
      ...preferenciasPorDefecto(),
      recordarPosicion: false,
    });
  });

  it("cambiar guarda `{ v: 1, … }` y valida: lo que no vale vuelve a su valor por defecto", () => {
    cambiarPreferencias((p) => ({ ...p, markdown: { tamanoLetra: 20, ancho: "ancho" } }));
    expect(JSON.parse(guardado() ?? "{}").markdown).toEqual({ tamanoLetra: 20, ancho: "ancho" });
    cambiarPreferencias(
      (p) => ({ ...p, markdown: { ...p.markdown, tamanoLetra: 99 } }) as unknown as typeof p,
    );
    expect(obtenerPreferencias().markdown).toEqual({ tamanoLetra: 17, ancho: "ancho" });
    expect(JSON.parse(guardado() ?? "{}").v).toBe(1);
  });

  it("un cambio que no cambia nada no escribe ni avisa", () => {
    const oyente = vi.fn();
    const quitar = suscribirPreferencias(oyente);
    cambiarPreferencias((p) => ({ ...p }));
    expect(oyente).not.toHaveBeenCalled();
    expect(guardado()).toBeNull();
    quitar();
  });

  it("si no se puede escribir, el cambio vale igual para esta sesión", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("lleno", "QuotaExceededError");
    });
    cambiarPreferencias((p) => ({ ...p, atajosUnaTecla: false }));
    expect(obtenerPreferencias().atajosUnaTecla).toBe(false);
  });

  it("restablecer borra `bpdf:prefs`, vuelve a los valores por defecto y avisa; no toca otras claves", () => {
    cambiarPreferencias((p) => ({ ...p, atajosUnaTecla: false }));
    localStorage.setItem("bpdf:positions", '{"v":1,"docs":{}}');
    const oyente = vi.fn();
    const quitar = suscribirPreferencias(oyente);
    restablecerPreferencias();
    expect(guardado()).toBeNull();
    expect(obtenerPreferencias()).toEqual(preferenciasPorDefecto());
    expect(oyente).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem("bpdf:positions")).toBe('{"v":1,"docs":{}}');
    quitar();
  });

  it("la copia en memoria manda: otra lectura no vuelve al almacenamiento (salvo otra pestaña)", () => {
    expect(obtenerPreferencias().atajosUnaTecla).toBe(true);
    guardar({ ...preferenciasPorDefecto(), atajosUnaTecla: false });
    expect(obtenerPreferencias().atajosUnaTecla).toBe(true);
    reiniciarPreferenciasEnMemoria();
    expect(obtenerPreferencias().atajosUnaTecla).toBe(false);
  });
});

describe("preferencias: varias pestañas (evento `storage`)", () => {
  const deOtraPestana = (key: string | null) =>
    window.dispatchEvent(new StorageEvent("storage", { key, storageArea: localStorage }));

  it("un cambio de otra pestaña se lee y se avisa", () => {
    const oyente = vi.fn();
    const quitar = suscribirPreferencias(oyente);
    expect(obtenerPreferencias().pdf.vista).toBe("continua");
    guardar({
      ...preferenciasPorDefecto(),
      pdf: { ...preferenciasPorDefecto().pdf, vista: "pagina" },
    });
    deOtraPestana(CLAVE_PREFERENCIAS);
    expect(oyente).toHaveBeenCalledTimes(1);
    expect(obtenerPreferencias().pdf.vista).toBe("pagina");
    quitar();
  });

  it("otra clave no avisa; vaciar todo (`key: null`) sí", () => {
    const oyente = vi.fn();
    const quitar = suscribirPreferencias(oyente);
    cambiarPreferencias((p) => ({ ...p, atajosUnaTecla: false }));
    oyente.mockClear();
    deOtraPestana("bpdf:positions");
    expect(oyente).not.toHaveBeenCalled();
    localStorage.clear();
    deOtraPestana(null);
    expect(oyente).toHaveBeenCalledTimes(1);
    expect(obtenerPreferencias().atajosUnaTecla).toBe(true);
    quitar();
  });

  it("los cambios de esta pestaña también avisan (el evento `storage` no llega a quien escribe)", () => {
    const oyente = vi.fn();
    const quitar = suscribirPreferencias(oyente);
    cambiarPreferencias((p) => ({ ...p, atajosUnaTecla: false }));
    expect(oyente).toHaveBeenCalledTimes(1);
    quitar();
  });

  it("sin suscriptores, no queda ningún oyente en `window`", () => {
    const poner = vi.spyOn(window, "addEventListener");
    const quitarSpy = vi.spyOn(window, "removeEventListener");
    const a = suscribirPreferencias(() => {});
    const b = suscribirPreferencias(() => {});
    a();
    b();
    expect(poner.mock.calls.filter(([tipo]) => tipo === "storage")).toHaveLength(1);
    expect(quitarSpy.mock.calls.filter(([tipo]) => tipo === "storage")).toHaveLength(1);
  });
});
