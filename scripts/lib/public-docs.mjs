// =============================================================================
// Validación de `public_docs/` — el contrato con el repo de Docusaurus
// =============================================================================
// Lógica pura (lee disco, no sale del proceso) para poder probarla con
// fixtures: tests/public-docs.test.ts. El script `validar-public-docs.mjs` solo
// la llama e imprime.
//
// Por qué existe: en Markdown no avisa ningún compilador. El repo de
// Docusaurus rompe su build con un frontmatter inválido o un enlace roto, pero
// eso ocurre en OTRO repo, días después y lejos de quien escribió la página.
// Aquí se caza en el commit que lo introduce. El contrato completo está en
// public_docs/README.md; cada regla de abajo cita su apartado.
// =============================================================================

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parse as parseYaml } from "yaml";

/** Ficheros para quien mantiene la documentación: no se publican (§1). */
export const NO_PUBLICADOS = new Set(["README.md", "CONVENCIONES.md"]);

export const FICHEROS_OBLIGATORIOS = [
  "README.md",
  "CONVENCIONES.md",
  "index.md",
  "_meta/entidad.json",
  "_meta/rutas-app.json",
  "_meta/redirects.json",
  "_meta/identidad-visual.md",
];

/** Máximo de palabras de la «Respuesta corta» (CONVENCIONES §2: un motor cita las primeras 40-60). */
export const MAX_PALABRAS_RESPUESTA = 60;

/**
 * Los `##` de una guía, en su orden (CONVENCIONES §3): se pueden omitir, no reordenar ni
 * renombrar, porque el Docusaurus deriva el JSON-LD de esta estructura.
 */
export const SECCIONES_GUIA = [
  { nombre: "Qué necesitas antes de empezar", patron: /^Qué necesitas antes de empezar$/ },
  { nombre: "Cómo …, paso a paso", patron: /^Cómo .+, paso a paso$/ },
  { nombre: "Qué tener en cuenta", patron: /^Qué tener en cuenta$/ },
  { nombre: "Lo que no es evidente", patron: /^Lo que no es evidente$/ },
  { nombre: "Preguntas frecuentes sobre …", patron: /^Preguntas frecuentes sobre .+$/ },
  { nombre: "Qué leer después", patron: /^Qué leer después$/ },
];

/** Con qué `r3zon.tipo` tiene sentido cada `r3zon.jsonld` (§6); los que no están, con cualquiera. */
const TIPOS_DE_JSONLD = {
  HowTo: new Set(["guia", "caso-uso"]),
  DefinedTermSet: new Set(["glosario"]),
};

/** Palabras de la «Respuesta corta»: el primer párrafo, sin la etiqueta. */
export function palabrasRespuestaCorta(cuerpo) {
  const parrafo = cuerpo.trimStart().split(/\n\s*\n/)[0] ?? "";
  return parrafo
    .replace("**Respuesta corta.**", "")
    .split(/\s+/)
    .filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
}

/**
 * Las dos líneas con que acaba cada página (CONVENCIONES §6): de quién es la documentación,
 * su fecha (la de `last_update.date`) y su URL publicada (`sitioDocumentacion` + `slug`).
 */
export function pieEsperado({ producto, organizacion, fecha, sitioDocumentacion, slug }) {
  return [
    `> Fuente: documentación oficial de ${producto} (${organizacion}). Actualizado el ${fecha}.`,
    `> ${sitioDocumentacion.replace(/\/$/, "")}${slug}`,
  ].join("\n");
}

