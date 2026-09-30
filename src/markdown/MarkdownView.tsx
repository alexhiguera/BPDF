import { PanelLeft, X } from "lucide-react";
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import Markdown, { type Components } from "react-markdown";
import type { OpenedMarkdown } from "@/documents/types";
import { messages } from "@/i18n/messages";
import {
  type AccionesDocumento,
  ContextoAcciones,
  ContextoDiagramas,
  ContextoImagenes,
  type ImagenesDocumento,
} from "./components/acciones";
import { Enlace } from "./components/Enlace";
import { Casilla, encabezado, Tabla } from "./components/elementos";
import { Imagen } from "./components/Imagen";
import { Indice } from "./components/Indice";
import { CodigoEnLinea, Preformateado } from "./components/Preformateado";
import { AlmacenUrls } from "./imagenes";
import { MarcoMermaid } from "./mermaid";
import { opcionesPipeline } from "./pipeline";
import { type EntradaIndice, idsCandidatos, leerIndice } from "./toc";
import "@/styles/markdown.css";

const t = messages.markdown;

/** Componentes propios del documento. Fijos (módulo): ver `acciones.ts`. */
const COMPONENTES: Components = {
  a: Enlace,
  img: Imagen,
  pre: Preformateado,
  code: CodigoEnLinea,
  table: Tabla,
  input: Casilla,
  h1: encabezado(1),
  h2: encabezado(2),
  h3: encabezado(3),
  h4: encabezado(4),
  h5: encabezado(5),
  h6: encabezado(6),
};

/**
 * Por encima de este tamaño, el contenido se pinta un momento después que la
 * barra (ver el efecto en `MarkdownView`). Por debajo, pintarlo cuesta menos
 * de ~0,5 s (medido) y el aviso solo sería un parpadeo.
 */
export const UMBRAL_DIFERIDO = 100_000;

/** A partir de este ancho el índice es una columna; por debajo, un panel encima. */
const PANTALLA_ANCHA = "(min-width: 64rem)";
const esAncha = () =>
  typeof window !== "undefined" && (window.matchMedia?.(PANTALLA_ANCHA).matches ?? false);

/**
 * El documento renderizado. `memo`: solo se vuelve a procesar si cambia el
 * texto, no cuando el visor se repinta (abrir el índice, un aviso).
 */
const Contenido = memo(function Contenido({ texto }: { texto: string }) {
  return (
    <Markdown {...opcionesPipeline} components={COMPONENTES}>
      {texto}
    </Markdown>
  );
});

/**
 * Visor de Markdown (Fase 7, docs/ARCHITECTURE.md → visor Markdown).
 *
 * Recibe el texto que ya leyó `DocumentProvider` (Fase 3): no vuelve a leer
 * el fichero. Se monta con `key={document.id}`: abrir otro documento lo
 * desmonta entero. No crea listeners globales, observers ni workers. Lo
 * temporal: los avisos de «Copiado» (cada bloque los cancela al desmontarse) y
 * las URL `blob:` de las imágenes locales (`AlmacenUrls`, revocadas aquí).
 *
 * El contenido vive en un `<article>` propio, que es el que se desplaza: la
 * búsqueda (Fase posterior) podrá recorrer su texto sin tocar el pipeline.
 */
