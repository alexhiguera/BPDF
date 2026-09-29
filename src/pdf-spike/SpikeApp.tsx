import { useEffect, useId, useMemo, useRef, useState } from "react";
import { DocumentErrorAlert } from "@/app/DocumentErrorAlert";
import { Button } from "@/components/ui/Button";
import { DocumentError } from "@/documents/errors";
import { readDocument } from "@/documents/read";
import { messages } from "@/i18n/messages";
import { MODOS, type Modo } from "@/pdf/dark/aplicar";
import type { Rgb } from "@/pdf/dark/color";
import { crearRecoloreado } from "@/pdf/dark/recolor";
import { abrirPdf, cargarPdfjs, PdfNoLegibleError } from "@/pdf/engine";
import { type FilaMedicion, medirPagina } from "./benchmark";
import { type ResultadoPintar, SesionPdf } from "./sesion";

/**
 * Laboratorio del spike de modo oscuro (Fase 4, `spike.html`). TEMPORAL y
 * deliberadamente simple: abre un PDF, lo pinta con cada estrategia y mide. La
 * lógica vive fuera (`src/pdf/`, `./sesion.ts`); aquí solo hay estado de UI.
 */

const ESCALAS = [1, 1.5, 2, 3, 4];

/** Lee un token `--rgb-*` de globals.css: los colores salen de ahí, no de aquí. */
function token(nombre: string, respaldo: Rgb): Rgb {
  const valor = getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
  const partes = valor.split(/\s+/).map(Number);
  return partes.length === 3 && partes.every((n) => Number.isFinite(n))
    ? (partes as unknown as Rgb)
    : respaldo;
}

const ms = (n: number) => n.toFixed(1);

