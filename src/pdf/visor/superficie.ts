import type { RenderTask } from "pdfjs-dist";
import { type ModoColor, oscurecerLienzo, type Transformador } from "../dark/aplicar";
import type { Pdfjs } from "../engine";
import { renderizarPagina, viewportCss } from "../render";
import {
  type CapaTexto,
  construirCapaEnlaces,
  construirCapaTexto,
  type Resaltado,
  resaltar,
} from "./capas";
import type { DocumentoVisor } from "./documento";
import type { DestinoEnlace } from "./enlaces";

/**
 * Una página en pantalla (o una miniatura): su lienzo, su capa de texto y sus
 * enlaces, dentro de un MARCO que pone React (un `<div>` vacío del tamaño de la
 * página). Sin React: el visor decide qué superficies viven y las libera.
 *
 * Estrategia de render (docs/ARCHITECTURE.md → visor PDF):
 * 1. pdf.js pinta en un lienzo NUEVO, fuera del DOM;
 * 2. en modo oscuro, se recolorea ese lienzo (en el worker, por franjas);
 * 3. solo entonces sustituye al anterior. Nunca se ve una página a medio
 *    pintar ni un destello blanco en modo oscuro, y al cambiar el zoom se ve la
 *    página anterior estirada hasta que llega la nueva.
 *
 * Cada `pintar()` abre una GENERACIÓN: lo que llegue de una anterior (render,
 * transformación, texto) se descarta. `liberar()` cancela y devuelve la memoria.
 */

export type ParametrosPintura = {
  zoom: number;
  rotacion: number;
  dpr: number;
  modo: ModoColor;
};

export type EstadoSuperficie = "vacia" | "pintando" | "lista" | "error";

export type DependenciasSuperficie = {
  pdfjs: Pdfjs;
  documento: DocumentoVisor;
  transformador: () => Transformador;
  /** El worker ha fallado: el visor cambia al transformador local. */
  alFallarWorker: () => void;
  /** Miniaturas: sin capa de texto ni enlaces. */
  conCapas: boolean;
  alEnlace?: (destino: DestinoEnlace) => void;
  etiquetaEnlace?: (destino: DestinoEnlace) => string;
  /** Se llama cada vez que la superficie termina de pintar. */
  alPintar?: (s: SuperficiePagina) => void;
};

export type Medidas = { msRender: number; msOscuro: number; msOscuroPrincipal: number };

const esCancelacion = (e: unknown): boolean =>
  e instanceof Error && e.name === "RenderingCancelledException";

/** Deja un lienzo a 0×0: devuelve su memoria sin esperar al recolector. */
function vaciar(lienzo: HTMLCanvasElement | null): void {
  if (!lienzo) return;
  lienzo.width = 0;
  lienzo.height = 0;
  lienzo.remove();
}

export class SuperficiePagina {
  #generacion = 0;
  #tarea: RenderTask | null = null;
  #lienzo: HTMLCanvasElement | null = null;
  #texto: CapaTexto | null = null;
  #enlaces: HTMLDivElement | null = null;
  #pintado: ParametrosPintura | null = null;
  #resaltado: Resaltado | null = null;
  #quitarResaltado: (() => void) | null = null;
  #estado: EstadoSuperficie = "vacia";
  medidas: Medidas | null = null;

  constructor(
    readonly numero: number,
    readonly marco: HTMLElement,
    private readonly deps: DependenciasSuperficie,
  ) {}

  get estado(): EstadoSuperficie {
    return this.#estado;
  }

  /** ¿Lo que se ve (o se está pintando) corresponde ya a `p`? */
  al(p: ParametrosPintura): boolean {
    const q = this.#pintado;
    return (
      q !== null &&
      q.zoom === p.zoom &&
      q.rotacion === p.rotacion &&
      q.dpr === p.dpr &&
      q.modo === p.modo
    );
  }

  /** Bytes del lienzo en memoria (4 por píxel). */
  get bytes(): number {
    return this.#lienzo ? this.#lienzo.width * this.#lienzo.height * 4 : 0;
  }

