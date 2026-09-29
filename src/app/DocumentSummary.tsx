import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import type { OpenedDocument } from "@/documents/types";
import { messages } from "@/i18n/messages";
import { formatBytes } from "@/lib/format";

const t = messages.document;

/**
 * Visor PROVISIONAL (Fase 3): nombre, tipo y tamaño del documento abierto, sin
 * mostrar su contenido. Lo sustituyen el visor de PDF (Fase 5) y el de
 * Markdown (Fase 7), que se montarán igual: con `key={document.id}`, para que
 * cambiar de documento desmonte el anterior y libere lo que hubiera creado.
 *
 * Al montarse lleva el foco a su título: el botón que lo abrió puede haber
 * desaparecido, y así un lector de pantalla anuncia qué se ha abierto.
 */
export function DocumentSummary({
  document,
  onClose,
}: {
  document: OpenedDocument;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);

  return (
    <section
      aria-labelledby="documento-titulo"
      className="m-auto flex w-full max-w-xl flex-col gap-4 p-6"
    >
      <h1
        id="documento-titulo"
        ref={heading}
        tabIndex={-1}
        className="text-2xl font-semibold wrap-anywhere"
      >
        {document.name}
      </h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-fg-muted">
        <dt>{t.kindLabel}</dt>
        <dd className="text-fg">{t.kinds[document.kind]}</dd>
        <dt>{t.sizeLabel}</dt>
        <dd className="text-fg">{formatBytes(document.size)}</dd>
      </dl>
      <p className="text-fg-muted">{t.pendingViewer}</p>
      <div>
        <Button variant="secondary" onClick={onClose}>
          {t.close}
        </Button>
      </div>
    </section>
  );
}
