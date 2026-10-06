import type { Platform } from "./types";
import { createWebPlatform } from "./web";

export type {
  DocumentoAGuardar,
  OpcionesGuardado,
  Platform,
  ResultadoGuardado,
  Soltado,
} from "./types";

/**
 * La plataforma en la que corre la app: la web, la única (D19: BPDF no tiene
 * versión de escritorio). La frontera se mantiene porque aísla las APIs de
 * ficheros del navegador del resto de la app y deja usar una falsa en los tests.
 */
export function createPlatform(): Platform {
  return createWebPlatform();
}
