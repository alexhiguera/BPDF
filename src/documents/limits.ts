import type { DocumentKind } from "./types";

const MiB = 1024 * 1024;

/**
 * Tamaño máximo por tipo de documento (docs/PLAN.md §4.2). Por encima se
 * muestra un error y no se intenta leer nada. Son topes contra el agotamiento
 * de memoria, no contra documentos normales; se ajustan con mediciones
 * (Fase 13), no a ojo.
 *
 * - **PDF, 512 MiB.** Abrir el fichero no lo lee, pero el visor sí: pdf.js
 *   recibe el documento entero como `ArrayBuffer` (Fase 5) y, al parsear, crea
 *   estructuras propias encima. Un búfer de 512 MiB es asumible en un equipo de
 *   escritorio; uno de varios GB puede agotar la memoria de la pestaña y
 *   hacerla caer sin aviso, que es peor que un mensaje.
 *   Los PDF reales, incluso escaneados de cientos de páginas, quedan muy por
 *   debajo.
 * - **Markdown, 20 MiB.** El texto se decodifica entero a una cadena de JS (en
 *   UTF-16: hasta el doble de bytes) y el render (Fase 7) construye encima dos
 *   árboles (mdast y hast) y otro de React, varias veces más grandes que el
 *   texto. 20 MiB es cuatro veces el documento grande del corpus de
 *   rendimiento (5 MB, Fase 13) y un Markdown escrito a mano no se acerca.
 */
export const MAX_BYTES: Readonly<Record<DocumentKind, number>> = {
  pdf: 512 * MiB,
  markdown: 20 * MiB,
};

/**
 * Hasta dónde se busca la firma `%PDF-`. La especificación la pone al
 * principio, pero los lectores (Acrobat, pdf.js) toleran basura delante y
 * Acrobat busca en los primeros 1024 bytes: aceptamos lo mismo que ellos.
 */
export const PDF_SIGNATURE_WINDOW = 1024;

/**
 * Tamaño máximo de una imagen de un Markdown (Fase 7 bis). La imagen no se lee
 * al abrir (se guarda el `File`), pero al pintarla el navegador la decodifica
 * entera: un PNG muy comprimido de pocos MB puede ser una imagen de cientos de
 * megapíxeles. 50 MiB deja pasar cualquier foto o captura real.
 */
export const MAX_BYTES_IMAGEN = 50 * MiB;

/**
 * Tope de ficheros de una carpeta abierta o soltada (Fase 7 bis). Recorrerla no
 * lee ningún fichero, pero cada uno es una entrada en memoria; una carpeta con
 * más no es la de un documento (un repositorio entero, una unidad).
 */
export const MAX_FICHEROS_CARPETA = 10_000;

/** Profundidad máxima al recorrer una carpeta soltada (enlaces cíclicos, árboles absurdos). */
export const MAX_PROFUNDIDAD_CARPETA = 32;

/**
 * Carpetas que no se recorren al abrir o soltar una carpeta: nunca contienen
 * las imágenes de un documento y pueden tener decenas de miles de ficheros.
 */
export const CARPETAS_IGNORADAS: ReadonlySet<string> = new Set([".git", "node_modules"]);
