import { project } from "@/config/project";
import { messages } from "@/i18n/messages";
import { EmptyState } from "./EmptyState";

/**
 * Shell de la aplicación: barra superior (cromo) y área de lectura. Una sola
 * vista y sin router: el documento abierto (Fase 3) decidirá qué se monta en
 * `<main>`.
 */
export function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#contenido"
        className="sr-only rounded-md bg-primary px-3 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {messages.app.skipToContent}
      </a>
      <header className="border-b border-border bg-app px-4 py-2">
        <span className="font-semibold">{project.name}</span>
      </header>
      <main id="contenido" tabIndex={-1} className="flex flex-1 bg-reading">
        <EmptyState />
      </main>
    </div>
  );
}
