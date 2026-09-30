import { ChevronDown, ChevronUp, X } from "lucide-react";
import { messages } from "@/i18n/messages";
import type { EstadoBusqueda } from "@/pdf/visor/controlador";

const t = messages.pdf;
const boton =
  "inline-flex size-8 items-center justify-center rounded-md text-fg hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Barra de búsqueda: el campo, el recuento («3 de 12») y anterior/siguiente.
 * Intro = siguiente, Mayús+Intro = anterior, Esc = cerrar.
 */
export function BarraBusqueda({
  consulta,
  onConsulta,
  resultado,
  activa,
  onSiguiente,
  onCerrar,
}: {
  consulta: string;
  onConsulta: (texto: string) => void;
  resultado: EstadoBusqueda | null;
  activa: number;
  onSiguiente: (direccion: 1 | -1) => void;
  onCerrar: () => void;
}) {
  const total = resultado?.coincidencias.length ?? 0;
  let estado = "";
  if (resultado && consulta.trim() !== "") {
    if (!resultado.terminada && total === 0)
      estado = t.searching(resultado.revisadas, resultado.total);
    else if (total > 0) estado = t.searchCount(activa + 1, total);
    else if (resultado.sinTexto) estado = t.searchNoText;
    else estado = t.searchNone;
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: <search> no existe en los navegadores mínimos (Chrome 111, Safari 16.4)
    <div
      role="search"
      className="flex flex-wrap items-center gap-2 border-b border-border bg-app px-3 py-1"
    >
      <input
        id="busqueda-pdf"
        type="search"
        // biome-ignore lint/a11y/noAutofocus: la barra se abre para escribir en ella
        autoFocus
        autoComplete="off"
        aria-label={t.searchLabel}
        placeholder={t.searchLabel}
        value={consulta}
        onChange={(e) => onConsulta(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onSiguiente(e.shiftKey ? -1 : 1);
          } else if (e.key === "Escape") {
            e.preventDefault();
            onCerrar();
          }
        }}
        className="h-8 w-64 max-w-full rounded-md border border-border bg-elevated px-2 text-sm text-fg"
      />
      <button
        type="button"
        className={boton}
        aria-label={t.searchPrevious}
        title={t.searchPrevious}
        disabled={total === 0}
        onClick={() => onSiguiente(-1)}
      >
        <ChevronUp aria-hidden="true" className="size-4" />
      </button>
      <button
        type="button"
        className={boton}
        aria-label={t.searchNext}
        title={t.searchNext}
        disabled={total === 0}
        onClick={() => onSiguiente(1)}
      >
        <ChevronDown aria-hidden="true" className="size-4" />
      </button>
      <span className="text-sm text-fg-muted tabular-nums" data-testid="estado-busqueda">
        {estado}
      </span>
      <button
        type="button"
        className={`${boton} ml-auto`}
        aria-label={t.searchClose}
        title={t.searchClose}
        onClick={onCerrar}
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
