import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { messages } from "@/i18n/messages";
import { PASOS_ZOOM, type Zoom } from "@/pdf/visor/disposicion";
import { olvidarPosiciones } from "./positions";
import { ANCHOS, type Ancho, type Preferencias, TAMANOS_LETRA, type TamanoLetra } from "./schema";
import { cambiarPreferencias, restablecerPreferencias } from "./store";
import { usePreferences } from "./usePreferences";

const t = messages.preferences;
const tp = messages.pdf;

/** El zoom como valor de un `<select>`: `ancho`, `pagina` o `fijo:1.25`. */
const valorZoom = (z: Zoom) => (z.tipo === "fijo" ? `fijo:${z.valor}` : z.tipo);
function zoomDe(valor: string): Zoom {
  if (valor === "ancho" || valor === "pagina") return { tipo: valor };
  return { tipo: "fijo", valor: Number(valor.slice("fijo:".length)) };
}

/**
 * Diálogo de preferencias (Fase 10, docs/PLAN.md §8). `<dialog>` modal que se
 * monta abierto, como la ayuda de atajos: Esc o su botón lo cierran y el foco
 * vuelve a donde estaba (el botón de la cabecera). Cada cambio se guarda al
 * momento; no hay «Aceptar». Se carga a demanda: ni `zod` ni el almacén entran
 * en el arranque de la app.
 */
