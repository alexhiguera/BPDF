import { createContext, useContext } from "react";
import { type RecursosDocumento, SIN_RECURSOS } from "@/documents/types";
import type { AlmacenUrls } from "../imagenes";
import type { MarcoMermaid } from "../mermaid";

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

/**
 * Las imágenes locales del documento: el conjunto entregado con él y el
 * almacén de URL de objeto del visor (Fase 7 bis). Sin visor, ninguna.
 */
export type ImagenesDocumento = {
  recursos: RecursosDocumento;
  almacen: AlmacenUrls | null;
};

export const ContextoImagenes = createContext<ImagenesDocumento>({
  recursos: SIN_RECURSOS,
  almacen: null,
});

export const useImagenes = () => useContext(ContextoImagenes);

/**
 * Los diagramas del documento (Fase 8): el marco aislado de Mermaid del visor,
 * creado al pedirlo por primera vez. Sin visor, ninguno (`null`).
 */
export const ContextoDiagramas = createContext<{ marco(): MarcoMermaid } | null>(null);

export const useDiagramas = () => useContext(ContextoDiagramas);