  #estadoA(estado: EstadoSuperficie): void {
    this.#estado = estado;
    this.marco.dataset.estado = estado;
  }

  /**
   * Pinta la página con `p`. Resuelve cuando termina, cuando se cancela
   * (otra llamada, o `liberar`) o cuando falla (estado `error`). No rechaza.
   */
  async pintar(p: ParametrosPintura): Promise<void> {
    const generacion = ++this.#generacion;
    const vigente = () => generacion === this.#generacion;
    this.#tarea?.cancel();
    this.#tarea = null;
    this.#pintado = p;
    this.#estadoA("pintando");
    const { documento, pdfjs } = this.deps;
    let lienzo: HTMLCanvasElement | null = null;
    try {
      const pagina = await documento.pagina(this.numero);
      if (!vigente()) return;
      lienzo = document.createElement("canvas");
      lienzo.setAttribute("aria-hidden", "true");
      const { tarea, hecho } = renderizarPagina(pagina, lienzo, p);
      this.#tarea = tarea;
      const render = await hecho;
      if (this.#tarea === tarea) this.#tarea = null;
      if (!vigente()) return vaciar(lienzo);

      let oscuro = { ms: 0, msHiloPrincipal: 0 };
      if (p.modo === "oscuro") {
        const ctx = lienzo.getContext("2d");
        if (!ctx) throw new Error("sin-contexto-2d");
        const transformador = this.deps.transformador();
        let r: Awaited<ReturnType<typeof oscurecerLienzo>>;
        try {
          r = await oscurecerLienzo(ctx, render.regiones, transformador, { vigente });
        } catch (error) {
          if (transformador.tipo !== "worker") throw error;
          // El worker ha fallado a media página: el lienzo tiene franjas sin
          // recolorear. Se vuelve a pintar entera con el transformador local.
          vaciar(lienzo);
          this.deps.alFallarWorker();
          if (vigente()) await this.pintar(p);
          return;
        }
        if (!r || !vigente()) return vaciar(lienzo);
        oscuro = r;
      }

      // Capas nuevas antes de cambiar nada: el cambio es de una vez.
      const viewport = viewportCss(pagina, p.zoom, p.rotacion);
      let texto: CapaTexto | null = null;
      let enlaces: HTMLDivElement | null = null;
      if (this.deps.conCapas) {
        const [contenido, listaEnlaces] = await Promise.all([
          documento.texto(this.numero).catch(() => null),
          documento.enlaces(this.numero).catch(() => []),
        ]);
        if (!vigente()) return vaciar(lienzo);
        if (contenido)
          texto = await construirCapaTexto(pdfjs, contenido, viewport, () => !vigente());
        if (!vigente()) return vaciar(lienzo);
        enlaces = construirCapaEnlaces(listaEnlaces, viewport, {
          alActivar: (d) => this.deps.alEnlace?.(d),
          etiqueta: (d) => this.deps.etiquetaEnlace?.(d) ?? "",
        });
      }

      this.#quitarCapas();
      vaciar(this.#lienzo);
      this.#lienzo = lienzo;
      this.marco.style.setProperty("--scale-factor", String(viewport.scale));
      this.marco.prepend(lienzo);
      if (texto) this.marco.append(texto.elemento);
      if (enlaces) this.marco.append(enlaces);
      this.#texto = texto;
      this.#enlaces = enlaces;
      this.medidas = {
        msRender: render.msRender,
        msOscuro: oscuro.ms,
        msOscuroPrincipal: oscuro.msHiloPrincipal,
      };
      // Medidas en el DOM (sin salir de él): las leen el E2E y el benchmark.
      this.marco.dataset.msRender = this.medidas.msRender.toFixed(1);
      this.marco.dataset.msOscuro = this.medidas.msOscuro.toFixed(1);
      this.marco.dataset.msOscuroPrincipal = this.medidas.msOscuroPrincipal.toFixed(1);
      this.marco.dataset.modo = p.modo;
      this.marco.dataset.zoom = String(p.zoom);
      this.marco.dataset.rotacion = String(p.rotacion);
      this.#estadoA("lista");
      if (this.#resaltado) this.resaltar(this.#resaltado);
      this.deps.alPintar?.(this);
    } catch (error) {
      if (!vigente()) return vaciar(lienzo);
      vaciar(lienzo);
      this.#pintado = null;
      this.#estadoA(esCancelacion(error) ? "vacia" : "error");
    }
  }

  /**
   * Resalta coincidencias de búsqueda (o las quita con `null`). Se recuerda y
   * se vuelve a aplicar tras cada render. Devuelve el `<mark>` activo, si lo hay.
   */
  resaltar(resaltado: Resaltado | null): HTMLElement | null {
    this.#quitarResaltado?.();
    this.#quitarResaltado = null;
    this.#resaltado = resaltado;
    if (!resaltado || !this.#texto) return null;
    const { activa, quitar } = resaltar(this.#texto, resaltado);
    this.#quitarResaltado = quitar;
    return activa;
  }

  #quitarCapas(): void {
    this.#quitarResaltado = null;
    this.#texto?.cancelar();
    this.#texto?.elemento.remove();
    this.#texto = null;
    this.#enlaces?.remove();
    this.#enlaces = null;
  }

  /** Cancela lo pendiente y libera el lienzo y las capas. Se puede volver a pintar. */
  liberar(): void {
    this.#generacion++;
    this.#tarea?.cancel();
    this.#tarea = null;
    this.#pintado = null;
    this.#quitarCapas();
    vaciar(this.#lienzo);
    this.#lienzo = null;
    this.medidas = null;
    this.#estadoA("vacia");
  }
}
