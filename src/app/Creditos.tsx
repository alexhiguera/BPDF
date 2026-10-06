import { project } from "@/config/project";
import { messages } from "@/i18n/messages";

const t = messages.credits;

/**
 * Mención discreta de BPDF y de quien lo hace (Fase 11): «BPDF · Gratis y open
 * source · Creado por R3ZON con ❤️». Solo sin documento abierto, para no quitar
 * espacio al visor; la misma información está en «Acerca de» (Preferencias).
 *
 * El enlace a la organización se abre como cualquier enlace externo de BPDF:
 * `Platform.openExternal`, que revalida la URL y abre una pestaña sin `opener`
 * ni `Referer`. El clic se intercepta (y el central se anula) para no salir de
 * ese mecanismo; `target` y `rel` quedan como red. Sin enlace al repositorio
 * hasta la Fase 16.
 */
export function Creditos({ onOpenExternal }: { onOpenExternal: (url: string) => void }) {
  const url = project.organizationUrl;
  return (
    <footer className="home-footer flex flex-wrap items-center justify-center gap-x-1.5 border-t border-border bg-app px-4 py-1 text-xs text-fg-subtle">
      <span>{project.name}</span>
      <span aria-hidden="true">·</span>
      <span>{t.free}</span>
      <span aria-hidden="true">·</span>
      <span className="inline-flex items-center gap-1">
        {t.createdBy}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title={t.organizationTitle(url)}
          onClick={(e) => {
            e.preventDefault();
            onOpenExternal(url);
          }}
          onAuxClick={(e) => e.preventDefault()}
          className="inline-flex min-h-6 items-center rounded px-0.5 text-fg-muted underline underline-offset-2 hover:text-fg"
        >
          {project.organization}
        </a>
        {t.withLove}
      </span>
    </footer>
  );
}
