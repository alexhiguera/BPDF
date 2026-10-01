import { describe, expect, it } from "vitest";
import { anclas, encabezadosFuente, lineaAPosicion, posicionALinea } from "@/editor/sincronia";

describe("encabezadosFuente: líneas de los encabezados del texto", () => {
  it("ATX de todos los niveles, en orden, y los duplicados cuentan por separado", () => {
    const texto = "# Uno\n\ntexto\n## Dos\n### Dos\n###### Seis\n## Dos";
    expect(encabezadosFuente(texto)).toEqual([1, 4, 5, 6, 7]);
  });

  it("setext (=== y ---) cuentan en la línea del texto", () => {
    expect(encabezadosFuente("Título\n======\n\nSub\n---\n")).toEqual([1, 4]);
  });

  it("un --- tras una línea en blanco o tras un elemento de lista no es encabezado", () => {
    expect(encabezadosFuente("texto\n\n---\n")).toEqual([]);
    expect(encabezadosFuente("- elemento\n---\n")).toEqual([]);
  });

  it("no son encabezados: #sin espacio, 4+ espacios de sangría, # dentro de código o fórmulas", () => {
    const texto = [
      "#etiqueta",
      "    # código sangrado",
      "```bash",
      "# comentario de bash",
      "```",
      "~~~~",
      "# tampoco",
      "~~~ (no cierra: más corta)",
      "# tampoco",
      "~~~~",
      "$$",
      "# en una fórmula",
      "$$",
      "$$ x $$",
      "# Sí",
    ].join("\n");
    expect(encabezadosFuente(texto)).toEqual([15]);
  });

  it("dentro de una cita, como las pinta el lector", () => {
    expect(encabezadosFuente("> # En cita\n>\n> texto")).toEqual([1]);
  });

  it("sin encabezados o vacío, lista vacía", () => {
    expect(encabezadosFuente("")).toEqual([]);
    expect(encabezadosFuente("solo texto\nde varias líneas")).toEqual([]);
  });

  it("un documento grande se recorre deprisa (lineal)", () => {
    const texto = "## Sección\n\ntexto de relleno\n\n".repeat(50_000);
    const inicio = performance.now();
    expect(encabezadosFuente(texto)).toHaveLength(50_000);
    expect(performance.now() - inicio).toBeLessThan(1000);
  });
});

describe("anclas e interpolación", () => {
  it("empieza y acaba en los extremos y empareja por orden", () => {
    expect(anclas([3, 10], [100, 500], 20, 1000)).toEqual([
      { linea: 1, y: 0 },
      { linea: 3, y: 100 },
      { linea: 10, y: 500 },
      { linea: 21, y: 1000 },
    ]);
  });

  it("si un lado tiene más encabezados, empareja los que hay en los dos", () => {
    expect(anclas([3, 10, 15], [100], 20, 1000)).toHaveLength(3);
  });

  it("descarta una pareja que no avanza en los dos lados (siempre creciente)", () => {
    const lista = anclas([3, 5, 10], [100, 50, 500], 20, 1000);
    expect(lista.map((a) => a.y)).toEqual([0, 100, 500, 1000]);
    for (let i = 1; i < lista.length; i++) {
      expect(lista[i]!.linea).toBeGreaterThan(lista[i - 1]!.linea);
      expect(lista[i]!.y).toBeGreaterThan(lista[i - 1]!.y);
    }
  });

  it("sin encabezados, proporcional entre el principio y el final", () => {
    const lista = anclas([], [], 99, 1000);
    expect(lineaAPosicion(lista, 50.5)).toBeCloseTo(500, 0);
  });

  it("interpola dentro de un tramo y las dos funciones son inversas", () => {
    const lista = anclas([11, 21], [200, 600], 30, 1000);
    expect(lineaAPosicion(lista, 11)).toBe(200);
    expect(lineaAPosicion(lista, 16)).toBe(400);
    expect(posicionALinea(lista, 400)).toBe(16);
    for (const linea of [1, 4.5, 11, 13.25, 21, 29]) {
      expect(posicionALinea(lista, lineaAPosicion(lista, linea))).toBeCloseTo(linea, 6);
    }
  });

  it("fuera de rango se queda en los extremos", () => {
    const lista = anclas([5], [100], 10, 300);
    expect(lineaAPosicion(lista, -3)).toBe(0);
    expect(lineaAPosicion(lista, 999)).toBe(300);
    expect(posicionALinea(lista, -50)).toBe(1);
  });

  it("con miles de anclas, la búsqueda es binaria (rápida)", () => {
    const n = 20_000;
    const lineas = Array.from({ length: n }, (_, i) => i * 4 + 2);
    const ys = Array.from({ length: n }, (_, i) => i * 60 + 10);
    const lista = anclas(lineas, ys, n * 4 + 10, n * 60 + 100);
    const inicio = performance.now();
    for (let i = 0; i < 100_000; i++) lineaAPosicion(lista, (i * 7) % (n * 4));
    expect(performance.now() - inicio).toBeLessThan(500);
  });
});
