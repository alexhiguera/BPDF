import { Button } from "@/components/ui/Button";
import { messages } from "@/i18n/messages";

/** Lo que se ve sin documento abierto (docs/PLAN.md §9.3). Toda la ventana acepta ficheros soltados. */
export function EmptyState({
  onOpen,
  onOpenFolder,
}: {
  onOpen: () => void;
  onOpenFolder: () => void;
}) {
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
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={onOpen}>{messages.open.button}</Button>
        <Button variant="secondary" onClick={onOpenFolder}>
          {messages.open.folder}
        </Button>
      </div>
      <p className="text-sm text-fg-subtle">{messages.open.shortcut}</p>
      <p className="text-sm text-fg-muted">{t.resources}</p>
      <p className="text-fg-subtle">{t.privacy}</p>
    </section>
  );
}
