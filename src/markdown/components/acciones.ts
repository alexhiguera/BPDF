import { createContext, useContext } from "react";

/**
 * Lo que los elementos del documento pueden pedir al visor. Por contexto y no
 * por props: así el mapa de componentes de react-markdown es fijo (módulo) y
 * el documento no se vuelve a procesar cuando el visor se repinta.
 */
export type AccionesDocumento = {
  /** Abre un enlace ya validado FUERA de BPDF (`Platform.openExternal`). */
  abrirExterno(url: string): void;
  /** Lleva la lectura (y el foco) a una sección del documento. `false` si no existe. */
  irASeccion(fragmento: string): boolean;
};

const SIN_VISOR: AccionesDocumento = {
  abrirExterno: () => {},
  irASeccion: () => false,
};

export const ContextoAcciones = createContext<AccionesDocumento>(SIN_VISOR);

export const useAcciones = () => useContext(ContextoAcciones);
