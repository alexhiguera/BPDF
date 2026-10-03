import {
  CLAVE_PREFERENCIAS,
  type Preferencias,
  preferenciasPorDefecto,
  VERSION,
  validarPreferencias,
} from "./schema";

/**
 * Lectura y escritura de `localStorage` con versión (Fase 10, docs/PLAN.md §8).
 *
 * Todo acceso va en `try/catch`: en modo privado, sin cuota o con el
 * almacenamiento bloqueado, `localStorage` lanza (a veces ya al nombrarlo).
 * Entonces BPDF sigue con los valores en memoria; nada se rompe.
 *
 * **Versiones.** Cada clave guarda `{ v, … }`. Al leer:
 * - sin clave → vacío; JSON roto, `v` que no es un entero ≥ 1 o datos que no
 *   validan → corrupto (se usan los valores por defecto);
 * - `v` mayor que la actual (una versión futura de BPDF, en otra pestaña) →
 *   futuro: se usan los valores por defecto **en memoria** y la clave no se
 *   reescribe por su cuenta (solo si el usuario cambia algo);
 * - `v` menor → se aplican las migraciones paso a paso (`n → n + 1`) y se valida
 *   el resultado. La v1 es la primera: las tablas están vacías, y el mecanismo
 *   se prueba con tablas sintéticas.
 */

/** Paso de migración de la versión `n` (la clave) a la `n + 1`. */
export type Migraciones = Readonly<Record<number, (datos: unknown) => unknown>>;

/** v1 es la primera versión: no hay migraciones todavía. */
export const MIGRACIONES_PREFERENCIAS: Migraciones = {};
export const MIGRACIONES_POSICIONES: Migraciones = {};

export type Lectura<T> =
  | { estado: "vacio" | "corrupto" | "futuro"; valor: null }
  | { estado: "valido" | "migrado"; valor: T };

/** `localStorage`, o `null` si el navegador no deja usarlo. */
export function almacenamiento(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function leerVersionado<T>(
  clave: string,
  validar: (datos: unknown) => T | null,
  migraciones: Migraciones,
  version: number = VERSION,
  almacen: Storage | null = almacenamiento(),
): Lectura<T> {
  let crudo: string | null;
  try {
    crudo = almacen ? almacen.getItem(clave) : null;
  } catch {
    crudo = null;
  }
  if (crudo === null) return { estado: "vacio", valor: null };
  let datos: unknown;
  try {
    datos = JSON.parse(crudo);
  } catch {
    return { estado: "corrupto", valor: null };
  }
  const v = typeof datos === "object" && datos !== null ? (datos as { v?: unknown }).v : undefined;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) {
    return { estado: "corrupto", valor: null };
  }
  if (v > version) return { estado: "futuro", valor: null };
  try {
    for (let n = v; n < version; n++) {
      const paso = migraciones[n];
      if (!paso) return { estado: "corrupto", valor: null };
      datos = paso(datos);
    }
  } catch {
    return { estado: "corrupto", valor: null };
  }
  const valor = validar(datos);
  if (valor === null) return { estado: "corrupto", valor: null };
  return { estado: v < version ? "migrado" : "valido", valor };
}

/** Escribe `valor` como JSON. `false` si no se pudo (sin almacenamiento, cuota…). */
export function escribir(
  clave: string,
  valor: unknown,
  almacen: Storage | null = almacenamiento(),
): boolean {
  if (!almacen) return false;
  try {
    almacen.setItem(clave, JSON.stringify(valor));
    return true;
  } catch {
    return false;
  }
}

export function borrar(clave: string, almacen: Storage | null = almacenamiento()): void {
  try {
    almacen?.removeItem(clave);
  } catch {
    // Sin almacenamiento no hay nada que borrar.
  }
}

// --- Preferencias (`bpdf:prefs`) ---------------------------------------------
//
// Una sola copia en memoria para toda la app, compartida por `usePreferences`:
// el objeto solo se sustituye cuando algo cambia (los componentes no se
// vuelven a pintar por nada). Los cambios de otra pestaña llegan por el evento
// `storage`, que no se dispara en la pestaña que escribe: por eso los de esta
// se avisan aquí mismo.

let actuales: Preferencias | null = null;
const oyentes = new Set<() => void>();

function cargar(): Preferencias {
  return (
    leerVersionado(CLAVE_PREFERENCIAS, validarPreferencias, MIGRACIONES_PREFERENCIAS).valor ??
    preferenciasPorDefecto()
  );
}

const iguales = (a: Preferencias, b: Preferencias) => JSON.stringify(a) === JSON.stringify(b);

function avisar(): void {
  for (const oyente of [...oyentes]) oyente();
}

export function obtenerPreferencias(): Preferencias {
  actuales ??= cargar();
  return actuales;
}

/**
 * Cambia las preferencias y las guarda. Lo que salga de `cambio` se valida: un
 * valor fuera del esquema vuelve a su valor por defecto. Si no se puede
 * escribir, el cambio vale igual para esta sesión.
 */
export function cambiarPreferencias(cambio: (actual: Preferencias) => Preferencias): void {
  const previas = obtenerPreferencias();
  const nuevas = validarPreferencias(cambio(previas)) ?? previas;
  if (iguales(nuevas, previas)) return;
  actuales = nuevas;
  escribir(CLAVE_PREFERENCIAS, nuevas);
  avisar();
}

/** «Restablecer preferencias»: borra `bpdf:prefs` (no toca las posiciones). */
export function restablecerPreferencias(): void {
  borrar(CLAVE_PREFERENCIAS);
  const previas = obtenerPreferencias();
  actuales = preferenciasPorDefecto();
  if (!iguales(actuales, previas)) avisar();
}

function alCambiarEnOtraPestana(e: StorageEvent): void {
  // `key === null`: la otra pestaña vació todo el almacenamiento.
  if (e.key !== null && e.key !== CLAVE_PREFERENCIAS) return;
  const nuevas = cargar();
  if (actuales && iguales(nuevas, actuales)) return;
  actuales = nuevas;
  avisar();
}

/** Para `useSyncExternalStore`: avisa de cualquier cambio, de esta pestaña o de otra. */
export function suscribirPreferencias(oyente: () => void): () => void {
  oyentes.add(oyente);
  if (oyentes.size === 1 && typeof window !== "undefined") {
    window.addEventListener("storage", alCambiarEnOtraPestana);
  }
  return () => {
    oyentes.delete(oyente);
    if (oyentes.size === 0 && typeof window !== "undefined") {
      window.removeEventListener("storage", alCambiarEnOtraPestana);
    }
  };
}

/** Solo para los tests: olvida la copia en memoria (el almacenamiento no se toca). */
export function reiniciarPreferenciasEnMemoria(): void {
  actuales = null;
}