export function SpikeApp() {
  const t = messages.pdfSpike;
  const id = useId();
  const lienzo = useRef<HTMLCanvasElement>(null);
  const [sesion, setSesion] = useState<SesionPdf | null>(null);
  const [cargando, setCargando] = useState(false);
  const [errorDocumento, setErrorDocumento] = useState<DocumentError | null>(null);
  const [errorPdf, setErrorPdf] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [escala, setEscala] = useState(1.5);
  const [modo, setModo] = useState<Modo>("selectivo");
  const [verRegiones, setVerRegiones] = useState(false);
  /** Último resultado y los parámetros que lo produjeron: solo vale si coinciden con los actuales. */
  const [resultado, setResultado] = useState<(ResultadoPintar & { clave: string }) | null>(null);
  const clave = `${pagina}|${escala}|${modo}|${verRegiones}`;
  /** Última medición y la página a la que corresponde (para no leer una anterior). */
  const [medicion, setMedicion] = useState<{ pagina: number; filas: FilaMedicion[] } | null>(null);
  const [midiendo, setMidiendo] = useState(false);

  const recolorear = useMemo(
    () =>
      crearRecoloreado({
        pagina: token("--rgb-page", [43, 43, 43]),
        texto: token("--rgb-fg", [236, 236, 236]),
      }),
    [],
  );
  const colorRegiones = useMemo(
    () => `rgb(${token("--rgb-accent", [16, 163, 127]).join(" ")})`,
    [],
  );

  // Una sesión a la vez: al sustituirla o al desmontar, se libera la anterior.
  useEffect(() => () => void sesion?.cerrar(), [sesion]);

  useEffect(() => {
    if (!sesion || !lienzo.current) return;
    let vigente = true;
    const claveActual = `${pagina}|${escala}|${modo}|${verRegiones}`;
    sesion
      .pintar(lienzo.current, {
        pagina,
        escala,
        dpr: window.devicePixelRatio || 1,
        modo,
        recolorear,
        colorRegiones: verRegiones ? colorRegiones : undefined,
      })
      .then((r) => {
        if (vigente && r) setResultado({ ...r, clave: claveActual });
      })
      .catch(() => vigente && setErrorPdf(true));
    return () => {
      vigente = false;
    };
  }, [sesion, pagina, escala, modo, verRegiones, recolorear, colorRegiones]);

  async function abrir(fichero: File | undefined) {
    if (!fichero) return;
    setErrorDocumento(null);
    setErrorPdf(false);
    setMedicion(null);
    setResultado(null);
    setCargando(true);
    try {
      const documento = await readDocument(fichero);
      if (documento.kind !== "pdf")
        throw new DocumentError("unsupported", { fileName: documento.name });
      const pdfjs = await cargarPdfjs();
      const inicio = performance.now();
      const pdf = await abrirPdf(documento.blob, pdfjs);
      setSesion(new SesionPdf(pdf, performance.now() - inicio));
      setPagina(1);
    } catch (error) {
      setSesion(null);
      if (error instanceof DocumentError) setErrorDocumento(error);
      else if (error instanceof PdfNoLegibleError) setErrorPdf(true);
      else throw error;
    } finally {
      setCargando(false);
    }
  }

  async function medir() {
    if (!sesion) return;
    setMidiendo(true);
    const dpr = window.devicePixelRatio || 1;
    setMedicion(null);
    setMedicion({ pagina, filas: await medirPagina(sesion, { pagina, dpr, recolorear }) });
    setMidiendo(false);
  }

  const listo = sesion !== null && resultado?.clave === clave;
  const estado = cargando
    ? t.loading
    : sesion && resultado
      ? [
          t.ready(sesion.paginas),
          t.openedIn(ms(sesion.msCarga)),
          t.timings(ms(resultado.msRender), ms(resultado.msTransformacion), resultado.regiones),
          resultado.omitida === "pagina-oscura" ? t.darkPageSkipped : "",
        ].join(" ")
      : "";

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">{t.title}</h1>
      <p className="text-fg-muted">{t.intro}</p>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1 text-sm">
          {t.file}
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => void abrir(e.currentTarget.files?.[0])}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.page}
          <input
            type="number"
            min={1}
            max={sesion?.paginas ?? 1}
            value={pagina}
            disabled={!sesion}
            onChange={(e) =>
              setPagina(
                Math.min(Math.max(1, Number(e.currentTarget.value) || 1), sesion?.paginas ?? 1),
              )
            }
            className="w-20 rounded-md border border-border bg-elevated px-2 py-1 text-fg"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {t.scale}
          <select
            value={escala}
            onChange={(e) => setEscala(Number(e.currentTarget.value))}
            className="rounded-md border border-border bg-elevated px-2 py-1 text-fg"
          >
            {ESCALAS.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={verRegiones}
            onChange={(e) => setVerRegiones(e.currentTarget.checked)}
          />
          {t.showRegions}
        </label>
      </div>

      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 font-medium">{t.mode}</legend>
        {MODOS.map((m) => (
          <label key={m} className="flex items-center gap-2">
            <input
              type="radio"
              name={`${id}-modo`}
              value={m}
              checked={modo === m}
              onChange={() => setModo(m)}
            />
            {t.modes[m]}
          </label>
        ))}
      </fieldset>

      <p role="status" className="text-sm text-fg-muted" data-testid="estado">
        {estado}
      </p>

      {errorDocumento && (
        <DocumentErrorAlert error={errorDocumento} onDismiss={() => setErrorDocumento(null)} />
      )}
      {errorPdf && (
        <p role="alert" className="text-danger">
          {t.invalidPdf}
        </p>
      )}

      <div className="overflow-auto rounded-md border border-border bg-app p-4">
        <canvas
          ref={lienzo}
          role="img"
          aria-label={t.canvas(pagina)}
          data-testid="lienzo"
          data-estado={listo ? "listo" : "pendiente"}
          data-modo={modo}
        />
      </div>

      <div>
        <Button variant="secondary" disabled={!sesion || midiendo} onClick={() => void medir()}>
          {midiendo ? t.benchmarkRunning : t.benchmark}
        </Button>
      </div>
      {medicion && <TablaMedicion pagina={medicion.pagina} filas={medicion.filas} />}
    </main>
  );
}

function TablaMedicion({ pagina, filas }: { pagina: number; filas: FilaMedicion[] }) {
  const c = messages.pdfSpike.benchmarkColumns;
  const cabeceras = [
    c.scale,
    c.canvas,
    c.dpr,
    c.render,
    c.transform,
    c.regions,
    c.canvasMemory,
    c.stripMemory,
    c.heap,
  ];
  return (
    <table className="text-sm" data-testid="medicion" data-pagina={pagina}>
      <thead>
        <tr>
          {cabeceras.map((h) => (
            <th key={h} className="border-b border-border px-2 py-1 text-left">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {filas.map((f) => (
          <tr key={f.escala}>
            <td className="px-2 py-1">{f.escala}</td>
            <td className="px-2 py-1">{`${f.ancho}×${f.alto}`}</td>
            <td className="px-2 py-1">{f.dpr}</td>
            <td className="px-2 py-1">{ms(f.msRender)}</td>
            <td className="px-2 py-1">{ms(f.msTransformacion)}</td>
            <td className="px-2 py-1">{f.regiones}</td>
            <td className="px-2 py-1">{f.mibLienzo.toFixed(1)}</td>
            <td className="px-2 py-1">{f.mibTransitorio.toFixed(1)}</td>
            <td className="px-2 py-1">{f.mibHeap === null ? "—" : f.mibHeap.toFixed(1)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
