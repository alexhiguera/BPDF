import { messages } from "@/i18n/messages";
import type { EntradaIndice } from "../toc";

/** Sangría por nivel: clases fijas (Tailwind solo ve clases escritas enteras). */
const SANGRIA = ["", "pl-2", "pl-5", "pl-8", "pl-11", "pl-14", "pl-17"];

/**
 * Índice del documento: una lista de enlaces a sus encabezados, sangrada por
 * nivel. Lista plana (y no anidada) a propósito: un documento puede saltar de
 * `h1` a `h4`, y una lista anidada inventaría niveles vacíos. El texto de cada
 * entrada es el del encabezado, pintado como texto.
 */
export function Indice({
  id,
  entradas,
  onIr,
}: {
  id: string;
  entradas: readonly EntradaIndice[];
  onIr: (id: string) => void;
}) {
  return (
    <nav
      id={id}
      aria-label={messages.markdown.tocLabel}
      className="md-indice absolute inset-y-0 left-0 z-10 w-72 max-w-[85vw] overflow-auto border-r border-border bg-app p-3 lg:static lg:z-auto lg:shrink-0"
    >
      <ol className="flex flex-col gap-0.5 text-sm">
        {entradas.map((e) => (
          <li key={e.id} className={SANGRIA[e.nivel]}>
            <a
              href={`#${e.id}`}
              className="block rounded px-2 py-1 text-fg-muted hover:bg-elevated hover:text-fg"
              onClick={(ev) => {
                ev.preventDefault();
                onIr(e.id);
              }}
            >
              {e.texto}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
