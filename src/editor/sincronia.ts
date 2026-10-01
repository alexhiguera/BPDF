import { type RefObject, useEffect, useRef } from "react";
import type { ManejadorEditor } from "./tipos";

/**
 * Desplazamiento sincronizado entre el editor y la vista previa (Fase 9), por
 * ENCABEZADOS: el i-ésimo encabezado del texto corresponde al i-ésimo de la
 * vista previa, y entre dos encabezados se interpola. No se intenta casar
 * carácter a carácter: el renderizado cambia alturas (imágenes, fórmulas,
 * diagramas) y cualquier cosa más fina sería frágil. Ante la duda, estabilidad.
 */

/** Un punto que se corresponde en los dos lados: línea del texto ↔ píxel de la vista previa. */
export type Ancla = { linea: number; y: number };

const VALLA = /^ {0,3}(`{3,}|~{3,})/;
const ATX = /^ {0,3}#{1,6}(?:[ \t]|$)/;
const SETEXT = /^ {0,3}(?:=+|-+)[ \t]*$/;
const CITA = /^ {0,3}(?:> ?)+/;
const NO_PARRAFO = /^ {0,3}(?:[-*+] |\d{1,9}[.)] |#|\||`{3}|~{3}|\$\$|<)/;

/**
 * Líneas (desde 1) donde empieza un encabezado, en orden: ATX (`# …`, también
 * dentro de citas, como los pinta el lector) y setext (texto subrayado con
 * `===` o `---`). Se ignoran los bloques de código con valla y las fórmulas en
 * bloque (`$$`), donde un `#` no es un encabezado. Es una aproximación de
 * CommonMark suficiente para anclar; si discrepa del lector en un caso raro, la
 * sincronía solo pierde precisión en ese tramo.
 */
export function encabezadosFuente(texto: string): number[] {
  const lineas = texto.split("\n");
  const salida: number[] = [];
  let valla: string | null = null;
  let formula = false;
  let anterior = "";
  lineas.forEach((original, i) => {
    const linea = original.replace(CITA, "");
    if (valla) {
      const cierre = linea.match(VALLA)?.[1];
      if (
        cierre &&
        cierre[0] === valla[0] &&
        cierre.length >= valla.length &&
        linea.trim() === cierre
      )
        valla = null;
      anterior = "";
      return;
    }
    if (formula) {
      if (linea.trim().endsWith("$$")) formula = false;
      anterior = "";
      return;
    }
    const apertura = linea.match(VALLA)?.[1];
    if (apertura) {
      valla = apertura;
      anterior = "";
      return;
    }
    if (linea.trim().startsWith("$$")) {
      // `$$…$$` en una sola línea no abre bloque.
      formula = !(linea.trim().length > 2 && linea.trim().endsWith("$$"));
      anterior = "";
      return;
    }
    if (ATX.test(linea)) {
      salida.push(i + 1);
      anterior = "";
      return;
    }
    if (SETEXT.test(linea) && anterior.trim() !== "" && !NO_PARRAFO.test(anterior)) {
      salida.push(i); // el encabezado es la línea de texto, la anterior
      anterior = "";
      return;
    }
    anterior = linea;
  });
  return salida;
}

/**
 * Las anclas: el principio de los dos lados, cada pareja de encabezados (los
 * que haya en los dos, por orden) y el final. Se descarta una pareja que no
 * avance en los dos lados a la vez (una discrepancia): así la correspondencia
 * es siempre creciente y la interpolación no da saltos hacia atrás.
 */
export function anclas(
  lineas: readonly number[],
  posiciones: readonly number[],
  totalLineas: number,
  altoTotal: number,
): Ancla[] {
  const salida: Ancla[] = [{ linea: 1, y: 0 }];
  const n = Math.min(lineas.length, posiciones.length);
  for (let i = 0; i < n; i++) {
    const linea = lineas[i] ?? 0;
    const y = posiciones[i] ?? 0;
    const ultima = salida.at(-1) as Ancla;
    if (linea > ultima.linea && y > ultima.y) salida.push({ linea, y });
  }
  const ultima = salida.at(-1) as Ancla;
  const fin = {
    linea: Math.max(totalLineas + 1, ultima.linea + 1),
    y: Math.max(altoTotal, ultima.y + 1),
  };
  salida.push(fin);
  return salida;
}

/** El tramo `[a, b]` que contiene `valor` según `clave`, por búsqueda binaria. */
function tramo(lista: readonly Ancla[], valor: number, clave: "linea" | "y"): [Ancla, Ancla] {
  let bajo = 0;
  let alto = lista.length - 2;
  while (bajo < alto) {
    const medio = (bajo + alto + 1) >> 1;
    if ((lista[medio] as Ancla)[clave] <= valor) bajo = medio;
    else alto = medio - 1;
  }
  return [lista[bajo] as Ancla, lista[bajo + 1] as Ancla];
}

