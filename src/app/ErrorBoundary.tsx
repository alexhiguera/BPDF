import { Home, RotateCcw, TriangleAlert } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { project } from "@/config/project";
import { messages } from "@/i18n/messages";
import { LogoBpdf } from "./LogoBpdf";

type Props = { children: ReactNode };
type State = { failed: boolean };

/**
 * Última red ante un error de render. BPDF no envía errores a ningún servicio
 * (sin telemetría: docs/SEGURIDAD.md §6): solo se avisa y se ofrece reintentar.
 * React 19 sigue exigiendo un componente de clase para esto.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Solo a la consola local, para quien depura. Nunca sale del dispositivo.
    console.error(error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const t = messages.error;
    return (
      <main className="static-page">
        <section className="ui-notice mx-auto flex w-full max-w-lg flex-col items-center gap-4 p-6 text-center">
          <LogoBpdf className="size-20" />
          <p className="font-bold tracking-widest text-brand-soft">{project.name}</p>
          <TriangleAlert aria-hidden="true" className="size-7 text-danger" />
          <h1 className="text-2xl font-semibold">{t.title}</h1>
          <p className="text-fg-muted">{t.body}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => window.location.reload()}>
              <RotateCcw aria-hidden="true" className="size-4" />
              {t.reload}
            </Button>
            <a
              href="/"
              className="ui-button ui-button-secondary inline-flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-fg"
            >
              <Home aria-hidden="true" className="size-4" />
              {t.home}
            </a>
          </div>
        </section>
      </main>
    );
  }
}
