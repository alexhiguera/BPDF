import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Constantes que se fijan AL COMPILAR (`define` de Vite y de Vitest): la versión
 * y la licencia de BPDF, de `package.json` (Fase 11, «Acerca de»). Vite sustituye
 * el texto en el código; en el navegador no se lee nada ni se evalúa nada (CSP).
 *
 * Solo lo importan `vite.config.ts` y `vitest.config.ts` (Node): la app usa
 * `src/config/version.ts`.
 */
export function constantesDeCompilacion(raiz: string): Record<string, string> {
  const paquete = JSON.parse(readFileSync(path.join(raiz, "package.json"), "utf8")) as {
    version: string;
    license: string;
  };
  return {
    __BPDF_VERSION__: JSON.stringify(paquete.version),
    __BPDF_LICENSE__: JSON.stringify(paquete.license),
  };
}
