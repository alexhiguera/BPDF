import { lazy, Suspense, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { project } from "@/config/project";
import { DocumentProvider, useDocument } from "@/documents/DocumentProvider";
import { messages } from "@/i18n/messages";
import type { Platform } from "@/platform";
import { DocumentErrorAlert } from "./DocumentErrorAlert";
import { DocumentSummary } from "./DocumentSummary";
import { DropZone } from "./DropZone";
import { EmptyState } from "./EmptyState";

/**
 * El visor PDF se carga a demanda, al abrir el primer PDF: ni él ni pdf.js
 * entran en el arranque de la app (límite de `build:tamano`).
 */
const VisorPdf = lazy(() => import("./pdf/VisorPdf"));

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
  const { document, error, openWithPicker, openDropped, close, dismissError } = useDocument();
  const main = useRef<HTMLElement>(null);

  useOpenShortcut(openWithPicker);

  const cerrar = () => {
    close();
    main.current?.focus(); // el botón pulsado desaparece con el documento
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
          <Button variant="secondary" onClick={openWithPicker}>
            {messages.open.button}
          </Button>
        )}
      </header>
      <main
        ref={main}
        id="contenido"
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col overflow-auto bg-reading"
      >
        {error && <DocumentErrorAlert error={error} onDismiss={dismissError} />}
        {document?.kind === "pdf" ? (
          <Suspense fallback={<p className="p-6 text-fg-muted">{messages.pdf.loading}</p>}>
            <VisorPdf
              key={document.id}
              documento={document}
              onClose={cerrar}
              onOpenExternal={(url) => platform.openExternal(url)}
            />
          </Suspense>
        ) : document ? (
          <DocumentSummary key={document.id} document={document} onClose={cerrar} />
        ) : (
          <EmptyState onOpen={openWithPicker} />
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
