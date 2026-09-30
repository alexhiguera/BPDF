import katex from "katex";
import { describe, expect, it } from "vitest";
import { MAX_FORMULA, opcionesKatex, quitarEstilosPorAtributo } from "@/markdown/matematicas";

/**
 * KaTeX con las opciones de BPDF (Fase 8). Con `renderToString` solo para
 * INSPECCIONAR la salida en Node: la app no lo usa (construye nodos).
 */
const html = (tex: string, bloque = false) => katex.renderToString(tex, opcionesKatex(bloque));

describe("opciones de KaTeX", () => {
  it("sin confianza, estrictas con los topes y lanzando ante errores", () => {
    const o = opcionesKatex(false);
    expect(o.trust).toBe(false);
    expect(o.throwOnError).toBe(true);
    expect(o.maxExpand).toBe(1000);
    expect(o.maxSize).toBe(20);
    expect(o.globalGroup).toBe(false);
    expect(o.output).toBe("htmlAndMathml");
    expect(opcionesKatex(true).displayMode).toBe(true);
  });

  it("cada fórmula recibe un objeto de macros nuevo: un \\gdef no pasa a la siguiente", () => {
    expect(opcionesKatex(false).macros).not.toBe(opcionesKatex(false).macros);
    const a = opcionesKatex(false);
    katex.renderToString("\\gdef\\secreto{filtrado}", a);
    expect(() => katex.renderToString("\\secreto", opcionesKatex(false))).toThrow();
  });

  it("límite de longitud", () => {
    expect(MAX_FORMULA).toBe(10_000);
  });
});

describe("KaTeX con entradas hostiles", () => {
  it.each([
    "\\href{javascript:alert(1)}{x}",
    "\\href{https://tracker.example/}{x}",
    "\\url{javascript:alert(1)}",
    "\\htmlClass{md-contenido}{x}",
    "\\htmlId{location}{x}",
    "\\htmlStyle{background:url(https://tracker.example/x)}{x}",
    "\\htmlData{onclick=alert(1)}{x}",
    "\\includegraphics{https://tracker.example/x.png}",
  ])("%s no produce enlaces, ids, clases, estilos ni imágenes del documento", (tex) => {
    let salida = "";
    try {
      salida = html(tex);
    } catch {
      return; // rechazada: también vale
    }
    // Sin trust se pintan como TEXTO rojo con su propia fuente: puede verse la
    // palabra «javascript», pero nunca como etiqueta ni atributo.
    expect(salida).not.toMatch(/<(a|img|iframe|script|object)[\s>]/i);
    for (const [, nombre = "", valor = ""] of salida.matchAll(/\s([\w:-]+)="([^"]*)"/g)) {
      expect(nombre).not.toMatch(/^(href|src|id|on\w+|data-\w+)$/i);
      if (nombre === "class") expect(valor).not.toMatch(/md-contenido|location/);
      if (nombre === "style") expect(valor).not.toMatch(/url\(|javascript|expression/i);
    }
  });

  it.each([
    ["macro recursiva", "\\def\\a{\\a}\\a"],
    ["macro exponencial", "\\def\\x{\\x\\x}\\x"],
    ["newcommand anidado", "\\newcommand{\\b}[1]{#1#1#1#1#1#1#1#1}\\b{\\b{\\b{\\b{\\b{\\b{x}}}}}}"],
  ])("%s se corta (maxExpand) en vez de colgar", (_caso, tex) => {
    expect(() => html(tex)).toThrow();
  });

  it("\\rule gigante queda acotado por maxSize", () => {
    const salida = html("\\rule{100000em}{100000em}");
    const tamanos = [
      ...salida.matchAll(/(?:width|height|border-right-width|border-top-width):\s*([\d.]+)em/g),
    ].map((m) => Number(m[1]));
    expect(Math.max(...tamanos)).toBeLessThanOrEqual(20);
  });

  it("un color que no es color no se cuela como CSS", () => {
    expect(() => html("\\color{javascript:alert(1)}{x}")).toThrow();
    expect(() => html("\\textcolor{red;background:url(https://t.example/c)}{x}")).toThrow();
  });

  it("el HTML dentro de \\text o del propio TeX es texto, no etiquetas", () => {
    const salida = html("\\text{<img src=x onerror=alert(1)>}");
    expect(salida).not.toMatch(/<img/);
    expect(salida).toContain("&lt;img");
  });
});

describe("quitarEstilosPorAtributo", () => {
  it("quita el atributo style de todo el árbol (la flecha de \\vec, \\pmb)", () => {
    const k = katex as unknown as {
      __renderToDomTree(t: string, o: object): Parameters<typeof quitarEstilosPorAtributo>[0];
    };
    const arbol = k.__renderToDomTree("\\vec{v} + \\pmb{x} + \\oiint", opcionesKatex(false));
    const conEstilo = (n: { attributes?: Record<string, string>; children?: unknown[] }): number =>
      (n.attributes && "style" in n.attributes ? 1 : 0) +
      (n.children ?? []).reduce((s: number, h) => s + conEstilo(h as typeof n), 0);
    expect(conEstilo(arbol)).toBeGreaterThan(0);
    quitarEstilosPorAtributo(arbol);
    expect(conEstilo(arbol)).toBe(0);
  });
});
