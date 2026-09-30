import { describe, expect, it } from "vitest";
import { type Accion, estadoInicial, reducir } from "@/app/pdf/estado";
import { ZOOM_MAXIMO } from "@/pdf/visor/disposicion";

const aplicar = (acciones: Accion[], total = 148) => acciones.reduce(reducir, estadoInicial(total));

describe("estado del visor", () => {
  it("empieza en la página 1, ajustado al ancho, continuo y en oscuro", () => {
    expect(estadoInicial(12)).toMatchObject({
      pagina: 1,
      total: 12,
      zoom: { tipo: "ancho" },
      rotacion: 0,
      vista: "continua",
      modo: "oscuro",
      miniaturas: false,
      busqueda: false,
    });
  });

  it("navega sin salirse del documento", () => {
    expect(aplicar([{ tipo: "siguiente" }, { tipo: "siguiente" }]).pagina).toBe(3);
    expect(aplicar([{ tipo: "anterior" }]).pagina).toBe(1);
    expect(aplicar([{ tipo: "ultima" }, { tipo: "siguiente" }]).pagina).toBe(148);
    expect(aplicar([{ tipo: "ir", pagina: 500 }]).pagina).toBe(148);
    expect(aplicar([{ tipo: "ir", pagina: -4 }]).pagina).toBe(1);
    expect(aplicar([{ tipo: "ir", pagina: Number.NaN }]).pagina).toBe(1);
    expect(aplicar([{ tipo: "ultima" }, { tipo: "primera" }]).pagina).toBe(1);
  });

  it("ir a una página pide desplazarse; verla al desplazarse, no", () => {
    const e = aplicar([{ tipo: "ir", pagina: 12 }]);
    expect(e.salto).toBe(1);
    const visto = reducir(e, { tipo: "visible", pagina: 13 });
    expect(visto.pagina).toBe(13);
    expect(visto.salto).toBe(1);
    // En los extremos, «siguiente» no hace nada (ni pide desplazarse).
    const fin = aplicar([{ tipo: "ultima" }]);
    expect(reducir(fin, { tipo: "siguiente" })).toBe(fin);
  });

  it("el zoom se acota y los pasos parten del zoom que se ve (aunque sea un ajuste)", () => {
    expect(aplicar([{ tipo: "zoom", zoom: { tipo: "fijo", valor: 40 } }]).zoom).toEqual({
      tipo: "fijo",
      valor: ZOOM_MAXIMO,
    });
    expect(aplicar([{ tipo: "paso-zoom", actual: 1.17, direccion: 1 }]).zoom).toEqual({
      tipo: "fijo",
      valor: 1.25,
    });
    expect(aplicar([{ tipo: "zoom", zoom: { tipo: "pagina" } }]).zoom).toEqual({ tipo: "pagina" });
  });

  it("girar da la vuelta completa de 90 en 90", () => {
    const giros = [1, 2, 3, 4].map(
      (n) => aplicar(Array.from({ length: n }, () => ({ tipo: "girar" }) as const)).rotacion,
    );
    expect(giros).toEqual([90, 180, 270, 0]);
  });

  it("girar a la izquierda resta 90 y también da la vuelta (Fase 6)", () => {
    const izquierda = { tipo: "girar", sentido: -1 } as const;
    const giros = [1, 2, 3, 4].map(
      (n) => aplicar(Array.from({ length: n }, () => izquierda)).rotacion,
    );
    expect(giros).toEqual([270, 180, 90, 0]);
    expect(aplicar([{ tipo: "girar" }, izquierda]).rotacion).toBe(0);
  });

  it("cambiar de vista conserva página, zoom, giro y modo, y lleva a la página", () => {
    const antes = aplicar([
      { tipo: "ir", pagina: 40 },
      { tipo: "zoom", zoom: { tipo: "fijo", valor: 2 } },
      { tipo: "girar" },
      { tipo: "modo", modo: "original" },
    ]);
    const despues = reducir(antes, { tipo: "vista", vista: "pagina" });
    expect(despues).toMatchObject({
      pagina: 40,
      zoom: antes.zoom,
      rotacion: 90,
      modo: "original",
      vista: "pagina",
    });
    expect(despues.salto).toBe(antes.salto + 1);
    expect(reducir(despues, { tipo: "vista", vista: "pagina" })).toBe(despues);
  });

  it("el modo oscuro se puede quitar y volver a poner (nadie queda atrapado)", () => {
    const e = aplicar([
      { tipo: "modo", modo: "original" },
      { tipo: "modo", modo: "oscuro" },
    ]);
    expect(e.modo).toBe("oscuro");
  });

  it("miniaturas y búsqueda se abren y se cierran", () => {
    expect(aplicar([{ tipo: "miniaturas" }]).miniaturas).toBe(true);
    expect(aplicar([{ tipo: "miniaturas" }, { tipo: "miniaturas" }]).miniaturas).toBe(false);
    expect(aplicar([{ tipo: "busqueda", abierta: true }]).busqueda).toBe(true);
  });
});
