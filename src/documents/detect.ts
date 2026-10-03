import { DocumentError } from "./errors";
import { PDF_SIGNATURE_WINDOW } from "./limits";
import type { DocumentKind } from "./types";

/**
 * Qué es un fichero, sin fiarse de lo que dice de sí mismo (docs/PLAN.md §4.2).
 *
 * La extensión dice qué **pretende** ser; el contenido lo confirma. El MIME que
 * da el navegador (`file.type`) no se lee nunca: sale de la extensión o del
 * registro del sistema operativo, no del contenido, y para `.md` suele venir
 * vacío o distinto en cada sistema.
 */

const EXTENSIONS: Readonly<Record<string, DocumentKind>> = {
  ".pdf": "pdf",
  ".md": "markdown",
  ".markdown": "markdown",
};

/**
 * Valor de `accept` del selector. Solo extensiones: con un MIME (`text/markdown`)
 * algunos sistemas amplían el filtro a otras extensiones del mismo tipo que
 * después se rechazarían. Es un filtro de comodidad, no una validación: el
 * usuario puede elegir «Todos los archivos».
 */
export const ACCEPT = Object.keys(EXTENSIONS).join(",");

/** Tipo que corresponde a la extensión del nombre (sin distinguir mayúsculas), o `null`. */
export function kindFromName(name: string): DocumentKind | null {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return null;
  return EXTENSIONS[name.slice(dot).toLowerCase()] ?? null;
}

const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

/** ¿Aparece `%PDF-` dentro de los primeros `PDF_SIGNATURE_WINDOW` bytes? */
export function hasPdfSignature(head: Uint8Array): boolean {
  const end = Math.min(head.length, PDF_SIGNATURE_WINDOW) - PDF_SIGNATURE.length;
  for (let i = 0; i <= end; i++) {
    if (PDF_SIGNATURE.every((byte, j) => head[i + j] === byte)) return true;
  }
  return false;
}

/**
 * Decodifica un Markdown como UTF-8 estricto. Lanza `not-utf8` si no lo es.
 *
 * - `fatal: true`: una secuencia inválida es un error, no un `�` silencioso.
 *   Así se rechazan los binarios y el UTF-16 con BOM (`FF FE` no es UTF-8).
 * - Un carácter NUL también se rechaza: es válido en UTF-8 pero ningún texto
 *   lo lleva, y es lo que delata un UTF-16 sin BOM (`#\0 \0h\0…`) o un binario
 *   que por casualidad fuera UTF-8 válido.
 * - El BOM de UTF-8, si lo hay, se quita (comportamiento de `TextDecoder`).
 */
export function decodeMarkdown(bytes: ArrayBuffer | Uint8Array, fileName?: string): string {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (cause) {
    throw new DocumentError("not-utf8", { fileName, kind: "markdown", cause });
  }
  if (text.includes("\0")) throw new DocumentError("not-utf8", { fileName, kind: "markdown" });
  return text;
}

// Controles C0/C1 y marcas de formato bidireccional. Estas últimas permiten
// que `informe\u202Efdp.md` se vea como «informedm.pdf»: el nombre que se muestra
// tiene que ser el que se ha validado.
const INVISIBLE = /[\p{Cc}\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;

/**
 * Nombre para mostrar a partir del que da la plataforma, que no es de fiar:
 * sin ruta (por si una plataforma la incluyera), sin caracteres de control ni
 * de dirección de texto, y normalizado (NFC). Se muestra siempre como texto
 * (React lo escapa), nunca como HTML. La extensión se valida sobre este
 * resultado: lo que se ve es lo que se ha comprobado.
 *
 * Solo se corta por `/`, que ningún sistema admite dentro de un nombre. `\`
 * sí es válido en Linux (`a\b.md`) y se conserva; las rutas de Windows no
 * llegan aquí (el navegador da el nombre sin ruta).
 */
export function displayName(raw: string, fallback: string): string {
  const base = raw.slice(raw.lastIndexOf("/") + 1);
  const clean = base.replace(INVISIBLE, "").normalize("NFC").trim();
  return clean || fallback;
}
