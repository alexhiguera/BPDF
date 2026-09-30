import type { MermaidConfig } from "mermaid";

/**
 * Lo que comparten la app y el marco aislado de Mermaid (Fase 8): la
 * configuración, los topes y el protocolo de mensajes. Sin la librería: la
 * app nunca importa Mermaid, solo el marco (`marco-mermaid.ts`).
 */

/** Más largo que esto no es un diagrama escrito a mano. */
export const MAX_DIAGRAMA = 50_000;

/**
 * Nodos con imagen (`A@{ img: "…" }`, Mermaid 11): para medirlos, Mermaid
 * carga la imagen. En el marco la CSP lo impide (`img-src 'none'`), pero BPDF
 * no deja ni intentarlo: esos diagramas no se dibujan (se muestra su código).
 */
export const NODO_CON_IMAGEN = /@\{[^}]*\bimg\s*:/;

/** Más grande que esto no es el SVG de un diagrama razonable. */
export const MAX_SVG = 5 * 1024 * 1024;

/** Colores del tema de BPDF para los diagramas (de los tokens). */
export type ColoresDiagrama = {
  fondo: string;
  nodo: string;
  texto: string;
  linea: string;
  acento: string;
};

/**
 * Configuración estricta (docs/SEGURIDAD.md §3.1):
 *
 * - `securityLevel: "strict"`: Mermaid escapa el HTML de las etiquetas,
 *   desactiva `click` (ni llamadas a funciones ni enlaces) y sanea su salida
 *   con DOMPurify.
 * - `htmlLabels: false`: etiquetas como `<text>` de SVG, no HTML dentro de
 *   `<foreignObject>`.
 * - `secure`: claves que un diagrama NO puede cambiar con `%%{init: …}%%`:
 *   las que Mermaid protege por defecto y todo lo que afecta a la seguridad o
 *   al aspecto (etiquetas HTML, tema, CSS propio, DOMPurify).
 * - Topes: `maxTextSize` (caracteres) y `maxEdges` (aristas).
 * - `suppressErrorRendering`: un error no pinta el SVG de «bomba» de Mermaid.
 */
export function configuracionMermaid(colores: ColoresDiagrama): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: "strict",
    htmlLabels: false,
    flowchart: { htmlLabels: false },
    maxTextSize: MAX_DIAGRAMA,
    maxEdges: 500,
    suppressErrorRendering: true,
    deterministicIds: true,
    deterministicIDSeed: "bpdf",
    theme: "base",
    themeVariables: {
      darkMode: true,
      background: colores.fondo,
      primaryColor: colores.nodo,
      primaryTextColor: colores.texto,
      primaryBorderColor: colores.acento,
      lineColor: colores.linea,
      secondaryColor: colores.nodo,
      tertiaryColor: colores.fondo,
      textColor: colores.texto,
      edgeLabelBackground: colores.fondo,
      clusterBkg: colores.fondo,
      fontFamily: "system-ui, sans-serif",
    },
    fontFamily: "system-ui, sans-serif",
    secure: [
      "secure",
      "securityLevel",
      "startOnLoad",
      "maxTextSize",
      "maxEdges",
      "suppressErrorRendering",
      "htmlLabels",
      "flowchart",
      "theme",
      "themeVariables",
      "themeCSS",
      "fontFamily",
      "dompurifyConfig",
      "deterministicIds",
      "deterministicIDSeed",
      "arrowMarkerAbsolute",
    ],
  };
}

/** De la app al marco. */
export type PeticionDiagrama = {
  tipo: "bpdf-dibujar";
  id: number;
  fuente: string;
  colores: ColoresDiagrama;
};

/** Del marco a la app. */
export type RespuestaMarco =
  | { tipo: "bpdf-listo" }
  | { tipo: "bpdf-svg"; id: number; svg: string }
  | { tipo: "bpdf-error"; id: number; motivo: MotivoError };

export type MotivoError = "invalid" | "tooLarge" | "images";

/** ¿Es una petición bien formada? El marco no se fía de lo que recibe. */
export function esPeticion(dato: unknown): dato is PeticionDiagrama {
  const d = dato as PeticionDiagrama;
  return (
    typeof d === "object" &&
    d !== null &&
    d.tipo === "bpdf-dibujar" &&
    Number.isSafeInteger(d.id) &&
    typeof d.fuente === "string" &&
    typeof d.colores === "object" &&
    d.colores !== null &&
    ["fondo", "nodo", "texto", "linea", "acento"].every((k) =>
      /^#[0-9a-f]{6}$/i.test(String((d.colores as Record<string, unknown>)[k])),
    )
  );
}

/** ¿Es una respuesta bien formada? La app tampoco se fía del marco. */
export function esRespuesta(dato: unknown): dato is RespuestaMarco {
  const d = dato as RespuestaMarco;
  if (typeof d !== "object" || d === null) return false;
  if (d.tipo === "bpdf-listo") return true;
  if (!Number.isSafeInteger((d as { id?: unknown }).id)) return false;
  if (d.tipo === "bpdf-svg") return typeof d.svg === "string" && d.svg.length <= MAX_SVG;
  return (
    d.tipo === "bpdf-error" &&
    (d.motivo === "invalid" || d.motivo === "tooLarge" || d.motivo === "images")
  );
}
