/**
 * Worker del modo oscuro: recolorea franjas de píxeles fuera del hilo principal
 * (docs/ARCHITECTURE.md → visor PDF, «Worker»). No ve el documento ni el DOM:
 * recibe bytes RGBA, los recolorea y los devuelve transferidos (sin copia).
 *
 * Mensajes: `PeticionFranja` → `RespuestaFranja`. La caché de colores de
 * `crearRecoloreado` vive aquí y se reutiliza entre franjas y páginas mientras
 * los colores de destino no cambien.
 */
import { type ColoresOscuro, oscurecerFranja } from "./aplicar";
import { crearRecoloreado, type Recoloreado } from "./recolor";
import type { Paralelogramo } from "./regiones";

export type PeticionFranja = {
  id: number;
  datos: ArrayBuffer;
  ancho: number;
  y0: number;
  conservar: readonly Paralelogramo[];
  colores: ColoresOscuro;
};
export type RespuestaFranja = { id: number; datos: ArrayBuffer } | { id: number; error: string };

/** El ámbito del worker, sin mezclar los tipos de `lib.webworker` con los del DOM. */
const ambito = self as unknown as {
  onmessage: ((e: MessageEvent<PeticionFranja>) => void) | null;
  postMessage(mensaje: RespuestaFranja, transferir?: Transferable[]): void;
};

let clave = "";
let recolorear: Recoloreado | null = null;

ambito.onmessage = (evento) => {
  const { id, datos, ancho, y0, conservar, colores } = evento.data;
  try {
    const nueva = JSON.stringify(colores);
    if (nueva !== clave || !recolorear) {
      recolorear = crearRecoloreado(colores);
      clave = nueva;
    }
    oscurecerFranja(new Uint8ClampedArray(datos), ancho, y0, conservar, recolorear);
    ambito.postMessage({ id, datos }, [datos]);
  } catch (error) {
    ambito.postMessage({ id, error: String(error) });
  }
};
