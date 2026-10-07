import { readFileSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { constantesDeCompilacion } from "./src/config/compilacion.ts";
import { htmlLang, project, siteUrl } from "./src/config/project.ts";
import { robotsTxt, sitemapXml } from "./src/config/public-site.ts";
import {
  cabecerasPara,
  cspMarcoMeta,
  cspMeta,
  RUTA_MARCO_MERMAID,
} from "./src/config/security-headers.ts";
import { messages } from "./src/i18n/messages.ts";

/** Escapa un valor para meterlo en HTML (texto o atributo entre comillas dobles). */
const html = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * Lo propio de BPDF en la build, sin dependencias:
 * - identidad y textos en `index.html` desde su fuente única;
 * - CSP como `<meta>` SOLO en la build: en desarrollo Vite inyecta scripts y
 *   estilos en línea que una CSP estricta bloquearía (la CSP se prueba contra
 *   `vite preview`, que sirve la build);
 * - `robots.txt` y `sitemap.xml` generados desde `project.ts`;
 * - Fase 8: `mermaid.html` (el marco aislado de Mermaid) lleva SU CSP, y
 *   `vite preview` manda las cabeceras de cada ruta (`cabecerasPara`).
 */
function bpdf(esBuild: boolean): Plugin {
  return {
    name: "bpdf",
    transformIndexHtml(texto, ctx) {
      const sustituido = texto
        .replace(/<html lang="[^"]*">/, `<html lang="${html(htmlLang)}">`)
        .replaceAll("__BPDF_NAME__", html(project.name))
        .replaceAll("__BPDF_DESCRIPTION__", html(project.description))
        .replaceAll("__BPDF_SITE_URL__", html(siteUrl()))
        .replaceAll("__BPDF_NOSCRIPT_TITLE__", html(messages.app.noscriptTitle))
        .replaceAll("__BPDF_NOSCRIPT_BODY__", html(messages.app.noscriptBody))
        .replaceAll("__BPDF_NOT_FOUND_TITLE__", html(messages.notFound.title))
        .replaceAll("__BPDF_NOT_FOUND_BODY__", html(messages.notFound.body))
        .replaceAll("__BPDF_BACK_HOME__", html(messages.app.backHome));
      if (!esBuild) return sustituido;
      return {
        html: sustituido,
        tags: [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content: ctx.path === RUTA_MARCO_MERMAID ? cspMarcoMeta() : cspMeta(),
            },
            injectTo: "head-prepend",
          },
        ],
      };
    },
    configurePreviewServer(servidor) {
      // La aplicación solo tiene una URL pública. Vercel sirve `404.html` con
      // estado 404 de forma nativa; aquí se responde directamente porque el
      // servidor estático de Vite convertiría el estado en 200 al servirla.
      servidor.middlewares.use((peticion, respuesta, siguiente) => {
        const ruta = new URL(peticion.url ?? "/", "http://localhost").pathname;
        const paginaConocida = ["/", "/index.html", "/404.html", RUTA_MARCO_MERMAID].includes(ruta);
        const ultimoSegmento = ruta.split("/").at(-1) ?? "";
        if (!paginaConocida && !ultimoSegmento.includes(".")) {
          for (const [nombre, valor] of Object.entries(cabecerasPara(ruta))) {
            respuesta.setHeader(nombre, valor);
          }
          respuesta.statusCode = 404;
          respuesta.setHeader("Content-Type", "text/html; charset=utf-8");
          respuesta.end(
            peticion.method === "HEAD"
              ? undefined
              : readFileSync(path.resolve(servidor.config.build.outDir, "404.html")),
          );
          return;
        }
        siguiente();
      });
      servidor.middlewares.use((peticion, respuesta, siguiente) => {
        for (const [nombre, valor] of Object.entries(cabecerasPara(peticion.url ?? "/"))) {
          respuesta.setHeader(nombre, valor);
        }
        siguiente();
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robotsTxt() });
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemapXml() });
    },
  };
}

export default defineConfig(({ command }) => ({
  // Sin fallback de SPA: BPDF tiene una sola página, y una ruta desconocida debe
  // dar 404 como en cualquier hosting estático, no la app.
  appType: "mpa",
  plugins: [tailwindcss(), bpdf(command === "build")],
  // Versión y licencia de package.json, sustituidas en el código al compilar (Fase 11).
  define: constantesDeCompilacion(import.meta.dirname),
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    // Navegadores mínimos: los del soporte oficial de Tailwind 4 (Chrome 111, Safari
    // 16.4, Firefox 128), que manda sobre el resto: pdf.js 6 por sí solo funcionaría
    // desde Firefox 114 (su worker es un módulo ES). Decisión del usuario, *2026-10-03*.
    // Sin polyfills ni compatibilidad artificial con versiones anteriores.
    target: ["chrome111", "edge111", "firefox128", "safari16.4"],
    // Ningún recurso incrustado como `data:` (Vite lo hace por defecto con los de
    // menos de 4 KB): la CSP no admite `data:` en ningún `*-src`. Lo destapó la
    // Fase 8: las fuentes pequeñas de KaTeX se incrustaban y `font-src 'self'` las
    // bloqueaba. Todo se sirve como fichero del propio origen.
    assetsInlineLimit: 0,
    rollupOptions: {
      // Fase 8: la app y el marco aislado de Mermaid (`mermaid.html`).
      input: {
        index: path.resolve(import.meta.dirname, "index.html"),
        "404": path.resolve(import.meta.dirname, "404.html"),
        mermaid: path.resolve(import.meta.dirname, "mermaid.html"),
      },
    },
  },
  // El worker del modo oscuro (src/pdf/dark/trabajador.ts) se empaqueta como módulo
  // ES, igual que el de pdf.js: los dos se cargan con `type: "module"`.
  worker: { format: "es" },
}));
