import type { PageViewport } from "pdfjs-dist";
import type { TextContent } from "pdfjs-dist/types/src/display/api";
import type { Pdfjs } from "../engine";
import { ajustarTramo, type Tramo } from "./busqueda";
import { cajaDe, type DestinoEnlace } from "./enlaces";

/**
 * Capas HTML encima del lienzo de una página: el texto (para seleccionar,
 * copiar y resaltar la búsqueda) y los enlaces. Solo DOM con `textContent`,
 * `createElement` y atributos: nunca HTML en crudo (CLAUDE.md §5).
 */

/** La capa de texto de pdf.js (`TextLayer`, API pública) ya construida. */
export type CapaTexto = {
  elemento: HTMLDivElement;
  /** Un elemento por trozo de texto, en el orden de `getTextContent`. */
  trozos: readonly HTMLElement[];
  cancelar(): void;
};

/**
 * Construye la capa de texto en un contenedor NUEVO (fuera del DOM), para
 * cambiarla de una vez por la anterior. El tamaño se fija en píxeles: pdf.js lo
 * escribe con `round()` de CSS, que no tienen todos los navegadores objetivo.
 */
export async function construirCapaTexto(
  pdfjs: Pdfjs,
  contenido: TextContent,
  viewport: PageViewport,
  cancelada: () => boolean,
): Promise<CapaTexto | null> {
  const elemento = document.createElement("div");
  elemento.className = "textLayer";
  const capa = new pdfjs.TextLayer({ textContentSource: contenido, container: elemento, viewport });
  const { pageWidth, pageHeight } = viewport.rawDims as { pageWidth: number; pageHeight: number };
  elemento.style.width = `${Math.floor(pageWidth * viewport.scale)}px`;
  elemento.style.height = `${Math.floor(pageHeight * viewport.scale)}px`;
  try {
    await capa.render();
  } catch {
    return null; // cancelada, o texto ilegible: la página se ve igual, sin selección
  }
  if (cancelada()) {
    capa.cancel();
    return null;
  }
  return { elemento, trozos: capa.textDivs, cancelar: () => capa.cancel() };
}

/** Coincidencias de una página, agrupadas por trozo, y cuál es la activa. */
export type Resaltado = { tramos: readonly (Tramo & { activa: boolean })[] };

/**
 * Resalta coincidencias en la capa de texto envolviendo sus caracteres en
 * `<mark>`. Devuelve el `<mark>` de la coincidencia activa (para llevarla a la
 * vista) y una función que deja la capa como estaba.
 */
export function resaltar(
  capa: CapaTexto,
  { tramos }: Resaltado,
): { activa: HTMLElement | null; quitar: () => void } {
  const porTrozo = new Map<number, (Tramo & { activa: boolean })[]>();
  for (const t of tramos) {
    const lista = porTrozo.get(t.trozo) ?? [];
    lista.push(t);
    porTrozo.set(t.trozo, lista);
  }
  const originales: [HTMLElement, string][] = [];
  let activa: HTMLElement | null = null;
  for (const [indice, lista] of porTrozo) {
    const div = capa.trozos[indice];
    if (!div) continue;
    const texto = div.textContent ?? "";
    originales.push([div, texto]);
    const partes: Node[] = [];
    let cursor = 0;
    for (const bruto of lista.sort((a, b) => a.desde - b.desde)) {
      const { desde, hasta } = ajustarTramo(texto, bruto);
      if (desde < cursor || hasta <= desde) continue;
      if (desde > cursor) partes.push(document.createTextNode(texto.slice(cursor, desde)));
      const mark = document.createElement("mark");
      mark.className = bruto.activa ? "coincidencia activa" : "coincidencia";
      mark.textContent = texto.slice(desde, hasta);
      if (bruto.activa && !activa) activa = mark;
      partes.push(mark);
      cursor = hasta;
    }
    if (cursor < texto.length) partes.push(document.createTextNode(texto.slice(cursor)));
    div.replaceChildren(...partes);
  }
  return {
    activa,
    quitar: () => {
      for (const [div, texto] of originales) div.textContent = texto;
    },
  };
}

/**
 * La capa de enlaces: un `<a>` transparente por enlace permitido. El clic lo
 * decide `alActivar` (navegar dentro del documento o abrir fuera por la
 * plataforma); el `<a>` nunca navega la app por sí mismo.
 */
export function construirCapaEnlaces(
  enlaces: readonly { rect: number[]; destino: DestinoEnlace }[],
  viewport: PageViewport,
  {
    alActivar,
    etiqueta,
  }: {
    alActivar: (destino: DestinoEnlace) => void;
    etiqueta: (destino: DestinoEnlace) => string;
  },
): HTMLDivElement {
  const capa = document.createElement("div");
  capa.className = "enlaces-pdf";
  const limite = { ancho: viewport.width, alto: viewport.height };
  for (const { rect, destino } of enlaces) {
    const caja = cajaDe(
      rect,
      ([x1 = 0, y1 = 0, x2 = 0, y2 = 0]) => [
        ...viewport.convertToViewportPoint(x1, y1),
        ...viewport.convertToViewportPoint(x2, y2),
      ],
      limite,
    );
    if (!caja) continue;
    const a = document.createElement("a");
    if (destino.tipo === "externo") {
      a.href = destino.url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    } else {
      a.href = `#pagina-${destino.pagina}`;
    }
    a.setAttribute("aria-label", etiqueta(destino));
    a.title = etiqueta(destino);
    a.dataset.destino = destino.tipo;
    Object.assign(a.style, {
      left: `${caja.izquierda}px`,
      top: `${caja.arriba}px`,
      width: `${caja.ancho}px`,
      height: `${caja.alto}px`,
    });
    a.addEventListener("click", (e) => {
      e.preventDefault();
      alActivar(destino);
    });
    // El clic central abriría la URL fuera del mecanismo controlado.
    a.addEventListener("auxclick", (e) => e.preventDefault());
    capa.append(a);
  }
  return capa;
}
