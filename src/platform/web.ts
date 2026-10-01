import { ACCEPT, kindFromName } from "@/documents/detect";
import { DocumentError } from "@/documents/errors";
import {
  CARPETAS_IGNORADAS,
  MAX_FICHEROS_CARPETA,
  MAX_PROFUNDIDAD_CARPETA,
} from "@/documents/limits";
import { EXTENSIONES_IMAGEN, tipoImagen } from "@/documents/recursos";
import { abrirSeleccion, type Seleccion } from "@/documents/seleccion";
import { urlPermitida } from "@/lib/url-externa";
import { crearGuardadoWeb } from "./guardar-web";
import type { Platform, Soltado } from "./types";

/**
 * Plataforma web: solo APIs estándar del navegador. Los ficheros se leen en
 * memoria con `Blob.arrayBuffer()` y no salen del dispositivo: no hay subida
 * ni `fetch`. Las URL de objeto (`blob:`) de las imágenes las crea el visor
 * de Markdown al pintarlas, no la plataforma.
 *
 * El navegador **nunca da rutas de disco**: de un fichero elegido, su nombre;
 * de una carpeta, rutas relativas a ella (`webkitRelativePath`,
 * `FileSystemEntry.fullPath`). BPDF no pide más.
 *
 * `doc` se inyecta para poder probarla en jsdom.
 */
export function createWebPlatform(doc: Document = document): Platform {
  const ventana = doc.defaultView;
  const guardar = crearGuardadoWeb(ventana);
  return {
    saveText: guardar,
    async pickDocument() {
      const files = await elegir(doc, "ficheros");
      return files ? abrirSeleccion(deFicheros(files)) : null;
    },
    async pickFolder() {
      const files = await elegir(doc, "carpeta");
      return files ? abrirSeleccion(deCarpetaElegida(files)) : null;
    },
    async openDropped(soltado) {
      return abrirSeleccion(await deSoltado(soltado));
    },
    openExternal(url) {
      const segura = urlPermitida(url);
      if (segura) ventana?.open(segura, "_blank", "noopener,noreferrer");
    },
  };
}

/** Filtro del selector de archivos: documentos e imágenes (para elegir un `.md` con las suyas). */
export const ACCEPT_ARCHIVOS = [ACCEPT, ...EXTENSIONES_IMAGEN].join(",");

/** ¿Merece la pena entregar este fichero de una carpeta? Solo Markdown e imágenes. */
const util = (nombre: string) => kindFromName(nombre) === "markdown" || tipoImagen(nombre) !== null;

const deFicheros = (files: readonly File[]): Seleccion => ({
  origen: "ficheros",
  entregados: files.map((file) => ({ ruta: file.name, file })),
});

/**
 * `<input webkitdirectory>`: cada `File` trae `webkitRelativePath`
 * (`carpeta/img/logo.png`). Se quita el primer segmento (el nombre de la
 * carpeta elegida: no hace falta) y lo que cuelga de `.git` o `node_modules`.
 */
function deCarpetaElegida(files: readonly File[]): Seleccion {
  const entregados: Seleccion["entregados"][number][] = [];
  for (const file of files) {
    const segmentos = (file.webkitRelativePath || file.name).split("/").slice(1);
    if (segmentos.some((s) => CARPETAS_IGNORADAS.has(s))) continue;
    const ruta = segmentos.join("/") || file.name;
    if (util(file.name)) entregados.push({ ruta, file });
  }
  return { origen: "carpeta", entregados };
}

/**
 * Lo soltado: una carpeta sola se recorre; ficheros sueltos se entregan tal
 * cual; una carpeta junto con otras cosas es un error (no se sabría cuál es la
 * raíz). Si el navegador no da entradas (`null`), se usan los ficheros planos.
 */
