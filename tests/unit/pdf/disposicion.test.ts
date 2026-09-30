import { describe, expect, it } from "vitest";
import { PIXELES_MAXIMOS, PT_A_CSS, resolucionEfectiva } from "@/pdf/render";
import {
  acotarZoom,
  bytesLienzo,
  dentroDePresupuesto,
  disponer,
  girar,
  leerPagina,
  PASOS_ZOOM,
  PRESUPUESTO_LIENZOS,
  pasoZoom,
  SEPARACION,
  tamanoTipico,
  ventana,
  ZOOM_MAXIMO,
  ZOOM_MINIMO,
  zoomEfectivo,
} from "@/pdf/visor/disposicion";

const A4 = { ancho: 595, alto: 842 };

describe("zoom", () => {
  it("se acota entre el mínimo y el máximo", () => {
    expect(acotarZoom(0.01)).toBe(ZOOM_MINIMO);
    expect(acotarZoom(99)).toBe(ZOOM_MAXIMO);
    expect(acotarZoom(1.3)).toBe(1.3);
  });

  it("los pasos suben y bajan al siguiente valor de la lista, sin salirse", () => {
    expect(pasoZoom(1, 1)).toBe(1.1);
    expect(pasoZoom(1, -1)).toBe(0.9);
    expect(pasoZoom(1.17, 1)).toBe(1.25); // desde un ajuste (no está en la lista)
    expect(pasoZoom(1.17, -1)).toBe(1.1);
    expect(pasoZoom(ZOOM_MAXIMO, 1)).toBe(ZOOM_MAXIMO);
    expect(pasoZoom(ZOOM_MINIMO, -1)).toBe(ZOOM_MINIMO);
    expect(PASOS_ZOOM[0]).toBe(ZOOM_MINIMO);
    expect(PASOS_ZOOM.at(-1)).toBe(ZOOM_MAXIMO);
  });

  it("ajustar al ancho llena el área menos los márgenes", () => {
    const area = { ancho: 1000, alto: 600 };
    const z = zoomEfectivo({ tipo: "ancho" }, A4, area);
    expect(A4.ancho * PT_A_CSS * z).toBeCloseTo(1000 - 2 * SEPARACION);
  });

  it("ajustar a la página cabe entera en alto y en ancho", () => {
    const area = { ancho: 1000, alto: 600 };
    const z = zoomEfectivo({ tipo: "pagina" }, A4, area);
    expect(A4.alto * PT_A_CSS * z).toBeCloseTo(600 - 2 * SEPARACION);
    expect(A4.ancho * PT_A_CSS * z).toBeLessThan(1000);
  });

  it("un ajuste en un área diminuta o enorme sigue dentro de los límites", () => {
    expect(zoomEfectivo({ tipo: "ancho" }, A4, { ancho: 0, alto: 0 })).toBe(ZOOM_MINIMO);
    expect(zoomEfectivo({ tipo: "ancho" }, A4, { ancho: 1e6, alto: 1e6 })).toBe(ZOOM_MAXIMO);
    expect(zoomEfectivo({ tipo: "fijo", valor: 12 }, A4, { ancho: 1, alto: 1 })).toBe(ZOOM_MAXIMO);
  });

  it("girar 90 o 270 grados intercambia ancho y alto; 180, no", () => {
    expect(girar(A4, 90)).toEqual({ ancho: 842, alto: 595 });
    expect(girar(A4, 270)).toEqual({ ancho: 842, alto: 595 });
    expect(girar(A4, 180)).toEqual(A4);
  });

  it("el tamaño típico es la mediana por ancho: una página apaisada no lo cambia", () => {
    expect(tamanoTipico([A4, A4, { ancho: 842, alto: 595 }, A4])).toEqual(A4);
    expect(tamanoTipico([])).toEqual({ ancho: 1, alto: 1 });
  });
});

