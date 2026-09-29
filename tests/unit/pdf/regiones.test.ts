import { describe, expect, it } from "vitest";
import {
  marcarRegiones,
  type Paralelogramo,
  paralelogramos,
  regionesAConservar,
} from "@/pdf/dark/regiones";

/** Máscara de `ancho × alto` como filas de 0/1, para comparar a ojo. */
function mascara(ancho: number, alto: number, regiones: Paralelogramo[], y0 = 0, filas = alto) {
  const m = new Uint8Array(ancho * filas);
  marcarRegiones(m, ancho, y0, filas, regiones);
  return Array.from({ length: filas }, (_, y) =>
    Array.from(m.subarray(y * ancho, (y + 1) * ancho)).join(""),
  );
}

describe("paralelogramos", () => {
  it("convierte las coordenadas normalizadas de pdf.js a píxeles del lienzo", () => {
    // pdf.js las guarda en Float16Array o Float32Array: se compara con tolerancia.
    const coords = new Float32Array([0.1, 0.5, 0.1, 0.25, 0.6, 0.5]);
    const [region] = paralelogramos(coords, 200, 400);
    for (const [i, v] of [20, 200, 20, 100, 120, 200].entries()) {
      expect(region?.[i]).toBeCloseTo(v, 3);
    }
  });

  it("sin coordenadas (página sin imágenes) no hay regiones", () => {
    expect(paralelogramos(null, 100, 100)).toEqual([]);
  });
});

describe("marcarRegiones", () => {
  it("marca exactamente los píxeles de un rectángulo alineado", () => {
    // A = (1,1), B = (1,3), C = (4,1): rectángulo x∈[1,4), y∈[1,3).
    expect(mascara(6, 4, [[1, 1, 1, 3, 4, 1]])).toEqual(["000000", "011100", "011100", "000000"]);
  });

  it("respeta el desplazamiento de la franja (y0)", () => {
    expect(mascara(6, 2, [[1, 1, 1, 3, 4, 1]], 2, 2)).toEqual(["011100", "000000"]);
  });

  it("marca un paralelogramo girado sin incluir las esquinas del rectángulo que lo contiene", () => {
    // Un rombo (cuadrado girado 45°) de centro (5,5).
    const rombo: Paralelogramo = [5, 1, 1, 5, 9, 5];
    const filas = mascara(10, 10, [rombo]);
    expect(filas[5]?.[5]).toBe("1");
    expect(filas[1]?.[1]).toBe("0");
    expect(filas[8]?.[8]).toBe("0");
  });
});

describe("regionesAConservar", () => {
  it("conserva las imágenes y descarta la que cubre la página entera (escaneo)", () => {
    const foto: Paralelogramo = [10, 10, 10, 50, 60, 10];
    const escaneo: Paralelogramo = [0, 0, 0, 100, 100, 0];
    expect(regionesAConservar([foto, escaneo], 100, 100)).toEqual([foto]);
  });
});
