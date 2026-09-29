import type { Recoloreado } from "@/pdf/dark/recolor";
import type { SesionPdf } from "./sesion";

/**
 * Benchmark mínimo del spike (docs/PDF_DARK_MODE_SPIKE.md §8). Para una
 * página, a varias escalas y con el DPR real: render de pdf.js, transformación
 * selectiva, tamaño del lienzo y memoria.
 *
 * Memoria: el navegador no ofrece una medida fiable de lo que ocupa un lienzo.
 * `performance.memory` (solo Chromium, no estándar) cuenta el heap de
 * JavaScript, que NO incluye el almacenamiento de los lienzos. Por eso se
 * reporta también la cifra calculada: ancho × alto × 4 bytes.
 */
export type FilaMedicion = {
  escala: number;
  dpr: number;
  ancho: number;
  alto: number;
  msRender: number;
  msTransformacion: number;
  regiones: number;
  mibLienzo: number;
  mibTransitorio: number;
  mibHeap: number | null;
};

const MIB = 1024 * 1024;
const heap = (): number | null =>
  (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ??
  null;

export async function medirPagina(
  sesion: SesionPdf,
  {
    pagina,
    dpr,
    recolorear,
    escalas = [1, 2, 4],
  }: {
    pagina: number;
    dpr: number;
    recolorear: Recoloreado;
    escalas?: readonly number[];
  },
): Promise<FilaMedicion[]> {
  const filas: FilaMedicion[] = [];
  for (const escala of escalas) {
    // Un lienzo nuevo por medida: el render de pdf.js no reutiliza el anterior.
    const lienzo = document.createElement("canvas");
    const r = await sesion.pintar(lienzo, { pagina, escala, dpr, modo: "selectivo", recolorear });
    const h = heap();
    lienzo.width = 0;
    lienzo.height = 0;
    if (!r) continue;
    filas.push({
      escala,
      dpr,
      ancho: r.ancho,
      alto: r.alto,
      msRender: r.msRender,
      msTransformacion: r.msTransformacion,
      regiones: r.regiones,
      mibLienzo: (r.ancho * r.alto * 4) / MIB,
      mibTransitorio: r.bytesTransitorios / MIB,
      mibHeap: h === null ? null : h / MIB,
    });
  }
  return filas;
}
