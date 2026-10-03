import {
  ChevronDown,
  ChevronUp,
  Fullscreen,
  Keyboard,
  Maximize,
  MoveHorizontal,
  PanelLeft,
  RotateCcw,
  RotateCw,
  Search,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  type ComponentProps,
  type Dispatch,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { messages } from "@/i18n/messages";
import { cn } from "@/lib/utils";
import { leerPagina, ZOOM_MAXIMO, ZOOM_MINIMO } from "@/pdf/visor/disposicion";
import { ATAJOS_BOTON, anuncioDeAtajo, ID_CAMPO_PAGINA } from "./atajos";
import type { Accion, EstadoVisor } from "./estado";

const t = messages.pdf;

/**
 * Botón de la barra: icono con nombre accesible (`aria-label`) y el mismo
 * texto como información emergente (`title`). Los que cambian un modo llevan
 * además texto visible y `aria-pressed`: el estado no depende de un icono. Los
 * que tienen atajo lo anuncian en `title` y `aria-keyshortcuts` (Fase 11,
 * `anuncioDeAtajo`), sin tocar el nombre accesible.
 */
function Boton({
  etiqueta,
  children,
  className,
  ...props
}: ComponentProps<"button"> & { etiqueta: string; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={etiqueta}
      title={etiqueta}
      className={cn(
        "inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md px-2 text-sm text-fg",
        "hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50",
        "aria-pressed:bg-elevated aria-pressed:outline aria-pressed:outline-1 aria-pressed:outline-border",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

const icono = "size-4 shrink-0";
const Separador = () => <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />;

export function BarraHerramientas({
  nombre,
  estado,
  porcentaje,
  despachar,
  onClose,
  pantallaCompleta,
  onPantallaCompleta,
  onAyuda,
  unaTecla,
}: {
  nombre: string;
  estado: EstadoVisor;
  porcentaje: number;
  despachar: Dispatch<Accion>;
  onClose: () => void;
  /** `null`: el navegador no permite pantalla completa (el botón no aparece). */
  pantallaCompleta: boolean | null;
  onPantallaCompleta: () => void;
  /** Abre la ayuda de atajos (también con los de una tecla desactivados). */
  onAyuda: () => void;
  /** ¿Están activados los atajos de una tecla? Si no, sus botones no los anuncian. */
  unaTecla: boolean;
}) {
  const atajo = (accion: Parameters<typeof anuncioDeAtajo>[0], etiqueta: string) =>
    anuncioDeAtajo(accion, etiqueta, unaTecla);
  const oscuro = estado.modo === "oscuro";
  // Al terminar de cargar, el foco pasa del título provisional a este.
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (document.activeElement === document.body || document.activeElement === null) {
      titulo.current?.focus();
    }
  }, []);
  const continua = estado.vista === "continua";
  return (
    <div className="flex flex-col border-b border-border bg-app">
      <div className="flex items-center gap-2 px-3 pt-2">
        <h1
          ref={titulo}
          id="titulo-documento"
          tabIndex={-1}
          className="min-w-0 flex-1 truncate text-sm font-semibold"
        >
          {nombre}
        </h1>
        <Boton etiqueta={t.close} onClick={onClose}>
          <X aria-hidden="true" className={icono} />
        </Boton>
      </div>
      <div
        role="toolbar"
        aria-label={t.toolbar}
        className="flex flex-wrap items-center gap-1 px-2 py-1"
      >
        <Boton
          etiqueta={estado.miniaturas ? t.hideThumbnails : t.showThumbnails}
          {...atajo("miniaturas", estado.miniaturas ? t.hideThumbnails : t.showThumbnails)}
          aria-pressed={estado.miniaturas}
          onClick={() => despachar({ tipo: "miniaturas" })}
        >
          <PanelLeft aria-hidden="true" className={icono} />
        </Boton>
        <Separador />
        <Boton
          etiqueta={t.previous}
          {...atajo("anterior", t.previous)}
          disabled={estado.pagina <= 1}
          onClick={() => despachar({ tipo: "anterior" })}
        >
          <ChevronUp aria-hidden="true" className={icono} />
        </Boton>
        <CampoPagina estado={estado} despachar={despachar} />
        <Boton
          etiqueta={t.next}
          {...atajo("siguiente", t.next)}
          disabled={estado.pagina >= estado.total}
          onClick={() => despachar({ tipo: "siguiente" })}
        >
          <ChevronDown aria-hidden="true" className={icono} />
        </Boton>
        <Separador />
        <Boton
          etiqueta={t.zoomOut}
          {...atajo("alejar", t.zoomOut)}
          disabled={porcentaje <= ZOOM_MINIMO * 100}
          onClick={() => despachar({ tipo: "paso-zoom", actual: porcentaje / 100, direccion: -1 })}
        >
          <ZoomOut aria-hidden="true" className={icono} />
        </Boton>
        <Boton
          etiqueta={t.zoomReset(porcentaje)}
          {...atajo("zoom100", t.zoomReset(porcentaje))}
          className="w-16 tabular-nums"
          onClick={() => despachar({ tipo: "zoom", zoom: { tipo: "fijo", valor: 1 } })}
        >
          {t.zoomPercent(porcentaje)}
        </Boton>
        <Boton
          etiqueta={t.zoomIn}
          {...atajo("acercar", t.zoomIn)}
          disabled={porcentaje >= ZOOM_MAXIMO * 100}
          onClick={() => despachar({ tipo: "paso-zoom", actual: porcentaje / 100, direccion: 1 })}
        >
          <ZoomIn aria-hidden="true" className={icono} />
        </Boton>
        <Boton
          etiqueta={t.fitWidth}
          aria-pressed={estado.zoom.tipo === "ancho"}
          onClick={() => despachar({ tipo: "zoom", zoom: { tipo: "ancho" } })}
        >
          <MoveHorizontal aria-hidden="true" className={icono} />
        </Boton>
        <Boton
          etiqueta={t.fitPage}
          aria-pressed={estado.zoom.tipo === "pagina"}
          onClick={() => despachar({ tipo: "zoom", zoom: { tipo: "pagina" } })}
        >
          <Maximize aria-hidden="true" className={icono} />
        </Boton>
        <Boton
          etiqueta={t.rotateLeft}
          {...atajo("girarIzquierda", t.rotateLeft)}
          onClick={() => despachar({ tipo: "girar", sentido: -1 })}
        >
          <RotateCcw aria-hidden="true" className={icono} />
        </Boton>
        <Boton
          etiqueta={t.rotate}
          {...atajo("girarDerecha", t.rotate)}
          onClick={() => despachar({ tipo: "girar" })}
        >
          <RotateCw aria-hidden="true" className={icono} />
        </Boton>
        <Separador />
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">{t.view}</legend>
          <Boton
            etiqueta={t.viewContinuous}
            aria-pressed={continua}
            onClick={() => despachar({ tipo: "vista", vista: "continua" })}
          >
            {t.viewContinuous}
          </Boton>
          <Boton
            etiqueta={t.viewSingle}
            aria-pressed={!continua}
            onClick={() => despachar({ tipo: "vista", vista: "pagina" })}
          >
            {t.viewSingle}
          </Boton>
        </fieldset>
        <Separador />
        <fieldset className="flex items-center gap-1">
          <legend className="sr-only">{t.colors}</legend>
          <Boton
            etiqueta={t.modeDark}
            aria-pressed={oscuro}
            onClick={() => despachar({ tipo: "modo", modo: "oscuro" })}
          >
            {t.modeDark}
          </Boton>
          <Boton
            etiqueta={t.modeOriginal}
            aria-pressed={!oscuro}
            onClick={() => despachar({ tipo: "modo", modo: "original" })}
          >
            {t.modeOriginal}
          </Boton>
        </fieldset>
        <Separador />
        <Boton
          etiqueta={t.search}
          {...atajo("buscar", t.search)}
          aria-pressed={estado.busqueda}
          onClick={() => despachar({ tipo: "busqueda", abierta: !estado.busqueda })}
        >
          <Search aria-hidden="true" className={icono} />
        </Boton>
        {pantallaCompleta !== null && (
          <Boton
            etiqueta={t.fullscreen}
            {...atajo("pantallaCompleta", t.fullscreen)}
            aria-pressed={pantallaCompleta}
            onClick={onPantallaCompleta}
          >
            <Fullscreen aria-hidden="true" className={icono} />
          </Boton>
        )}
        <Boton
          etiqueta={t.shortcuts}
          {...atajo("ayuda", t.shortcuts)}
          aria-haspopup="dialog"
          onClick={onAyuda}
        >
          <Keyboard aria-hidden="true" className={icono} />
        </Boton>
      </div>
    </div>
  );
}

/**
 * «Ir a página»: un campo de texto (no `type="number"`, que acepta «1e3» y
 * cambia con la rueda del ratón). Se valida al pulsar Intro o salir: solo un
 * entero entre 1 y el total; si no, se avisa y el visor no se mueve.
 */
function CampoPagina({ estado, despachar }: { estado: EstadoVisor; despachar: Dispatch<Accion> }) {
  const [texto, setTexto] = useState(String(estado.pagina));
  const [invalido, setInvalido] = useState(false);
  const idAviso = useId();
  const idTotal = useId();

  useEffect(() => {
    setTexto(String(estado.pagina));
    setInvalido(false);
  }, [estado.pagina]);

  const confirmar = () => {
    const pagina = leerPagina(texto, estado.total);
    if (pagina === null) {
      setInvalido(texto.trim() !== String(estado.pagina));
      return false;
    }
    setInvalido(false);
    if (pagina !== estado.pagina) despachar({ tipo: "ir", pagina });
    return true;
  };

  return (
    <span className="relative flex items-center gap-1 text-sm">
      <input
        id={ID_CAMPO_PAGINA}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={t.pageInput}
        aria-keyshortcuts={ATAJOS_BOTON.irAPagina.aria}
        aria-describedby={invalido ? `${idTotal} ${idAviso}` : idTotal}
        aria-invalid={invalido || undefined}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar();
          if (e.key === "Escape") {
            setTexto(String(estado.pagina));
            setInvalido(false);
          }
        }}
        onBlur={() => {
          if (!confirmar()) setTexto(String(estado.pagina));
        }}
        className={cn(
          "h-8 w-14 rounded-md border bg-elevated px-2 text-center tabular-nums text-fg",
          invalido ? "border-danger" : "border-border",
        )}
      />
      <span id={idTotal} className="whitespace-nowrap text-fg-muted">
        {t.pageTotal(estado.total)}
      </span>
      {invalido && (
        <span
          id={idAviso}
          role="alert"
          className="absolute top-full left-0 z-10 mt-1 w-max max-w-64 rounded-md border border-border bg-elevated px-2 py-1 text-xs text-danger"
        >
          {t.invalidPage(estado.total)}
        </span>
      )}
    </span>
  );
}
