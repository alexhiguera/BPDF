import { Button } from "@/components/ui/Button";
import { messages } from "@/i18n/messages";

/** Lo que se ve sin documento abierto (docs/PLAN.md §9.3). Toda la ventana acepta ficheros soltados. */
export function EmptyState({ onOpen }: { onOpen: () => void }) {
  const t = messages.emptyState;
  return (
    <section
      aria-labelledby="estado-vacio-titulo"
      className="m-auto flex max-w-xl flex-col items-center gap-4 p-6 text-center"
    >
      <h1 id="estado-vacio-titulo" className="text-2xl font-semibold">
        {t.title}
      </h1>
      <p className="text-fg-muted">{t.body}</p>
      <Button onClick={onOpen}>{messages.open.button}</Button>
      <p className="text-sm text-fg-subtle">{messages.open.shortcut}</p>
      <p className="text-fg-subtle">{t.privacy}</p>
    </section>
  );
}
