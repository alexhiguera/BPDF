import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Los textos visibles viven en `src/i18n/messages.ts` (D2). Este test busca, en
 * los componentes, texto escrito directamente en el JSX o en atributos que un
 * lector de pantalla anuncia. Es una heurística sencilla a propósito: falla con
 * lo habitual (`<p>Hola</p>`, `aria-label="Cerrar"`), no con todo lo posible.
 */
function componentes(dir = "src"): string[] {
  return readdirSync(dir).flatMap((f) => {
    const ruta = path.join(dir, f);
    if (statSync(ruta).isDirectory()) return componentes(ruta);
    return f.endsWith(".tsx") ? [ruta] : [];
  });
}

// Texto entre `>` y `<` con al menos una letra, fuera de expresiones `{…}`. El
// `>` de una flecha (`=> Promise<T>`) no abre texto de JSX.
const TEXTO_JSX = /(?<!=)>\s*[^<>{}\s][^<>{}]*[A-Za-zÁÉÍÓÚÑáéíóúñ][^<>{}]*</;
const ATRIBUTO_VISIBLE = /\b(aria-label|title|alt|placeholder)="[^"]*[A-Za-zÁÉÍÓÚÑáéíóúñ]/;

describe("textos de la interfaz centralizados", () => {
  it("ningún componente escribe texto visible fuera de messages.ts", () => {
    const culpables = componentes().flatMap((f) => {
      const lineas = readFileSync(f, "utf8").split("\n");
      return lineas
        .map((l, i) => ({ l: l.trim(), n: i + 1 }))
        .filter(({ l }) => !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*"))
        .filter(({ l }) => TEXTO_JSX.test(l) || ATRIBUTO_VISIBLE.test(l))
        .map(({ l, n }) => `${f}:${n}  ${l}`);
    });
    expect(culpables).toEqual([]);
  });

  it("la heurística detecta los casos que tiene que detectar", () => {
    expect(TEXTO_JSX.test("<p>Hola</p>")).toBe(true);
    expect(TEXTO_JSX.test("<h1>{t.title}</h1>")).toBe(false);
    expect(TEXTO_JSX.test("async (leer: () => Promise<Doc | null>) => {")).toBe(false);
    expect(ATRIBUTO_VISIBLE.test('<button aria-label="Cerrar">')).toBe(true);
    expect(ATRIBUTO_VISIBLE.test("<button aria-label={t.close}>")).toBe(false);
  });
});
