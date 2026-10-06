import { CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { project } from "@/config/project";
import type { DocumentError, DocumentErrorCode } from "@/documents/errors";
import { MAX_BYTES, MAX_FICHEROS_CARPETA } from "@/documents/limits";
import { messages } from "@/i18n/messages";
import { formatBytes } from "@/lib/format";

const t = messages.documentError;

/** Motivo legible de cada error (docs/PLAN.md §9.3). */
function reason(error: DocumentError): string {
  const texts: Record<DocumentErrorCode, string> = {
    unsupported: t.unsupported,
    "no-markdown": t.noMarkdown,
    "several-markdown": t.severalMarkdown,
    incompatible: t.incompatible,
    "folder-no-markdown": t.folderNoMarkdown,
    "folder-too-large": t.folderTooLarge(MAX_FICHEROS_CARPETA.toLocaleString(project.locale)),
    "mixed-drop": t.mixedDrop,
    empty: t.empty,
    "too-large": t.tooLarge(formatBytes(MAX_BYTES[error.kind ?? "pdf"])),
    "not-pdf": t.notPdf,
    "not-utf8": t.notUtf8,
    unreadable: t.unreadable,
  };
  return texts[error.code];
}

/**
 * Aviso de un fichero que no se pudo abrir. `role="alert"` para que se anuncie
 * al aparecer. El nombre del fichero se pinta como texto (React lo escapa) y
 * puede ser largo o no tener espacios: se parte donde haga falta.
 */
export function DocumentErrorAlert({
  error,
  onDismiss,
}: {
  error: DocumentError;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="ui-notice mx-auto mt-6 flex w-[calc(100%-2rem)] max-w-xl flex-col gap-2 p-4"
      data-tone="error"
    >
      <p className="flex items-start gap-2 font-medium wrap-anywhere text-danger">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        {error.fileName ? t.title(error.fileName) : t.titleNoFile}
      </p>
      <p className="text-fg-muted">{reason(error)}</p>
      <div>
        <Button variant="secondary" onClick={onDismiss}>
          {t.dismiss}
        </Button>
      </div>
    </div>
  );
}