export default function MarkdownView({
  documento,
  onClose,
  onOpenExternal,
}: {
  documento: OpenedMarkdown;
  onClose: () => void;
  onOpenExternal: (url: string) => void;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const articulo = useRef<HTMLElement>(null);
  const idIndice = useId();
  const [indice, setIndice] = useState<EntradaIndice[]>([]);
  const [indiceAbierto, setIndiceAbierto] = useState(esAncha);
  const [aviso, setAviso] = useState("");
  const [listo, setListo] = useState(() => documento.text.length <= UMBRAL_DIFERIDO);
  const abrirFuera = useRef(onOpenExternal);
  // Las URL `blob:` de las imágenes de ESTE documento: se revocan todas al
  // desmontar (cerrar o abrir otro, que monta otro visor con `key`).
  const [almacen] = useState(() => new AlmacenUrls());
  useEffect(() => () => almacen.revocarTodo(), [almacen]);
  // El marco aislado de Mermaid: solo si el documento tiene diagramas (se crea al
  // pedirlo) y se destruye, iframe incluido, al desmontar.
  const marco = useRef<MarcoMermaid | null>(null);
  useEffect(
    () => () => {
      marco.current?.destruir();
      marco.current = null;
    },
    [],
  );
  const diagramas = useMemo(
    () => ({
      marco() {
        marco.current ??= new MarcoMermaid();
        return marco.current;
      },
    }),
    [],
  );
  const imagenes = useMemo<ImagenesDocumento>(
    () => ({ recursos: documento.resources, almacen }),
    [documento.resources, almacen],
  );

  useEffect(() => {
    abrirFuera.current = onOpenExternal;
  }, [onOpenExternal]);

  // Como el resto de vistas de documento: el foco va al título al abrir.
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  // Documento grande: primero se pinta la barra y «Preparando…», y después el
  // contenido. Pintarlo bloquea el hilo principal (segundos por MB, medido en
  // docs/ARCHITECTURE.md), y sin esto la pantalla anterior se quedaría
  // congelada sin ninguna señal. `requestAnimationFrame` corre ANTES del
  // siguiente pintado; el `setTimeout` de dentro, después.
  useEffect(() => {
    if (listo) return;
    let espera: ReturnType<typeof setTimeout> | undefined;
    const marco = requestAnimationFrame(() => {
      espera = setTimeout(() => setListo(true));
    });
    return () => {
      cancelAnimationFrame(marco);
      clearTimeout(espera);
    };
  }, [listo]);

  // El índice se lee de los encabezados ya pintados, antes de que se vea nada.
  // Depende del texto aunque no lo lea: el DOM que lee sale de él.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver arriba
  useLayoutEffect(() => {
    if (listo && articulo.current) setIndice(leerIndice(articulo.current));
  }, [documento.text, listo]);

  const acciones = useMemo<AccionesDocumento>(
    () => ({
      abrirExterno(url) {
        setAviso(t.link.announceExternal(url));
        abrirFuera.current(url);
      },
      irASeccion: (fragmento) => irA(articulo.current, fragmento),
    }),
    [],
  );

  const irDesdeIndice = (id: string) => {
    irA(articulo.current, id);
    // En pantalla estrecha el índice tapa el texto: se cierra al elegir.
    if (!esAncha()) setIndiceAbierto(false);
  };

  const hayIndice = indice.length > 0;
  return (
    <section aria-labelledby="titulo-documento" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-app px-3 py-1.5">
        {hayIndice && (
          <button
            type="button"
            className="md-boton"
            aria-expanded={indiceAbierto}
            aria-controls={idIndice}
            title={indiceAbierto ? t.hideToc : t.showToc}
            onClick={() => setIndiceAbierto((a) => !a)}
          >
            <PanelLeft aria-hidden="true" className="size-4 shrink-0" />
            {t.toc}
          </button>
        )}
        <h1
          ref={titulo}
          id="titulo-documento"
          tabIndex={-1}
          className="min-w-0 flex-1 truncate text-sm font-semibold"
        >
          {documento.name}
        </h1>
        <button
          type="button"
          className="md-boton"
          aria-label={t.close}
          title={t.close}
          onClick={onClose}
        >
          <X aria-hidden="true" className="size-4 shrink-0" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1">
        {hayIndice && indiceAbierto && (
          <Indice id={idIndice} entradas={indice} onIr={irDesdeIndice} />
        )}
        <article
          ref={articulo}
          // biome-ignore lint/a11y/noNoninteractiveTabindex: región desplazable con el teclado
          tabIndex={0}
          aria-labelledby="titulo-documento"
          className="min-w-0 flex-1 overflow-auto bg-page"
        >
          <div className="md-contenido" aria-busy={!listo}>
            {listo ? (
              <ContextoAcciones value={acciones}>
                <ContextoImagenes value={imagenes}>
                  <ContextoDiagramas value={diagramas}>
                    <Contenido texto={documento.text} />
                  </ContextoDiagramas>
                </ContextoImagenes>
              </ContextoAcciones>
            ) : (
              <p role="status" className="text-fg-muted">
                {t.loading}
              </p>
            )}
          </div>
        </article>
      </div>
      <p className="sr-only" aria-live="polite">
        {aviso}
      </p>
    </section>
  );
}

/**
 * Desplaza hasta la sección y le pasa el foco. Solo busca dentro del propio
 * documento y solo ids con prefijo (`idsCandidatos`): un enlace del documento
 * no puede llevar el foco a la interfaz de BPDF.
 */
function irA(raiz: HTMLElement | null, fragmento: string): boolean {
  if (!raiz) return false;
  for (const id of idsCandidatos(fragmento)) {
    const destino = raiz.ownerDocument.getElementById(id);
    if (!destino || !raiz.contains(destino)) continue;
    // Las notas al pie (`li`) no son enfocables de por sí.
    if (!destino.hasAttribute("tabindex")) destino.tabIndex = -1;
    destino.scrollIntoView?.({ block: "start" });
    destino.focus({ preventScroll: true });
    return true;
  }
  return false;
}
