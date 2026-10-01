import { lazy, Suspense, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { project } from "@/config/project";
import { DocumentProvider, useDocument } from "@/documents/DocumentProvider";
import { messages } from "@/i18n/messages";
import type { Platform } from "@/platform";
import { ConfirmarDescarte } from "./ConfirmarDescarte";
import { DocumentErrorAlert } from "./DocumentErrorAlert";
import { DropZone } from "./DropZone";
import { ElegirMarkdown } from "./ElegirMarkdown";
import { EmptyState } from "./EmptyState";

/**
 * Los visores se cargan a demanda, al abrir el primer documento de su tipo: ni
 * pdf.js ni el pipeline de Markdown entran en el arranque de la app (límite de
 * `build:tamano`).
 */
const VisorPdf = lazy(() => import("./pdf/VisorPdf"));
const MarkdownView = lazy(() => import("@/markdown/MarkdownView"));

/**
 * La aplicación. Recibe la plataforma (web hoy, Electron en la Fase 14) desde
 * `main.tsx`, y los tests una falsa.
 */
export function App({ platform }: { platform: Platform }) {
  return (
    <DocumentProvider platform={platform}>
      <Shell platform={platform} />
    </DocumentProvider>
  );
}

/**
 * Shell: barra superior (cromo) y área de lectura. Una sola vista y sin
 * router: el documento abierto decide qué se monta en `<main>`.
 */
function Shell({ platform }: { platform: Platform }) {
  const {
    document,
    error,
    choice,
    openWithPicker,
    openFolder,
    openDropped,
    choose,
    cancelChoice,
    close,
    dismissError,
    setModified,
    pendingDiscard,
    respondDiscard,
  } = useDocument();
  const main = useRef<HTMLElement>(null);

  useOpenShortcut(openWithPicker);

  const cerrar = async () => {
    // El botón pulsado desaparece con el documento: el foco pasa a <main>.
    if (await close()) main.current?.focus();
  };

  return (
    <DropZone onFiles={openDropped}>
      <a
        href="#contenido"
        className="sr-only rounded-md bg-primary px-3 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {messages.app.skipToContent}
      </a>
      <header className="flex items-center justify-between gap-4 border-b border-border bg-app px-4 py-2">
        <span className="font-semibold">{project.name}</span>
        {/* Sin documento, la acción está en el centro del estado vacío. */}
        {document && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openFolder}>
              {messages.open.folder}
            </Button>
            <Button variant="secondary" onClick={openWithPicker}>
              {messages.open.button}
            </Button>
          </div>
        )}
      </header>
      <main
        ref={main}
        id="contenido"
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col overflow-auto bg-reading"
      >
        {error && <DocumentErrorAlert error={error} onDismiss={dismissError} />}
        {choice && <ElegirMarkdown choice={choice} onChoose={choose} onCancel={cancelChoice} />}
        {document?.kind === "pdf" ? (
          <Suspense fallback={<p className="p-6 text-fg-muted">{messages.pdf.loading}</p>}>
            <VisorPdf
              key={document.id}
              documento={document}
              onClose={cerrar}
              onOpenExternal={(url) => platform.openExternal(url)}
            />
          </Suspense>
        ) : document?.kind === "markdown" ? (
          <Suspense fallback={<p className="p-6 text-fg-muted">{messages.markdown.loading}</p>}>
            <MarkdownView
              key={document.id}
              documento={document}
              onClose={cerrar}
              onOpenExternal={(url) => platform.openExternal(url)}
              onModificado={setModified}
              onGuardar={(texto) => platform.saveText(document, texto)}
            />
          </Suspense>
        ) : (
          !choice && <EmptyState onOpen={openWithPicker} onOpenFolder={openFolder} />
        )}
        {pendingDiscard && document && (
          <ConfirmarDescarte nombre={document.name} onResponder={respondDiscard} />
        )}
      </main>
    </DropZone>
  );
}

/**
 * `Ctrl+O` / `Cmd+O` abre el selector (docs/PLAN.md §9.4) en lugar del
 * «Abrir archivo» del navegador, que cargaría el fichero fuera de la app. Es
 * el único listener global: un atajo de teclado tiene que funcionar tenga el
 * foco quien lo tenga.
 */
function useOpenShortcut(open: () => void) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        open();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);
}
