import { messages } from "@/i18n/messages";
import type { ModoMarkdown } from "./tipos";

const t = messages.markdown.mode;
const MODOS: readonly ModoMarkdown[] = ["lectura", "edicion", "dividido"];

/**
 * Lectura / Edición / Dividido (Fase 9). Como los modos del visor PDF: botones
 * con texto visible y `aria-pressed` dentro de un grupo con nombre, así que el
 * modo actual se ve y se anuncia sin depender del color.
 */
export function ModeSwitch({
  modo,
  onModo,
}: {
  modo: ModoMarkdown;
  onModo: (modo: ModoMarkdown) => void;
}) {
  return (
    <fieldset className="flex items-center gap-1">
      <legend className="sr-only">{t.label}</legend>
      {MODOS.map((m) => (
        <button
          key={m}
          type="button"
          className="md-boton aria-pressed:bg-elevated aria-pressed:outline aria-pressed:outline-1 aria-pressed:outline-border"
          aria-pressed={modo === m}
          onClick={() => onModo(m)}
        >
          {t[m]}
        </button>
      ))}
    </fieldset>
  );
}