describe("disposición continua y ventana de virtualización", () => {
  const d = disponer(
    Array.from({ length: 300 }, () => A4),
    1,
  );
  const alto = Math.floor(842 * PT_A_CSS);

  it("apila las páginas con su separación y calcula el alto total", () => {
    expect(d.arriba[0]).toBe(SEPARACION);
    expect(d.arriba[1]).toBe(SEPARACION * 2 + alto);
    expect(d.alto).toBe(SEPARACION + 300 * (alto + SEPARACION));
    expect(d.ancho).toBe(Math.floor(595 * PT_A_CSS) + 2 * SEPARACION);
  });

  it("al principio se ve la 1 y viven la 1 y la 2", () => {
    const v = ventana(d, 0, 800);
    expect(v.visibles).toEqual({ desde: 1, hasta: 1 });
    expect(v.vivas).toEqual({ desde: 1, hasta: 2 });
    expect(v.actual).toBe(1);
  });

  it("en mitad de un documento de 300 páginas solo viven las visibles ±1", () => {
    const y = d.arriba[149] ?? 0; // la 150 arriba del todo
    const v = ventana(d, y, 800);
    expect(v.actual).toBe(150);
    expect(v.visibles).toEqual({ desde: 150, hasta: 150 });
    expect(v.vivas).toEqual({ desde: 149, hasta: 151 });
  });

  it("entre dos páginas visibles, las dos cuentan", () => {
    const y = (d.arriba[9] ?? 0) + alto - 100; // últimos 100 px de la 10
    const v = ventana(d, y, 800);
    expect(v.visibles).toEqual({ desde: 10, hasta: 11 });
    expect(v.vivas).toEqual({ desde: 9, hasta: 12 });
  });

  it("al final no se sale del documento", () => {
    const v = ventana(d, d.alto - 800, 800);
    expect(v.vivas.hasta).toBe(300);
    expect(v.actual).toBe(300);
  });

  it("un documento sin páginas no tiene ventana", () => {
    expect(ventana(disponer([], 1), 0, 800).actual).toBe(0);
  });

  it("las páginas de distinto tamaño conservan su tamaño y el ancho es el mayor", () => {
    const mixta = disponer([A4, { ancho: 842, alto: 595 }], 1);
    expect(mixta.tamanos[1]?.ancho).toBe(Math.floor(842 * PT_A_CSS));
    expect(mixta.ancho).toBe(Math.floor(842 * PT_A_CSS) + 2 * SEPARACION);
  });
});

describe("presupuesto de memoria de los lienzos", () => {
  it("la resolución física se limita a DPR 2 y a PIXELES_MAXIMOS por lienzo", () => {
    expect(resolucionEfectiva(800, 1000, 3)).toBe(2);
    expect(resolucionEfectiva(800, 1000, 0.5)).toBe(1);
    const r = resolucionEfectiva(4000, 5000, 2);
    expect(4000 * r * 5000 * r).toBeLessThanOrEqual(PIXELES_MAXIMOS + 1);
  });

  it("cuenta 4 bytes por píxel físico", () => {
    expect(bytesLienzo({ ancho: 100, alto: 50 }, 2)).toBe(200 * 100 * 4);
  });

  it("las visibles entran siempre; las vecinas, solo si caben", () => {
    const grande = 64 * 2 ** 20;
    const r = dentroDePresupuesto([7, 8, 9, 6], 2, () => grande);
    expect(r).toEqual([7, 8]); // 128 MiB visibles; una vecina más pasaría de 160
    expect(dentroDePresupuesto([7, 9, 6], 1, () => 30 * 2 ** 20)).toEqual([7, 9, 6]);
    expect(dentroDePresupuesto([1, 2], 2, () => PRESUPUESTO_LIENZOS * 2)).toEqual([1, 2]);
  });
});

describe("campo «ir a página»", () => {
  it.each([
    ["", null],
    ["   ", null],
    ["abc", null],
    ["0", null],
    ["-1", null],
    ["1.5", null],
    ["1e2", null],
    ["149", null],
    ["99999999999999999999", null],
    ["1", 1],
    [" 12 ", 12],
    ["148", 148],
  ])("«%s» → %s (de 148)", (texto, esperado) => {
    expect(leerPagina(texto, 148)).toBe(esperado);
  });
});
