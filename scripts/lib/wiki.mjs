// =============================================================================
// GitHub Wiki desde `public_docs/` (Fase 16)
// =============================================================================
// La documentación pública tiene UNA fuente: `public_docs/`. El Docusaurus de R3ZON la
// publica en docs.r3zon.com; la Wiki del repositorio es una copia GENERADA, nunca editada
// a mano (se sobrescribe entera en cada generación).
//
// Qué cambia al pasar al formato de la Wiki:
//   - La Wiki es plana y nombra cada página por su fichero: `<id>.md` (el `id` del
//     frontmatter, o el nombre del fichero). La portada (`slug: /`) es `Home.md`.
//   - Sin frontmatter: la Wiki lo enseñaría como texto.
//   - Los enlaces internos `../x/y.md#ancla` pasan a `y#ancla`, el nombre de su página.
//   - `_Sidebar.md` con las secciones (`_category_.json`) y `_Footer.md` con la fuente.
// El cuerpo no se toca: el pie de cada página sigue apuntando a docs.r3zon.com, la URL
// canónica.
//
// Función pura sobre un repo (lee disco, no escribe): el script la llama y escribe; los
// tests, con el proyecto ficticio de tests/_fixtures.
// =============================================================================

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { enlacesDe, NO_PUBLICADOS, separarFrontmatter } from "./public-docs.mjs";

function paginasDe(raiz, rel = "") {
  const salida = [];
  for (const nombre of readdirSync(path.join(raiz, rel))) {
    const relHijo = rel ? `${rel}/${nombre}` : nombre;
    if (statSync(path.join(raiz, relHijo)).isDirectory()) {
      if (!nombre.startsWith("_")) salida.push(...paginasDe(raiz, relHijo));
    } else if (nombre.endsWith(".md") && !NO_PUBLICADOS.has(relHijo)) {
      salida.push(relHijo);
    }
  }
  return salida.sort();
}

function categoria(raiz, carpeta) {
  const f = path.join(raiz, carpeta, "_category_.json");
  try {
    return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
  } catch {
    return {};
  }
}

/**
 * @param {{ raizRepo: string, repositorio: string }} p  `repositorio`: URL de GitHub del repo
 * @returns {Map<string, string>} nombre de fichero de la Wiki → contenido
 */
export function generarWiki({ raizRepo, repositorio }) {
  const raiz = path.join(raizRepo, "public_docs");
  const paginas = paginasDe(raiz).map((rel) => {
    const { datos, cuerpo } = separarFrontmatter(readFileSync(path.join(raiz, rel), "utf8"));
    const nombre = datos.slug === "/" ? "Home" : String(datos.id ?? path.basename(rel, ".md"));
    return { rel, datos, cuerpo, nombre };
  });
  const porRuta = new Map(paginas.map((p) => [p.rel, p.nombre]));
  const nombres = new Set();
  for (const p of paginas) {
    if (nombres.has(p.nombre))
      throw new Error(`Dos páginas darían la misma de la Wiki: ${p.nombre}`);
    nombres.add(p.nombre);
  }

  const salida = new Map();
  for (const p of paginas) {
    let cuerpo = p.cuerpo;
    // De atrás adelante, para que los índices sigan valiendo al sustituir.
    for (const { destino, indice } of enlacesDe(cuerpo).reverse()) {
      const [ruta, ancla] = destino.split("#");
      if (!ruta?.endsWith(".md") || /^[a-z]+:/i.test(ruta)) continue;
      const objetivo = path.posix.normalize(path.posix.join(path.posix.dirname(p.rel), ruta));
      const nombre = porRuta.get(objetivo);
      if (!nombre) continue;
      const nuevo = ancla ? `${nombre}#${ancla}` : nombre;
      const inicio = indice + 2;
      cuerpo = cuerpo.slice(0, inicio) + cuerpo.slice(inicio).replace(destino, nuevo);
    }
    salida.set(
      `${p.nombre}.md`,
      `<!-- Generado desde public_docs/${p.rel} (npm run wiki:generar). No se edita en la Wiki: se sobrescribe. -->\n\n${cuerpo.trim()}\n`,
    );
  }

  // Barra lateral: portada y páginas de la raíz, después cada sección en su orden.
  const orden = (a, b) =>
    (a.datos.sidebar_position ?? 99) - (b.datos.sidebar_position ?? 99) ||
    a.rel.localeCompare(b.rel);
  const enlace = (p) => `- [${p.datos.sidebar_label ?? p.datos.title}](${p.nombre})`;
  const lineas = [];
  for (const p of paginas.filter((x) => !x.rel.includes("/")).sort(orden)) lineas.push(enlace(p));
  const carpetas = [
    ...new Set(paginas.filter((p) => p.rel.includes("/")).map((p) => path.posix.dirname(p.rel))),
  ];
  const etiqueta = (c) =>
    c
      .split("/")
      .map((_, i, partes) => categoria(raiz, partes.slice(0, i + 1).join("/")).label)
      .filter(Boolean)
      .join(" · ") || c;
  const posicion = (c) =>
    c
      .split("/")
      .map((_, i, partes) => categoria(raiz, partes.slice(0, i + 1).join("/")).position ?? 99);
  carpetas.sort((a, b) => {
    const pa = posicion(a);
    const pb = posicion(b);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] ?? -1) - (pb[i] ?? -1);
      if (d) return d;
    }
    return a.localeCompare(b);
  });
  for (const c of carpetas) {
    lineas.push("", `**${etiqueta(c)}**`, "");
    for (const p of paginas.filter((x) => path.posix.dirname(x.rel) === c).sort(orden)) {
      lineas.push(enlace(p));
    }
  }
  salida.set("_Sidebar.md", `${lineas.join("\n")}\n`);

  salida.set(
    "_Footer.md",
    `Generada desde [\`public_docs/\`](${repositorio}/tree/main/public_docs), la fuente única de la documentación. Versión publicada: https://docs.r3zon.com/bpdf\n`,
  );
  return salida;
}
