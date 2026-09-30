import { describe, expect, it } from "vitest";
import {
  ajustarTramo,
  buscarEnPagina,
  indexarPagina,
  normalizarConsulta,
  type OpcionesBusqueda,
  primeraDesde,
  SIN_OPCIONES,
  siguienteIndice,
  type TrozoTexto,
  tieneTexto,
} from "@/pdf/visor/busqueda";

const buscar = (
  trozos: TrozoTexto[],
  consulta: string,
  pagina = 1,
  opciones: Partial<OpcionesBusqueda> = {},
) => {
  const o = { ...SIN_OPCIONES, ...opciones };
  return buscarEnPagina(indexarPagina(trozos), normalizarConsulta(consulta, o), pagina, o);
};
const cuantas = (trozos: TrozoTexto[], consulta: string, opciones: Partial<OpcionesBusqueda>) =>
  buscar(trozos, consulta, 1, opciones).length;

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

describe("índice: texto con mayúsculas y en minúsculas, alineados", () => {
  it.each([
    ["latino con tildes", "Canción ÁRBOL"],
    ["İ turca (NFKD la parte en I + punto, que se quita)", "İstanbul"],
    ["ß y ẞ", "Straße STRAẞE"],
    ["ligaduras", "ﬁn ﬂor ﬀ"],
    ["emoji y fuera del plano básico", "😀 Hola 𝐀𝐁"],
    ["griego con sigma final", "ΟΔΥΣΣΕΥΣ"],
    ["guion blando", "pala­bra"],
  ])("%s: las dos cadenas y las tablas miden lo mismo", (_caso, str) => {
    const i = indexarPagina([{ str, hasEOL: true }, { str: "fin" }]);
    expect(i.minusculas).toHaveLength(i.texto.length);
    expect(i.trozo).toHaveLength(i.texto.length);
    expect(i.posicion).toHaveLength(i.texto.length);
    expect(i.minusculas).not.toMatch(/\p{Lu}/u);
  });

  it("el texto conserva las mayúsculas y quita las tildes", () => {
    const i = indexarPagina([{ str: "Canción ÁRBOL" }]);
    expect(i.texto).toBe("Cancion ARBOL");
    expect(i.minusculas).toBe("cancion arbol");
  });
});

describe("distinguir mayúsculas", () => {
  const trozos = [{ str: "Rosa, rosa y ROSA. Rosales" }];

  it("sin la opción, se busca como en la Fase 5", () => {
    expect(cuantas(trozos, "rosa", {})).toBe(4);
  });

  it("con la opción, solo la forma exacta (y los acentos se siguen ignorando)", () => {
    expect(cuantas(trozos, "Rosa", { mayusculas: true })).toBe(2);
    expect(cuantas(trozos, "ROSA", { mayusculas: true })).toBe(1);
    expect(cuantas(trozos, "rosa", { mayusculas: true })).toBe(1);
    expect(cuantas([{ str: "Canción" }], "Cancion", { mayusculas: true })).toBe(1);
    expect(cuantas([{ str: "Canción" }], "cancion", { mayusculas: true })).toBe(0);
  });

  it("la consulta conserva sus mayúsculas con la opción", () => {
    expect(normalizarConsulta(" Árbol  ÉL ", { mayusculas: true, palabraCompleta: false })).toBe(
      "Arbol EL",
    );
  });

  it("los tramos resaltados son los del texto mostrado", () => {
    const r = buscar(trozos, "ROSA", 1, { mayusculas: true });
    expect(r[0]?.tramos).toEqual([{ trozo: 0, desde: 13, hasta: 17 }]);
  });
});

