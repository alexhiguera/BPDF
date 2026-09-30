import type { RecursoLocal } from "@/documents/types";

/**
 * Las URL de objeto (`blob:`) de las imágenes locales de UN documento
 * (Fase 7 bis, docs/ARCHITECTURE.md §4 sexies).
 *
 * Ciclo de vida:
 *
 * - **Solo lo que se pinta.** Una URL se crea cuando una imagen del documento
 *   la pide (`adquirir`), no al abrir: un recurso entregado que el texto no
 *   usa nunca tiene URL.
 * - **Una por recurso**, aunque el documento lo use diez veces: cada
 *   `adquirir` suma un uso y cada `liberar` resta; al llegar a cero, se revoca.
 * - **Nada sobrevive al visor**: `revocarTodo` al desmontar (cerrar o abrir
 *   otro documento) revoca lo que quedara.
 *
 * `URL.createObjectURL` no copia los bytes: la URL apunta al `Blob`, que en
 * web es un trozo del `File` en disco. Revocarla permite al navegador soltar
 * esa referencia.
 */
export class AlmacenUrls {
  private readonly vivas = new Map<RecursoLocal, { url: string; usos: number }>();

  constructor(
    private readonly crear: (blob: Blob) => string = (b) => URL.createObjectURL(b),
    private readonly revocar: (url: string) => void = (u) => URL.revokeObjectURL(u),
  ) {}

  adquirir(recurso: RecursoLocal): string {
    const viva = this.vivas.get(recurso);
    if (viva) {
      viva.usos++;
      return viva.url;
    }
    const url = this.crear(recurso.blob);
    this.vivas.set(recurso, { url, usos: 1 });
    return url;
  }

  liberar(recurso: RecursoLocal): void {
    const viva = this.vivas.get(recurso);
    if (!viva) return;
    if (--viva.usos > 0) return;
    this.vivas.delete(recurso);
    this.revocar(viva.url);
  }

  revocarTodo(): void {
    for (const { url } of this.vivas.values()) this.revocar(url);
    this.vivas.clear();
  }

  /** URL vivas ahora mismo (para tests y depuración). */
  get tamano(): number {
    return this.vivas.size;
  }
}
