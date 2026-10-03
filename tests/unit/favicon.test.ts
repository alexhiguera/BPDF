import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * El favicon (Fase 11, `public/favicon.svg`). Un SVG de favicon no puede leer
 * las propiedades CSS de la página, así que sus colores van escritos: este test
 * comprueba que son exactamente tokens de `globals.css` (CLAUDE.md §13: colores
 * solo desde los tokens) y que no pide nada fuera (CSP, privacidad).
 */
const svg = readFileSync("public/favicon.svg", "utf8");
const css = readFileSync("src/styles/globals.css", "utf8");

const hexDeToken = (nombre: string) => {
  const m = css.match(new RegExp(`--rgb-${nombre}:\\s*(\\d+) (\\d+) (\\d+);`));
  if (!m) throw new Error(`No existe el token --rgb-${nombre}`);
  return `#${[m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("")}`;
};

describe("public/favicon.svg", () => {
  it("usa solo colores de los tokens (app, fg y accent)", () => {
    const usados = new Set(
      [...svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{3,6})"/gi)].map((m) => m[1]?.toLowerCase()),
    );
    expect([...usados].sort()).toEqual(
      [hexDeToken("app"), hexDeToken("fg"), hexDeToken("accent")].sort(),
    );
    expect(svg).not.toMatch(/rgb\(|hsl\(/i);
  });

  it("es un SVG cuadrado y autónomo: sin scripts, imágenes, fuentes ni nada externo", () => {
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 32 32">/);
    expect(svg).toContain("<title>BPDF</title>");
    expect(svg).not.toMatch(/<script|<image|<text|<foreignObject|<style|href=|url\(|@import/i);
    // Pequeño: es un icono, no una ilustración.
    expect(svg.length).toBeLessThan(2048);
  });

  it("lo enlaza index.html desde el propio origen", () => {
    expect(readFileSync("index.html", "utf8")).toContain(
      '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
    );
  });
});
