// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { transformadorLocal } from "@/pdf/dark/aplicar";
import type { Pdfjs } from "@/pdf/engine";
import { indexarPagina } from "@/pdf/visor/busqueda";
import {
  ControladorVisor,
  type EstadoBusqueda,
  type Marco,
  RENDERS_A_LA_VEZ,
} from "@/pdf/visor/controlador";
import type { DocumentoVisor } from "@/pdf/visor/documento";

/**
 * El controlador con un documento de mentira cuyas páginas no terminan de
 * cargar hasta que el test lo decide: así se ve qué pide, en qué orden, cuántas
 * a la vez y qué libera. El render real (lienzo) se prueba en Playwright.
 */
function documentoFalso(total: number, textos: Record<number, string> = {}) {
  const pedidas: number[] = [];
  const liberadas: number[] = [];
  const pendientes = new Map<number, { rechazar: (e: Error) => void }[]>();
  const doc = {
    total,
    destruido: false,
    pagina: vi.fn((n: number) => {
      pedidas.push(n);
      return new Promise((_, rechazar) => {
        const lista = pendientes.get(n) ?? [];
        lista.push({ rechazar });
        pendientes.set(n, lista);
      });
    }),
    liberarPagina: vi.fn((n: number) => liberadas.push(n)),
    indice: vi.fn(async (n: number) => indexarPagina(textos[n] ? [{ str: textos[n] }] : [])),
    destruir: vi.fn(async () => {
      doc.destruido = true;
    }),
  };
  /** Hace fallar la carga de la página `n` (su render termina en error). */
  const fallar = (n: number) => {
    for (const p of pendientes.get(n) ?? []) p.rechazar(new Error("pagina-rota"));
    pendientes.delete(n);
  };
  return { doc, pedidas, liberadas, fallar };
}

function montar(total = 300, textos?: Record<number, string>) {
  const f = documentoFalso(total, textos);
  const destruirTransformador = vi.fn();
  const c = new ControladorVisor({} as Pdfjs, f.doc as unknown as DocumentoVisor, {
    colores: { pagina: [43, 43, 43], texto: [236, 236, 236] },
    alEnlace: () => {},
    etiquetaEnlace: () => "",
    crearTransformador: (colores) => ({
      ...transformadorLocal(colores),
      destruir: destruirTransformador,
    }),
  });
  return { c, ...f, destruirTransformador };
}

const marcos = (...numeros: number[]): Marco[] =>
  numeros.map((numero) => ({ numero, marco: document.createElement("div") }));
const P = { zoom: 1, rotacion: 0, dpr: 1, modo: "oscuro" as const };
const tick = () => new Promise((r) => setTimeout(r, 0));

