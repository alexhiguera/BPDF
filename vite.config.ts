import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { htmlLang, project } from "./src/config/project.ts";
import { robotsTxt, sitemapXml } from "./src/config/public-site.ts";
import { cabecerasSeguridad, cspMeta } from "./src/config/security-headers.ts";
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
 * - `robots.txt` y `sitemap.xml` generados desde `project.ts`.
 */
function bpdf(esBuild: boolean): Plugin {
  return {
    name: "bpdf",
    transformIndexHtml(texto) {
      const sustituido = texto
        .replace(/<html lang="[^"]*">/, `<html lang="${html(htmlLang)}">`)
        .replaceAll("__BPDF_NAME__", html(project.name))
        .replaceAll("__BPDF_DESCRIPTION__", html(project.description))
        .replaceAll("__BPDF_NOSCRIPT__", html(messages.app.noscript));
      if (!esBuild) return sustituido;
      return {
        html: sustituido,
        tags: [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: cspMeta() },
            injectTo: "head-prepend",
          },
        ],
      };
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
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  build: {
    // Navegadores mínimos: los que exige Tailwind 4 (`color-mix`, `@property`).
    target: ["chrome111", "edge111", "firefox111", "safari16.4"],
  },
  preview: {
    headers: cabecerasSeguridad(),
  },
}));