/** Problemas de estructura de una guía (CONVENCIONES §3). */
export function problemasDeGuia(cuerpo) {
  const problemas = [];
  const lineas = cuerpo.split("\n");
  let ultimo = -1;
  const vistas = new Set();
  for (let i = 0; i < lineas.length; i++) {
    const m = /^##\s+(.+?)\s*$/.exec(lineas[i]);
    if (!m) continue;
    const indice = SECCIONES_GUIA.findIndex((s) => s.patron.test(m[1]));
    if (indice < 0) {
      problemas.push(`«## ${m[1]}» no es una sección de guía (CONVENCIONES §3)`);
      continue;
    }
    if (indice <= ultimo) problemas.push(`«## ${m[1]}» fuera de orden (CONVENCIONES §3)`);
    ultimo = Math.max(ultimo, indice);
    vistas.add(indice);
    if (indice === 3) {
      let contenido = false;
      for (let j = i + 1; j < lineas.length && !/^##\s/.test(lineas[j]); j++) {
        if (lineas[j].trim() && !lineas[j].startsWith(">")) contenido = true;
      }
      if (!contenido) problemas.push("«## Lo que no es evidente» está vacía");
    }
  }
  if (!vistas.has(1)) problemas.push("falta «## Cómo …, paso a paso» (CONVENCIONES §3)");
  if (!vistas.has(3)) problemas.push("falta «## Lo que no es evidente» (CONVENCIONES §3)");
  return problemas;
}

/** Valores válidos del contrato universal (§5). */
export const TIPOS = new Set([
  "guia",
  "concepto",
  "faq",
  "problema",
  "referencia",
  "caso-uso",
  "glosario",
  "indice",
]);
export const JSONLD = new Set([
  "HowTo",
  "FAQPage",
  "TechArticle",
  "DefinedTermSet",
  "Article",
  "none",
]);
export const ESTADOS = new Set(["publicado", "proximamente"]);

/** Claves permitidas: cualquier otra es un error, para que el contrato no crezca en silencio. */
export const CLAVES_RAIZ = new Set([
  "id",
  "title",
  "sidebar_label",
  "sidebar_position",
  "slug",
  "description",
  "keywords",
  "tags",
  "last_update",
  "r3zon",
]);
export const CLAVES_R3ZON = new Set(["tipo", "jsonld", "estado", "intencion", "app_url", "origen"]);
export const CLAVES_LAST_UPDATE = new Set(["date", "author"]);

/** Encabezados que no dicen nada de lo que hay debajo (CONVENCIONES §2). */
const ENCABEZADOS_PROHIBIDOS = /^##\s+(introducci[oó]n|consideraciones|notas|resumen)\s*$/im;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Separa frontmatter YAML y cuerpo. */
export function separarFrontmatter(texto) {
  const m = texto.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  return { datos: parseYaml(m[1], { schema: "core" }) ?? {}, cuerpo: m[2] };
}

/** `YYYY-MM-DD` de un valor de YAML (que puede llegar como Date). */
function comoFecha(valor) {
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return typeof valor === "string" ? valor : null;
}

function fechaValida(texto) {
  if (!FECHA.test(texto)) return false;
  const d = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texto;
}

/** Recorre el árbol y devuelve rutas relativas (con `/`) de los `.md` y `.mdx`. */
function listarMarkdown(raiz, rel = "") {
  const salida = [];
  for (const nombre of readdirSync(path.join(raiz, rel))) {
    const relHijo = rel ? `${rel}/${nombre}` : nombre;
    if (statSync(path.join(raiz, relHijo)).isDirectory()) {
      if (nombre.startsWith("_")) continue; // `_meta/` y compañía: no son páginas (§1).
      salida.push(...listarMarkdown(raiz, relHijo));
    } else if (/\.mdx?$/.test(nombre)) {
      salida.push(relHijo);
    }
  }
  return salida.sort();
}

/**
 * Enlaces Markdown `[texto](destino)`, equilibrando paréntesis: una ruta como
 * `../src/app/(app)/x` corta un regex ingenuo en el primer `)`.
 */
