import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { messages } from "@/i18n/messages";

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
      <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <p className="text-fg-muted">{t.body}</p>
        <div>
          <Button onClick={() => this.setState({ failed: false })}>{t.retry}</Button>
        </div>
      </main>
    );
  }
}
