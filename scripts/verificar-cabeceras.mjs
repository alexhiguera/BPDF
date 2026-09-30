/**
 * Comprueba las cabeceras HTTP que DE VERDAD sirve un despliegue de BPDF
 * contra la fuente única (`src/config/security-headers.ts`, `cabecerasPara`).
 * CLAUDE.md §10: una cabecera que no llega solo la ve quien hace la petición.
 *
 *   npm run cabeceras:verificar -- https://bpdf.r3zon.com
 *   npm run cabeceras:verificar -- http://localhost:4173     (vite preview)
 *
 * Pide `/`, `/mermaid.html` y un módulo de `/assets/` del marco (lo saca del
 * propio `mermaid.html`), y compara cada cabecera esperada. Solo peticiones al
 * sitio indicado; sin cuerpo de documentos (BPDF no tiene nada más que servir).
 * Termina con código 1 si falta o difiere alguna.
 */
import { fileURLToPath } from "node:url";
import { cabecerasPara, RUTA_MARCO_MERMAID } from "../src/config/security-headers.ts";

/** Diferencias entre lo esperado y lo recibido (nombres sin distinguir mayúsculas). */
export function diferencias(esperadas, recibidas) {
  const fallos = [];
  for (const [nombre, valor] of Object.entries(esperadas)) {
    const real = recibidas.get(nombre);
    if (real === null) fallos.push(`falta ${nombre}`);
    else if (real !== valor)
      fallos.push(`${nombre} distinta:\n      esperada: ${valor}\n      recibida: ${real}`);
  }
  return fallos;
}

async function comprobar(base, ruta) {
  const respuesta = await fetch(new URL(ruta, base), { redirect: "manual" });
  const fallos =
    respuesta.status === 200
      ? diferencias(cabecerasPara(ruta), respuesta.headers)
      : [`respuesta ${respuesta.status}`];
  console.log(`${fallos.length ? "✗" : "✓"} ${ruta} (${respuesta.status})`);
  for (const f of fallos) console.log(`    ${f}`);
  return { fallos, cuerpo: respuesta.ok ? await respuesta.text() : "" };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const base = process.argv[2];
  if (!base || !/^https?:\/\//.test(base)) {
    console.error("Uso: npm run cabeceras:verificar -- https://bpdf.r3zon.com");
    process.exit(2);
  }
  let total = 0;
  total += (await comprobar(base, "/")).fallos.length;
  const marco = await comprobar(base, RUTA_MARCO_MERMAID);
  total += marco.fallos.length;
  const modulo = marco.cuerpo.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  if (modulo) total += (await comprobar(base, modulo)).fallos.length;
  else {
    console.log("✗ no se encontró el módulo del marco en /mermaid.html");
    total++;
  }
  console.log(
    total
      ? `\n${total} problema(s).`
      : "\n✓ Todas las cabeceras coinciden con security-headers.ts.",
  );
  process.exit(total ? 1 : 0);
}
