import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { project, siteUrl } from "@/config/project";
import { PAGINAS_PUBLICAS, robotsTxt, sitemapXml } from "@/config/public-site";
import { comprobarIdentidad } from "../../scripts/lib/identidad.mjs";
import { crearProyecto, PROYECTO } from "../_fixtures/proyecto";

const REPO = process.cwd();

/** Lo que tiene que ser verdad en ESTE repo. */
describe("configuración de este proyecto", () => {
  it("la identidad de project.ts coincide con package.json y public_docs/", () => {
    expect(comprobarIdentidad({ raizRepo: REPO, proyecto: project })).toEqual([]);
  });

  it("el dominio es el oficial (D5) y el de ejemplo no vuelve a la configuración pública", () => {
    // Fase 15. Lo que se publica o se sincroniza con el Docusaurus, además de project.ts.
    expect(siteUrl()).toBe("https://bpdf.r3zon.com");
    const publicos = [
      "src/config/project.ts",
      "src/config/public-site.ts",
      "index.html",
      "vercel.json",
      ...readdirSync(path.join(REPO, "public_docs"), { recursive: true, encoding: "utf8" })
        .filter((f) => /\.(md|json)$/.test(f))
        .map((f) => path.join("public_docs", f)),
    ];
    for (const rel of publicos) {
      expect(readFileSync(path.join(REPO, rel), "utf8"), rel).not.toMatch(/\bexample\.com/);
    }
    expect(robotsTxt() + sitemapXml()).not.toMatch(/example\./);
    expect(robotsTxt()).toContain("Sitemap: https://");
    expect(sitemapXml()).not.toMatch(/<loc>http:/);
  });

  it("robots.txt y sitemap.xml salen del dominio de project.ts, con fechas literales", () => {
    expect(robotsTxt()).toContain(`Sitemap: ${siteUrl()}/sitemap.xml`);
    for (const { path, lastModified } of PAGINAS_PUBLICAS) {
      expect(lastModified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(sitemapXml()).toContain(`<loc>${siteUrl()}${path}</loc><lastmod>${lastModified}`);
    }
  });
});

describe("comprobarIdentidad detecta", () => {
  let p: ReturnType<typeof crearProyecto>;
  const errores = (cambios: Partial<typeof PROYECTO> = {}) =>
    comprobarIdentidad({ raizRepo: p.raiz, proyecto: { ...PROYECTO, ...cambios } }).join("\n");
  afterEach(() => p.borrar());

  it("nada en un proyecto coherente", () => {
    p = crearProyecto();
    expect(errores()).toBe("");
  });

  it.each([
    ["el nombre", { name: "Otro" }, /softwareApplication\.name[\s\S]*index\.md/],
    ["el slug", { slug: "otro-slug" }, /package\.json[\s\S]*sitioDocumentacion/],
    ["la descripción", { description: "Otra." }, /softwareApplication\.description/],
    ["el dominio", { domain: "otro.test" }, /sitioProducto[\s\S]*ids\.[\s\S]*rutas-app\.json/],
    ["la organización", { organization: "Otra" }, /organization\.name/],
    ["el idioma", { locale: "en-GB" }, /inLanguage/],
  ])("%s cambiado solo en project.ts", (_campo, cambios, patron) => {
    p = crearProyecto();
    expect(errores(cambios)).toMatch(patron);
  });

  it("un slug con mayúsculas o espacios", () => {
    p = crearProyecto();
    p.editar("package.json", PROYECTO.slug, "Mal Slug");
    expect(errores({ slug: "Mal Slug" })).toMatch(/minúsculas con guiones/);
  });
});