export function enlacesDe(texto) {
  const salida = [];
  for (let i = 0; i < texto.length - 1; i++) {
    if (texto[i] !== "]" || texto[i + 1] !== "(") continue;
    let profundidad = 1;
    let j = i + 2;
    while (j < texto.length && profundidad > 0) {
      if (texto[j] === "(") profundidad++;
      else if (texto[j] === ")") profundidad--;
      if (profundidad > 0) j++;
    }
    if (profundidad !== 0) continue;
    salida.push({
      destino: texto
        .slice(i + 2, j)
        .split(/\s+"/)[0]
        .trim(),
      indice: i,
    });
    i = j;
  }
  return salida;
}

/**
 * El cuerpo sin código: bloques con valla y código en línea. Un ejemplo como
 * `` `![Plano](images/plano.png)` `` no es un enlace de la página, y Docusaurus tampoco
 * lo trata como tal.
 */
export function sinCodigo(texto) {
  return texto
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*$/gm, "")
    .replace(/`+[^`\n]*`+/g, "");
}

/** ¿Tiene la página un `## Cómo …` con lista ORDENADA debajo? (lo exige el HowTo, §6.1) */
export function tieneProcedimiento(cuerpo) {
  const lineas = cuerpo.split("\n");
  for (let i = 0; i < lineas.length; i++) {
    if (!/^##\s+C[oó]mo\b/i.test(lineas[i])) continue;
    for (let j = i + 1; j < lineas.length && !/^##\s/.test(lineas[j]); j++) {
      if (/^\d+\.\s/.test(lineas[j])) return true;
    }
  }
  return false;
}

/**
 * ¿Existe la ruta en la app? La app es una build estática de Vite sin fallback
 * de SPA (`appType: "mpa"` en vite.config.ts): una ruta existe si hay un HTML de
 * entrada que la sirva. `/` → `index.html`; `/x` → `x.html` o `x/index.html`,
 * relativos a la raíz del repo.
 */
export function rutaExisteEnApp(raizRepo, ruta) {
  const objetivo = ruta.replace(/[?#].*$/, "").replace(/^\/|\/$/g, "");
  if (objetivo.split("/").includes("..")) return false;
  const candidatos = objetivo ? [`${objetivo}.html`, `${objetivo}/index.html`] : ["index.html"];
  return candidatos.some((c) => existsSync(path.join(raizRepo, c)));
}

/**
 * Valida `public_docs/` entero.
 *
 * @param {{ raizRepo: string, hoy: string }} opciones  `hoy` en YYYY-MM-DD
 * @returns {{ errores: string[], avisos: string[], paginas: number }}
 */
export function validarPublicDocs({ raizRepo, hoy }) {
  const raiz = path.join(raizRepo, "public_docs");
  const errores = [];
  const avisos = [];
  const err = (fichero, msg) => errores.push(`${fichero}: ${msg}`);

  // ── Estructura (§4) ────────────────────────────────────────────────────────
  if (!existsSync(raiz)) return { errores: ["public_docs/ no existe"], avisos, paginas: 0 };
  for (const f of FICHEROS_OBLIGATORIOS) {
    if (!existsSync(path.join(raiz, f))) err(f, "falta (es parte del contrato, §4)");
  }
  if (existsSync(path.join(raiz, "es"))) {
    err("es/", "el árbol ES el idioma por defecto; no lleva carpeta de idioma (§7)");
  }

  // ── _meta (§3) ─────────────────────────────────────────────────────────────
  const leerJson = (rel) => {
    try {
      return JSON.parse(readFileSync(path.join(raiz, rel), "utf8"));
    } catch (e) {
      if (existsSync(path.join(raiz, rel))) err(rel, `JSON inválido: ${e.message}`);
      return null;
    }
  };
  const entidad = leerJson("_meta/entidad.json");
  const rutasApp = leerJson("_meta/rutas-app.json");
  const redirects = leerJson("_meta/redirects.json");

  let prefijoDocs = null;
  if (entidad) {
    for (const k of ["sitioProducto", "sitioDocumentacion"]) {
      if (typeof entidad[k] !== "string" || !/^https:\/\//.test(entidad[k])) {
        err("_meta/entidad.json", `\`${k}\` debe ser una URL https`);
      }
    }
    for (const k of ["organization", "website", "softwareApplication"]) {
      if (typeof entidad.ids?.[k] !== "string") err("_meta/entidad.json", `falta \`ids.${k}\``);
    }
    if (entidad.organization?.["@id"] !== entidad.ids?.organization) {
      err("_meta/entidad.json", "`organization.@id` no coincide con `ids.organization`");
    }
    if (entidad.softwareApplication?.["@id"] !== entidad.ids?.softwareApplication) {
      err(
        "_meta/entidad.json",
        "`softwareApplication.@id` no coincide con `ids.softwareApplication`",
      );
    }
    try {
      prefijoDocs = new URL(entidad.sitioDocumentacion).pathname.replace(/\/$/, "");
    } catch {
      // ya reportado arriba
    }
    // La coherencia con src/config/project.ts (nombre, dominio, slug…) la
    // comprueba scripts/lib/identidad.mjs.
  }

  const rutasDeclaradas = new Set();
  if (rutasApp) {
    for (const grupo of ["modulos", "otras", "publicas"]) {
      const valor = rutasApp[grupo];
      if (!valor || typeof valor !== "object" || Array.isArray(valor)) {
        err(
          "_meta/rutas-app.json",
          `\`${grupo}\` debe existir y ser un objeto (aunque esté vacío)`,
        );
        continue;
      }
      for (const [ruta, info] of Object.entries(valor)) {
        rutasDeclaradas.add(ruta);
        if (!info?.label) err("_meta/rutas-app.json", `\`${ruta}\` no tiene \`label\``);
        if (!rutaExisteEnApp(raizRepo, ruta)) {
          err("_meta/rutas-app.json", `\`${ruta}\` no existe en la app (ningún HTML la sirve)`);
        }
      }
    }
    if (entidad && rutasApp.base !== entidad.sitioProducto) {
      err("_meta/rutas-app.json", "`base` debe ser igual a `sitioProducto` de entidad.json");
    }
  }

  if (redirects && !Array.isArray(redirects.redirects)) {
    err("_meta/redirects.json", "`redirects` debe ser un array (vacío si no hay ninguno)");
  }

  // ── Páginas ────────────────────────────────────────────────────────────────
  const ficheros = existsSync(raiz) ? listarMarkdown(raiz) : [];
  const slugs = new Map();
  const ids = new Map();
  let paginas = 0;

  // Cada carpeta con páginas lleva su `_category_.json` con `label` (§4): sin él, el
  // Docusaurus titula la sección con el nombre de la carpeta.
  const carpetas = new Set(
    ficheros.filter((f) => f.includes("/")).map((f) => f.slice(0, f.lastIndexOf("/"))),
  );
  for (const carpeta of carpetas) {
    const rel = `${carpeta}/_category_.json`;
    if (!existsSync(path.join(raiz, rel))) {
      err(rel, "falta: cada sección lleva su `_category_.json` con `label` (§4)");
      continue;
    }
    const categoria = leerJson(rel);
    if (categoria && typeof categoria.label !== "string") err(rel, "falta `label`");
  }

  for (const rel of ficheros) {
    if (rel.endsWith(".mdx")) {
      err(rel, "solo Markdown (.md): nada de MDX ni lógica de Docusaurus en el producto (§2)");
      continue;
    }
    if (NO_PUBLICADOS.has(rel)) continue;
    paginas++;
    const texto = readFileSync(path.join(raiz, rel), "utf8");

    let fm;
    try {
      fm = separarFrontmatter(texto);
    } catch (e) {
      err(rel, `frontmatter YAML inválido: ${e.message}`);
      continue;
    }
    if (!fm) {
      err(rel, "no tiene frontmatter");
      continue;
    }
    const { datos, cuerpo } = fm;
    const r3zon = datos.r3zon ?? {};

    // Campos permitidos (§5).
    for (const k of Object.keys(datos)) {
      if (!CLAVES_RAIZ.has(k)) err(rel, `campo \`${k}\` no está en el contrato`);
    }
    for (const k of Object.keys(r3zon)) {
      if (!CLAVES_R3ZON.has(k)) err(rel, `campo \`r3zon.${k}\` no está en el contrato universal`);
    }
    for (const k of Object.keys(datos.last_update ?? {})) {
      if (!CLAVES_LAST_UPDATE.has(k)) err(rel, `campo \`last_update.${k}\` no está en el contrato`);
    }

    // Obligatorios (§5).
    if (!datos.title) err(rel, "falta `title`");
    if (!datos.description) err(rel, "falta `description`");
    else if (String(datos.description).length > 170) {
      avisos.push(
        `${rel}: \`description\` de ${String(datos.description).length} caracteres (objetivo: ≤160)`,
      );
    }
    if (typeof datos.slug !== "string" || !datos.slug.startsWith("/")) {
      err(rel, "falta `slug` o no empieza por `/` (es obligatorio siempre, §5)");
    } else if (slugs.has(datos.slug)) {
      err(rel, `\`slug\` ${datos.slug} repetido (ya lo usa ${slugs.get(datos.slug)})`);
    } else {
      slugs.set(datos.slug, rel);
    }
    if (datos.id !== undefined) {
      if (typeof datos.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(datos.id)) {
        err(rel, `\`id\` debe ir en minúsculas con guiones: ${datos.id}`);
      } else if (ids.has(datos.id)) {
        err(rel, `\`id\` ${datos.id} repetido (ya lo usa ${ids.get(datos.id)})`);
      } else {
        ids.set(datos.id, rel);
      }
    }

    // Fecha (§8): literal, válida y no futura.
    const fecha = comoFecha(datos.last_update?.date);
    if (!fecha) err(rel, "falta `last_update.date` (se mantiene A MANO, §8)");
    else if (!fechaValida(fecha))
      err(rel, `\`last_update.date: ${fecha}\` no es una fecha YYYY-MM-DD`);
    else if (fecha > hoy) err(rel, `\`last_update.date: ${fecha}\` está en el futuro`);

    // Valores (§5).
    if (!TIPOS.has(r3zon.tipo)) err(rel, `\`r3zon.tipo\` ausente o inválido: ${r3zon.tipo}`);
    if (!JSONLD.has(r3zon.jsonld)) err(rel, `\`r3zon.jsonld\` ausente o inválido: ${r3zon.jsonld}`);
    if (!ESTADOS.has(r3zon.estado))
      err(rel, `\`r3zon.estado\` ausente o inválido: ${r3zon.estado}`);
    if (r3zon.estado === "proximamente" && r3zon.jsonld === "HowTo") {
      err(
        rel,
        "una página `proximamente` no declara HowTo: no se describen pasos que no se pueden dar (§5)",
      );
    }
    if (
      r3zon.jsonld === "HowTo" &&
      r3zon.estado !== "proximamente" &&
      !tieneProcedimiento(cuerpo)
    ) {
      err(rel, "`jsonld: HowTo` exige un `## Cómo …` con lista ordenada debajo (CONVENCIONES §3)");
    }
    const tiposValidos = TIPOS_DE_JSONLD[r3zon.jsonld];
    if (tiposValidos && !tiposValidos.has(r3zon.tipo)) {
      err(rel, `\`jsonld: ${r3zon.jsonld}\` no corresponde a \`tipo: ${r3zon.tipo}\` (§6)`);
    }
    if (r3zon.jsonld === "FAQPage" && !/^###\s+.+\?\s*$/m.test(cuerpo)) {
      err(rel, "`jsonld: FAQPage` exige preguntas como `### …?` (§6)");
    }
    if (r3zon.tipo === "guia") {
      for (const p of problemasDeGuia(cuerpo)) err(rel, p);
    }
    if (r3zon.app_url !== undefined && !rutasDeclaradas.has(r3zon.app_url)) {
      err(rel, `\`r3zon.app_url: ${r3zon.app_url}\` no aparece en _meta/rutas-app.json`);
    }
    if (r3zon.origen !== undefined && !existsSync(path.join(raizRepo, String(r3zon.origen)))) {
      err(rel, `\`r3zon.origen: ${r3zon.origen}\` no existe en el repo`);
    }

    // Redacción (CONVENCIONES §2).
    const primerParrafo = cuerpo.trimStart();
    if (!primerParrafo.startsWith("**Respuesta corta.**")) {
      err(rel, "el cuerpo debe empezar por `**Respuesta corta.**` (CONVENCIONES §2)");
    } else if (palabrasRespuestaCorta(cuerpo) > MAX_PALABRAS_RESPUESTA) {
      err(
        rel,
        `la «Respuesta corta» tiene ${palabrasRespuestaCorta(cuerpo)} palabras (máximo ${MAX_PALABRAS_RESPUESTA}, CONVENCIONES §2)`,
      );
    }

    // Pie con la fuente y la URL publicada (CONVENCIONES §6).
    if (entidad && fecha && typeof datos.slug === "string") {
      const pie = pieEsperado({
        producto: entidad.softwareApplication?.name,
        organizacion: entidad.organization?.name,
        fecha,
        sitioDocumentacion: String(entidad.sitioDocumentacion ?? ""),
        slug: datos.slug,
      });
      if (!cuerpo.trimEnd().endsWith(pie)) {
        err(rel, `debe terminar con el pie (CONVENCIONES §6):\n${pie}`);
      }
    }
    const prohibido = cuerpo.match(ENCABEZADOS_PROHIBIDOS);
    if (prohibido)
      err(rel, `encabezado sin contenido informativo: «${prohibido[0].trim()}» (CONVENCIONES §2)`);

    // Nada de MDX dentro de un .md (§2): Docusaurus lo interpretaría como código.
    if (/^(import|export)\s/m.test(cuerpo) || /<[A-Z][A-Za-z]*[\s/>]/.test(cuerpo)) {
      err(rel, "contiene sintaxis MDX (import/export o componentes): solo Markdown (§2)");
    }

    // Enlaces (§7): relativos a fichero y que resuelven.
    for (const { destino } of enlacesDe(sinCodigo(cuerpo))) {
      if (/^(https?:|mailto:|#)/.test(destino)) continue;
      if (destino.startsWith("/")) {
        err(
          rel,
          `enlace absoluto \`${destino}\`: los internos van relativos a fichero (../x.md) (§7)`,
        );
        continue;
      }
      const ruta = destino.split("#")[0];
      if (!ruta) continue;
      if (!ruta.endsWith(".md")) {
        err(rel, `enlace \`${destino}\` no apunta a un .md (§7)`);
        continue;
      }
      const objetivo = path.normalize(path.join(path.dirname(rel), ruta));
      if (objetivo.startsWith("..") || !existsSync(path.join(raiz, objetivo))) {
        err(rel, `enlace roto \`${destino}\``);
      } else if (NO_PUBLICADOS.has(objetivo) || objetivo.startsWith("_")) {
        err(rel, `enlace \`${destino}\` apunta a un fichero que no se publica`);
      }
    }
  }

  if (!slugs.has("/")) err("index.md", "ninguna página tiene `slug: /` (la portada del producto)");

  // Cada destino de redirect resuelve a una página real (§9).
  if (Array.isArray(redirects?.redirects)) {
    for (const r of redirects.redirects) {
      if (typeof r?.de !== "string" || typeof r?.a !== "string") {
        err("_meta/redirects.json", `entrada inválida: ${JSON.stringify(r)}`);
        continue;
      }
      const sinPrefijo =
        prefijoDocs && r.a.startsWith(prefijoDocs) ? r.a.slice(prefijoDocs.length) || "/" : null;
      if (sinPrefijo === null || !slugs.has(sinPrefijo.replace(/(.)\/$/, "$1"))) {
        err("_meta/redirects.json", `"${r.de}" apunta a "${r.a}", que no es ninguna página`);
      }
    }
  }

  return { errores, avisos, paginas };
}
