// =============================================================================
// Identidad del proyecto: ¿dicen lo mismo todos los ficheros que la repiten?
// =============================================================================
// `src/config/project.ts` es la fuente. Estos ficheros no pueden importarlo y
// repiten parte de sus valores:
//
//   package.json                   name            = slug
//   public_docs/_meta/entidad.json dominio, nombre, descripción, idioma,
//                                  organización y ruta de docs (/<slug>)
//   public_docs/_meta/rutas-app.json  base          = https://<dominio>
//   public_docs/index.md           title contiene el nombre
//
// Si divergen, el JSON-LD de la documentación declara un producto distinto del
// de la app. Funciones puras: el proyecto llega por parámetro (tests con
// fixtures; el script lo importa de project.ts, que Node 24 ejecuta sin
// compilar).
// =============================================================================

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { separarFrontmatter } from "./public-docs.mjs";

/** @typedef {{ name: string, slug: string, description: string, domain: string, organization: string, locale: string }} Proyecto */

function leerJson(ruta) {
  try {
    return JSON.parse(readFileSync(ruta, "utf8"));
  } catch {
    return null;
  }
}

/**
 * @param {{ raizRepo: string, proyecto: Proyecto }} p
 * @returns {string[]} errores
 */
export function comprobarIdentidad({ raizRepo, proyecto }) {
  const errores = [];
  const err = (fichero, campo, real, esperado) =>
    errores.push(
      `${fichero}: ${campo} es ${JSON.stringify(real)} y src/config/project.ts dice ${JSON.stringify(esperado)}`,
    );
  const r = (rel) => path.join(raizRepo, rel);

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(proyecto.slug)) {
    errores.push(
      `src/config/project.ts: slug ${JSON.stringify(proyecto.slug)} debe ir en minúsculas con guiones`,
    );
  }

  const pkg = leerJson(r("package.json"));
  if (pkg && pkg.name !== proyecto.slug) err("package.json", "name", pkg.name, proyecto.slug);

  const entidad = leerJson(r("public_docs/_meta/entidad.json"));
  if (entidad) {
    const f = "public_docs/_meta/entidad.json";
    const app = `https://${proyecto.domain}`;
    if (entidad.sitioProducto !== app) err(f, "sitioProducto", entidad.sitioProducto, app);
    for (const [k, id] of Object.entries(entidad.ids ?? {})) {
      if (typeof id !== "string" || !id.startsWith(`${app}/#`)) {
        err(f, `ids.${k}`, id, `${app}/#${k === "softwareApplication" ? "software" : k}`);
      }
    }
    let rutaDocs = null;
    try {
      rutaDocs = new URL(entidad.sitioDocumentacion).pathname.replace(/\/$/, "");
    } catch {
      // URL inválida: la reporta validarPublicDocs.
    }
    if (rutaDocs !== `/${proyecto.slug}`) {
      err(f, "la ruta de sitioDocumentacion", rutaDocs, `/${proyecto.slug}`);
    }
    const sw = entidad.softwareApplication ?? {};
    if (sw.name !== proyecto.name) err(f, "softwareApplication.name", sw.name, proyecto.name);
    if (sw.description !== proyecto.description) {
      err(f, "softwareApplication.description", sw.description, proyecto.description);
    }
    if (sw.inLanguage !== proyecto.locale) {
      err(f, "softwareApplication.inLanguage", sw.inLanguage, proyecto.locale);
    }
    if (entidad.organization?.name !== proyecto.organization) {
      err(f, "organization.name", entidad.organization?.name, proyecto.organization);
    }
  }

  const rutasApp = leerJson(r("public_docs/_meta/rutas-app.json"));
  if (rutasApp && rutasApp.base !== `https://${proyecto.domain}`) {
    err("public_docs/_meta/rutas-app.json", "base", rutasApp.base, `https://${proyecto.domain}`);
  }

  if (existsSync(r("public_docs/index.md"))) {
    const titulo = separarFrontmatter(readFileSync(r("public_docs/index.md"), "utf8"))?.datos
      ?.title;
    if (typeof titulo !== "string" || !titulo.includes(proyecto.name)) {
      errores.push(
        `public_docs/index.md: el title ${JSON.stringify(titulo)} no nombra el producto (${JSON.stringify(proyecto.name)})`,
      );
    }
  }

  return errores;
}
