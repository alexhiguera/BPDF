import { LockKeyhole } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { messages } from "@/i18n/messages";

const t = messages.pdf.password;

/**
 * Contraseña de apertura de un PDF (Fase 6, D13): `<dialog>` modal.
 *
 * La contraseña **no se guarda**: vive en el estado de este campo hasta que se
 * pulsa «Abrir», que la entrega (`onEnviar`) y vacía el campo. Nada de
 * almacenamiento, registros ni mensajes; sin autocompletar; el formulario nunca
 * se envía (`preventDefault`; la CSP tiene `form-action 'none'`). Reintentos
 * sin límite: tras una incorrecta, el aviso queda asociado al campo y el foco
 * vuelve a él. Cancelar (o Esc) cierra el documento.
 */
export function DialogoContrasena({
  incorrecta,
  comprobando,
  intento,
  onEnviar,
  onCancelar,
}: {
  incorrecta: boolean;
  comprobando: boolean;
  /** Cambia con cada intento: el campo recupera el foco al terminar. */
  intento: number;
  onEnviar: (contrasena: string) => void;
  onCancelar: () => void;
}) {
  const [valor, setValor] = useState("");
  const dialogo = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLInputElement>(null);
  const idTitulo = useId();
  const idTexto = useId();
  const idCampo = useId();
  const idError = useId();

  useEffect(() => {
    const d = dialogo.current;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
    };
  }, []);

  // Fase 13: cancelar cierra el diálogo ANTES de avisar a la app, que cierra el documento
  // y pone el foco en <main>. Con el modal aún abierto, <main> está inerte y ese foco no
  // se aplicaba: Chromium lo devolvía él solo al cerrar el diálogo; Firefox lo dejaba en
  // <body> (E2E de compatibilidad).
  const cancelar = () => {
    if (dialogo.current?.open) dialogo.current.close();
    onCancelar();
  };

  // Al abrir y tras cada intento fallido: el foco, al campo (ya vacío).
  // biome-ignore lint/correctness/useExhaustiveDependencies: `intento` es el disparador
  useEffect(() => {
    if (!comprobando) campo.current?.focus();
  }, [intento, comprobando]);

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={idTitulo}
      aria-describedby={idTexto}
      // Esc: el diálogo no se cierra solo; se cierra el documento.
      onCancel={(e) => {
        e.preventDefault();
        cancelar();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border border-border bg-elevated p-0 text-fg backdrop:bg-app/80"
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (comprobando || valor === "") return;
          const contrasena = valor;
          setValor("");
          onEnviar(contrasena);
        }}
        className="flex flex-col gap-3 p-4"
      >
        <h2 id={idTitulo} className="flex items-center gap-2 text-base font-semibold">
          <LockKeyhole aria-hidden="true" className="size-4 shrink-0" />
          {t.title}
        </h2>
        <p id={idTexto} className="text-sm text-fg-muted">
          {t.body}
        </p>
        <label htmlFor={idCampo} className="text-sm font-medium">
          {t.label}
        </label>
        <input
          ref={campo}
          id={idCampo}
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={valor}
          readOnly={comprobando}
          onChange={(e) => setValor(e.target.value)}
          aria-invalid={incorrecta || undefined}
          aria-describedby={incorrecta ? idError : undefined}
          className={`h-9 rounded-md border bg-app px-2 text-fg ${incorrecta ? "border-danger" : "border-border"}`}
        />
        {incorrecta && (
          <p id={idError} role="alert" className="text-sm text-danger">
            {t.wrong}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={cancelar}>
            {t.cancel}
          </Button>
          <Button type="submit" loading={comprobando} disabled={valor === ""}>
            {comprobando ? t.checking : t.open}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
