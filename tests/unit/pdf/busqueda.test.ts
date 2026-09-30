import { describe, expect, it } from "vitest";
import {
  ajustarTramo,
  buscarEnPagina,
  indexarPagina,
  normalizarConsulta,
  primeraDesde,
  siguienteIndice,
  tieneTexto,
} from "@/pdf/visor/busqueda";

const buscar = (trozos: { str: string; hasEOL?: boolean }[], consulta: string, pagina = 1) =>
  buscarEnPagina(indexarPagina(trozos), normalizarConsulta(consulta), pagina);

describe("normalización", () => {
  it("sin tildes, en minúsculas y con los espacios colapsados", () => {
    expect(normalizarConsulta("  Canción   DEL  Búho ")).toBe("cancion del buho");
  });

  it("las ligaduras tipográficas se buscan como sus letras", () => {
    expect(normalizarConsulta("ﬁn")).toBe("fin");
    expect(indexarPagina([{ str: "ﬁnal" }]).texto).toBe("final");
  });

  it("una consulta vacía o solo de espacios no busca nada", () => {
    expect(normalizarConsulta("   ")).toBe("");
    expect(buscar([{ str: "algo" }], "  ")).toEqual([]);
  });
});

describe("buscarEnPagina", () => {
  it("encuentra sin distinguir mayúsculas ni tildes y dice qué trozo resaltar", () => {
    const r = buscar([{ str: "Primera búsqueda." }, { str: "BÚSQUEDA y busqueda" }], "búsqueda", 2);
    expect(r).toHaveLength(3);
    expect(r.every((c) => c.pagina === 2)).toBe(true);
    expect(r[0]?.tramos).toEqual([{ trozo: 0, desde: 8, hasta: 16 }]);
    expect(r[1]?.tramos).toEqual([{ trozo: 1, desde: 0, hasta: 8 }]);
    expect(r[2]?.tramos).toEqual([{ trozo: 1, desde: 11, hasta: 19 }]);
  });

  it("una frase partida entre dos líneas se encuentra (el fin de línea es un espacio)", () => {
    const r = buscar(
      [{ str: "Esta es una frase", hasEOL: true }, { str: "partida entre" }],
      "frase partida",
    );
    expect(r).toHaveLength(1);
    expect(r[0]?.tramos).toEqual([
      { trozo: 0, desde: 12, hasta: 18 }, // «frase» + el fin de línea
      { trozo: 1, desde: 0, hasta: 7 },
    ]);
  });

  it("una palabra repartida en varios trozos sin espacio se encuentra entera", () => {
    const r = buscar([{ str: "docu" }, { str: "mento" }], "documento");
    expect(r[0]?.tramos).toEqual([
      { trozo: 0, desde: 0, hasta: 4 },
      { trozo: 1, desde: 0, hasta: 5 },
    ]);
  });

  it("las coincidencias no se solapan", () => {
    expect(buscar([{ str: "aaaa" }], "aa")).toHaveLength(2);
  });

  it("sin coincidencias, lista vacía", () => {
    expect(buscar([{ str: "nada que ver" }], "búho")).toEqual([]);
  });

  it("los caracteres fuera del plano básico no desplazan las posiciones", () => {
    const r = buscar([{ str: "😀 hola" }], "hola");
    expect(r[0]?.tramos).toEqual([{ trozo: 0, desde: 3, hasta: 7 }]);
  });

  it("un tramo no parte un par sustituto", () => {
    expect(ajustarTramo("a😀", { trozo: 0, desde: 1, hasta: 2 })).toEqual({
      trozo: 0,
      desde: 1,
      hasta: 3,
    });
  });
});

describe("documentos sin texto (escaneos, sin OCR)", () => {
  it("una página sin trozos, o solo con espacios, no tiene texto", () => {
    expect(tieneTexto(indexarPagina([]))).toBe(false);
    expect(tieneTexto(indexarPagina([{ str: "  ", hasEOL: true }]))).toBe(false);
    expect(tieneTexto(indexarPagina([{ str: "x" }]))).toBe(true);
  });
});

describe("navegación entre coincidencias", () => {
  it("siguiente y anterior dan la vuelta", () => {
    expect(siguienteIndice(-1, 3, 1)).toBe(0);
    expect(siguienteIndice(-1, 3, -1)).toBe(2);
    expect(siguienteIndice(2, 3, 1)).toBe(0);
    expect(siguienteIndice(0, 3, -1)).toBe(2);
    expect(siguienteIndice(0, 0, 1)).toBe(-1);
  });

  it("la primera es la de la página que se lee o la siguiente; si no hay, la primera", () => {
    const c = [2, 2, 7].map((pagina) => ({ pagina, tramos: [] }));
    expect(primeraDesde(c, 1)).toBe(0);
    expect(primeraDesde(c, 3)).toBe(2);
    expect(primeraDesde(c, 9)).toBe(0);
    expect(primeraDesde([], 1)).toBe(-1);
  });
});
