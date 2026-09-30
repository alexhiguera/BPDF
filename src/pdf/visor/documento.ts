import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { TextContent } from "pdfjs-dist/types/src/display/api";
import { type IndicePagina, indexarPagina, type TrozoTexto } from "./busqueda";
import type { Tamano } from "./disposicion";
import { type AnotacionPdf, type DestinoEnlace, resolverEnlace } from "./enlaces";

/**
 * Un PDF abierto en el visor: envuelve el `PDFDocumentProxy` de pdf.js con lo
 * que el visor necesita y controla su memoria (docs/ARCHITECTURE.md → visor
 * PDF, «Memoria»). Sin React.
 *
 * - Tamaños de página: al abrir solo se conoce la primera; el resto se piden en
 *   segundo plano, por lotes, y mientras tanto se supone el de la primera (lo
 *   habitual es que todas midan lo mismo).
 * - Texto de la capa de texto: caché pequeña (las páginas vivas y poco más).
 * - Índice de búsqueda: solo cadenas, una vez por página, al buscar por primera
 *   vez. Es lo único que crece con el documento (~el tamaño de su texto).
 * - `destruir()` libera el documento en pdf.js (y su worker) y ya no se puede
 *   usar: todo lo que llegue después se descarta.
 */
export class DocumentoVisor {
  #destruido = false;
  #textos = new Map<number, Promise<TextContent>>();
  #indices = new Map<number, Promise<IndicePagina>>();
  #anotaciones = new Map<number, Promise<AnotacionPdf[]>>();

  /** Páginas cuyo texto se conserva para la capa de texto. */
  static readonly TEXTOS_EN_CACHE = 12;

  constructor(readonly pdf: PDFDocumentProxy) {}

  get total(): number {
    return this.pdf.numPages;
  }

  /** Páginas con su texto en caché (para comprobar la política de memoria). */
  get textosEnCache(): number {
    return this.#textos.size;
  }

  get destruido(): boolean {
    return this.#destruido;
  }

  pagina(numero: number): Promise<PDFPageProxy> {
    if (this.#destruido) return Promise.reject(new DocumentoDestruidoError());
    return this.pdf.getPage(numero);
  }

  /** Tamaño en puntos de una página, con su rotación propia (`/Rotate`) aplicada. */
  static tamanoDe(pagina: PDFPageProxy): Tamano {
    const { width, height } = pagina.getViewport({ scale: 1 });
    return { ancho: width, alto: height };
  }

  /**
   * Pide los tamaños de todas las páginas y llama a `alAvanzar` con la lista
   * completa cada `lote` páginas. Para si el documento se destruye.
   */
  async tamanos(inicial: Tamano, alAvanzar: (tamanos: Tamano[]) => void, lote = 50): Promise<void> {
    const tamanos: Tamano[] = Array.from({ length: this.total }, () => inicial);
    for (let n = 1; n <= this.total; n++) {
      if (this.#destruido) return;
      try {
        tamanos[n - 1] = DocumentoVisor.tamanoDe(await this.pagina(n));
      } catch {
        if (this.#destruido) return;
        // Una página que no se puede leer conserva el tamaño supuesto: su render fallará y lo dirá.
      }
      if (n % lote === 0 || n === this.total) alAvanzar([...tamanos]);
    }
  }

  /** El contenido de texto para `TextLayer`, con caché de las últimas páginas. */
  texto(numero: number): Promise<TextContent> {
    let texto = this.#textos.get(numero);
    if (texto) {
      this.#textos.delete(numero); // al final: la más reciente
    } else {
      texto = this.pagina(numero).then((p) =>
        p.getTextContent({ includeMarkedContent: true, disableNormalization: true }),
      );
      texto.catch(() => this.#textos.delete(numero));
    }
    this.#textos.set(numero, texto);
    while (this.#textos.size > DocumentoVisor.TEXTOS_EN_CACHE) {
      const primera = this.#textos.keys().next().value;
      if (primera === undefined) break;
      this.#textos.delete(primera);
    }
    return texto;
  }

  /** El índice de búsqueda de una página (se calcula una vez). */
  indice(numero: number): Promise<IndicePagina> {
    let indice = this.#indices.get(numero);
    if (!indice) {
      // Mismas opciones que la capa de texto: los trozos coinciden uno a uno.
      indice = this.pagina(numero)
        .then((p) => p.getTextContent({ includeMarkedContent: true, disableNormalization: true }))
        .then((t) => indexarPagina(trozosDeTexto(t)));
      indice.catch(() => this.#indices.delete(numero));
      this.#indices.set(numero, indice);
    }
    return indice;
  }

  /** Enlaces de una página: la anotación y a dónde lleva, ya filtrados por la política. */
  async enlaces(numero: number): Promise<{ rect: number[]; destino: DestinoEnlace }[]> {
    let anotaciones = this.#anotaciones.get(numero);
    if (!anotaciones) {
      anotaciones = this.pagina(numero).then(
        (p) => p.getAnnotations({ intent: "display" }) as Promise<AnotacionPdf[]>,
      );
      anotaciones.catch(() => this.#anotaciones.delete(numero));
      this.#anotaciones.set(numero, anotaciones);
    }
    const salida: { rect: number[]; destino: DestinoEnlace }[] = [];
    for (const a of await anotaciones) {
      if (a.subtype !== "Link" || !Array.isArray(a.rect)) continue;
      const destino = await resolverEnlace(a, this.pdf, numero);
      if (destino) salida.push({ rect: a.rect, destino });
    }
    return salida;
  }

  /**
   * Libera lo que pdf.js guarda de una página renderizada (listas de
   * operaciones, imágenes decodificadas). La página se puede volver a pintar.
   */
  liberarPagina(numero: number): void {
    if (this.#destruido) return;
    this.pdf
      .getPage(numero)
      .then((p) => p.cleanup())
      .catch(() => {});
  }

  async destruir(): Promise<void> {
    if (this.#destruido) return;
    this.#destruido = true;
    this.#textos.clear();
    this.#indices.clear();
    this.#anotaciones.clear();
    await this.pdf.loadingTask.destroy();
  }
}

export class DocumentoDestruidoError extends Error {
  constructor() {
    super("documento-destruido");
    this.name = "DocumentoDestruidoError";
  }
}

/** Los trozos de TEXTO de `getTextContent`, en orden (sin los de contenido marcado). */
export function trozosDeTexto(contenido: { items: readonly object[] }): TrozoTexto[] {
  const trozos: TrozoTexto[] = [];
  for (const item of contenido.items) {
    if ("str" in item && typeof item.str === "string") {
      trozos.push({ str: item.str, hasEOL: "hasEOL" in item && item.hasEOL === true });
    }
  }
  return trozos;
}
