import { describe, expect, it } from "vitest";
import { crearSlugger, idsCandidatos, slug, textoDe } from "@/markdown/toc";

describe("slug", () => {
  it.each([
    ["Instalación", "instalación"],
    ["Uso avanzado", "uso-avanzado"],
    ["¿Preguntas? ¡Frecuentes!", "preguntas-frecuentes"],
    ["API v2.0 (beta)", "api-v20-beta"],
    ["snake_case y guion-medio", "snake_case-y-guion-medio"],
    ["日本語の見出し", "日本語の見出し"],
    ["  espacios  ", "--espacios--"],
    ["<script>alert(1)</script>", "scriptalert1script"],
  ])("%j → %j", (texto, esperado) => {
    expect(slug(texto)).toBe(esperado);
  });
});

describe("crearSlugger", () => {
  it("prefija todos los ids con md-", () => {
    const s = crearSlugger();
    expect(s("location")).toBe("md-location");
    expect(s("__proto__")).toBe("md-__proto__");
    expect(s("contenido")).toBe("md-contenido");
  });

  it("numera los repetidos en orden, también si alguien escribió el sufijo a mano", () => {
    const s = crearSlugger();
    expect([s("Uso"), s("Uso"), s("Uso-1"), s("Uso"), s("uso")]).toEqual([
      "md-uso",
      "md-uso-1",
      "md-uso-1-1",
      "md-uso-2",
      "md-uso-3",
    ]);
  });

  it("un encabezado sin letras ni números recibe un nombre de reserva", () => {
    const s = crearSlugger();
    expect([s("!!!"), s(""), s("¿?")]).toEqual(["md-seccion", "md-seccion-1", "md-seccion-2"]);
  });

  it("es determinista: el mismo documento da los mismos ids", () => {
    const titulos = ["A", "B", "A", "C", "A"];
    const a = crearSlugger();
    const b = crearSlugger();
    expect(titulos.map(a)).toEqual(titulos.map(b));
  });
});

describe("textoDe", () => {
  it("junta el texto de un encabezado con formato, código e imágenes", () => {
    expect(
      textoDe({
        type: "heading",
        depth: 2,
        children: [
          { type: "inlineCode", value: "código" },
          { type: "text", value: " y " },
          { type: "emphasis", children: [{ type: "text", value: "énfasis" }] },
          { type: "image", url: "x.png", alt: " logo" },
          { type: "html", value: "<b>" },
        ],
      }),
    ).toBe("código y énfasis logo");
  });
});

describe("idsCandidatos", () => {
  it("un fragmento apunta al id con prefijo, y en minúsculas si no existe tal cual", () => {
    expect(idsCandidatos("Uso")).toEqual(["md-Uso", "md-uso"]);
    expect(idsCandidatos("uso")).toEqual(["md-uso"]);
  });

  it("un fragmento que ya lleva el prefijo (notas al pie) se prueba primero tal cual", () => {
    expect(idsCandidatos("md-fn-1")).toEqual(["md-fn-1", "md-md-fn-1"]);
  });

  it("nunca propone un id sin prefijo: un enlace no puede apuntar a la interfaz", () => {
    for (const f of ["contenido", "titulo-documento", "root", "#x"]) {
      expect(idsCandidatos(f).every((id) => id.startsWith("md-"))).toBe(true);
    }
  });
});
