import type { ModoColor } from "@/pdf/dark/aplicar";
import { acotarZoom, pasoZoom, type Zoom } from "@/pdf/visor/disposicion";

/**
 * Estado de la vista de un PDF: qué página, con qué zoom, giro, vista y
 * colores. Reductor puro (probado en `tests/unit/pdf/estado.test.ts`); la
 * interfaz lo lee y el controlador pinta lo que dice.
 *
 * No se guarda nada entre sesiones (preferencias persistentes: fuera de la
 * Fase 5). Al abrir otro documento, el visor se monta de nuevo con el estado
 * inicial.
 */
export type Vista = "continua" | "pagina";
export type Rotacion = 0 | 90 | 180 | 270;

export type EstadoVisor = {
  pagina: number;
  total: number;
  zoom: Zoom;
  rotacion: Rotacion;
  vista: Vista;
  modo: ModoColor;
  miniaturas: boolean;
  busqueda: boolean;
  /**
   * Cambia cada vez que el usuario pide IR a una página (botones, campo,
   * teclado, enlace, búsqueda): la vista se desplaza hasta ella. Si la página
   * cambia porque el usuario se desplaza, no cambia.
   */
  salto: number;
};

export const estadoInicial = (total: number): EstadoVisor => ({
  pagina: 1,
  total,
  zoom: { tipo: "ancho" },
  rotacion: 0,
  vista: "continua",
  modo: "oscuro",
  miniaturas: false,
  busqueda: false,
  salto: 0,
});

export type Accion =
  | { tipo: "ir"; pagina: number }
  | { tipo: "siguiente" }
  | { tipo: "anterior" }
  | { tipo: "primera" }
  | { tipo: "ultima" }
  /** La página visible ha cambiado al desplazarse (no mueve la vista). */
  | { tipo: "visible"; pagina: number }
  | { tipo: "zoom"; zoom: Zoom }
  /** Acercar o alejar desde el zoom que se ve ahora (aunque sea un ajuste). */
  | { tipo: "paso-zoom"; actual: number; direccion: 1 | -1 }
  | { tipo: "girar" }
  | { tipo: "vista"; vista: Vista }
  | { tipo: "modo"; modo: ModoColor }
  | { tipo: "miniaturas"; abiertas?: boolean }
  | { tipo: "busqueda"; abierta: boolean };

const acotarPagina = (n: number, total: number) => Math.min(Math.max(1, Math.round(n)), total);

export function reducir(estado: EstadoVisor, accion: Accion): EstadoVisor {
  const ir = (pagina: number): EstadoVisor => ({
    ...estado,
    pagina: acotarPagina(pagina, estado.total),
    salto: estado.salto + 1,
  });
  switch (accion.tipo) {
    case "ir":
      return Number.isFinite(accion.pagina) ? ir(accion.pagina) : estado;
    case "siguiente":
      return estado.pagina < estado.total ? ir(estado.pagina + 1) : estado;
    case "anterior":
      return estado.pagina > 1 ? ir(estado.pagina - 1) : estado;
    case "primera":
      return ir(1);
    case "ultima":
      return ir(estado.total);
    case "visible": {
      const pagina = acotarPagina(accion.pagina, estado.total);
      return pagina === estado.pagina ? estado : { ...estado, pagina };
    }
    case "zoom":
      return {
        ...estado,
        zoom:
          accion.zoom.tipo === "fijo"
            ? { tipo: "fijo", valor: acotarZoom(accion.zoom.valor) }
            : accion.zoom,
      };
    case "paso-zoom":
      return {
        ...estado,
        zoom: { tipo: "fijo", valor: pasoZoom(accion.actual, accion.direccion) },
      };
    case "girar":
      return { ...estado, rotacion: ((estado.rotacion + 90) % 360) as Rotacion };
    case "vista":
      // Cambiar de vista conserva la página y la lleva a la vista.
      return accion.vista === estado.vista
        ? estado
        : { ...estado, vista: accion.vista, salto: estado.salto + 1 };
    case "modo":
      return { ...estado, modo: accion.modo };
    case "miniaturas":
      return { ...estado, miniaturas: accion.abiertas ?? !estado.miniaturas };
    case "busqueda":
      return { ...estado, busqueda: accion.abierta };
  }
}
