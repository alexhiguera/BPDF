import { rmSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import {
  palabrasRespuestaCorta,
  pieEsperado,
  sinCodigo,
  tieneProcedimiento,
  validarPublicDocs,
} from "../scripts/lib/public-docs.mjs";
import { crearProyecto, HOY } from "./_fixtures/proyecto";

describe("public_docs/ del repo", () => {
  it("cumple el contrato con el repo de Docusaurus", () => {
    const hoy = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    const { errores } = validarPublicDocs({ raizRepo: process.cwd(), hoy });
    expect(errores).toEqual([]);
  });
});

/**
 * Cada caso parte de un proyecto ficticio válido (tests/_fixtures/proyecto.ts),
 * rompe UNA cosa y comprueba que el validador lo ve. No depende de la identidad
 * ni de las páginas de este repo: funciona igual en la plantilla y en cualquier
 * proyecto derivado.
 */
describe("el validador de public_docs", () => {
  let p: ReturnType<typeof crearProyecto>;
  const errores = () => validarPublicDocs({ raizRepo: p.raiz, hoy: HOY }).errores.join("\n");
  const GUIA = "public_docs/seccion/guia.md";

  afterEach(() => p.borrar());

  it("acepta el proyecto de referencia (si no, los demás casos no prueban nada)", () => {
    p = crearProyecto();
    expect(validarPublicDocs({ raizRepo: p.raiz, hoy: HOY }).errores).toEqual([]);
  });

  it("detecta una fecha futura", () => {
    p = crearProyecto();
    p.editar(GUIA, `date: ${HOY}`, "date: 2099-01-01");
    expect(errores()).toMatch(/está en el futuro/);
  });

  it("detecta una fecha que falta", () => {
    p = crearProyecto();
    p.editar(GUIA, /last_update:\n {2}date: .*\n {2}author: .*\n/, "");
    expect(errores()).toMatch(/falta `last_update.date`/);
  });

  it("detecta un campo que no está en el contrato universal", () => {
    p = crearProyecto();
    p.editar(GUIA, "  estado: publicado", "  estado: publicado\n  plan_minimo: basic");
    expect(errores()).toMatch(/`r3zon.plan_minimo` no está en el contrato universal/);
  });

  it("detecta un valor inválido", () => {
    p = crearProyecto();
    p.editar(GUIA, "tipo: guia", "tipo: tutorial");
    expect(errores()).toMatch(/`r3zon.tipo` ausente o inválido: tutorial/);
  });

  it("detecta un enlace roto y un enlace absoluto", () => {
    p = crearProyecto();
    p.editar(GUIA, "(../index.md)", "(../no-existe.md) y [otra](/seccion)");
    const e = errores();
    expect(e).toMatch(/enlace roto `..\/no-existe.md`/);
    expect(e).toMatch(/enlace absoluto `\/seccion`/);
  });

  it("detecta un app_url que no está en rutas-app.json", () => {
    p = crearProyecto();
    p.editar(GUIA, "app_url: /login", "app_url: /no-declarada");
    expect(errores()).toMatch(/`r3zon.app_url: \/no-declarada` no aparece/);
  });

  it("detecta una ruta de rutas-app.json que no existe en la app", () => {
    p = crearProyecto();
    p.editar(
      "public_docs/_meta/rutas-app.json",
      '"otras":{',
      '"otras":{"/ruta-inventada":{"label":"X"},',
    );
    expect(errores()).toMatch(/`\/ruta-inventada` no existe en la app/);
  });

  it("detecta un HowTo sin procedimiento", () => {
    p = crearProyecto();
    p.editar(GUIA, "## Cómo hacer algo, paso a paso", "## Los pasos");
    expect(errores()).toMatch(/`jsonld: HowTo` exige/);
  });

  it("detecta una página sin «Respuesta corta»", () => {
    p = crearProyecto();
    p.editar(GUIA, "**Respuesta corta.** ", "");
    expect(errores()).toMatch(/Respuesta corta/);
  });

  it("detecta sintaxis MDX", () => {
    p = crearProyecto();
    p.editar(GUIA, "## Qué tener en cuenta", '<Aviso tipo="x" />\n\n## Qué tener en cuenta');
    expect(errores()).toMatch(/sintaxis MDX/);
  });

  it("detecta un slug repetido", () => {
    p = crearProyecto();
    p.editar(GUIA, "slug: /seccion/guia", "slug: /");
    expect(errores()).toMatch(/`slug` \/ repetido/);
  });

  it("acepta un redirect hacia una página que existe", () => {
    p = crearProyecto();
    p.editar(
      "public_docs/_meta/redirects.json",
      '"redirects":[]',
      '"redirects":[{"de":"/guias/antigua","a":"/proyecto-prueba/seccion/guia"}]',
    );
    expect(errores()).toBe("");
  });

  it("detecta un redirect hacia una página que no existe", () => {
    p = crearProyecto();
    p.editar(
      "public_docs/_meta/redirects.json",
      '"redirects":[]',
      '"redirects":[{"de":"/guias/antigua","a":"/proyecto-prueba/no-existe"}]',
    );
    expect(errores()).toMatch(/"\/guias\/antigua" apunta a/);
  });

  // ── Fase 16: el contrato completo del hub ────────────────────────────────────

  it("detecta una «Respuesta corta» de más de 60 palabras", () => {
    p = crearProyecto();
    p.editar(GUIA, "Se hace así.", `Se hace así. ${"palabra ".repeat(60)}`);
    expect(errores()).toMatch(/la «Respuesta corta» tiene 63 palabras \(máximo 60/);
  });

  it("detecta una página sin pie, o con la fecha o la URL de otra", () => {
    p = crearProyecto();
    p.editar(GUIA, /> Fuente:[\s\S]*$/, "");
    expect(errores()).toMatch(/seccion\/guia\.md: debe terminar con el pie/);
    p.borrar();
    p = crearProyecto();
    p.editar(GUIA, "proyecto-prueba/seccion/guia", "proyecto-prueba/otra");
    expect(errores()).toMatch(/debe terminar con el pie/);
  });

  it("detecta una guía con secciones fuera de orden, renombradas o sin «Lo que no es evidente»", () => {
    p = crearProyecto();
    p.editar(GUIA, "## Qué tener en cuenta\n\nNada.\n\n", "");
    p.editar(GUIA, "## Qué leer después", "## Qué leer después\n\n## Qué tener en cuenta\n\nNada.");
    expect(errores()).toMatch(/«## Qué tener en cuenta» fuera de orden/);
    p.borrar();
    p = crearProyecto();
    p.editar(GUIA, "## Qué tener en cuenta", "## Consejos");
    expect(errores()).toMatch(/«## Consejos» no es una sección de guía/);
    p.borrar();
    p = crearProyecto();
    p.editar(GUIA, "## Lo que no es evidente\n\n- Un detalle.\n\n", "");
    expect(errores()).toMatch(/falta «## Lo que no es evidente»/);
    p.borrar();
    p = crearProyecto();
    p.editar(GUIA, "- Un detalle.", "");
    expect(errores()).toMatch(/«## Lo que no es evidente» está vacía/);
  });

  it("detecta un jsonld que no corresponde al tipo, y un FAQPage sin preguntas", () => {
    p = crearProyecto();
    p.editar(GUIA, "jsonld: HowTo", "jsonld: DefinedTermSet");
    expect(errores()).toMatch(/`jsonld: DefinedTermSet` no corresponde a `tipo: guia`/);
    p.borrar();
    p = crearProyecto();
    p.editar(GUIA, "jsonld: HowTo", "jsonld: FAQPage");
    expect(errores()).toMatch(/`jsonld: FAQPage` exige preguntas/);
  });

  it("detecta un id repetido o con otro formato", () => {
    p = crearProyecto();
    p.editar(GUIA, "slug: /seccion/guia", "id: portada\nslug: /seccion/guia");
    p.editar("public_docs/index.md", "slug: /", "id: portada\nslug: /");
    expect(errores()).toMatch(/`id` portada repetido/);
    p.borrar();
    p = crearProyecto();
    p.editar(GUIA, "slug: /seccion/guia", "id: Mi Guía\nslug: /seccion/guia");
    expect(errores()).toMatch(/`id` debe ir en minúsculas con guiones/);
  });

  it("detecta una sección sin `_category_.json` y la falta de identidad-visual.md", () => {
    p = crearProyecto();
    rmSync(p.ruta("public_docs/seccion/_category_.json"));
    rmSync(p.ruta("public_docs/_meta/identidad-visual.md"));
    const e = errores();
    expect(e).toMatch(/seccion\/_category_\.json: falta/);
    expect(e).toMatch(/_meta\/identidad-visual\.md: falta/);
  });
});

describe("sinCodigo", () => {
  it("quita el código en línea y los bloques con valla: sus ejemplos no son enlaces", () => {
    const texto =
      "Escribe `![Plano](images/plano.png)`.\n\n```md\n[x](otro.png)\n```\n\n[real](a.md)";
    expect(sinCodigo(texto)).not.toMatch(/plano\.png|otro\.png/);
    expect(sinCodigo(texto)).toContain("[real](a.md)");
  });

  it("y el validador no da por roto un enlace de ejemplo dentro de código", () => {
    const p = crearProyecto();
    try {
      p.editar(
        "public_docs/seccion/guia.md",
        "Nada.",
        "Escribe `![Plano](images/plano.png)` y verás la imagen.",
      );
      expect(validarPublicDocs({ raizRepo: p.raiz, hoy: HOY }).errores).toEqual([]);
    } finally {
      p.borrar();
    }
  });
});

describe("palabrasRespuestaCorta y pieEsperado", () => {
  it("cuenta solo el primer párrafo, sin la etiqueta ni la puntuación suelta", () => {
    expect(palabrasRespuestaCorta("**Respuesta corta.** Uno dos — tres.\n\nCuatro cinco.")).toBe(3);
  });

  it("une la URL de la documentación y el slug sin barras dobles", () => {
    const base = { producto: "P", organizacion: "O", fecha: "2026-10-04" };
    expect(pieEsperado({ ...base, sitioDocumentacion: "https://d.test/p/", slug: "/" })).toBe(
      "> Fuente: documentación oficial de P (O). Actualizado el 2026-10-04.\n> https://d.test/p/",
    );
    expect(pieEsperado({ ...base, sitioDocumentacion: "https://d.test/p", slug: "/a/b" })).toMatch(
      /> https:\/\/d\.test\/p\/a\/b$/,
    );
  });
});

describe("tieneProcedimiento", () => {
  it("exige lista ORDENADA bajo un «## Cómo …»", () => {
    expect(tieneProcedimiento("## Cómo hacerlo\n\n1. Uno\n2. Dos")).toBe(true);
    expect(tieneProcedimiento("## Cómo hacerlo\n\n- Uno\n- Dos")).toBe(false);
    expect(tieneProcedimiento("## Otra cosa\n\n1. Uno")).toBe(false);
  });
});
