import { afterEach, describe, expect, it } from "vitest";
import { generarWiki } from "../scripts/lib/wiki.mjs";
import { project } from "../src/config/project";
import { crearProyecto } from "./_fixtures/proyecto";

const REPO = "https://github.com/ejemplo/proyecto";

describe("generarWiki (Fase 16)", () => {
  let p: ReturnType<typeof crearProyecto>;
  afterEach(() => p?.borrar());

  it("una página por página publicable, la portada como Home, sin frontmatter ni los no publicados", () => {
    p = crearProyecto();
    const wiki = generarWiki({ raizRepo: p.raiz, repositorio: REPO });
    expect([...wiki.keys()].sort()).toEqual(["Home.md", "_Footer.md", "_Sidebar.md", "guia.md"]);
    const guia = wiki.get("guia.md") ?? "";
    expect(guia).not.toMatch(/^---|r3zon:/m);
    expect(guia).toMatch(/^<!-- Generado desde public_docs\/seccion\/guia\.md/);
    expect(guia).toContain("**Respuesta corta.**");
    // El pie sigue apuntando a la URL canónica de la documentación.
    expect(guia).toContain("> https://docs.r3zon.com/proyecto-prueba/seccion/guia");
  });

  it("reescribe los enlaces internos al nombre de la página de la Wiki, con su ancla", () => {
    p = crearProyecto();
    p.editar("public_docs/index.md", "[Guía](seccion/guia.md)", "[Guía](seccion/guia.md#pasos)");
    const wiki = generarWiki({ raizRepo: p.raiz, repositorio: REPO });
    expect(wiki.get("Home.md")).toContain("[Guía](guia#pasos)");
    expect(wiki.get("guia.md")).toContain("[Portada](Home)");
    // Lo externo y lo que no es una página se queda como está.
    p.editar("public_docs/index.md", "[Guía]", "[Web](https://example.test/a.md) y [Guía]");
    expect(generarWiki({ raizRepo: p.raiz, repositorio: REPO }).get("Home.md")).toContain(
      "[Web](https://example.test/a.md)",
    );
  });

  it("la barra lateral sigue las secciones de _category_.json y el pie enlaza a la fuente", () => {
    p = crearProyecto();
    const wiki = generarWiki({ raizRepo: p.raiz, repositorio: REPO });
    expect(wiki.get("_Sidebar.md")).toMatch(/\*\*Sección\*\*\n\n- \[Cómo hacer algo\]\(guia\)/);
    expect(wiki.get("_Footer.md")).toContain(`${REPO}/tree/main/public_docs`);
  });

  it("falla si dos páginas darían el mismo nombre en la Wiki", () => {
    p = crearProyecto();
    p.escribir("public_docs/otra/guia.md", "---\nslug: /otra/guia\n---\n\nx\n");
    expect(() => generarWiki({ raizRepo: p.raiz, repositorio: REPO })).toThrow(
      /misma de la Wiki: guia/,
    );
  });

  it("con el public_docs/ de este repo: todas las páginas, y ningún enlace .md sin reescribir", () => {
    const wiki = generarWiki({ raizRepo: process.cwd(), repositorio: project.repositoryUrl });
    expect(wiki.has("Home.md")).toBe(true);
    expect(wiki.size).toBeGreaterThan(30);
    for (const [nombre, texto] of wiki) {
      // Ejemplos de sintaxis aparte (van entre comillas invertidas), ningún enlace a un .md.
      expect(texto.replace(/`[^`\n]*`/g, ""), nombre).not.toMatch(/\]\([^)]*\.md(#[^)]*)?\)/);
    }
  });
});
