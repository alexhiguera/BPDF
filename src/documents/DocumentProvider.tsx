import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Platform } from "@/platform";
import { DocumentError } from "./errors";
import type { OpenedDocument } from "./types";

type DocumentState = {
  /** El documento abierto. Uno solo (D16). */
  document: OpenedDocument | null;
  /** El último intento de apertura que falló, hasta que se descarta o se abre otro. */
  error: DocumentError | null;
};

export type DocumentContextValue = DocumentState & {
  /** Selector del sistema. Cancelar no cambia nada. */
  openWithPicker(): Promise<void>;
  /** Ficheros soltados en la ventana. Más de uno es un error (D16). */
  openDropped(files: readonly File[]): Promise<void>;
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
  const [state, setState] = useState<DocumentState>({ document: null, error: null });
  const turn = useRef(0);

  const load = useCallback(async (read: () => Promise<OpenedDocument | null>) => {
    const mine = ++turn.current;
    try {
      const document = await read();
      if (mine !== turn.current || !document) return;
      setState({ document, error: null });
    } catch (e) {
      if (mine !== turn.current) return;
      setState((s) => ({ document: s.document, error: asDocumentError(e) }));
    }
  }, []);

  const openWithPicker = useCallback(() => load(() => platform.pickDocument()), [load, platform]);

  const openDropped = useCallback(
    (files: readonly File[]) =>
      load(async () => {
        const [file, ...rest] = files;
        if (!file) return null;
        if (rest.length > 0) throw new DocumentError("multiple");
        return platform.openDroppedFile(file);
      }),
    [load, platform],
  );

  const close = useCallback(() => {
    turn.current++; // una apertura en curso ya no debe aplicarse
    setState({ document: null, error: null });
  }, []);

  const dismissError = useCallback(() => setState((s) => ({ ...s, error: null })), []);

  const value = useMemo(
    () => ({ ...state, openWithPicker, openDropped, close, dismissError }),
    [state, openWithPicker, openDropped, close, dismissError],
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
