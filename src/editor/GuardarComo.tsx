import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { messages } from "@/i18n/messages";
import type { TemaExportacion } from "@/markdown/impresion";

const t = messages.markdown.saveAs;

export type FormatoGuardado = "markdown" | "pdf";

/**
 * «Guardar como…» (Fase 17): un `<dialog>` modal, como el resto de diálogos de
 * BPDF, con dos grupos de opciones nativas (radio): el formato y, para PDF, sus
 * colores. Nativo y no un menú propio: el teclado (flechas dentro del grupo, Tab
 * entre grupos, Esc para cerrar) y los lectores de pantalla ya saben usarlo.
 *
 * - **Markdown (.md)**: guarda el texto actual pidiendo destino (`saveText` con
 *   `nuevoDestino`); sin `showSaveFilePicker`, una descarga.
 * - **PDF (.pdf)**: la impresión del navegador (`impresion.ts`), en claro u
 *   oscuro. La elección de colores vive solo aquí: no se guarda en ningún sitio.
 *
 * Esc o «Cancelar» cierran sin hacer nada; el foco vuelve a donde estaba.
 */
export function GuardarComo({
  onMarkdown,
  onPdf,
  onCancelar,
}: {
  onMarkdown: () => void;
  onPdf: (tema: TemaExportacion) => void;
  onCancelar: () => void;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();
  const idPista = useId();
  const nombre = useId();
  const [formato, setFormato] = useState<FormatoGuardado>("markdown");
  const [tema, setTema] = useState<TemaExportacion>("claro");

  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
      if (previo?.isConnected) previo.focus();
    };
  }, []);

  const opcion = <V extends string>(
    grupo: string,
    valor: V,
    actual: V,
    cambiar: (v: V) => void,
    etiqueta: string,
    desactivada = false,
  ) => (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="radio"
        name={grupo}
        value={valor}
        checked={actual === valor}
        disabled={desactivada}
        onChange={() => cambiar(valor)}
        className="size-4 accent-accent"
      />
      {etiqueta}
    </label>
  );

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      aria-describedby={idPista}
      onCancel={(e) => {
        e.preventDefault();
        onCancelar();
      }}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-md border border-border bg-elevated p-0 text-fg backdrop:bg-app/80"
    >
      <form
        method="dialog"
        className="flex flex-col gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (formato === "pdf") onPdf(tema);
          else onMarkdown();
        }}
      >
        <h2 id={idTitulo} className="text-base font-semibold">
          {t.title}
        </h2>
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1 text-sm font-medium text-fg-muted">{t.format}</legend>
          {opcion(`${nombre}-formato`, "markdown", formato, setFormato, t.markdown)}
          {opcion(`${nombre}-formato`, "pdf", formato, setFormato, t.pdf)}
        </fieldset>
        <fieldset className="flex flex-col gap-1.5" disabled={formato !== "pdf"}>
          <legend className="mb-1 text-sm font-medium text-fg-muted">{t.theme}</legend>
          {opcion(`${nombre}-tema`, "claro", tema, setTema, t.light, formato !== "pdf")}
          {opcion(`${nombre}-tema`, "oscuro", tema, setTema, t.dark, formato !== "pdf")}
        </fieldset>
        <p id={idPista} className="text-sm text-fg-muted">
          {formato === "pdf" ? t.pdfHint : t.markdownHint}
        </p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancelar}>
            {t.cancel}
          </Button>
          <Button type="submit">{t.confirm}</Button>
        </div>
      </form>
    </dialog>
  );
}
