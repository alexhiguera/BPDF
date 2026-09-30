import { messages } from "@/i18n/messages";
import { displayName, kindFromName } from "./detect";
import { DocumentError } from "./errors";
import { MAX_FICHEROS_CARPETA } from "./limits";
import { type LocalFile, readDocument } from "./read";
import { crearRecursos, directorio, normalizarRuta, tipoImagen } from "./recursos";
import type { Apertura, OpenedDocument } from "./types";

/**
 * Lo que el usuario entrega de una vez (Fase 7 bis). Lo construye la
 * plataforma, sin rutas de disco:
 *
 * - `ficheros`: elegidos o soltados sueltos. `ruta` es solo el nombre: el
 *   navegador no dice de qué carpeta vienen (todos, de la misma).
 * - `carpeta`: una carpeta elegida o soltada. `ruta` es relativa a ella, SIN
 *   su propio nombre (`img/logo.png`).
 */
export type Seleccion = {
  readonly origen: "ficheros" | "carpeta";
  readonly entregados: readonly { readonly ruta: string; readonly file: LocalFile }[];
};

type Entrada = Seleccion["entregados"][number];

const nombreDe = (ruta: string) => ruta.slice(ruta.lastIndexOf("/") + 1);
const esMarkdown = (e: Entrada) => kindFromName(nombreDe(e.ruta).toLowerCase()) === "markdown";

/**
 * Abre una selección (docs/ARCHITECTURE.md §4 sexies):
 *
 * - **Un fichero suelto**: como siempre (PDF o Markdown, sin recursos).
 * - **Varios ficheros**: exactamente un `.md` y el resto imágenes admitidas.
 *   Un PDF acompañado, dos `.md` o un fichero de otro tipo son un error: BPDF
 *   abre un documento cada vez (D16) y no adivina cuál quería el usuario.
 * - **Carpeta**: se ignora lo que no es Markdown ni imagen. Sin `.md`, error;
 *   con uno, se abre; con varios, se devuelve la **elección** para que el
 *   usuario diga cuál es el principal.
 *
 * Solo se lee el `.md` elegido. Las imágenes quedan como `Blob` sin leer.
 */
export async function abrirSeleccion(seleccion: Seleccion): Promise<Apertura | null> {
  const { origen, entregados } = seleccion;
  const [primero] = entregados;
  // Una carpeta sin nada útil no es una cancelación: se dice.
  if (!primero) {
    if (origen === "carpeta") throw new DocumentError("folder-no-markdown");
    return null;
  }
  if (origen === "ficheros" && entregados.length === 1) return readDocument(primero.file);
  if (entregados.length > MAX_FICHEROS_CARPETA) throw new DocumentError("folder-too-large");

  const markdowns = entregados.filter(esMarkdown);
  if (origen === "ficheros") {
    const ajeno = entregados.find((e) => !esMarkdown(e) && !tipoImagen(e.ruta));
    if (ajeno) {
      throw new DocumentError("incompatible", {
        fileName: displayName(nombreDe(ajeno.ruta), messages.document.untitled),
      });
    }
    const [md, otro] = markdowns;
    if (!md) throw new DocumentError("no-markdown");
    if (otro) throw new DocumentError("several-markdown");
    return abrirMarkdown(md, entregados);
  }

  const [md, otro] = markdowns;
  if (!md) throw new DocumentError("folder-no-markdown");
  if (!otro) return abrirMarkdown(md, entregados);
  const ordenados = [...markdowns].sort(porProfundidadYNombre);
  return {
    kind: "choose-markdown",
    candidates: ordenados.map((m) => rutaVisible(m.ruta)),
    choose(indice) {
      const elegido = ordenados[indice];
      if (!elegido) return Promise.reject(new DocumentError("unreadable"));
      return abrirMarkdown(elegido, entregados);
    },
  };
}

async function abrirMarkdown(
  md: Entrada,
  entregados: Seleccion["entregados"],
): Promise<OpenedDocument> {
  const documento = await readDocument(md.file);
  if (documento.kind !== "markdown") throw new DocumentError("unreadable");
  const base = directorio(normalizarRuta(md.ruta.split("/")) ?? "");
  return { ...documento, resources: crearRecursos(entregados, base) };
}

/** Primero los de la raíz, después por orden alfabético: el principal suele estar arriba. */
function porProfundidadYNombre(a: Entrada, b: Entrada): number {
  const profundidad = a.ruta.split("/").length - b.ruta.split("/").length;
  return profundidad || a.ruta.localeCompare(b.ruta);
}

/**
 * Una ruta relativa para mostrarla: cada segmento saneado como un nombre
 * (sin controles ni marcas bidireccionales, NFC). Solo se pinta como texto.
 */
function rutaVisible(ruta: string): string {
  return ruta
    .split("/")
    .filter(Boolean)
    .map((s) => displayName(s, messages.document.untitled))
    .join("/");
}
