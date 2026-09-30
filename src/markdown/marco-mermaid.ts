import mermaid from "mermaid";
import {
  type ColoresDiagrama,
  configuracionMermaid,
  esPeticion,
  MAX_DIAGRAMA,
  NODO_CON_IMAGEN,
  type RespuestaMarco,
} from "./mermaid-config";
import { sanearSvg } from "./svg-seguro";

/**
 * El marco aislado de Mermaid (Fase 8): lo único que se ejecuta en
 * `/mermaid.html`, dentro de un iframe con `sandbox="allow-scripts"`.
 *
 * - **Solo funciona aislado.** Si su origen no es opaco (la página se abre
 *   directamente, o otra web la enmarca sin sandbox) o no tiene padre, no hace
 *   nada: no escucha mensajes.
 * - **Solo escucha a su padre** (`event.source === window.parent`) y solo
 *   peticiones bien formadas (`esPeticion`).
 * - Dibuja de una en una (Mermaid usa un contenedor temporal único), limpia el
 *   SVG (`sanearSvg`) y responde con él o con el motivo del error. La app lo
 *   vuelve a comprobar (`verificarSvg`): no se fía del marco.
 * - Sin red: su CSP (`CSP_MARCO_MERMAID`) no deja pedir nada.
 */
const aislado = self.origin === "null" && window.parent !== window;

if (aislado) {
  let iniciado = false;
  let cola: Promise<unknown> = Promise.resolve();

  const responder = (r: RespuestaMarco) => window.parent.postMessage(r, "*");

  const dibujar = async (id: number, fuente: string, colores: ColoresDiagrama) => {
    if (fuente.length > MAX_DIAGRAMA)
      return responder({ tipo: "bpdf-error", id, motivo: "tooLarge" });
    if (NODO_CON_IMAGEN.test(fuente))
      return responder({ tipo: "bpdf-error", id, motivo: "images" });
    if (!iniciado) {
      mermaid.initialize(configuracionMermaid(colores));
      iniciado = true;
    }
    const elemento = `bpdf-mermaid-${id}`;
    try {
      const { svg } = await mermaid.render(elemento, fuente);
      // Limpieza con DOM AQUÍ, donde la CSP permite los estilos en línea del SVG.
      const limpio = sanearSvg(svg);
      if (limpio) responder({ tipo: "bpdf-svg", id, svg: limpio });
      else responder({ tipo: "bpdf-error", id, motivo: "invalid" });
    } catch (e) {
      const texto = e instanceof Error ? e.message : String(e);
      const grande = /maximum|too (large|many)|edges|maxTextSize/i.test(texto);
      responder({ tipo: "bpdf-error", id, motivo: grande ? "tooLarge" : "invalid" });
    } finally {
      document.getElementById(`d${elemento}`)?.remove();
      document.getElementById(elemento)?.remove();
    }
  };

  window.addEventListener("message", (evento) => {
    if (evento.source !== window.parent || !esPeticion(evento.data)) return;
    const { id, fuente, colores } = evento.data;
    cola = cola.then(() => dibujar(id, fuente, colores)).catch(() => {});
  });

  responder({ tipo: "bpdf-listo" });
}
