import { useSyncExternalStore } from "react";
import type { Preferencias } from "./schema";
import { obtenerPreferencias, suscribirPreferencias } from "./store";

/**
 * Las preferencias guardadas (Fase 10), al día con esta pestaña y con las demás
 * (evento `storage`). El objeto es el mismo mientras nada cambie. Para
 * cambiarlas: `cambiarPreferencias` y `restablecerPreferencias` (`store.ts`).
 */
export function usePreferences(): Preferencias {
  return useSyncExternalStore(suscribirPreferencias, obtenerPreferencias, obtenerPreferencias);
}