async function deSoltado({ ficheros, entradas }: Soltado): Promise<Seleccion> {
  const carpetas = entradas.filter((e): e is FileSystemDirectoryEntry => !!e?.isDirectory);
  const [carpeta] = carpetas;
  if (!carpeta) return deFicheros(ficheros);
  if (entradas.length > 1) throw new DocumentError("mixed-drop");
  return { origen: "carpeta", entregados: await recorrer(carpeta) };
}

/**
 * Recorre una carpeta soltada con la API estándar de entradas (File and
 * Directory Entries: Chrome, Edge, Firefox y Safari). Iterativo, con topes de
 * ficheros y de profundidad; solo pide el `File` de los Markdown y las
 * imágenes. Las rutas son relativas a la carpeta soltada.
 */
async function recorrer(raiz: FileSystemDirectoryEntry) {
  const entregados: { ruta: string; file: File }[] = [];
  const pendientes = [{ carpeta: raiz, prefijo: "", nivel: 0 }];
  let vistos = 0;
  while (pendientes.length > 0) {
    const { carpeta, prefijo, nivel } = pendientes.pop() as (typeof pendientes)[number];
    for (const entrada of await leerCarpeta(carpeta)) {
      if (++vistos > MAX_FICHEROS_CARPETA) throw new DocumentError("folder-too-large");
      const ruta = prefijo + entrada.name;
      if (entrada.isDirectory) {
        if (CARPETAS_IGNORADAS.has(entrada.name) || nivel + 1 > MAX_PROFUNDIDAD_CARPETA) continue;
        pendientes.push({
          carpeta: entrada as FileSystemDirectoryEntry,
          prefijo: `${ruta}/`,
          nivel: nivel + 1,
        });
      } else if (entrada.isFile && util(entrada.name)) {
        entregados.push({ ruta, file: await ficheroDe(entrada as FileSystemFileEntry) });
      }
    }
  }
  return entregados;
}

/** `readEntries` devuelve por lotes (100 en Chrome): se llama hasta que vuelve vacío. */
async function leerCarpeta(carpeta: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const lector = carpeta.createReader();
  const todas: FileSystemEntry[] = [];
  for (;;) {
    const lote = await new Promise<FileSystemEntry[]>((ok, mal) =>
      lector.readEntries(ok, mal),
    ).catch((cause) => {
      throw new DocumentError("unreadable", { cause });
    });
    if (lote.length === 0) return todas;
    todas.push(...lote);
  }
}

const ficheroDe = (entrada: FileSystemFileEntry) =>
  new Promise<File>((ok, mal) => entrada.file(ok, mal)).catch((cause) => {
    throw new DocumentError("unreadable", { cause });
  });

/**
 * El selector estándar: un `<input type="file">` creado al vuelo, fuera del
 * DOM y del árbol de accesibilidad. El control accesible es el botón que llama
 * a esta función (`click()` necesita ese gesto del usuario).
 *
 * - `ficheros`: selección múltiple con el filtro de documentos e imágenes.
 * - `carpeta`: `webkitdirectory` (Chrome, Edge, Firefox, Safari). El navegador
 *   puede pedir confirmación («¿subir N archivos?»): es su texto genérico;
 *   BPDF no sube nada.
 *
 * Cancelar resuelve `null` con el evento `cancel` (Chrome 113, Firefox 91,
 * Safari 16.4: los navegadores mínimos de `build.target`) o con un `change`
 * sin ficheros. Si un navegador no avisara, la promesa quedaría pendiente sin
 * efecto alguno: nadie espera por ella para desbloquear nada, y se libera con
 * el `<input>`.
 */
function elegir(doc: Document, modo: "ficheros" | "carpeta"): Promise<File[] | null> {
  return new Promise((resolve) => {
    const input = doc.createElement("input");
    input.type = "file";
    if (modo === "carpeta") input.webkitdirectory = true;
    else {
      input.multiple = true;
      input.accept = ACCEPT_ARCHIVOS;
    }
    input.addEventListener(
      "change",
      () => {
        const files = Array.from(input.files ?? []);
        resolve(files.length > 0 ? files : null);
      },
      { once: true },
    );
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}
