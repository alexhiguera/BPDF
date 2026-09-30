import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  buscarEnPagina,
  normalizarConsulta,
  type OpcionesBusqueda,
  tieneTexto,
} from "@/pdf/visor/busqueda";
import { DocumentoDestruidoError, DocumentoVisor, trozosDeTexto } from "@/pdf/visor/documento";
import { crearPdfGrande } from "../../fixtures/pdf/modo-oscuro/generar.mjs";
import {
  BUSQUEDA,
  CJK,
  crearPdfBusqueda,
  crearPdfCjk,
  crearPdfProtegido,
  crearPdfSinTexto,
  crearPdfVisor,
  VISOR,
} from "../../fixtures/pdf/visor/generar.mjs";
import { abrirBytes } from "../../helpers/pdfjs";

/** El envoltorio del visor sobre pdf.js real (Node, sin lienzo). */
const abiertos: DocumentoVisor[] = [];
afterEach(async () => {
  for (const d of abiertos.splice(0)) await d.destruir();
});

async function abrir(bytes: Uint8Array = crearPdfVisor()) {
  const { doc } = await abrirBytes(bytes);
  const d = new DocumentoVisor(doc);
  abiertos.push(d);
  return d;
}

describe("fixtures del visor", () => {
  it("los ficheros versionados son exactamente lo que produce el generador", () => {
    const dir = "tests/fixtures/pdf/visor";
    expect(Buffer.compare(readFileSync(`${dir}/visor.pdf`), crearPdfVisor())).toBe(0);
    expect(Buffer.compare(readFileSync(`${dir}/protegido.pdf`), crearPdfProtegido())).toBe(0);
    expect(Buffer.compare(readFileSync(`${dir}/sin-texto.pdf`), crearPdfSinTexto())).toBe(0);
    expect(Buffer.compare(readFileSync(`${dir}/cjk.pdf`), crearPdfCjk())).toBe(0);
    expect(Buffer.compare(readFileSync(`${dir}/busqueda.pdf`), crearPdfBusqueda())).toBe(0);
  });
});

describe("DocumentoVisor", () => {
  it("da el tamaño de cada página con su propia rotación aplicada", async () => {
    const d = await abrir();
    expect(d.total).toBe(VISOR.paginas);
    const vistos: { ancho: number; alto: number }[][] = [];
    await d.tamanos({ ancho: 1, alto: 1 }, (t) => vistos.push(t), 2);
    const final = vistos.at(-1) ?? [];
    expect(final[0]).toEqual({ ancho: 595, alto: 842 });
    expect(final[VISOR.apaisada - 1]).toEqual({ ancho: 842, alto: 595 });
    expect(final[VISOR.girada - 1]).toEqual({ ancho: 842, alto: 595 }); // /Rotate 90
    // Avisa por lotes (cada 2 y al final) con la lista completa.
    expect(vistos.map((t) => t.length)).toEqual([5, 5, 5]);
  });

  it("indexa el texto y la búsqueda encuentra las 4 «búsqueda» en las páginas esperadas", async () => {
    const d = await abrir();
    const consulta = normalizarConsulta(VISOR.busqueda.palabra);
    const paginas: number[] = [];
    for (let n = 1; n <= d.total; n++) {
      for (const c of buscarEnPagina(await d.indice(n), consulta, n)) paginas.push(c.pagina);
    }
    expect(paginas).toEqual(VISOR.busqueda.paginas);
    const partida = buscarEnPagina(await d.indice(2), normalizarConsulta(VISOR.frasePartida), 2);
    expect(partida).toHaveLength(1);
  });

  it("con el texto real de pdf.js: mayúsculas, palabra completa y guion de fin de línea (Fase 6)", async () => {
    const d = await abrir(crearPdfBusqueda());
    const indice = await d.indice(1);
    const cuantas = (consulta: string, o: Partial<OpcionesBusqueda> = {}) => {
      const opciones = { mayusculas: false, palabraCompleta: false, ...o };
      return buscarEnPagina(indice, normalizarConsulta(consulta, opciones), 1, opciones).length;
    };
    expect(cuantas("rosa")).toBe(BUSQUEDA.rosa.todas);
    expect(cuantas("ROSA", { mayusculas: true })).toBe(BUSQUEDA.rosa.mayusculas);
    expect(cuantas("rosa", { palabraCompleta: true })).toBe(BUSQUEDA.rosa.palabra);
    expect(cuantas(BUSQUEDA.partida)).toBe(1);
    expect(cuantas(BUSQUEDA.partida, { palabraCompleta: true })).toBe(1);
    // Las dos mitades se resaltan cada una en su trozo de la capa de texto.
    const [partida] = buscarEnPagina(indice, normalizarConsulta(BUSQUEDA.partida), 1);
    expect(partida?.tramos).toHaveLength(2);
  });

  it("los trozos del índice son los mismos, en el mismo orden, que los de la capa de texto", async () => {
    const d = await abrir();
    const contenido = await d.texto(2);
    const trozos = trozosDeTexto(contenido);
    // La capa de texto crea un elemento por cada trozo con `str` (los de contenido
    // marcado no cuentan): el tramo `trozo: i` de la búsqueda es su elemento i.
    expect(trozos.map((t) => t.str)).toContain("Primera búsqueda del documento.");
    expect(trozos.length).toBe(contenido.items.filter((i) => "str" in i).length);
  });

  it("lee texto CJK de una fuente no incrustada con los cmaps del propio origen", async () => {
    const d = await abrir(crearPdfCjk());
    const trozos = trozosDeTexto(await d.texto(1)).map((t) => t.str);
    expect(trozos).toContain(CJK.texto);
    expect(trozos).toContain(CJK.latino);
  });

  it("un PDF de solo dibujo no tiene texto que buscar", async () => {
    const d = await abrir(crearPdfSinTexto());
    expect(tieneTexto(await d.indice(1))).toBe(false);
    expect(tieneTexto(await d.indice(2))).toBe(false);
  });

  it("de la página 1 solo quedan los enlaces permitidos, ya resueltos", async () => {
    const d = await abrir();
    const destinos = (await d.enlaces(1)).map((e) => e.destino);
    expect(destinos).toEqual([
      { tipo: "interno", pagina: 3 },
      { tipo: "interno", pagina: 5 },
      { tipo: "externo", url: VISOR.urlExterna },
      { tipo: "interno", pagina: 2 },
    ]);
    // javascript:, file: y la acción JavaScript no aparecen.
    expect(await d.enlaces(2)).toEqual([]);
  });

  it("la caché de texto de la capa de texto no crece sin límite", async () => {
    const d = await abrir(crearPdfGrande(DocumentoVisor.TEXTOS_EN_CACHE + 8));
    for (let n = 1; n <= d.total; n++) await d.texto(n);
    expect(d.textosEnCache).toBe(DocumentoVisor.TEXTOS_EN_CACHE);
  });

  it("destruido, no se puede usar y pdf.js lo ha liberado", async () => {
    const d = await abrir();
    await d.destruir();
    expect(d.destruido).toBe(true);
    await expect(d.pagina(1)).rejects.toBeInstanceOf(DocumentoDestruidoError);
    expect(() => d.liberarPagina(1)).not.toThrow();
    // Pedir tamaños después no avisa de nada.
    const avisos: unknown[] = [];
    await d.tamanos({ ancho: 1, alto: 1 }, (t) => avisos.push(t));
    expect(avisos).toEqual([]);
    await d.destruir(); // dos veces, sin error
  });
});
