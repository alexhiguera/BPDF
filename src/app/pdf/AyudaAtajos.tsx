import { X } from "lucide-react";
import { Fragment, useEffect, useId, useRef } from "react";
import { messages } from "@/i18n/messages";

const t = messages.pdf.help;

/**
 * Ayuda de atajos del visor PDF (Fase 6): `<dialog>` modal con la tabla de
 * atajos y el interruptor de los de una tecla (WCAG 2.1.4). Se monta abierto y
 * se cierra con Esc (nativo del diálogo) o con su botón; al cerrarse, el foco
 * vuelve a donde estaba. Mientras está abierto, el visor no intercepta teclas.
 */
export function AyudaAtajos({
  unaTecla,
  onUnaTecla,
  onCerrar,
}: {
  unaTecla: boolean;
  onUnaTecla: (activos: boolean) => void;
  onCerrar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idCasilla = useId();
  const idPista = useId();

  useEffect(() => {
    const d = dialogo.current;
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
      if (previo?.isConnected) previo.focus();
    };
  }, []);

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      onClose={onCerrar}
      className="m-auto max-h-[85vh] w-[min(40rem,calc(100vw-2rem))] overflow-auto rounded-md border border-border bg-elevated p-0 text-fg backdrop:bg-app/80"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 id={idTitulo} className="flex-1 text-base font-semibold">
          {t.title}
        </h2>
        <button
          type="button"
          aria-label={t.close}
          title={t.close}
          onClick={() => dialogo.current?.close()}
          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-app"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-4 px-4 py-3">
        <div className="flex items-start gap-2">
          <input
            id={idCasilla}
            type="checkbox"
            checked={unaTecla}
            onChange={(e) => onUnaTecla(e.target.checked)}
            aria-describedby={idPista}
            className="size-6 shrink-0 accent-accent"
          />
          <div>
            <label htmlFor={idCasilla} className="font-medium">
              {t.singleKey}
            </label>
            <p id={idPista} className="text-sm text-fg-muted">
              {t.singleKeyHint}
            </p>
          </div>
        </div>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{t.table}</caption>
          <thead>
            <tr className="border-b border-border text-left text-fg-muted">
              <th scope="col" className="py-1 pr-4 font-medium">
                {t.keys}
              </th>
              <th scope="col" className="py-1 font-medium">
                {t.action}
              </th>
            </tr>
          </thead>
          <tbody>
            {t.rows.map((fila) => (
              <tr key={`${fila.keys.join("+")}-${fila.action}`} className="border-b border-border">
                <td className="py-1 pr-4 whitespace-nowrap">
                  {fila.keys.map((tecla, i) => (
                    <Fragment key={tecla}>
                      {i > 0 && " + "}
                      <kbd className="rounded border border-border bg-app px-1.5 font-mono text-xs">
                        {tecla}
                      </kbd>
                    </Fragment>
                  ))}
                </td>
                <td className="py-1">
                  {fila.action}
                  {"single" in fila && fila.single && (
                    <span className="ml-2 text-xs text-fg-muted">({t.singleKeyMark})</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </dialog>
  );
}
