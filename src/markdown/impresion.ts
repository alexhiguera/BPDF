/**
 * Exportar un Markdown a PDF (Fase 17, docs/ARCHITECTURE.md §4 duodecies) con la
 * impresión del navegador: `window.print()` y «Guardar como PDF» en su diálogo.
 * Sin librería de PDF ni servidor: el texto queda seleccionable, las fórmulas y
 * los diagramas, vectoriales, y los enlaces, activos.
 *
 * Lo que se imprime es una copia del documento renderizada con el mismo pipeline
 * (`Contenido`) en un contenedor aparte (`.bpdf-impresion`, oculto en pantalla;
 * en impresión, lo único visible: `impresion.css`). Antes de abrir el diálogo hay
 * que esperar a que esté COMPLETO: KaTeX y Mermaid se cargan a demanda y las
 * imágenes se decodifican aparte, así que imprimir enseguida sacaría fórmulas
 * como código, «Dibujando el diagrama…» o huecos.
 */

/** Tema del PDF exportado. Efímero: no es una preferencia ni se guarda en ningún sitio. */
export type TemaExportacion = "claro" | "oscuro";

/**
 * Lo que aún no está listo dentro de `raiz`: fórmulas cargando, diagramas sin
 * dibujar e imágenes sin terminar de cargar. Una fórmula o un diagrama con error
 * SÍ están listos (se ven como código, con su aviso), y una imagen rota también
 * (`complete` es `true` cuando el navegador ha terminado, bien o mal).
 */
export function pendientesDeImpresion(raiz: ParentNode): number {
  let pendientes = raiz.querySelectorAll(
    '[data-formula="cargando"], [data-diagrama="esperando"], [data-diagrama="dibujando"]',
  ).length;
  for (const img of raiz.querySelectorAll("img")) if (!img.complete) pendientes++;
  return pendientes;
}

/**
 * Tope de la espera: más que la de un diagrama (`ESPERA_MAXIMA_MS`, 20 s, tras la
 * que se muestra con error, es decir, listo). Si se pasa, no se imprime: mejor un
 * aviso que un PDF con huecos.
 */
export const ESPERA_IMPRESION_MS = 30_000;

/** Cada cuánto se mira. Dos miradas seguidas sin nada pendiente dan el documento por listo. */
export const INTERVALO_IMPRESION_MS = 50;

/**
 * Resuelve cuando `raiz` lleva dos miradas seguidas sin nada pendiente. Dos y no
 * una: justo después de montarse, una imagen local aún no existe (su URL llega en
 * un efecto) y el documento parecería listo sin estarlo. Rechaza si se agota el
 * tiempo o si se cancela (`senal`).
 */
export function esperarImpresion(
  raiz: ParentNode,
  {
    senal,
    maxMs = ESPERA_IMPRESION_MS,
    intervaloMs = INTERVALO_IMPRESION_MS,
  }: { senal?: AbortSignal; maxMs?: number; intervaloMs?: number } = {},
): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const inicio = Date.now();
    let limpias = 0;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    const cancelar = () => {
      clearTimeout(temporizador);
      rechazar(new DOMException("Exportación cancelada", "AbortError"));
    };
    if (senal?.aborted) return cancelar();
    senal?.addEventListener("abort", cancelar, { once: true });
    const mirar = () => {
      limpias = pendientesDeImpresion(raiz) === 0 ? limpias + 1 : 0;
      if (limpias >= 2) {
        senal?.removeEventListener("abort", cancelar);
        resolver();
      } else if (Date.now() - inicio >= maxMs) {
        senal?.removeEventListener("abort", cancelar);
        rechazar(new Error("El documento no terminó de prepararse para imprimir"));
      } else {
        temporizador = setTimeout(mirar, intervaloMs);
      }
    };
    mirar();
  });
}

/**
 * Abre el diálogo de impresión. `limpiar` se llama al cerrarse (`afterprint`):
 * hasta entonces la copia imprimible tiene que seguir montada, porque en algunos
 * navegadores `print()` vuelve antes de imprimir. Devuelve `false` si el
 * navegador no puede imprimir (sin `window.print`, o lanza): entonces ya ha
 * limpiado.
 *
 * `senal`: quien llama la cancela si se va antes de que llegue `afterprint` (se
 * cierra el documento, o empieza otra exportación). Entonces se quita el oyente sin
 * llamar a `limpiar`: no queda nada colgado de `window`, y un `afterprint` tardío no
 * desmonta la copia de una exportación posterior.
 */
export function imprimir(ventana: Window, limpiar: () => void, senal?: AbortSignal): boolean {
  if (typeof ventana.print !== "function") {
    limpiar();
    return false;
  }
  const quitar = () => {
    ventana.removeEventListener("afterprint", alTerminar);
    senal?.removeEventListener("abort", quitar);
  };
  const alTerminar = () => {
    quitar();
    limpiar();
  };
  ventana.addEventListener("afterprint", alTerminar);
  senal?.addEventListener("abort", quitar, { once: true });
  try {
    ventana.print();
    return true;
  } catch {
    alTerminar();
    return false;
  }
}
