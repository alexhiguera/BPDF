import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

/**
 * Proyecto mínimo y AUTOCONTENIDO para probar los validadores.
 *
 * No copia nada del repo: si los tests dependieran del dominio, el nombre o las
 * páginas de la plantilla, se romperían en cuanto un proyecto derivado los
 * personalizara (pasó: auditoría final, B1). Aquí la identidad es la de un
 * producto ficticio y el repo real se valida aparte, con sus propios valores.
 */
export type Identidad = Record<
  "name" | "slug" | "description" | "domain" | "organization" | "locale",
  string
>;

export const PROYECTO: Readonly<Identidad> = {
  name: "Proyecto Prueba",
  slug: "proyecto-prueba",
  description: "Descripción de prueba.",
  domain: "app.prueba.test",
  organization: "Organización Prueba",
  locale: "es-ES",
};

export const HOY = "2026-09-23";

const APP = `https://${PROYECTO.domain}`;
const DOCS = `https://docs.r3zon.com/${PROYECTO.slug}`;

/** El pie de cada página (CONVENCIONES §6), con la fecha del fixture. */
export const pie = (slug: string) =>
  `> Fuente: documentación oficial de ${PROYECTO.name} (${PROYECTO.organization}). Actualizado el ${HOY}.\n> ${DOCS}${slug}`;

function pagina(fm: string, cuerpo: string): string {
  return `---\n${fm.trim()}\n---\n\n${cuerpo.trim()}\n`;
}

const FICHEROS: Record<string, string> = {
  "package.json": JSON.stringify({ name: PROYECTO.slug, version: "0.1.0" }),
  // Páginas como las sirve una build de Vite: las dos formas de rutaExisteEnApp.
  "index.html": "",
  "login/index.html": "",
  "inicio.html": "",
  "public_docs/README.md": "# Contrato\n",
  "public_docs/CONVENCIONES.md": "# Convenciones\n",
  "public_docs/_meta/entidad.json": JSON.stringify({
    sitioProducto: APP,
    sitioDocumentacion: DOCS,
    ids: {
      organization: `${APP}/#organization`,
      website: `${APP}/#website`,
      softwareApplication: `${APP}/#software`,
    },
    organization: { "@id": `${APP}/#organization`, name: PROYECTO.organization },
    softwareApplication: {
      "@id": `${APP}/#software`,
      name: PROYECTO.name,
      description: PROYECTO.description,
      inLanguage: PROYECTO.locale,
    },
  }),
  "public_docs/_meta/rutas-app.json": JSON.stringify({
    base: APP,
    modulos: {},
    otras: { "/inicio": { label: "Inicio" } },
    publicas: { "/": { label: "Portada" }, "/login": { label: "Acceder" } },
  }),
  "public_docs/_meta/redirects.json": JSON.stringify({ redirects: [] }),
  "public_docs/_meta/identidad-visual.md": "# Identidad visual\n",
  "public_docs/seccion/_category_.json": JSON.stringify({ label: "Sección", position: 1 }),
  "public_docs/index.md": pagina(
    `
title: "Documentación de ${PROYECTO.name}"
slug: /
description: "Portada."
last_update:
  date: ${HOY}
r3zon:
  tipo: indice
  jsonld: TechArticle
  estado: publicado
  app_url: /`,
    `**Respuesta corta.** Portada.\n\n[Guía](seccion/guia.md)\n\n${pie("/")}`,
  ),
  "public_docs/seccion/guia.md": pagina(
    `
title: "Cómo hacer algo"
slug: /seccion/guia
description: "Guía."
last_update:
  date: ${HOY}
  author: Equipo
r3zon:
  tipo: guia
  jsonld: HowTo
  estado: publicado
  app_url: /login`,
    `**Respuesta corta.** Se hace así.

## Cómo hacer algo, paso a paso

1. Primero.
2. Después.

## Qué tener en cuenta

Nada.

## Lo que no es evidente

- Un detalle.

## Qué leer después

- [Portada](../index.md)

${pie("/seccion/guia")}`,
  ),
};

/** Crea el proyecto en un temporal y devuelve helpers para romperlo de una en una. */
export function crearProyecto() {
  const raiz = mkdtempSync(path.join(tmpdir(), "proyecto-prueba-"));
  for (const [rel, contenido] of Object.entries(FICHEROS)) {
    mkdirSync(path.dirname(path.join(raiz, rel)), { recursive: true });
    writeFileSync(path.join(raiz, rel), contenido);
  }
  return {
    raiz,
    ruta: (rel: string) => path.join(raiz, rel),
    /** Sustituye en un fichero; falla si el texto no está, para que el test no mienta. */
    editar(rel: string, de: string | RegExp, a: string) {
      const f = path.join(raiz, rel);
      const antes = readFileSync(f, "utf8");
      const despues = antes.replace(de, a);
      if (despues === antes) throw new Error(`El fixture ${rel} no contiene ${String(de)}`);
      writeFileSync(f, despues);
    },
    escribir(rel: string, contenido: string) {
      mkdirSync(path.dirname(path.join(raiz, rel)), { recursive: true });
      writeFileSync(path.join(raiz, rel), contenido);
    },
    borrar: () => rmSync(raiz, { recursive: true, force: true }),
  };
}
