import { RUTA_MARCO_MERMAID } from "@/config/security-headers";
import { messages } from "@/i18n/messages";
import {
  type ColoresDiagrama,
  esRespuesta,
  MAX_DIAGRAMA,
  type PeticionDiagrama,
} from "./mermaid-config";
import { verificarSvg } from "./svg-seguro";

/**
 * Diagramas Mermaid desde la app (Fase 8, docs/ARCHITECTURE.md §4 septies).
 *
 * La app **nunca ejecuta Mermaid**: lo hace el marco aislado
 * (`/mermaid.html`, `marco-mermaid.ts`) dentro de un iframe con
 * `sandbox="allow-scripts"` (sin `allow-same-origin`: origen opaco, sin acceso
 * al DOM, al almacenamiento ni a las cookies de BPDF). Mermaid necesita
 * estilos en línea que la CSP de la app no permite; el marco tiene su propia
 * CSP, que sí los permite pero no deja pedir nada a la red.
 *
 * Una instancia por visor: el iframe se crea con el primer diagrama (ni
 * Mermaid ni su página se descargan si el documento no tiene diagramas) y se
 * elimina, con su listener, al destruirse el visor.
 */

export class DiagramaInvalidoError extends Error {}
export class DiagramaGrandeError extends Error {}
export class DiagramaConImagenesError extends Error {}

/** Si el marco no responde en este tiempo, el diagrama se da por fallido. */
export const ESPERA_MAXIMA_MS = 20_000;

/** SVG dibujados que se recuerdan por visor (Fase 9). */
export const MAX_CACHE = 64;

type Pendiente = {
  resolver: (svg: string) => void;
  rechazar: (e: Error) => void;
  temporizador: ReturnType<typeof setTimeout>;
};

export class MarcoMermaid {
  private iframe: HTMLIFrameElement | null = null;
  private listo: Promise<void> | null = null;
  private avisarListo: () => void = () => {};
  private readonly pendientes = new Map<number, Pendiente>();
  private siguiente = 0;
  private destruido = false;
  /**
   * Fase 9: los SVG ya dibujados, por fuente y colores. Al editar, la vista
   * previa vuelve a pintar el documento y un diagrama que no ha cambiado (o que
   * solo ha cambiado de sitio) no vuelve al marco. Solo los que salieron bien;
   * como mucho `MAX_CACHE`, los más recientes.
   */
  private readonly cache = new Map<string, Promise<string>>();

  constructor(private readonly doc: Document = document) {}

  /** El SVG del diagrama, saneado en el marco y verificado aquí. */
  dibujar(fuente: string, colores: ColoresDiagrama): Promise<string> {
    if (this.destruido) return Promise.reject(new DiagramaInvalidoError());
    if (fuente.length > MAX_DIAGRAMA) return Promise.reject(new DiagramaGrandeError());
    const clave = `${JSON.stringify(colores)}\u0000${fuente}`;
    const hecho = this.cache.get(clave);
    if (hecho) {
      // Reinsertar: el más reciente queda al final (el primero es el que sale).
      this.cache.delete(clave);
      this.cache.set(clave, hecho);
      return hecho;
    }
    const svg = this.pedir(fuente, colores);
    this.cache.set(clave, svg);
    if (this.cache.size > MAX_CACHE) this.cache.delete(this.cache.keys().next().value as string);
    svg.catch(() => {
      if (this.cache.get(clave) === svg) this.cache.delete(clave);
    });
    return svg;
  }

  private pedir(fuente: string, colores: ColoresDiagrama): Promise<string> {
    const id = ++this.siguiente;
    return new Promise<string>((resolver, rechazar) => {
      const temporizador = setTimeout(() => {
        this.pendientes.delete(id);
        rechazar(new DiagramaGrandeError());
      }, ESPERA_MAXIMA_MS);
      this.pendientes.set(id, { resolver, rechazar, temporizador });
      this.preparar().then(() => {
        const peticion: PeticionDiagrama = { tipo: "bpdf-dibujar", id, fuente, colores };
        // El marco tiene origen opaco: no hay otro origen de destino posible que "*".
        // El mensaje solo llega a ESE iframe (su `contentWindow`).
        this.iframe?.contentWindow?.postMessage(peticion, "*");
      });
    });
  }

  /** Quita el iframe y el listener y rechaza lo pendiente. */
  destruir() {
    this.destruido = true;
    this.doc.defaultView?.removeEventListener("message", this.alMensaje);
    this.iframe?.remove();
    this.iframe = null;
    this.cache.clear();
    for (const p of this.pendientes.values()) {
      clearTimeout(p.temporizador);
      p.rechazar(new DiagramaInvalidoError());
    }
    this.pendientes.clear();
  }

  private preparar(): Promise<void> {
    if (this.listo) return this.listo;
    this.listo = new Promise<void>((ok) => {
      this.avisarListo = ok;
    });
    this.doc.defaultView?.addEventListener("message", this.alMensaje);
    const iframe = this.doc.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("aria-hidden", "true");
    iframe.setAttribute("tabindex", "-1");
    iframe.setAttribute("referrerpolicy", "no-referrer");
    iframe.title = messages.markdown.diagram.frame;
    iframe.className = "bpdf-marco-mermaid";
    iframe.src = RUTA_MARCO_MERMAID;
    this.doc.body.append(iframe);
    this.iframe = iframe;
    return this.listo;
  }

  /**
   * Solo se atienden mensajes de ESTE iframe (`source`), con origen opaco
   * (`"null"`: el sandbox está puesto) y bien formados. El SVG se comprueba
   * aquí (`verificarSvg`, sin DOM): lo que llega del marco es tan poco de fiar
   * como el documento, y se rechaza entero si algo no cumple la lista blanca.
   */
  private readonly alMensaje = (evento: MessageEvent) => {
    if (!this.iframe || evento.source !== this.iframe.contentWindow) return;
    if (evento.origin !== "null" || !esRespuesta(evento.data)) return;
    const r = evento.data;
    if (r.tipo === "bpdf-listo") return this.avisarListo();
    const pendiente = this.pendientes.get(r.id);
    if (!pendiente) return;
    this.pendientes.delete(r.id);
    clearTimeout(pendiente.temporizador);
    if (r.tipo === "bpdf-error") {
      pendiente.rechazar(
        r.motivo === "tooLarge"
          ? new DiagramaGrandeError()
          : r.motivo === "images"
            ? new DiagramaConImagenesError()
            : new DiagramaInvalidoError(),
      );
      return;
    }
    if (verificarSvg(r.svg)) pendiente.resolver(r.svg);
    else pendiente.rechazar(new DiagramaInvalidoError());
  };
}
