/**
 * Todos los textos visibles de la interfaz (D2: español en v1).
 *
 * Los componentes no escriben texto a mano: lo leen de aquí. Así, añadir otro
 * idioma es añadir otro objeto con la misma forma (el tipo `Messages` obliga a
 * traducirlo entero) y elegir cuál se usa; no hace falta buscar cadenas por
 * todo `src/`. `tests/unit/textos.test.ts` falla si aparece texto suelto en un
 * componente.
 *
 * El nombre y la descripción del producto no están aquí: son identidad y viven
 * en `src/config/project.ts`.
 */
export const messages = {
  app: {
    skipToContent: "Saltar al contenido",
    noscript: "BPDF necesita JavaScript para funcionar.",
  },
  emptyState: {
    title: "Tu lector de PDF y Markdown",
    body: "Abre un PDF o un Markdown, o arrástralo a esta ventana.",
    privacy: "Tus documentos no salen de este dispositivo.",
  },
  open: {
    button: "Abrir archivo",
    shortcut: "Atajo: Ctrl+O (⌘O en Mac)",
  },
  dropZone: {
    hint: "Suelta el archivo para abrirlo",
  },
  document: {
    /** Nombre que se muestra si el fichero no trae uno utilizable. */
    untitled: "Sin nombre",
    kinds: { pdf: "PDF", markdown: "Markdown" },
    kindLabel: "Tipo",
    sizeLabel: "Tamaño",
    pendingViewer:
      "BPDF ya ha comprobado y cargado el documento. La vista de lectura llegará en una próxima versión.",
    close: "Cerrar documento",
  },
  documentError: {
    title: (fileName: string) => `No se ha podido abrir «${fileName}»`,
    titleNoFile: "No se ha podido abrir el archivo",
    dismiss: "Descartar aviso",
    unsupported: "BPDF abre archivos PDF (.pdf) y Markdown (.md, .markdown).",
    multiple: "Suelta un solo archivo: BPDF abre un documento cada vez.",
    empty: "El archivo está vacío.",
    tooLarge: (max: string) => `El archivo supera el tamaño máximo para este tipo (${max}).`,
    notPdf: "El archivo se llama .pdf, pero su contenido no es un PDF.",
    notUtf8:
      "El archivo no es texto en UTF-8. Si es un Markdown, guárdalo con esa codificación y vuelve a abrirlo.",
    unreadable:
      "No se ha podido leer el archivo. Comprueba que sigue existiendo y que tienes permiso para abrirlo.",
  },
  error: {
    title: "Algo ha fallado",
    body: "Puedes volver a intentarlo.",
    retry: "Reintentar",
  },
} as const;

/**
 * La forma de los textos, con cualquier cadena: lo que tendrá que cumplir otro
 * idioma. Los textos con datos (un nombre, un tamaño) son funciones que
 * devuelven la cadena; otro idioma las traduce con los mismos parámetros.
 */
type Forma<T> = {
  readonly [K in keyof T]: T[K] extends string
    ? string
    : T[K] extends (...args: infer A) => string
      ? (...args: A) => string
      : Forma<T[K]>;
};
export type Messages = Forma<typeof messages>;
