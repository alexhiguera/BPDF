/**
 * Genera `vercel.json` (las cabeceras HTTP de la web publicada) desde la
 * fuente única, `src/config/security-headers.ts` (`reglasVercel`).
 *
 *   npm run cabeceras:vercel
 *
 * `tests/unit/vercel.test.ts` falla si el fichero versionado no coincide:
 * quien cambie la CSP o las cabeceras, regenera y commitea los dos a la vez.
 * Node 24 carga el `.ts` directamente (sin tipos en tiempo de ejecución).
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { reglasVercel } from "../src/config/security-headers.ts";

export function contenidoVercel() {
  const config = {
    $schema: "https://openapi.vercel.sh/vercel.json",
    headers: reglasVercel(),
  };
  return `${JSON.stringify(config, null, 2)}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const destino = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "vercel.json");
  writeFileSync(destino, contenidoVercel());
  console.log(`✓ ${path.relative(process.cwd(), destino)} generado desde security-headers.ts`);
}
