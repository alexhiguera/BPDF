import { siteUrl } from "./project.ts";

/**
 * `robots.txt` y `sitemap.xml` de la web pública. Los emite `vite.config.ts` en
 * la build, a partir del dominio de `project.ts`, para no repetirlo en ficheros
 * estáticos (dominio oficial de D5 desde la Fase 15).
 *
 * `lastModified` es LITERAL. Nunca `new Date()`: movería la fecha de todo el
 * sitio en cada despliegue y el buscador acabaría ignorando la señal. Quien
 * cambia el contenido visible de una de estas páginas actualiza su fecha aquí en
 * el mismo commit (CLAUDE.md §9).
 */
export const PAGINAS_PUBLICAS: readonly { path: string; lastModified: string }[] = [
  // La portada y la identidad visual se rediseñaron el 2026-10-06.
  { path: "/", lastModified: "2026-10-06" },
];

export function robotsTxt(): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl()}/sitemap.xml\n`;
}

export function sitemapXml(): string {
  const urls = PAGINAS_PUBLICAS.map(
    ({ path, lastModified }) =>
      `  <url><loc>${siteUrl()}${path}</loc><lastmod>${lastModified}</lastmod></url>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
