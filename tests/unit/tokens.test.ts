import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Contraste WCAG 2.x de cada par de tokens que se usa junto (docs/PLAN.md §9.2).
 * Lee los valores de `globals.css`, así que cambiar la paleta sin cumplirlos
 * rompe este test en vez de romper la accesibilidad en silencio.
 */
const css = readFileSync("src/styles/globals.css", "utf8");

function token(nombre: string): [number, number, number] {
  const m = css.match(new RegExp(`--rgb-${nombre}:\\s*(\\d+) (\\d+) (\\d+);`));
  if (!m) throw new Error(`No existe el token --rgb-${nombre} en globals.css`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function luminancia([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contraste(a: string, b: string): number {
  const [l1, l2] = [luminancia(token(a)), luminancia(token(b))].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (l1 + 0.05) / (l2 + 0.05);
}

const PLANOS = ["app", "reading", "page", "elevated"];

// [primer plano, fondo, mínimo]. Texto: 4,5:1 (AA). Elementos de interfaz y foco: 3:1.
const PARES: [string, string, number][] = [
  ...PLANOS.map((f): [string, string, number] => ["fg", f, 4.5]),
  ...PLANOS.map((f): [string, string, number] => ["fg-muted", f, 4.5]),
  ...PLANOS.map((f): [string, string, number] => ["danger", f, 4.5]),
  ...PLANOS.map((f): [string, string, number] => ["accent", f, 3]),
  ["fg-subtle", "app", 4.5],
  ["fg-subtle", "reading", 4.5],
  ["primary-fg", "primary", 4.5],
  ["border", "reading", 1.2],
];

describe("tokens de diseño", () => {
  it.each(PARES)("%s sobre %s alcanza %s:1", (fg, fondo, minimo) => {
    expect(contraste(fg, fondo)).toBeGreaterThanOrEqual(minimo);
  });

  it("los tres planos (app, lectura, página) son distintos y ninguno es negro puro", () => {
    const planos = ["app", "reading", "page"].map((p) => token(p).join(" "));
    expect(new Set(planos).size).toBe(3);
    expect(planos).not.toContain("0 0 0");
  });
});
