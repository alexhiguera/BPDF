import { messages } from "@/i18n/messages";

/** Lo que se ve sin documento abierto. La Fase 3 añade aquí abrir y soltar ficheros. */
export function EmptyState() {
  const t = messages.emptyState;
  return (
    <section
      aria-labelledby="estado-vacio-titulo"
      className="m-auto flex max-w-xl flex-col gap-3 p-6 text-center"
    >
      <h1 id="estado-vacio-titulo" className="text-2xl font-semibold">
        {t.title}
      </h1>
      <p className="text-fg-muted">{t.status}</p>
      <p className="text-fg-subtle">{t.privacy}</p>
    </section>
  );
}
