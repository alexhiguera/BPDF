import { describe, expect, it } from "vitest";
import { esPaginaOscura } from "@/pdf/dark/aplicar";
import { contraste, type Rgb } from "@/pdf/dark/color";
import {
  crearRecoloreado,
  desempaquetar,
  empaquetar,
  invertirPixeles,
  recolorearRgb,
  transformarPixeles,
} from "@/pdf/dark/recolor";

/** Los tokens de globals.css (`--rgb-page`, `--rgb-fg`). */
const PAGINA: Rgb = [43, 43, 43];
const TEXTO: Rgb = [236, 236, 236];
const op = { pagina: PAGINA, texto: TEXTO };

function cerca(real: Rgb, esperado: Rgb, tolerancia = 1) {
  for (const [i, c] of real.entries()) {
    expect(Math.abs(c - (esperado[i] ?? 0))).toBeLessThanOrEqual(tolerancia);
  }
}

describe("recolorearRgb", () => {
  it("el papel blanco pasa al color de página", () => {
    cerca(recolorearRgb([255, 255, 255], op), PAGINA);
  });

  it("la tinta negra pasa al color de texto, con contraste ≥ 7:1 sobre la página", () => {
    const tinta = recolorearRgb([0, 0, 0], op);
    cerca(tinta, TEXTO);
    expect(contraste(tinta, PAGINA)).toBeGreaterThanOrEqual(7);
  });

  it("un gris medio queda gris y entre la página y el texto", () => {
    const [r, g, b] = recolorearRgb([128, 128, 128], op);
    expect(r).toBe(g);
    expect(g).toBe(b);
    expect(r).toBeGreaterThan(PAGINA[0]);
    expect(r).toBeLessThan(TEXTO[0]);
  });

  it("invierte el orden de los grises: el más claro del original queda el más oscuro", () => {
    const claro = recolorearRgb([242, 242, 242], op)[0];
    const medio = recolorearRgb([128, 128, 128], op)[0];
    expect(claro).toBeLessThan(medio);
  });

  it("un color saturado con contraste suficiente se conserva tal cual (verde de un gráfico)", () => {
    cerca(recolorearRgb([40, 170, 60], op), [40, 170, 60], 1);
  });

  it("un color saturado justo por debajo de 3:1 se aclara lo mínimo (rojo: 2,83 → 3)", () => {
    const rojo = recolorearRgb([220, 40, 40], op);
    cerca(rojo, [220, 40, 40], 6);
    expect(contraste(rojo, PAGINA)).toBeGreaterThanOrEqual(3);
  });

  it("un color muy oscuro se aclara hasta ≥ 3:1 conservando el tono (azul marino)", () => {
    const [r, g, b] = recolorearRgb([20, 40, 100], op);
    expect(contraste([r, g, b], PAGINA)).toBeGreaterThanOrEqual(3);
    expect(b).toBeGreaterThan(g);
    expect(g).toBeGreaterThan(r);
  });

  it("un relleno pastel oscurece pero conserva su matiz (azul claro → azul oscuro)", () => {
    const [r, g, b] = recolorearRgb([232, 240, 255], op);
    expect(Math.max(r, g, b)).toBeLessThan(110);
    expect(b).toBeGreaterThan(r);
  });
});

describe("crearRecoloreado (con caché)", () => {
  it("da lo mismo que recolorearRgb y conserva el alfa", () => {
    const f = crearRecoloreado(op);
    for (const c of [
      [255, 255, 255],
      [0, 0, 0],
      [220, 40, 40],
      [20, 40, 100],
    ] as Rgb[]) {
      const salida = f(empaquetar(c));
      expect(desempaquetar(salida)).toEqual(recolorearRgb(c, op));
      expect(salida >>> 24).toBe(0xff);
      // Segunda vez, desde la caché: el mismo resultado.
      expect(f(empaquetar(c))).toBe(salida);
    }
  });
});

describe("transformarPixeles e invertirPixeles", () => {
  const blanco = empaquetar([255, 255, 255]);

  it("no toca los píxeles marcados en la máscara (dentro de una imagen)", () => {
    const px = new Uint32Array([blanco, blanco, blanco]);
    transformarPixeles(px, crearRecoloreado(op), new Uint8Array([0, 1, 0]));
    expect(desempaquetar(px[1] ?? 0)).toEqual([255, 255, 255]);
    expect(desempaquetar(px[0] ?? 0)).toEqual(recolorearRgb([255, 255, 255], op));
  });

  it("sin máscara recolorea todos", () => {
    const px = new Uint32Array([blanco, blanco]);
    transformarPixeles(px, crearRecoloreado(op));
    expect(px.every((p) => desempaquetar(p)[0] === recolorearRgb([255, 255, 255], op)[0])).toBe(
      true,
    );
  });

  it("el negativo invierte cada canal y conserva el alfa", () => {
    const px = new Uint32Array([empaquetar([255, 0, 10])]);
    invertirPixeles(px);
    expect(desempaquetar(px[0] ?? 0)).toEqual([0, 255, 245]);
    expect((px[0] ?? 0) >>> 24).toBe(0xff);
  });
});

describe("esPaginaOscura", () => {
  const pagina = (color: Rgb, n = 100) =>
    Uint8ClampedArray.from({ length: n * 4 }, (_, i) => (i % 4 === 3 ? 255 : (color[i % 4] ?? 0)));

  it("una página blanca no es oscura", () => {
    expect(esPaginaOscura(pagina([255, 255, 255]))).toBe(false);
  });

  it("una diapositiva casi negra sí lo es (no se invierte a clara)", () => {
    expect(esPaginaOscura(pagina([24, 24, 28]))).toBe(true);
  });

  it("una página de un color saturado oscuro no cuenta como oscura neutra", () => {
    expect(esPaginaOscura(pagina([20, 40, 140]))).toBe(false);
  });
});
