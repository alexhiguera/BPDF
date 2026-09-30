import { MAX_BYTES_IMAGEN } from "./limits";
import type { RecursoLocal, RecursosDocumento, TipoImagen } from "./types";

/**
 * Recursos locales de un Markdown (Fase 7 bis, docs/ARCHITECTURE.md §4 sexies).
 *
 * Principio: **BPDF nunca busca ficheros en el equipo.** Un documento solo
 * puede usar lo que el usuario entregó explícitamente junto con él (varios
 * ficheros o una carpeta). Todo lo de aquí son funciones puras sobre ese
 * conjunto: ninguna toca el disco, la red ni el DOM.
 */

const TIPOS: Readonly<Record<string, TipoImagen>> = {
  ".png": "png",
  ".jpg": "jpeg",
  ".jpeg": "jpeg",
  ".gif": "gif",
  ".webp": "webp",
  ".svg": "svg",
};

/** Tipo MIME con el que se entrega cada formato. Nunca el `file.type` del navegador. */
export const MIME_IMAGEN: Readonly<Record<TipoImagen, string>> = {
  png: "image/png",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

/** Extensiones de imagen para el filtro del selector. */
export const EXTENSIONES_IMAGEN = Object.keys(TIPOS);

/** Formato de imagen según la extensión (sin distinguir mayúsculas), o `null`. */
export function tipoImagen(nombre: string): TipoImagen | null {
  const punto = nombre.lastIndexOf(".");
  if (punto < 0 || punto < nombre.lastIndexOf("/")) return null;
  return TIPOS[nombre.slice(punto).toLowerCase()] ?? null;
}

/**
 * Normaliza una ruta relativa `/`-separada: NFC, sin segmentos vacíos ni `.`,
 * y `..` aplicado. `null` si sube por encima de la raíz. No decodifica nada ni
 * acepta `\`: eso lo decide quien llama.
 */
export function normalizarRuta(segmentos: readonly string[]): string | null {
  const pila: string[] = [];
  for (const crudo of segmentos) {
    const s = crudo.normalize("NFC");
    if (s === "" || s === ".") continue;
    if (s === "..") {
      if (pila.length === 0) return null;
      pila.pop();
      continue;
    }
    pila.push(s);
  }
  return pila.join("/");
}

/** Directorio de una ruta ya normalizada (`"docs/a.md"` → `"docs"`, `"a.md"` → `""`). */
export function directorio(ruta: string): string {
  const barra = ruta.lastIndexOf("/");
  return barra < 0 ? "" : ruta.slice(0, barra);
}

/** Un fichero entregado, con su ruta relativa a la raíz de la entrega. */
export type Entregado = {
  readonly ruta: string;
  readonly file: Pick<File, "size" | "slice">;
};

/**
 * Construye el conjunto de recursos a partir de lo entregado: solo imágenes de
 * formato admitido (el resto se ignora) y sin leer ningún fichero. `base` es
 * el directorio del `.md`.
 *
 * El `Blob` de cada recurso es `file.slice(0, size, mime)`: un trozo del
 * propio fichero con el tipo MIME de su extensión, sin copiar bytes.
 */
export function crearRecursos(entregados: readonly Entregado[], base: string): RecursosDocumento {
  const ficheros = new Map<string, RecursoLocal>();
  const ambiguas = new Set<string>();
  for (const { ruta: cruda, file } of entregados) {
    const ruta = normalizarRuta(cruda.split("/"));
    if (!ruta) continue; // la plataforma no debería dar esto; no se adivina
    const tipo = tipoImagen(ruta);
    if (!tipo) continue;
    if (ficheros.has(ruta)) ambiguas.add(ruta);
    ficheros.set(ruta, {
      ruta,
      tipo,
      size: file.size,
      blob: file.slice(0, file.size, MIME_IMAGEN[tipo]),
    });
  }
  return { base: normalizarRuta(base.split("/")) ?? "", ficheros, ambiguas };
}

/**
 * Qué pasa con una referencia de imagen del documento:
 *
 * - `ok`: está entre lo entregado.
 * - `no-encontrado`: la ruta es válida pero no se entregó ese fichero.
 * - `fuera`: sale del conjunto entregado (`../` de más, ruta absoluta,
 *   unidad de Windows, esquema como `file:`). No se busca: BPDF no mira fuera.
 * - `no-soportado`: no es un formato de imagen admitido.
 * - `demasiado-grande`: supera `MAX_BYTES_IMAGEN`.
 * - `ambiguo`: corresponde a más de un fichero entregado.
 * - `invalido`: no es una ruta que se pueda interpretar (escape `%` roto,
 *   caracteres de control, vacía).
 */
export type Resolucion =
  | { readonly estado: "ok"; readonly recurso: RecursoLocal }
  | {
      readonly estado:
        | "no-encontrado"
        | "fuera"
        | "no-soportado"
        | "demasiado-grande"
        | "ambiguo"
        | "invalido";
    };

// biome-ignore lint/suspicious/noControlCharactersInRegex: es justo lo que se rechaza
const CONTROLES = /[\u0000-\u001f\u007f]/;
const ESQUEMA = /^[a-z][a-z\d+.-]*:/i;

/**
 * El ÚNICO punto donde una referencia del documento se convierte en un fichero.
 *
 * 1. Se quita `?consulta` y `#fragmento` (en Markdown son de la URL, no del
 *    nombre).
 * 2. Se rechaza `\`: en una URL no es separador y en Windows sí; aceptarlo
 *    sería interpretar la ruta de dos maneras.
 * 3. Se decodifican los escapes `%` **una vez** (`foto%20grande.png`,
 *    `%2e%2e`). Un `%` suelto es inválido; `%252e` queda como el nombre
 *    literal `%2e`, no como `..`.
 * 4. Se rechazan controles, rutas absolutas (`/x`) y esquemas (`file:`,
 *    `C:`, `data:`, `javascript:`).
 * 5. Se une al directorio del `.md` y se normaliza segmento a segmento: un
 *    `..` que sube por encima de la raíz es `fuera`. Nunca se compara texto
 *    antes de normalizar.
 * 6. Solo entonces se busca, **exactamente** (mayúsculas incluidas), en el
 *    mapa de lo entregado.
 */
export function resolverRecurso(referencia: unknown, recursos: RecursosDocumento): Resolucion {
  if (typeof referencia !== "string") return { estado: "invalido" };
  const sinUrl = referencia.split(/[?#]/, 1)[0] ?? "";
  if (sinUrl.includes("\\")) return { estado: "fuera" };
  let ruta: string;
  try {
    ruta = decodeURIComponent(sinUrl);
  } catch {
    return { estado: "invalido" };
  }
  if (ruta.trim() === "" || CONTROLES.test(ruta)) return { estado: "invalido" };
  if (ruta.startsWith("/") || ruta.includes("\\") || ESQUEMA.test(ruta)) return { estado: "fuera" };

  const destino = normalizarRuta([...recursos.base.split("/"), ...ruta.split("/")]);
  if (destino === null) return { estado: "fuera" };
  if (destino === "") return { estado: "invalido" };
  if (!tipoImagen(destino)) return { estado: "no-soportado" };
  if (recursos.ambiguas.has(destino)) return { estado: "ambiguo" };
  const recurso = recursos.ficheros.get(destino);
  if (!recurso) return { estado: "no-encontrado" };
  if (recurso.size > MAX_BYTES_IMAGEN) return { estado: "demasiado-grande" };
  return { estado: "ok", recurso };
}
