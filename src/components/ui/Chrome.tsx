import { X } from "lucide-react";
import { type ComponentProps, type ReactNode, useEffect, useId, useRef } from "react";
import { cn } from "@/lib/utils";

export function IconButton({
  etiqueta,
  className,
  children,
  ...props
}: ComponentProps<"button"> & { etiqueta: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      className={cn("ui-icon-button", className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function ToolbarGroup({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: un grupo de controles dentro de una toolbar no es un grupo de formulario
    <div role="group" aria-label={label} className={cn("ui-toolbar-group", className)}>
      {children}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("ui-badge", className)}>{children}</span>;
}

/** Panel modal móvil: dialog nativo, cierre por Escape/fondo y retorno de foco. */
export function MobileSheet({
  title,
  closeLabel,
  onClose,
  children,
  className,
  testId,
}: {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (node && !node.open) node.showModal();
    return () => {
      if (node?.open) node.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape ya cierra el dialog; el clic solo detecta su backdrop no enfocable
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-testid={testId}
      className={cn("ui-sheet", className)}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ui-sheet-panel">
        <div className="ui-sheet-header">
          <h2 id={titleId}>{title}</h2>
          <IconButton etiqueta={closeLabel} onClick={onClose}>
            <X aria-hidden="true" className="size-5" />
          </IconButton>
        </div>
        <div className="ui-sheet-content">{children}</div>
      </div>
    </dialog>
  );
}
