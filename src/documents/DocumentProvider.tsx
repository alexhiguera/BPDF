import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Platform, Soltado } from "@/platform";
import { DocumentError } from "./errors";
import type { Apertura, EleccionMarkdown, OpenedDocument } from "./types";

type DocumentState = {
  /** El documento abierto. Uno solo (D16). */
  document: OpenedDocument | null;
  /** El último intento de apertura que falló, hasta que se descarta o se abre otro. */
  error: DocumentError | null;
  /** Una carpeta con varios Markdown esperando a que el usuario elija el principal. */
  choice: EleccionMarkdown | null;
};

/** Una sustitución esperando a que el usuario confirme que descarta sus cambios. */
type Confirmacion = { resolver: (descartar: boolean) => void };

export type DocumentContextValue = DocumentState & {
  /** Selector de archivos del sistema (uno, o un Markdown con sus imágenes). Cancelar no cambia nada. */
  openWithPicker(): Promise<void>;
  /** Selector de carpeta. */
  openFolder(): Promise<void>;
  /** Lo soltado en la ventana, ya capturado dentro del evento (ver `Soltado`). */
  openDropped(soltado: Soltado): Promise<void>;
  /** Abre el Markdown elegido de `choice`. */
  choose(index: number): Promise<void>;
  /** Descarta la elección pendiente: el documento abierto sigue como estaba. */
  cancelChoice(): void;
  /** Cierra el documento y vuelve al estado vacío (con cambios, tras confirmar). `false` si no se cerró. */
  close(): Promise<boolean>;
  dismissError(): void;
  /**
   * Fase 9: el documento abierto tiene cambios sin guardar. Lo marca el editor;
   * abrir otro documento siempre empieza limpio.
   */
  modified: boolean;
  setModified(modified: boolean): void;
  /** Hay una sustitución esperando a que el usuario confirme (`respondDiscard`). */
  pendingDiscard: boolean;
  /** Respuesta del usuario: `true` descarta los cambios y sigue; `false` no toca nada. */
  respondDiscard(discard: boolean): void;
};

const DocumentContext = createContext<DocumentContextValue | null>(null);

/**
 * Estado del documento abierto (docs/PLAN.md §4.1: un contexto, sin librería
 * de estado).
 *
 * **Un documento a la vez (D16).** Abrir otro lo sustituye: el anterior deja de
 * estar referenciado aquí y el recolector lo libera. Este estado no posee
 * recursos que haya que cerrar a mano (ni URL de objeto ni documentos de
 * pdf.js): los crean los visores (Fases 5 y 7), que se montan con
 * `key={document.id}` y los liberan al desmontarse, es decir, al sustituirse o
 * cerrarse el documento.
 *
 * **Si falla una apertura, el documento abierto se queda**: un fichero no
 * válido no debe hacer perder el que se estaba leyendo.
 *
 * **Carreras.** Cada apertura toma un turno; solo la última aplica su
 * resultado. Si un Markdown grande termina de leerse después de que se haya
 * soltado otro fichero, se descarta.
 *
 * **Cambios sin guardar (Fase 9).** El editor marca `modified`. Si hay cambios,
 * cualquier sustitución (selector, carpeta, soltar, elegir el Markdown de una
 * carpeta) y cerrar piden confirmación **después** de leer y validar lo nuevo y
 * **antes** de aplicarlo: cancelar el selector o elegir algo que no vale no
 * pregunta nada ni toca el documento abierto, y todas las vías pasan por aquí
 * (`load`). Con cambios, `beforeunload` avisa al cerrar o recargar la
 * pestaña. Nada de esto guarda nada: los cambios solo existen en memoria.
 */
