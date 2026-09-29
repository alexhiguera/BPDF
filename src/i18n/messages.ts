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
    status: "BPDF está en desarrollo: todavía no se pueden abrir documentos.",
    privacy: "Tus documentos no salen de este dispositivo.",
  },
  error: {
    title: "Algo ha fallado",
    body: "Puedes volver a intentarlo.",
    retry: "Reintentar",
  },
} as const;

/** La forma de los textos, con cualquier cadena: lo que tendrá que cumplir otro idioma. */
type Forma<T> = { readonly [K in keyof T]: T[K] extends string ? string : Forma<T[K]> };
export type Messages = Forma<typeof messages>;