describe("palabra completa", () => {
  it("descarta las coincidencias dentro de otra palabra", () => {
    const t = [{ str: "sol, solar, girasol y sol." }];
    expect(cuantas(t, "sol", {})).toBe(4);
    expect(cuantas(t, "sol", { palabraCompleta: true })).toBe(2);
  });

  it("vale al principio y al final de la página, y junto a puntuación o guion", () => {
    expect(cuantas([{ str: "sol" }], "sol", { palabraCompleta: true })).toBe(1);
    expect(cuantas([{ str: "(sol)-sol" }], "sol", { palabraCompleta: true })).toBe(2);
  });

  it("un número pegado también cuenta como parte de la palabra", () => {
    expect(cuantas([{ str: "sol2 2sol sol" }], "sol", { palabraCompleta: true })).toBe(1);
  });

  it("un candidato que no vale no esconde otro que se solapa con él", () => {
    // «aa» en «aaa aa»: el primer candidato (0) no vale, tampoco el de 1; sí el de 4.
    const r = buscar([{ str: "aaa aa" }], "aa", 1, { palabraCompleta: true });
    expect(r).toHaveLength(1);
    expect(r[0]?.tramos).toEqual([{ trozo: 0, desde: 4, hasta: 6 }]);
  });

  it("una frase entre dos trozos y las dos opciones a la vez", () => {
    const t = [{ str: "Buen Día", hasEOL: true }, { str: "buenos días" }];
    expect(cuantas(t, "buen dia", { palabraCompleta: true })).toBe(1);
    expect(cuantas(t, "Buen Dia", { palabraCompleta: true, mayusculas: true })).toBe(1);
    expect(cuantas(t, "buen", { palabraCompleta: true, mayusculas: true })).toBe(0);
  });

  it("una letra fuera del plano básico cuenta como letra", () => {
    // 𐐀 (Deseret, U+10400) es una letra de dos unidades UTF-16.
    expect(cuantas([{ str: "𐐀sol sol𐐀 sol" }], "sol", { palabraCompleta: true })).toBe(1);
  });
});

describe("guion al final de línea", () => {
  it("une la palabra partida (guion y fin de línea en el mismo trozo)", () => {
    const t = [{ str: "una pala-", hasEOL: true }, { str: "bra partida" }];
    expect(indexarPagina(t).texto).toBe("una palabra partida");
    const r = buscar(t, "palabra");
    expect(r[0]?.tramos).toEqual([
      { trozo: 0, desde: 4, hasta: 8 },
      { trozo: 1, desde: 0, hasta: 3 },
    ]);
  });

  it("también con el fin de línea en un trozo vacío aparte, y con U+2010", () => {
    const t = [{ str: "pala‐ " }, { str: "", hasEOL: true }, { str: "bra" }];
    expect(indexarPagina(t).texto).toBe("palabra");
    expect(cuantas(t, "palabra", { palabraCompleta: true })).toBe(1);
  });

  it("el guion blando se ignora siempre, también en la consulta", () => {
    expect(indexarPagina([{ str: "pala­bra" }]).texto).toBe("palabra");
    expect(cuantas([{ str: "palabra" }], "pala­bra", {})).toBe(1);
  });

  it("no une si la línea no acaba tras el guion", () => {
    expect(indexarPagina([{ str: "bien-" }, { str: "estar" }]).texto).toBe("bien-estar");
    expect(indexarPagina([{ str: "bien- estar" }]).texto).toBe("bien- estar");
  });

  it("no une números, guiones sueltos ni lo que no sigue con una letra", () => {
    expect(indexarPagina([{ str: "2020-", hasEOL: true }, { str: "2021" }]).texto).toBe(
      "2020- 2021",
    );
    expect(indexarPagina([{ str: "a -", hasEOL: true }, { str: "b" }]).texto).toBe("a - b");
    expect(indexarPagina([{ str: "pala-", hasEOL: true }, { str: "(bra)" }]).texto).toBe(
      "pala- (bra)",
    );
    expect(indexarPagina([{ str: "final-", hasEOL: true }]).texto).toBe("final- ");
  });

  it("un guion que no parte nada conserva su posición para resaltarlo", () => {
    const r = buscar([{ str: "bien-" }, { str: "estar" }], "bien-estar");
    expect(r[0]?.tramos).toEqual([
      { trozo: 0, desde: 0, hasta: 5 },
      { trozo: 1, desde: 0, hasta: 5 },
    ]);
  });
});

describe("rendimiento", () => {
  it("una página grande con miles de coincidencias se indexa y se busca deprisa", () => {
    const linea = "Él dijo: «la LA la-»";
    const trozos = Array.from({ length: 5000 }, (_, k) => ({
      str: linea,
      hasEOL: k % 2 === 0,
    }));
    const inicio = performance.now();
    const indice = indexarPagina(trozos);
    const todas = buscarEnPagina(indice, normalizarConsulta("la"), 1);
    const exactas = buscarEnPagina(indice, "LA", 1, { mayusculas: true, palabraCompleta: true });
    const ms = performance.now() - inicio;
    expect(todas.length).toBeGreaterThanOrEqual(10000);
    expect(exactas).toHaveLength(5000);
    // Holgado: en el equipo de desarrollo tarda decenas de milisegundos.
    expect(ms).toBeLessThan(2000);
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
