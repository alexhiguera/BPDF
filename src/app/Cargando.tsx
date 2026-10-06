/**
 * Aviso de carga mientras llega un trozo a demanda (visor PDF, lector de
 * Markdown): `role="status"`, para que un lector de pantalla lo anuncie igual
 * que los demás estados de carga de la app (Fase 11).
 */
export function Cargando({ texto }: { texto: string }) {
  return (
    <div role="status" className="flex flex-1 items-center justify-center p-6 text-fg-muted">
      <p className="ui-notice flex items-center gap-3 px-4 py-3">
        <span aria-hidden="true" className="ui-spinner" />
        {texto}
      </p>
    </div>
  );
}
