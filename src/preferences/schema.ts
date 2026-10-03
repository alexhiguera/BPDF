import { z } from "zod";
import { ZOOM_MAXIMO, ZOOM_MINIMO, type Zoom } from "@/pdf/visor/disposicion";

// Sin compilar validadores con `new Function`: la CSP de BPDF no permite `eval`
// (ni se abrirá para esto). Sin `jitless`, zod prueba `new Function("")` y, aunque
// captura el error, el navegador informa una violación de CSP (medido en los E2E).
z.config({ jitless: true });

/**
 * Esquemas de lo que BPDF guarda en `localStorage` (Fase 10, docs/PLAN.md §8 y
 * docs/FASES.md → Fase 10). Lo leído se trata como dato hostil (otra pestaña,
 * una versión futura, alguien que lo edite a mano): se valida aquí y nunca
 * rompe el arranque.
 *
 * Solo dos claves: `bpdf:prefs` y `bpdf:positions`. Nunca nombres de fichero,
 * rutas, contenido, contraseñas, opciones de búsqueda, estado del editor ni
 * posición de un Markdown.
 */

export const CLAVE_PREFERENCIAS = "bpdf:prefs";
export const CLAVE_POSICIONES = "bpdf:positions";

/** Versión actual de los dos esquemas. La v1 es la primera: no hay nada que migrar. */
export const VERSION = 1;

/** Tamaños de letra de Markdown, en px (17 = el de siempre, 1.0625rem). */
export const TAMANOS_LETRA = [15, 16, 17, 18, 20, 22] as const;
export type TamanoLetra = (typeof TAMANOS_LETRA)[number];

/** Anchos de la columna de Markdown, en `ch` (72 = el de siempre). */
export const ANCHOS = { estrecho: 60, normal: 72, ancho: 90 } as const;
export type Ancho = keyof typeof ANCHOS;

export type Preferencias = {
  v: typeof VERSION;
  pdf: {
    modo: "oscuro" | "original";
    zoom: Zoom;
    vista: "continua" | "pagina";
    miniaturas: boolean;
  };
  markdown: { tamanoLetra: TamanoLetra; ancho: Ancho };
  atajosUnaTecla: boolean;
  recordarPosicion: boolean;
};

/** Los valores por defecto: el comportamiento de BPDF antes de la Fase 10. */
export function preferenciasPorDefecto(): Preferencias {
  return {
    v: VERSION,
    pdf: { modo: "oscuro", zoom: { tipo: "ancho" }, vista: "continua", miniaturas: false },
    markdown: { tamanoLetra: 17, ancho: "normal" },
    atajosUnaTecla: true,
    recordarPosicion: true,
  };
}

const esquemaZoom = z.union([
  z.object({ tipo: z.literal("ancho") }),
  z.object({ tipo: z.literal("pagina") }),
  z.object({ tipo: z.literal("fijo"), valor: z.number().min(ZOOM_MINIMO).max(ZOOM_MAXIMO) }),
]);

/**
 * `bpdf:prefs`, campo a campo: un campo inválido (o que falta) vuelve a su
 * valor por defecto sin arrastrar a los demás. Lo que no pertenece al esquema
 * se descarta (`z.object` no copia claves desconocidas).
 */
const d = preferenciasPorDefecto;
export const esquemaPreferencias = z.object({
  v: z.literal(VERSION),
  pdf: z
    .object({
      modo: z.enum(["oscuro", "original"]).catch(() => d().pdf.modo),
      zoom: esquemaZoom.catch(() => d().pdf.zoom),
      vista: z.enum(["continua", "pagina"]).catch(() => d().pdf.vista),
      miniaturas: z.boolean().catch(() => d().pdf.miniaturas),
    })
    .catch(() => d().pdf),
  markdown: z
    .object({
      tamanoLetra: z.literal(TAMANOS_LETRA).catch(() => d().markdown.tamanoLetra),
      ancho: z.enum(["estrecho", "normal", "ancho"]).catch(() => d().markdown.ancho),
    })
    .catch(() => d().markdown),
  atajosUnaTecla: z.boolean().catch(() => d().atajosUnaTecla),
  recordarPosicion: z.boolean().catch(() => d().recordarPosicion),
});

/** Valida unas preferencias ya en la versión actual. `null` si no son de esa versión. */
export function validarPreferencias(datos: unknown): Preferencias | null {
  const r = esquemaPreferencias.safeParse(datos);
  return r.success ? (r.data as Preferencias) : null;
}

/** Máximo de posiciones guardadas (D8). Al pasar de aquí se borra la más antigua. */
export const MAX_POSICIONES = 50;

export type Posicion = { page: number; zoom: Zoom; t: number };
export type Posiciones = { v: typeof VERSION; docs: Record<string, Posicion> };

/**
 * Huella de un PDF: `fingerprints[0]` de pdf.js (hexadecimal). Se exige esa forma
 * también para que ninguna clave del registro pueda ser `__proto__` o similar.
 */
export const esHuella = (h: unknown): h is string =>
  typeof h === "string" && /^[0-9a-f]{1,64}$/i.test(h);

const esquemaPosicion = z.object({
  page: z.number().int().min(1),
  zoom: esquemaZoom,
  t: z.number().min(0),
});

/**
 * `bpdf:positions`: una entrada inválida se descarta sola; el resto se conserva.
 * Devuelve `null` si no es un registro de la versión actual.
 */
export function validarPosiciones(datos: unknown): Posiciones | null {
  if (typeof datos !== "object" || datos === null) return null;
  const { v, docs } = datos as { v?: unknown; docs?: unknown };
  if (v !== VERSION || typeof docs !== "object" || docs === null || Array.isArray(docs)) {
    return null;
  }
  const limpias: Record<string, Posicion> = {};
  for (const [huella, entrada] of Object.entries(docs)) {
    if (!esHuella(huella)) continue;
    const r = esquemaPosicion.safeParse(entrada);
    if (r.success) limpias[huella] = r.data as Posicion;
  }
  return { v: VERSION, docs: limpias };
}