export default function PreferencesDialog({ onCerrar }: { onCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const prefs = usePreferences();
  const [aviso, setAviso] = useState("");
  const id = useId();

  useEffect(() => {
    const d = dialogo.current;
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (d && !d.open) d.showModal();
    return () => {
      if (d?.open) d.close();
      if (previo?.isConnected) previo.focus();
    };
  }, []);

  const cambiar = (cambio: (p: Preferencias) => Preferencias) => {
    setAviso("");
    cambiarPreferencias(cambio);
  };
  const pdf = (campos: Partial<Preferencias["pdf"]>) =>
    cambiar((p) => ({ ...p, pdf: { ...p.pdf, ...campos } }));
  const markdown = (campos: Partial<Preferencias["markdown"]>) =>
    cambiar((p) => ({ ...p, markdown: { ...p.markdown, ...campos } }));

  // El zoom guardado siempre sale en la lista, aunque no sea uno de los pasos.
  const pasos: number[] = [...PASOS_ZOOM];
  if (prefs.pdf.zoom.tipo === "fijo" && !pasos.includes(prefs.pdf.zoom.valor)) {
    pasos.push(prefs.pdf.zoom.valor);
    pasos.sort((a, b) => a - b);
  }

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-intro`}
      onClose={onCerrar}
      className="m-auto max-h-[85vh] w-[min(36rem,calc(100vw-2rem))] overflow-auto rounded-md border border-border bg-elevated p-0 text-fg backdrop:bg-app/80"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 id={`${id}-titulo`} className="flex-1 text-base font-semibold">
          {t.title}
        </h2>
        <button
          type="button"
          aria-label={t.close}
          title={t.close}
          onClick={() => dialogo.current?.close()}
          className="inline-flex size-8 items-center justify-center rounded-md hover:bg-app"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="flex flex-col gap-5 px-4 py-3 text-sm">
        <p id={`${id}-intro`} className="text-fg-muted">
          {t.intro}
        </p>

        <Grupo titulo={t.pdf} pista={t.pdfHint} idPista={`${id}-pdf`}>
          <Selector
            id={`${id}-modo`}
            etiqueta={t.mode}
            valor={prefs.pdf.modo}
            onCambio={(v) => pdf({ modo: v === "original" ? "original" : "oscuro" })}
            opciones={[
              ["oscuro", tp.modeDark],
              ["original", tp.modeOriginal],
            ]}
          />
          <Selector
            id={`${id}-zoom`}
            etiqueta={t.zoom}
            valor={valorZoom(prefs.pdf.zoom)}
            onCambio={(v) => pdf({ zoom: zoomDe(v) })}
            opciones={[
              ["ancho", tp.fitWidth],
              ["pagina", tp.fitPage],
              ...pasos.map((p): [string, string] => [
                `fijo:${p}`,
                t.zoomFixed(Math.round(p * 100)),
              ]),
            ]}
          />
          <Selector
            id={`${id}-vista`}
            etiqueta={t.view}
            valor={prefs.pdf.vista}
            onCambio={(v) => pdf({ vista: v === "pagina" ? "pagina" : "continua" })}
            opciones={[
              ["continua", tp.viewContinuous],
              ["pagina", tp.viewSingle],
            ]}
          />
        </Grupo>

        <Grupo titulo={t.markdown}>
          <Selector
            id={`${id}-letra`}
            etiqueta={t.fontSize}
            valor={String(prefs.markdown.tamanoLetra)}
            onCambio={(v) => markdown({ tamanoLetra: Number(v) as TamanoLetra })}
            opciones={TAMANOS_LETRA.map((n): [string, string] => [String(n), t.fontSizeValue(n)])}
          />
          <Selector
            id={`${id}-ancho`}
            etiqueta={t.width}
            valor={prefs.markdown.ancho}
            onCambio={(v) => markdown({ ancho: v as Ancho })}
            opciones={(Object.keys(ANCHOS) as Ancho[]).map((a): [string, string] => [
              a,
              t.widths[a],
            ])}
          />
        </Grupo>

        <Grupo titulo={t.keyboard}>
          <Casilla
            id={`${id}-atajos`}
            etiqueta={t.singleKey}
            marcada={prefs.atajosUnaTecla}
            onCambio={(v) => cambiar((p) => ({ ...p, atajosUnaTecla: v }))}
          />
        </Grupo>

        <Grupo titulo={t.position}>
          <Casilla
            id={`${id}-recordar`}
            etiqueta={t.remember}
            pista={t.rememberHint}
            marcada={prefs.recordarPosicion}
            onCambio={(v) => cambiar((p) => ({ ...p, recordarPosicion: v }))}
          />
          <div>
            <Button
              variant="secondary"
              onClick={() => {
                olvidarPosiciones();
                setAviso(t.forgotten);
              }}
            >
              {t.forget}
            </Button>
          </div>
        </Grupo>

        <div className="flex flex-wrap items-center gap-3 border-t border-border pt-3">
          <Button
            variant="secondary"
            onClick={() => {
              restablecerPreferencias();
              setAviso(t.resetDone);
            }}
          >
            {t.reset}
          </Button>
          <p role="status" className="text-fg-muted">
            {aviso}
          </p>
        </div>
      </div>
    </dialog>
  );
}

function Grupo({
  titulo,
  pista,
  idPista,
  children,
}: {
  titulo: string;
  pista?: string;
  idPista?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={pista ? idPista : undefined}>
      <legend className="mb-1 font-semibold">{titulo}</legend>
      {pista && (
        <p id={idPista} className="text-fg-muted">
          {pista}
        </p>
      )}
      {children}
    </fieldset>
  );
}

function Selector({
  id,
  etiqueta,
  valor,
  onCambio,
  opciones,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  opciones: readonly (readonly [string, string])[];
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <label htmlFor={id}>{etiqueta}</label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        className="rounded-md border border-border bg-app px-2 py-1 text-fg"
      >
        {opciones.map(([v, texto]) => (
          <option key={v} value={v}>
            {texto}
          </option>
        ))}
      </select>
    </div>
  );
}

function Casilla({
  id,
  etiqueta,
  pista,
  marcada,
  onCambio,
}: {
  id: string;
  etiqueta: string;
  pista?: string;
  marcada: boolean;
  onCambio: (marcada: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      <input
        id={id}
        type="checkbox"
        checked={marcada}
        onChange={(e) => onCambio(e.target.checked)}
        aria-describedby={pista ? `${id}-pista` : undefined}
        className="mt-1 size-4 accent-accent"
      />
      <div>
        <label htmlFor={id}>{etiqueta}</label>
        {pista && (
          <p id={`${id}-pista`} className="text-fg-muted">
            {pista}
          </p>
        )}
      </div>
    </div>
  );
}