export function DocumentProvider({
  platform,
  children,
}: {
  platform: Platform;
  children: ReactNode;
}) {
  const [state, setState] = useState<DocumentState>({ document: null, error: null, choice: null });
  const turn = useRef(0);
  const [modified, setModifiedState] = useState(false);
  const modifiedRef = useRef(false);
  const setModified = useCallback((m: boolean) => {
    modifiedRef.current = m;
    setModifiedState(m);
  }, []);

  // Confirmar antes de perder cambios. Una petición nueva cancela la anterior.
  const [pendingDiscard, setPendingDiscard] = useState(false);
  const pendiente = useRef<Confirmacion | null>(null);
  const confirmDiscard = useCallback((): Promise<boolean> => {
    if (!modifiedRef.current) return Promise.resolve(true);
    pendiente.current?.resolver(false);
    return new Promise<boolean>((resolver) => {
      pendiente.current = { resolver };
      setPendingDiscard(true);
    });
  }, []);
  const respondDiscard = useCallback((discard: boolean) => {
    const p = pendiente.current;
    pendiente.current = null;
    setPendingDiscard(false);
    p?.resolver(discard);
  }, []);

  useEffect(() => {
    if (!modified) return;
    // El texto del aviso lo pone el navegador; basta con cancelar el evento.
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [modified]);

  // `read` se llama en el acto (sin `await` antes): `openDropped` depende de ello
  // para que la plataforma lea lo soltado dentro del evento.
  const load = useCallback(
    async (read: () => Promise<Apertura | null>) => {
      const mine = ++turn.current;
      try {
        const result = await read();
        if (mine !== turn.current || !result) return;
        if (result.kind === "choose-markdown") {
          setState((s) => ({ document: s.document, error: null, choice: result }));
        } else {
          if (!(await confirmDiscard())) {
            if (mine === turn.current) setState((s) => ({ ...s, choice: null }));
            return;
          }
          if (mine !== turn.current) return;
          setModified(false);
          setState({ document: result, error: null, choice: null });
        }
      } catch (e) {
        if (mine !== turn.current) return;
        setState((s) => ({ document: s.document, error: asDocumentError(e), choice: null }));
      }
    },
    [confirmDiscard, setModified],
  );

  const openWithPicker = useCallback(() => load(() => platform.pickDocument()), [load, platform]);
  const openFolder = useCallback(() => load(() => platform.pickFolder()), [load, platform]);
  const openDropped = useCallback(
    (soltado: Soltado) => load(() => platform.openDropped(soltado)),
    [load, platform],
  );

  const choice = state.choice;
  const choose = useCallback(
    (index: number) => (choice ? load(() => choice.choose(index)) : Promise.resolve()),
    [load, choice],
  );
  const cancelChoice = useCallback(() => setState((s) => ({ ...s, choice: null })), []);

  const close = useCallback(async () => {
    if (!(await confirmDiscard())) return false;
    turn.current++; // una apertura en curso ya no debe aplicarse
    setModified(false);
    setState({ document: null, error: null, choice: null });
    return true;
  }, [confirmDiscard, setModified]);

  const dismissError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  const value = useMemo(
    () => ({
      ...state,
      openWithPicker,
      openFolder,
      openDropped,
      choose,
      cancelChoice,
      close,
      dismissError,
      modified,
      setModified,
      pendingDiscard,
      respondDiscard,
    }),
    [
      state,
      openWithPicker,
      openFolder,
      openDropped,
      choose,
      cancelChoice,
      close,
      dismissError,
      modified,
      setModified,
      pendingDiscard,
      respondDiscard,
    ],
  );
  return <DocumentContext value={value}>{children}</DocumentContext>;
}

export function useDocument(): DocumentContextValue {
  const value = useContext(DocumentContext);
  if (!value) throw new Error("useDocument() fuera de <DocumentProvider>");
  return value;
}

/**
 * Un error que no es `DocumentError` es un fallo nuestro, no del fichero: se
 * muestra como «no se pudo leer» y se deja en la consola local para quien
 * depura (nunca sale del dispositivo).
 */
function asDocumentError(e: unknown): DocumentError {
  if (e instanceof DocumentError) return e;
  console.error(e);
  return new DocumentError("unreadable", { cause: e });
}
