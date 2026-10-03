/**
 * Aviso de carga mientras llega un trozo a demanda (visor PDF, lector de
 * Markdown): `role="status"`, para que un lector de pantalla lo anuncie igual
 * que los demás estados de carga de la app (Fase 11).
 */
export function Cargando({ texto }: { texto: string }) {
  return (
    <p role="status" className="p-6 text-fg-muted">
      {texto}
    </p>
  );
}
