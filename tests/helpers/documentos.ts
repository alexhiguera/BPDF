import { readDocument } from "@/documents/read";
import type { Platform } from "@/platform";

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
 * Plataforma en memoria: la validación es la real (`readDocument`); solo se
 * sustituye el selector del sistema por una cola de respuestas.
 */
export class PlataformaEnMemoria implements Platform {
  private cola: (File | null)[] = [];
  selectoresAbiertos = 0;

  /** Lo que «elegirá» el usuario la próxima vez (`null` = cancelar). */
  elegira(file: File | null): this {
    this.cola.push(file);
    return this;
  }

  async pickDocument() {
    this.selectoresAbiertos++;
    const file = this.cola.shift() ?? null;
    return file ? readDocument(file) : null;
  }

  openDroppedFile(file: File) {
    return readDocument(file);
  }

  /** Enlaces que la app ha pedido abrir fuera (no se abre nada). */
  readonly externas: string[] = [];
  openExternal(url: string) {
    this.externas.push(url);
  }
}