/** Píxel de la vista previa que corresponde a una línea (con fracción) del texto. */
export function lineaAPosicion(lista: readonly Ancla[], linea: number): number {
  const [a, b] = tramo(lista, linea, "linea");
  const f = Math.min(Math.max((linea - a.linea) / (b.linea - a.linea), 0), 1);
  return a.y + f * (b.y - a.y);
}

/** Línea (con fracción) del texto que corresponde a un píxel de la vista previa. */
export function posicionALinea(lista: readonly Ancla[], y: number): number {
  const [a, b] = tramo(lista, y, "y");
  const f = Math.min(Math.max((y - a.y) / (b.y - a.y), 0), 1);
  return a.linea + f * (b.linea - a.linea);
}

/**
 * Los encabezados que pinta la vista previa, en orden, sin los que no vienen
 * del texto: el título oculto de las notas al pie que añade GFM.
 */
export function encabezadosVista(articulo: HTMLElement): HTMLElement[] {
  return [...articulo.querySelectorAll<HTMLElement>(".md-contenido :is(h1,h2,h3,h4,h5,h6)")].filter(
    (h) => !h.closest("[data-footnotes]") && !h.classList.contains("sr-only"),
  );
}

/**
 * Sincroniza los dos paneles mientras `activo`. Manda el panel con el que el
 * usuario está interactuando (puntero encima, foco dentro o rueda): el
 * desplazamiento que esto provoca en el otro no se reenvía, así que no hay
 * bucle editor → vista → editor. Un fotograma por evento como mucho.
 */
export function useDesplazamientoSincronizado({
  activo,
  editorListo,
  editor,
  panelEditor,
  articulo,
  texto,
}: {
  activo: boolean;
  /** El editor se carga a demanda: hasta que está montado no hay nada que sincronizar. */
  editorListo: boolean;
  editor: RefObject<ManejadorEditor | null>;
  panelEditor: RefObject<HTMLElement | null>;
  articulo: RefObject<HTMLElement | null>;
  /** El texto que pinta la vista previa: las anclas salen de él. */
  texto: string;
}) {
  const lineasTexto = useRef<number[]>([]);
  const versionTexto = useRef(0);
  useEffect(() => {
    if (!activo) return;
    lineasTexto.current = encabezadosFuente(texto);
    versionTexto.current++;
  }, [activo, texto]);

  useEffect(() => {
    const vista = articulo.current;
    const lado = panelEditor.current;
    const ed = editor.current;
    if (!activo || !editorListo || !vista || !lado || !ed) return;
    let manda: "editor" | "vista" | null = null;
    let pendiente = 0;
    // Medir todos los encabezados cuesta O(n) lecturas de disposición: se hace
    // solo cuando cambia algo que las mueve (texto, alto o ancho), no en cada
    // fotograma (con 1 MB de encabezados, medirlos siempre bloqueaba).
    let cache: { clave: string; lista: Ancla[] } | null = null;
    const calcular = (): Ancla[] => {
      const clave = `${versionTexto.current}:${vista.scrollHeight}:${vista.clientWidth}:${ed.totalLineas()}`;
      if (cache?.clave === clave) return cache.lista;
      const arriba = vista.getBoundingClientRect().top - vista.scrollTop;
      const posiciones = encabezadosVista(vista).map((h) => h.getBoundingClientRect().top - arriba);
      const lista = anclas(lineasTexto.current, posiciones, ed.totalLineas(), vista.scrollHeight);
      cache = { clave, lista };
      return lista;
    };
    const sincronizar = (origen: "editor" | "vista") => {
      if (manda !== origen || pendiente) return;
      pendiente = requestAnimationFrame(() => {
        pendiente = 0;
        const lista = calcular();
        if (origen === "editor") vista.scrollTop = lineaAPosicion(lista, ed.lineaSuperior());
        else ed.irALinea(posicionALinea(lista, vista.scrollTop));
      });
    };
    const tomar = (quien: "editor" | "vista") => () => {
      manda = quien;
    };
    const alEditor = () => sincronizar("editor");
    const alVista = () => sincronizar("vista");
    const desplazable = ed.desplazable();
    const oyentes: [EventTarget, string, EventListener][] = [
      [desplazable, "scroll", alEditor],
      [vista, "scroll", alVista],
    ];
    for (const [el, quien] of [
      [lado, "editor"],
      [vista, "vista"],
    ] as const) {
      for (const tipo of ["pointerenter", "focusin", "wheel", "touchstart"]) {
        oyentes.push([el, tipo, tomar(quien)]);
      }
    }
    for (const [el, tipo, f] of oyentes) el.addEventListener(tipo, f, { passive: true });
    return () => {
      cancelAnimationFrame(pendiente);
      for (const [el, tipo, f] of oyentes) el.removeEventListener(tipo, f);
    };
  }, [activo, editorListo, editor, panelEditor, articulo]);
}
