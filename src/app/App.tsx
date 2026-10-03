import { Settings } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
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
/** Preferencias (Fase 10): el diálogo, `zod` y el almacén llegan al abrirlo. */
const PreferencesDialog = lazy(() => import("@/preferences/PreferencesDialog"));

/**
 * La aplicación. Recibe la plataforma (la web) desde
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
  const [preferencias, setPreferencias] = useState(false);

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
        <div className="flex gap-2">
          {/* Sin documento, abrir está en el centro del estado vacío. */}
          {document && (
            <>
              <Button variant="secondary" onClick={openFolder}>
                {messages.open.folder}
              </Button>
              <Button variant="secondary" onClick={openWithPicker}>
                {messages.open.button}
              </Button>
            </>
          )}
          {/* Las preferencias, siempre: también sin documento abierto. */}
          <Button
            variant="secondary"
            aria-haspopup="dialog"
            title={messages.preferences.open}
            onClick={() => setPreferencias(true)}
          >
            <Settings aria-hidden="true" className="size-4" />
            {/* En pantalla estrecha, solo el icono: el nombre sigue ahí para el lector. */}
            <span className="max-sm:sr-only">{messages.preferences.open}</span>
          </Button>
        </div>
      </header>
      {preferencias && (
        <Suspense fallback={null}>
          <PreferencesDialog onCerrar={() => setPreferencias(false)} />
        </Suspense>
      )}
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
