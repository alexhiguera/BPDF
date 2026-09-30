import type { Platform } from "./types";
import { createWebPlatform } from "./web";

export type { Platform, Soltado } from "./types";

/**
 * La plataforma en la que corre la app. Hoy solo existe la web; la Fase 14
 * añadirá aquí la rama de Electron (según exista `window.bpdf`, que expone su
 * preload). No se simula antes: no hay IPC ni preload que detectar.
 */
export function createPlatform(): Platform {
  return createWebPlatform();
}
