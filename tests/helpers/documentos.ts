import { abrirSeleccion, type Seleccion } from "@/documents/seleccion";
import { type OpenedMarkdown, type RecursosDocumento, SIN_RECURSOS } from "@/documents/types";
import type { Platform, Soltado } from "@/platform";

/** Utilidades para construir ficheros y plataformas en los tests. */

export const PDF_VALIDO = "%PDF-1.4\n%prueba\n";

/** Primeros bytes de un PNG: lo que hay dentro de un «PDF falso». */
export const BYTES_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);

export function fichero(nombre: string, contenido: BlobPart = "", tipo = ""): File {
  return new File([contenido], nombre, { type: tipo });
}

/**
 * Un fichero cuya lectura no termina hasta que el test lo decide. Solo tiene
 * lo que `readDocument` usa de un `File`.
 */
export function ficheroLento(nombre: string, contenido: string) {
  let liberar: () => void = () => {};
  const listo = new Promise<void>((r) => {
    liberar = r;
  });
  const real = fichero(nombre, contenido);
  const file = {
    name: nombre,
    size: real.size,
    slice: (...a: Parameters<Blob["slice"]>) => real.slice(...a),
    arrayBuffer: async () => {
      await listo;
      return real.arrayBuffer();
    },
  } as unknown as File;
  return { file, liberar };
}

/**
 * Plataforma en memoria: la validación es la real (`abrirSeleccion`, que usa
 * `readDocument`); solo se sustituyen los selectores del sistema por colas de
 * respuestas.
 */
export class PlataformaEnMemoria implements Platform {
  private cola: (File[] | null)[] = [];
  private colaCarpetas: (Seleccion["entregados"] | null)[] = [];
  selectoresAbiertos = 0;

  /** Lo que «elegirá» el usuario en el selector de archivos (`null` = cancelar). */
  elegira(files: File | readonly File[] | null): this {
    this.cola.push(files === null ? null : Array.isArray(files) ? [...files] : [files as File]);
    return this;
  }

  /** Lo que «elegirá» en el selector de carpeta: rutas relativas a ella (`null` = cancelar). */
  elegiraCarpeta(entregados: Seleccion["entregados"] | null): this {
    this.colaCarpetas.push(entregados);
    return this;
  }

  async pickDocument() {
    this.selectoresAbiertos++;
    const files = this.cola.shift() ?? null;
    return files ? abrirSeleccion({ origen: "ficheros", entregados: planos(files) }) : null;
  }

  async pickFolder() {
    this.selectoresAbiertos++;
    const entregados = this.colaCarpetas.shift() ?? null;
    return entregados ? abrirSeleccion({ origen: "carpeta", entregados }) : null;
  }

  /** jsdom no tiene entradas de carpeta: lo soltado son siempre ficheros planos. */
  async openDropped(soltado: Soltado) {
    return abrirSeleccion({ origen: "ficheros", entregados: planos(soltado.ficheros) });
  }

  /** Enlaces que la app ha pedido abrir fuera (no se abre nada). */
  readonly externas: string[] = [];
  openExternal(url: string) {
    this.externas.push(url);
  }
}

const planos = (files: readonly File[]) => files.map((file) => ({ ruta: file.name, file }));

/** Lo que `DropZone` entregaría al soltar estos ficheros (sin carpetas). */
export const soltado = (...ficheros: File[]): Soltado => ({ ficheros, entradas: [] });

let idMarkdown = 0;

/** Un Markdown ya abierto, para montar el visor sin pasar por la apertura. */
export function markdown(
  text: string,
  name = "doc.md",
  resources: RecursosDocumento = SIN_RECURSOS,
): OpenedMarkdown {
  return { id: `md-${++idMarkdown}`, name, size: text.length, kind: "markdown", text, resources };
}
