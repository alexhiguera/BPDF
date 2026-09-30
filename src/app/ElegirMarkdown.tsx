import { FileText } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import type { EleccionMarkdown } from "@/documents/types";
import { messages } from "@/i18n/messages";

const t = messages.chooseMarkdown;

/**
 * Una carpeta con varios Markdown (Fase 7 bis): BPDF no adivina cuál es el
 * principal, lo pregunta. No es un explorador de carpetas: una lista de
 * botones con las rutas relativas a la carpeta (ya saneadas, pintadas como
 * texto) y «Cancelar». El foco va al título al aparecer, como el resto de
 * vistas; cancelar deja el documento abierto como estaba.
 */
export function ElegirMarkdown({
  choice,
  onChoose,
  onCancel,
}: {
  choice: EleccionMarkdown;
  onChoose: (index: number) => void;
  onCancel: () => void;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), []);

  return (
    <section
      aria-labelledby="elegir-markdown-titulo"
      className="mx-auto mt-6 flex w-full max-w-xl flex-col gap-3 rounded-md border border-border bg-app p-4"
    >
      <h2 id="elegir-markdown-titulo" ref={titulo} tabIndex={-1} className="text-lg font-semibold">
        {t.title}
      </h2>
      <p className="text-fg-muted">{t.body(choice.candidates.length)}</p>
      <ul aria-label={t.list} className="flex max-h-80 flex-col gap-1 overflow-auto">
        {choice.candidates.map((ruta, i) => (
          // Las rutas pueden repetirse una vez saneadas: la clave es la posición.
          // biome-ignore lint/suspicious/noArrayIndexKey: lista fija de esta elección
          <li key={i}>
            <button
              type="button"
              onClick={() => onChoose(i)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left wrap-anywhere hover:bg-elevated"
            >
              <FileText aria-hidden="true" className="size-4 shrink-0 text-fg-muted" />
              {ruta}
            </button>
          </li>
        ))}
      </ul>
      <div>
        <Button variant="secondary" onClick={onCancel}>
          {t.cancel}
        </Button>
      </div>
    </section>
  );
}
