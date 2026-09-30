import {
  type ColoresOscuro,
  type ModoColor,
  type Transformador,
  transformadorLocal,
} from "../dark/aplicar";
import { transformadorEnWorker } from "../dark/transformador-worker";
import type { Pdfjs } from "../engine";
import { PT_A_CSS } from "../render";
import {
  buscarEnPagina,
  type Coincidencia,
  normalizarConsulta,
  type OpcionesBusqueda,
  SIN_OPCIONES,
  tieneTexto,
} from "./busqueda";
import type { Resaltado } from "./capas";
import type { DocumentoVisor } from "./documento";
import type { DestinoEnlace } from "./enlaces";
import { type ParametrosPintura, SuperficiePagina } from "./superficie";

/**
 * El visor sin React (docs/ARCHITECTURE.md → visor PDF). La interfaz le dice qué
 * páginas y miniaturas tienen marco en pantalla; el controlador decide qué se
 * pinta, en qué orden y qué se libera. Es la POLÍTICA DE MEMORIA:
 *
 * - Solo tienen lienzo las páginas que la interfaz declara vivas (las visibles
 *   ±1) y las miniaturas visibles en su panel. Al salir, el lienzo se deja a
 *   0×0, se quitan sus capas y pdf.js libera la página (`page.cleanup()`).
 * - Como mucho `RENDERS_A_LA_VEZ` renders en curso; primero las páginas (en el
 *   orden dado: la visible antes que las vecinas), después las miniaturas.
 * - Un render que deja de hacer falta se cancela (pdf.js `RenderTask.cancel()`).
 */
export const RENDERS_A_LA_VEZ = 2;
/** Ancho CSS de una miniatura. */
export const ANCHO_MINIATURA = 112;

export type Marco = { numero: number; marco: HTMLElement };

export type Memoria = { lienzos: number; bytes: number; pintando: number };

export type EstadoBusqueda = {
  consulta: string;
  coincidencias: readonly Coincidencia[];
  revisadas: number;
  total: number;
  terminada: boolean;
  /** Ninguna página revisada tiene texto: probablemente un escaneo (sin OCR). */
  sinTexto: boolean;
};

export type OpcionesControlador = {
  colores: ColoresOscuro;
  alEnlace: (destino: DestinoEnlace) => void;
  etiquetaEnlace: (destino: DestinoEnlace) => string;
  /** Algo ha cambiado en lo que se está pintando (para el estado «renderizando»). */
  alCambio?: () => void;
  /** Para los tests: el worker por defecto no existe en jsdom. */
  crearTransformador?: (colores: ColoresOscuro) => Transformador;
};

type Pendiente = { superficie: SuperficiePagina; parametros: ParametrosPintura };

export class ControladorVisor {
  #paginas = new Map<number, SuperficiePagina>();
  #miniaturas = new Map<number, SuperficiePagina>();
  #colaPaginas: Pendiente[] = [];
  #colaMiniaturas: Pendiente[] = [];
  /**
   * Superficies pintando. Cuenta superficies, no llamadas: si una superficie
   * vuelve a pintar (otro zoom), su render anterior se cancela y no ocupa hueco.
   */
  #enCurso = new Set<SuperficiePagina>();
  #turnos = new WeakMap<SuperficiePagina, object>();
  #transformador: Transformador | null = null;
  #destruido = false;
  #busqueda = 0;
  #coincidencias: readonly Coincidencia[] = [];
  #activa = -1;
  #llevarAActiva = false;

  constructor(
    readonly pdfjs: Pdfjs,
    readonly documento: DocumentoVisor,
    private readonly opciones: OpcionesControlador,
  ) {}

  get total(): number {
    return this.documento.total;
  }

