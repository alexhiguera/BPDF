import type { Zoom } from "@/pdf/visor/disposicion";
import {
  CLAVE_POSICIONES,
  esHuella,
  MAX_POSICIONES,
  type Posicion,
  type Posiciones,
  VERSION,
  validarPosiciones,
} from "./schema";
import { borrar, escribir, leerVersionado, MIGRACIONES_POSICIONES } from "./store";

/**
 * Página y zoom de cada PDF (Fase 10, D8), en `bpdf:positions`:
 * `{ v: 1, docs: { [huella]: { page, zoom, t } } }`.
 *
 * - **Solo PDF.** La huella es `fingerprints[0]` de pdf.js (la calcula del ID del
 *   fichero). Nunca el nombre ni el contenido. Un Markdown no guarda posición.
 * - Como mucho `MAX_POSICIONES`: al pasar, se borran las de `t` más antiguo.
 * - Con una versión futura guardada (otra pestaña con un BPDF más nuevo) no se
 *   lee ni se escribe nada: guardar posiciones es automático y no debe pisarla.
 *   «Olvidar posiciones guardadas» sí la borra (lo pide el usuario).
 *
 * Quien llama decide si «Recordar la posición» está activado.
 */

const leer = () => leerVersionado(CLAVE_POSICIONES, validarPosiciones, MIGRACIONES_POSICIONES);

/** Deja las `MAX_POSICIONES` de `t` más reciente. */
export function recortar(docs: Record<string, Posicion>): Record<string, Posicion> {
  const entradas = Object.entries(docs);
  if (entradas.length <= MAX_POSICIONES) return docs;
  entradas.sort(([, a], [, b]) => b.t - a.t);
  return Object.fromEntries(entradas.slice(0, MAX_POSICIONES));
}

function guardar(docs: Record<string, Posicion>): void {
  const registro: Posiciones = { v: VERSION, docs: recortar(docs) };
  escribir(CLAVE_POSICIONES, registro);
}

/**
 * La posición guardada de un PDF, o `null`. Recuperarla cuenta como uso: su `t`
 * pasa a `ahora` (la última en olvidarse por antigüedad).
 */
export function recuperarPosicion(huella: string, ahora = Date.now()): Posicion | null {
  if (!esHuella(huella)) return null;
  const lectura = leer();
  if (!lectura.valor) return null;
  const guardada = lectura.valor.docs[huella];
  if (!guardada) return null;
  guardar({ ...lectura.valor.docs, [huella]: { ...guardada, t: ahora } });
  return guardada;
}

export function guardarPosicion(
  huella: string,
  posicion: { page: number; zoom: Zoom },
  ahora = Date.now(),
): void {
  if (!esHuella(huella)) return;
  const lectura = leer();
  if (lectura.estado === "futuro") return;
  const docs = lectura.valor?.docs ?? {};
  guardar({ ...docs, [huella]: { page: posicion.page, zoom: posicion.zoom, t: ahora } });
}

/** «Olvidar posiciones guardadas»: borra `bpdf:positions` entero. */
export function olvidarPosiciones(): void {
  borrar(CLAVE_POSICIONES);
}
