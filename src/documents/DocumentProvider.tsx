import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
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
  /** Cierra el documento y vuelve al estado vacío. */
  close(): void;
  dismissError(): void;
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
 * La confirmación de «cambios sin guardar» antes de sustituir llega con el
 * editor (Fase 9), que es quien puede tener cambios.
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

  // `read` se llama en el acto (sin `await` antes): `openDropped` depende de ello
  // para que la plataforma lea lo soltado dentro del evento.
  const load = useCallback(async (read: () => Promise<Apertura | null>) => {
    const mine = ++turn.current;
    try {
      const result = await read();
      if (mine !== turn.current || !result) return;
      if (result.kind === "choose-markdown") {
        setState((s) => ({ document: s.document, error: null, choice: result }));
      } else {
        setState({ document: result, error: null, choice: null });
      }
    } catch (e) {
      if (mine !== turn.current) return;
      setState((s) => ({ document: s.document, error: asDocumentError(e), choice: null }));
    }
  }, []);

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

  const close = useCallback(() => {
    turn.current++; // una apertura en curso ya no debe aplicarse
    setState({ document: null, error: null, choice: null });
  }, []);

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
    }),
    [state, openWithPicker, openFolder, openDropped, choose, cancelChoice, close, dismissError],
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
