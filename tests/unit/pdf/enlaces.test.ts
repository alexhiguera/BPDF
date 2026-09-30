import { describe, expect, it, vi } from "vitest";
import {
  type AnotacionPdf,
  cajaDe,
  type ResolutorDestinos,
  resolverEnlace,
  urlPermitida,
} from "@/pdf/visor/enlaces";

/**
 * Política de enlaces de un PDF. El contenido es hostil (CLAUDE.md §5): corpus
 * de URLs maliciosas y malformadas que nunca deben llegar a abrirse.
 */
describe("urlPermitida", () => {
  it.each([
    "https://example.com/",
    "http://example.com/a?b=c#d",
    "mailto:alguien@example.com",
    "HTTPS://EXAMPLE.COM/x",
  ])("permite %s", (url) => {
    expect(urlPermitida(url)).not.toBeNull();
  });

  it.each([
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "blob:https://example.com/uuid",
    "vbscript:msgbox(1)",
    "ftp://example.com/",
    "tel:+34600000000",
    "/ruta/relativa",
    "../otra",
    "#ancla",
    "example.com",
    "https://usuario:clave@example.com/",
    "http://",
    "",
    `https://example.com/${"a".repeat(3000)}`,
  ])("rechaza %s", (url) => {
    expect(urlPermitida(url)).toBeNull();
  });

  it("rechaza lo que no es texto", () => {
    expect(urlPermitida(undefined)).toBeNull();
    expect(urlPermitida({ toString: () => "https://example.com" })).toBeNull();
  });
});

function documento(): ResolutorDestinos {
  return {
    numPages: 10,
    getDestination: vi.fn(async (nombre: string) =>
      nombre === "anexo" ? [{ num: 50, gen: 0 }, { name: "Fit" }] : null,
    ),
    getPageIndex: vi.fn(async (ref: { num: number }) => {
      if (ref.num === 50) return 8;
      throw new Error("referencia rota");
    }),
  };
}

const link = (a: Omit<AnotacionPdf, "subtype">): AnotacionPdf => ({
  subtype: "Link",
  rect: [0, 0, 10, 10],
  ...a,
});

describe("resolverEnlace", () => {
  it("un enlace externo permitido se abre fuera, normalizado", async () => {
    expect(await resolverEnlace(link({ url: "https://example.com" }), documento(), 1)).toEqual({
      tipo: "externo",
      url: "https://example.com/",
    });
  });

  it("un enlace javascript: (o cualquier otro no permitido) no es un enlace", async () => {
    expect(await resolverEnlace(link({ url: "javascript:alert(1)" }), documento(), 1)).toBeNull();
    expect(await resolverEnlace(link({ url: "file:///etc/passwd" }), documento(), 1)).toBeNull();
  });

  it("un destino explícito con referencia de página va a esa página", async () => {
    const d = documento();
    expect(
      await resolverEnlace(link({ dest: [{ num: 50, gen: 0 }, { name: "XYZ" }] }), d, 1),
    ).toEqual({ tipo: "interno", pagina: 9 });
  });

  it("un destino explícito con índice de página también", async () => {
    expect(await resolverEnlace(link({ dest: [2, { name: "Fit" }] }), documento(), 1)).toEqual({
      tipo: "interno",
      pagina: 3,
    });
  });

  it("un destino con nombre se busca en el documento", async () => {
    expect(await resolverEnlace(link({ dest: "anexo" }), documento(), 1)).toEqual({
      tipo: "interno",
      pagina: 9,
    });
  });

  it("un destino inexistente, roto o fuera del documento no es un enlace", async () => {
    const d = documento();
    expect(await resolverEnlace(link({ dest: "no-existe" }), d, 1)).toBeNull();
    expect(await resolverEnlace(link({ dest: [{ num: 99, gen: 0 }] }), d, 1)).toBeNull();
    expect(await resolverEnlace(link({ dest: [42] }), d, 1)).toBeNull();
    expect(await resolverEnlace(link({ dest: [-3] }), d, 1)).toBeNull();
    expect(await resolverEnlace(link({ dest: [{ num: "x" }] }), d, 1)).toBeNull();
  });

  it("las acciones de página siguiente/anterior/primera/última funcionan dentro del documento", async () => {
    const d = documento();
    expect(await resolverEnlace(link({ action: "NextPage" }), d, 4)).toEqual({
      tipo: "interno",
      pagina: 5,
    });
    expect(await resolverEnlace(link({ action: "PrevPage" }), d, 4)).toEqual({
      tipo: "interno",
      pagina: 3,
    });
    expect(await resolverEnlace(link({ action: "FirstPage" }), d, 4)).toEqual({
      tipo: "interno",
      pagina: 1,
    });
    expect(await resolverEnlace(link({ action: "LastPage" }), d, 4)).toEqual({
      tipo: "interno",
      pagina: 10,
    });
    expect(await resolverEnlace(link({ action: "NextPage" }), d, 10)).toBeNull();
  });

  it("otras acciones con nombre (imprimir, buscar…) y otras anotaciones se ignoran", async () => {
    const d = documento();
    expect(await resolverEnlace(link({ action: "Print" }), d, 1)).toBeNull();
    expect(
      await resolverEnlace({ subtype: "Widget", url: "https://example.com" }, d, 1),
    ).toBeNull();
    expect(await resolverEnlace(link({}), d, 1)).toBeNull();
  });
});

describe("cajaDe", () => {
  const identidad = (r: number[]) => r;
  const limite = { ancho: 100, alto: 100 };

  it("normaliza el rectángulo (esquinas en cualquier orden)", () => {
    expect(cajaDe([50, 40, 10, 20], identidad, limite)).toEqual({
      izquierda: 10,
      arriba: 20,
      ancho: 40,
      alto: 20,
    });
  });

  it("recorta a la página y descarta lo que no tiene área o no es un rectángulo", () => {
    expect(cajaDe([-10, -10, 20, 20], identidad, limite)).toEqual({
      izquierda: 0,
      arriba: 0,
      ancho: 20,
      alto: 20,
    });
    expect(cajaDe([5, 5, 5, 50], identidad, limite)).toBeNull();
    expect(cajaDe([200, 200, 300, 300], identidad, limite)).toBeNull();
    expect(cajaDe([0, 0, Number.NaN, 5], identidad, limite)).toBeNull();
    expect(cajaDe("no", identidad, limite)).toBeNull();
    expect(cajaDe([1, 2, 3], identidad, limite)).toBeNull();
  });
});