  #obtenerTransformador = (): Transformador => {
    this.#transformador ??=
      this.opciones.crearTransformador?.(this.opciones.colores) ??
      transformadorEnWorker(this.opciones.colores) ??
      transformadorLocal(this.opciones.colores);
    return this.#transformador;
  };

  #alFallarWorker = (): void => {
    this.#transformador?.destruir();
    this.#transformador = transformadorLocal(this.opciones.colores);
  };

  /** Qué hace el modo oscuro ahora: en el worker o en el hilo principal. */
  get tipoTransformador(): Transformador["tipo"] | null {
    return this.#transformador?.tipo ?? null;
  }

  #nueva(numero: number, marco: HTMLElement, conCapas: boolean): SuperficiePagina {
    return new SuperficiePagina(numero, marco, {
      pdfjs: this.pdfjs,
      documento: this.documento,
      transformador: this.#obtenerTransformador,
      alFallarWorker: this.#alFallarWorker,
      conCapas,
      alEnlace: this.opciones.alEnlace,
      etiquetaEnlace: this.opciones.etiquetaEnlace,
      alPintar: conCapas ? (s) => this.#trasPintar(s) : undefined,
    });
  }

  /**
   * Las páginas con marco en pantalla, por prioridad (la visible primero), y
   * cómo pintarlas. Las que no están se liberan.
   */
  mostrar(marcos: readonly Marco[], parametros: ParametrosPintura): void {
    if (this.#destruido) return;
    this.#sincronizar(this.#paginas, marcos, true, true);
    this.#colaPaginas = [];
    for (const { numero } of marcos) {
      const s = this.#paginas.get(numero);
      if (s && !s.al(parametros)) this.#colaPaginas.push({ superficie: s, parametros });
    }
    this.#bombear();
  }

  /** Las miniaturas visibles en su panel. Con `[]`, se liberan todas. */
  mostrarMiniaturas(
    marcos: readonly Marco[],
    anchoPt: (numero: number) => number,
    base: Omit<ParametrosPintura, "zoom">,
  ): void {
    if (this.#destruido) return;
    this.#sincronizar(this.#miniaturas, marcos, false, false);
    this.#colaMiniaturas = [];
    for (const { numero } of marcos) {
      const s = this.#miniaturas.get(numero);
      const parametros = {
        ...base,
        zoom: ANCHO_MINIATURA / (anchoPt(numero) * PT_A_CSS),
        dpr: Math.min(base.dpr, 2),
      };
      if (s && !s.al(parametros)) this.#colaMiniaturas.push({ superficie: s, parametros });
    }
    this.#bombear();
  }

  #sincronizar(
    mapa: Map<number, SuperficiePagina>,
    marcos: readonly Marco[],
    conCapas: boolean,
    liberarEnPdfjs: boolean,
  ): void {
    const vivas = new Map(marcos.map((m) => [m.numero, m.marco]));
    for (const [numero, s] of mapa) {
      if (vivas.get(numero) !== s.marco) {
        s.liberar();
        this.#enCurso.delete(s);
        mapa.delete(numero);
        const enUso = this.#paginas.has(numero) || this.#miniaturas.has(numero);
        if (liberarEnPdfjs && !enUso) this.documento.liberarPagina(numero);
      }
    }
    for (const [numero, marco] of vivas) {
      if (mapa.has(numero)) continue;
      const s = this.#nueva(numero, marco, conCapas);
      if (conCapas) s.resaltar(this.#resaltadoDe(numero));
      mapa.set(numero, s);
    }
  }

  #bombear(): void {
    while (!this.#destruido) {
      const cola = this.#colaPaginas.length > 0 ? this.#colaPaginas : this.#colaMiniaturas;
      const siguiente = cola[0];
      if (!siguiente) break;
      const { superficie, parametros } = siguiente;
      const lleno = this.#enCurso.size >= RENDERS_A_LA_VEZ && !this.#enCurso.has(superficie);
      if (lleno) break;
      cola.shift();
      const viva =
        this.#paginas.get(superficie.numero) === superficie ||
        this.#miniaturas.get(superficie.numero) === superficie;
      if (!viva || superficie.al(parametros)) continue;
      const turno = {};
      this.#turnos.set(superficie, turno);
      this.#enCurso.add(superficie);
      void superficie.pintar(parametros).finally(() => {
        if (this.#turnos.get(superficie) === turno) this.#enCurso.delete(superficie);
        this.opciones.alCambio?.();
        this.#bombear();
      });
    }
    this.opciones.alCambio?.();
  }

  memoria(): Memoria {
    let [lienzos, bytes, pintando] = [0, 0, 0];
    for (const s of [...this.#paginas.values(), ...this.#miniaturas.values()]) {
      if (s.bytes > 0) lienzos++;
      bytes += s.bytes;
      if (s.estado === "pintando") pintando++;
    }
    return { lienzos, bytes, pintando };
  }

  /** La superficie de una página viva (para los tests y las medidas). */
  superficie(numero: number): SuperficiePagina | undefined {
    return this.#paginas.get(numero);
  }

  // --- Búsqueda -----------------------------------------------------------

  /**
   * Busca `consulta` en todo el documento, página a página, y avisa del
   * progreso. Una búsqueda nueva (o `cancelarBusqueda`) deja sin efecto la
   * anterior. Cede el hilo entre páginas para no bloquear la interfaz.
   * `opciones`: distinguir mayúsculas y palabra completa (Fase 6).
   */
  async buscar(
    consulta: string,
    alProgreso: (e: EstadoBusqueda) => void,
    opciones: OpcionesBusqueda = SIN_OPCIONES,
  ): Promise<void> {
    const turno = ++this.#busqueda;
    const normalizada = normalizarConsulta(consulta, opciones);
    const total = this.total;
    const coincidencias: Coincidencia[] = [];
    let conTexto = false;
    const informar = (revisadas: number) =>
      alProgreso({
        consulta,
        coincidencias: [...coincidencias],
        revisadas,
        total,
        terminada: revisadas === total,
        sinTexto: !conTexto,
      });
    if (normalizada === "") return;
    let ultimoAviso = performance.now();
    for (let n = 1; n <= total; n++) {
      let indice: Awaited<ReturnType<DocumentoVisor["indice"]>> | null = null;
      try {
        indice = await this.documento.indice(n);
      } catch {
        // Página ilegible: se salta.
      }
      if (turno !== this.#busqueda || this.#destruido) return;
      if (indice) {
        conTexto ||= tieneTexto(indice);
        coincidencias.push(...buscarEnPagina(indice, normalizada, n, opciones));
      }
      if (n === total || performance.now() - ultimoAviso > 100) {
        informar(n);
        ultimoAviso = performance.now();
        await new Promise((r) => setTimeout(r, 0));
        if (turno !== this.#busqueda || this.#destruido) return;
      }
    }
  }

  cancelarBusqueda(): void {
    this.#busqueda++;
    this.resaltarBusqueda([], -1);
  }

  /**
   * Resalta `coincidencias` en las páginas vivas, con `activa` destacada. Si
   * `llevar`, la coincidencia activa se lleva a la vista en cuanto su página
   * tenga capa de texto.
   */
  resaltarBusqueda(coincidencias: readonly Coincidencia[], activa: number, llevar = false): void {
    this.#coincidencias = coincidencias;
    this.#activa = activa;
    this.#llevarAActiva = llevar && activa >= 0;
    for (const [numero, s] of this.#paginas) {
      const mark = s.resaltar(this.#resaltadoDe(numero));
      if (mark && this.#llevarAActiva) this.#llevar(mark);
    }
  }

  #resaltadoDe(numero: number): Resaltado | null {
    const tramos: Resaltado["tramos"][number][] = [];
    this.#coincidencias.forEach((c, i) => {
      if (c.pagina !== numero) return;
      for (const t of c.tramos) tramos.push({ ...t, activa: i === this.#activa });
    });
    return tramos.length > 0 ? { tramos } : null;
  }

  #trasPintar(s: SuperficiePagina): void {
    if (!this.#llevarAActiva) return;
    const activa = this.#coincidencias[this.#activa];
    if (activa?.pagina !== s.numero) return;
    const mark = s.marco.querySelector<HTMLElement>("mark.activa");
    if (mark) this.#llevar(mark);
  }

  #llevar(mark: HTMLElement): void {
    this.#llevarAActiva = false;
    mark.scrollIntoView({ block: "center", inline: "nearest" });
  }

  // --- Ciclo de vida ------------------------------------------------------

  async destruir(): Promise<void> {
    if (this.#destruido) return;
    this.#destruido = true;
    this.#busqueda++;
    this.#colaPaginas = [];
    this.#colaMiniaturas = [];
    this.#enCurso.clear();
    for (const s of [...this.#paginas.values(), ...this.#miniaturas.values()]) s.liberar();
    this.#paginas.clear();
    this.#miniaturas.clear();
    this.#transformador?.destruir();
    this.#transformador = null;
    await this.documento.destruir();
  }
}

export type { ModoColor, ParametrosPintura };
