import { PanelLeft, Save, X } from "lucide-react";
import {
  lazy,
  memo,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Markdown, { type Components } from "react-markdown";
import type { OpenedMarkdown } from "@/documents/types";
import { ModeSwitch } from "@/editor/ModeSwitch";
import { SplitView } from "@/editor/SplitView";
import { useDesplazamientoSincronizado } from "@/editor/sincronia";
import type { EstadoGuardado, ManejadorEditor, ModoMarkdown } from "@/editor/tipos";
import { messages } from "@/i18n/messages";
import type { ResultadoGuardado } from "@/platform";
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

/**
 * El editor (CodeMirror) se carga a demanda al entrar en «Edición» o
 * «Dividido»: leer un Markdown no lo descarga.
 */
const EditorMarkdown = lazy(() => import("@/editor/EditorMarkdown"));

/** Espera desde la última tecla hasta refrescar la vista previa («Dividido»). */
export const ESPERA_VISTA_PREVIA_MS = 200;

/**
 * Si pintar la vista previa de ESTE documento costó más que esto, en
 * «Dividido» deja de refrescarse sola: cada refresco bloquearía la escritura
 * ese tiempo (medido: 1,4–3,4 s con 1 MB). Se avisa y se actualiza a mano o al
 * cambiar de modo. Decisión de la Fase 9 (docs/ARCHITECTURE.md §4 octies).
 */
export const UMBRAL_PAUSA_MS = 250;

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
 *
 * **Edición (Fase 9).** Tres modos: «Lectura» (lo de siempre), «Edición» (solo
 * el editor, sin vista previa) y «Dividido» (editor y vista previa). La vista
 * previa es ESTE MISMO lector (`Contenido`, mismo pipeline, mismas políticas de
 * URL, recursos, KaTeX y Mermaid) con el texto editado, que se le pasa 200 ms
 * después de la última tecla, nunca en cada una. El texto editado vive en el
 * editor (`EstadoGuardado`: sobrevive a cambiar de modo, con su historial);
 * `documento` no cambia: sus recursos son los que se entregaron al abrir, y
 * editar no da acceso a nada más. Los cambios se marcan con `onModificado` y se
 * guardan con `onGuardar` (Ctrl/⌘+S o el botón). Nada se guarda por su cuenta.
 */
export default function MarkdownView({
  documento,
  onClose,
  onOpenExternal,
  onModificado = () => {},
  onGuardar,
  umbralPausaMs = UMBRAL_PAUSA_MS,
}: {
  documento: OpenedMarkdown;
  onClose: () => void;
  onOpenExternal: (url: string) => void;
  /** El documento pasa a tener (o deja de tener) cambios sin guardar. */
  onModificado?: (modificado: boolean) => void;
  /** Guarda el texto (`Platform.saveText`). Sin esto no se ofrece guardar. */
  onGuardar?: (texto: string) => Promise<ResultadoGuardado>;
  /** Para los tests: el umbral de la pausa de la vista previa. */
  umbralPausaMs?: number;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);
  const articulo = useRef<HTMLElement>(null);
  const idIndice = useId();
  const [indice, setIndice] = useState<EntradaIndice[]>([]);
  const [indiceAbierto, setIndiceAbierto] = useState(esAncha);
  const [aviso, setAviso] = useState("");
  const [listo, setListo] = useState(() => documento.text.length <= UMBRAL_DIFERIDO);
  const abrirFuera = useRef(onOpenExternal);

  // --- Edición (Fase 9) ----------------------------------------------------
  const [modo, setModo] = useState<ModoMarkdown>("lectura");
  const modoRef = useRef(modo);
  modoRef.current = modo;
  /** El texto que pinta la vista previa: el del documento hasta que se edita. */
  const [textoVista, setTextoVista] = useState(documento.text);
  const textoVistaRef = useRef(textoVista);
  textoVistaRef.current = textoVista;
  /**
   * Cuándo empezó el último pintado de la vista previa (para medir lo que
   * cuesta). El primero solo se mide en un documento grande (el que se pinta en
   * diferido, abajo): en uno pequeño, el primer pintado de la página incluye
   * el arranque en frío de todo y daría una pausa falsa.
   */
  const inicioPintado = useRef<number | null>(null);
  /** La vista previa de este documento es cara: en «Dividido» no se refresca sola. */
  const [pausada, setPausada] = useState(false);
  /** Hay cambios que la vista previa pausada aún no muestra. */
  const [desactualizada, setDesactualizada] = useState(false);
  const refrescarVista = useCallback((texto: string) => {
    setDesactualizada(false);
    if (texto === textoVistaRef.current) return;
    inicioPintado.current = performance.now();
    setTextoVista(texto);
  }, []);
  /** El editor se carga la primera vez que se entra en un modo con él, y ya se queda. */
  const [editorCargado, setEditorCargado] = useState(false);
  const [estadoEditor] = useState<EstadoGuardado>(() => ({ actual: null }));
  const editor = useRef<ManejadorEditor | null>(null);
  const [editorListo, setEditorListo] = useState(false);
  const panelEditor = useRef<HTMLDivElement>(null);
  const version = useRef(0);
  const modificado = useRef(false);
  const [sinGuardar, setSinGuardar] = useState(false);
  const avisarModificado = useRef(onModificado);
  avisarModificado.current = onModificado;
  /** Solo en las transiciones: un repintado al empezar a editar y otro al guardar. */
  const marcarModificado = useCallback((m: boolean) => {
    modificado.current = m;
    setSinGuardar(m);
    avisarModificado.current(m);
  }, []);
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [guardando, setGuardando] = useState(false);
  const guardandoRef = useRef(false);
  const [errorGuardado, setErrorGuardado] = useState(false);

  /** El texto actual: el del editor montado, el que dejó al desmontarse o el original. */
  const textoActual = useCallback((): string => {
    if (editor.current) return editor.current.texto();
    const guardado = estadoEditor.actual as { doc?: { toString(): string } } | null;
    return guardado?.doc?.toString() ?? documento.text;
  }, [estadoEditor, documento.text]);

  // Cada cambio del editor: O(1). Marca «modificado» la primera vez y
  // reprograma la vista previa; el texto solo se saca del editor al vencer la
  // espera (sacarlo cuesta O(tamaño)).
  const alCambiar = useRef(() => {});
  alCambiar.current = () => {
    version.current++;
    // Solo cuando cambia algo: una tecla normal no vuelve a pintar el visor.
    if (errorGuardado) setErrorGuardado(false);
    if (!modificado.current) marcarModificado(true);
    if (modoRef.current !== "dividido") return;
    if (pausadaRef.current) {
      if (!desactualizada) setDesactualizada(true);
      return;
    }
    clearTimeout(espera.current);
    espera.current = setTimeout(() => {
      if (editor.current) refrescarVista(editor.current.texto());
    }, ESPERA_VISTA_PREVIA_MS);
  };
  const pausadaRef = useRef(pausada);
  pausadaRef.current = pausada;
  useEffect(() => () => clearTimeout(espera.current), []);

  const cambiarModo = (nuevo: ModoMarkdown) => {
    clearTimeout(espera.current);
    // La vista previa se pone al día al volver a verla (también si estaba en pausa).
    if (nuevo !== "edicion") refrescarVista(textoActual());
    if (nuevo !== "lectura") setEditorCargado(true);
    setModo(nuevo);
  };

  // Al entrar en un modo con editor, el foco va a él (cuando ha cargado).
  useEffect(() => {
    if (editorListo && modo !== "lectura") editor.current?.enfocar();
  }, [editorListo, modo]);

  const guardar = useCallback(async () => {
    if (!onGuardar || guardandoRef.current) return;
    guardandoRef.current = true;
    setGuardando(true);
    setErrorGuardado(false);
    const guardada = version.current;
    try {
      const resultado = await onGuardar(textoActual());
      if (resultado !== "cancelado") {
        // Si se escribió algo mientras se guardaba, sigue modificado.
        if (version.current === guardada && modificado.current) marcarModificado(false);
        setAviso(resultado === "guardado" ? t.saved : t.downloaded);
      }
    } catch {
      setErrorGuardado(true);
    } finally {
      guardandoRef.current = false;
      setGuardando(false);
    }
  }, [onGuardar, textoActual, marcarModificado]);

  // Ctrl/⌘+S: guarda aquí, no «Guardar página» del navegador. Con un diálogo
  // modal abierto (otra pregunta está en curso) no guarda, pero tampoco deja
  // pasar el del navegador.
  useEffect(() => {
    if (!onGuardar) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "s")
        return;
      e.preventDefault();
      if (document.querySelector("dialog[open]")) return;
      void guardar();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onGuardar, guardar]);

  useDesplazamientoSincronizado({
    activo: modo === "dividido",
    editorListo,
    editor,
    panelEditor,
    articulo,
    texto: textoVista,
  });
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
      espera = setTimeout(() => {
        inicioPintado.current = performance.now();
        setListo(true);
      });
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
  }, [textoVista, listo, modo]);

  // Lo que costó pintar la vista previa (del cambio de texto a aquí: parsear,
  // React y el DOM). Decide si en «Dividido» se refresca sola.
  // biome-ignore lint/correctness/useExhaustiveDependencies: se mide cada pintado del texto
  useLayoutEffect(() => {
    if (!listo || inicioPintado.current === null) return;
    const coste = performance.now() - inicioPintado.current;
    inicioPintado.current = null;
    setPausada(coste > umbralPausaMs);
  }, [textoVista, listo]);

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

  const hayIndice = indice.length > 0 && modo === "lectura";
  const editorMontable = editorCargado && (
    <Suspense
      fallback={
        <p role="status" className="p-4 text-fg-muted">
          {t.editor.loading}
        </p>
      }
    >
      <EditorMarkdown
        textoInicial={documento.text}
        estado={estadoEditor}
        alCambiar={alCambiar}
        manejador={editor}
        etiqueta={t.editor.label}
        alMontar={setEditorListo}
      />
    </Suspense>
  );
  const vista: ReactNode = (
    <article
      ref={articulo}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: región desplazable con el teclado
      tabIndex={0}
      aria-labelledby="titulo-documento"
      // `contain: strict`: lo que pase dentro (y en el editor de al lado) no obliga a
      // volver a maquetar ni pintar lo de fuera.
      className="min-h-0 min-w-0 flex-1 overflow-auto bg-page [contain:strict]"
    >
      <div className="md-contenido" aria-busy={!listo}>
        {listo ? (
          <ContextoAcciones value={acciones}>
            <ContextoImagenes value={imagenes}>
              <ContextoDiagramas value={diagramas}>
                <Contenido texto={textoVista} />
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
  );
  return (
    <section
      aria-labelledby="titulo-documento"
      className="flex min-h-0 flex-1 flex-col"
      data-modo={modo}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-app px-3 py-1.5">
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
        {sinGuardar && (
          <span className="text-xs text-fg-muted" data-testid="modificado">
            {t.modified}
          </span>
        )}
        <ModeSwitch modo={modo} onModo={cambiarModo} />
        {onGuardar && (
          <button
            type="button"
            className="md-boton"
            title={t.saveShortcut}
            aria-keyshortcuts="Control+S Meta+S"
            disabled={guardando}
            onClick={() => void guardar()}
          >
            <Save aria-hidden="true" className="size-4 shrink-0" />
            {guardando ? t.saving : t.save}
          </button>
        )}
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
      {errorGuardado && (
        <p role="alert" className="border-b border-border bg-app px-3 py-1.5 text-sm text-danger">
          {t.saveFailed}
        </p>
      )}
      {/* Una sola estructura para los tres modos. Lectura ↔ Dividido comparten la
          vista previa sin volver a montarla (pintar 1 MB cuesta segundos), y el
          editor, una vez cargado, se queda. En Edición la vista previa NO está
          montada: una oculta de 1 MB (con miles de fórmulas) hacía que teclear
          tuviera picos de casi 1 s (medido; docs/ARCHITECTURE.md §4 octies). */}
      <SplitView
        mostrar={modo === "lectura" ? "derecha" : modo === "edicion" ? "izquierda" : "ambos"}
        izquierda={editorMontable}
        refIzquierda={panelEditor}
        derecha={
          <>
            {modo === "dividido" && desactualizada && (
              <div
                role="status"
                className="flex flex-wrap items-center gap-2 border-b border-border bg-app px-3 py-1.5 text-sm text-fg-muted"
              >
                <span>{t.previewPaused}</span>
                <button
                  type="button"
                  className="md-boton"
                  onClick={() => refrescarVista(textoActual())}
                >
                  {t.previewRefresh}
                </button>
              </div>
            )}
            <div className="relative flex min-h-0 flex-1">
              {hayIndice && indiceAbierto && (
                <Indice id={idIndice} entradas={indice} onIr={irDesdeIndice} />
              )}
              {modo !== "edicion" && vista}
            </div>
          </>
        }
      />
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
