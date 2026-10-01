/**
 * Lo que el resto de la app sabe del editor (Fase 9). Sin tipos de
 * CodeMirror: quien importa esto no arrastra el editor al arranque.
 */

/** Modo del visor de Markdown. */
export type ModoMarkdown = "lectura" | "edicion" | "dividido";

/**
 * El editor montado, visto desde fuera. Las líneas empiezan en 1 y pueden
 * tener parte decimal (una fracción de línea: sincronía del desplazamiento).
 */
export type ManejadorEditor = {
  /** El texto actual. Cuesta O(tamaño): solo al guardar o al refrescar la vista previa. */
  texto(): string;
  /** La línea que está arriba del todo en la vista del editor. */
  lineaSuperior(): number;
  /** Lleva esa línea arriba del todo. */
  irALinea(linea: number): void;
  totalLineas(): number;
  /** El elemento que se desplaza (para escuchar su `scroll`). */
  desplazable(): HTMLElement;
  enfocar(): void;
};

/**
 * Estado del editor que sobrevive a desmontarlo (cambiar de modo): el
 * `EditorState` de CodeMirror, con su historial. Opaco para quien no es el
 * editor.
 */
export type EstadoGuardado = { actual: unknown };
