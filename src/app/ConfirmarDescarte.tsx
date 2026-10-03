import { useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { messages } from "@/i18n/messages";

const t = messages.discard;

/** El elemento con el foco, también dentro de un Shadow DOM (el del editor). */
function elementoActivo(): HTMLElement | null {
  let e: Element | null = document.activeElement;
  while (e?.shadowRoot?.activeElement) e = e.shadowRoot.activeElement;
  return e instanceof HTMLElement && e !== document.body ? e : null;
}

/**
 * «Hay cambios sin guardar» (Fase 9): antes de sustituir o cerrar un documento
 * con cambios. `<dialog>` modal; el foco empieza en «Seguir editando» (lo que
 * no pierde nada) y Esc equivale a esa opción. Descartar no guarda ni borra
 * nada en ningún sitio: los cambios solo existían en memoria.
 */
export function ConfirmarDescarte({
  nombre,
  onResponder,
}: {
  nombre: string;
  onResponder: (descartar: boolean) => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const seguir = useRef<HTMLButtonElement>(null);
  const idTitulo = useId();
  const idTexto = useId();

  useEffect(() => {
    // Fase 13: al responder, el foco vuelve a donde estaba (casi siempre, el editor). El
    // editor vive en un Shadow DOM: el elemento con el foco se busca dentro de él, no en
    // su anfitrión. Si ya no existe (se descartó y hay otro documento), no se toca.
    const previo = elementoActivo();
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
    seguir.current?.focus();
    return () => {
      if (d?.open) d.close();
      if (previo?.isConnected) previo.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      aria-describedby={idTexto}
      onCancel={(e) => {
        e.preventDefault();
        onResponder(false);
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border border-border bg-elevated p-0 text-fg backdrop:bg-app/80"
    >
      <div className="flex flex-col gap-3 p-4">
        <h2 id={idTitulo} className="text-base font-semibold">
          {t.title}
        </h2>
        <p id={idTexto} className="text-sm text-fg-muted">
          {t.body(nombre)}
        </p>
        <div className="flex justify-end gap-2">
          <Button ref={seguir} variant="secondary" onClick={() => onResponder(false)}>
            {t.cancel}
          </Button>
          <Button onClick={() => onResponder(true)}>{t.confirm}</Button>
        </div>
      </div>
    </dialog>
  );
}