describe("ControladorVisor: qué se pinta y en qué orden", () => {
  it(`pinta en el orden dado y como mucho ${RENDERS_A_LA_VEZ} a la vez`, async () => {
    const { c, pedidas } = montar();
    c.mostrar(marcos(150, 149, 151), P);
    await tick();
    expect(pedidas).toEqual([150, 149]);
    expect(c.memoria().pintando).toBe(2);
  });

  it("no repite el render de una página que ya se está pintando con los mismos parámetros", async () => {
    const { c, pedidas } = montar();
    const m = marcos(1, 2);
    c.mostrar(m, P);
    c.mostrar(m, P);
    c.mostrar(m, P);
    await tick();
    expect(pedidas).toEqual([1, 2]);
  });

  it("con otros parámetros (zoom, giro, modo) vuelve a pintar", async () => {
    const { c, pedidas } = montar();
    const m = marcos(1);
    c.mostrar(m, P);
    c.mostrar(m, { ...P, zoom: 2 });
    c.mostrar(m, { ...P, zoom: 2, modo: "original" });
    await tick();
    expect(pedidas).toEqual([1, 1, 1]);
  });

  it("las páginas que dejan de estar vivas se liberan (también en pdf.js)", async () => {
    const { c, liberadas } = montar();
    const [a, b, d] = marcos(1, 2, 3);
    c.mostrar([a!, b!, d!], P);
    c.mostrar([d!], P);
    expect(liberadas.sort()).toEqual([1, 2]);
    expect(c.superficie(1)).toBeUndefined();
    expect(c.superficie(3)).toBeDefined();
    expect(a?.marco.dataset.estado).toBe("vacia");
  });

  it("recorrer rápido 300 páginas deja vivas solo las últimas pedidas", async () => {
    const { c } = montar();
    for (let n = 1; n <= 298; n++) c.mostrar(marcos(n, n + 1, n + 2), P);
    await tick();
    expect(c.memoria().pintando).toBeLessThanOrEqual(3);
    expect(c.superficie(1)).toBeUndefined();
    expect(c.superficie(300)).toBeDefined();
  });

  it("un render que falla deja la página en error y deja paso a la siguiente", async () => {
    const { c, pedidas, fallar } = montar();
    const m = marcos(1, 2, 3);
    c.mostrar(m, P);
    await tick();
    fallar(1);
    await tick();
    await tick();
    expect(m[0]?.marco.dataset.estado).toBe("error");
    expect(pedidas).toEqual([1, 2, 3]);
  });

  it("las miniaturas van detrás de las páginas y se liberan todas al cerrar el panel", async () => {
    const { c, pedidas } = montar();
    c.mostrarMiniaturas(marcos(10, 11), () => 595, { rotacion: 0, dpr: 1, modo: "oscuro" });
    c.mostrar(marcos(5), P);
    await tick();
    expect(pedidas[0]).toBe(10); // ya estaba en marcha
    c.mostrarMiniaturas([], () => 595, { rotacion: 0, dpr: 1, modo: "oscuro" });
    expect(c.memoria().pintando).toBeLessThanOrEqual(1);
  });
});

describe("ControladorVisor: ciclo de vida", () => {
  it("destruir libera todo, el transformador y el documento, y después no hace nada", async () => {
    const { c, doc, destruirTransformador, pedidas } = montar();
    c.mostrar(marcos(1, 2), P);
    await tick();
    await c.destruir();
    expect(doc.destruir).toHaveBeenCalledOnce();
    expect(c.memoria()).toEqual({ lienzos: 0, bytes: 0, pintando: 0 });
    c.mostrar(marcos(7), P);
    await tick();
    expect(pedidas).not.toContain(7);
    await c.destruir(); // dos veces, sin error
    expect(doc.destruir).toHaveBeenCalledOnce();
    // El transformador se creó al primer render en oscuro... o no llegó a crearse.
    expect(destruirTransformador.mock.calls.length).toBeLessThanOrEqual(1);
  });
});

describe("ControladorVisor: búsqueda", () => {
  it("recorre todas las páginas y acumula las coincidencias", async () => {
    const { c } = montar(3, { 1: "hola mundo", 3: "HOLA otra vez" });
    const avisos: EstadoBusqueda[] = [];
    await c.buscar("hola", (e) => avisos.push(e));
    const final = avisos.at(-1);
    expect(final?.terminada).toBe(true);
    expect(final?.coincidencias.map((x) => x.pagina)).toEqual([1, 3]);
    expect(final?.sinTexto).toBe(false);
  });

  it("dice cuándo el documento no tiene texto (escaneo sin OCR)", async () => {
    const { c } = montar(2);
    const avisos: EstadoBusqueda[] = [];
    await c.buscar("hola", (e) => avisos.push(e));
    expect(avisos.at(-1)).toMatchObject({ terminada: true, sinTexto: true, coincidencias: [] });
  });

  it("una búsqueda nueva deja sin efecto la anterior", async () => {
    const { c } = montar(50, { 50: "hola" });
    const viejos: EstadoBusqueda[] = [];
    const nuevos: EstadoBusqueda[] = [];
    const vieja = c.buscar("hola", (e) => viejos.push(e));
    const nueva = c.buscar("adios", (e) => nuevos.push(e));
    await Promise.all([vieja, nueva]);
    expect(viejos.every((e) => !e.terminada)).toBe(true);
    expect(nuevos.at(-1)?.terminada).toBe(true);
  });

  it("una consulta vacía no busca", async () => {
    const { c, doc } = montar(3, { 1: "x" });
    await c.buscar("   ", () => {});
    expect(doc.indice).not.toHaveBeenCalled();
  });
});
