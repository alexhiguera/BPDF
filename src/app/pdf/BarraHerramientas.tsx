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
  Settings2,
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
import { MobileSheet, ToolbarGroup } from "@/components/ui/Chrome";
import { messages } from "@/i18n/messages";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import { leerPagina, ZOOM_MAXIMO, ZOOM_MINIMO } from "@/pdf/visor/disposicion";
import { ATAJOS_BOTON, anuncioDeAtajo, ID_CAMPO_PAGINA } from "./atajos";
import { useBarraHerramientas } from "./barra-teclado";
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
      className={cn("ui-control", className)}
      {...props}
    >
      {children}
    </button>
  );
}

const icono = "size-4 shrink-0";
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
  const [herramientas, setHerramientas] = useState(false);
  const movil = useMediaQuery("(max-width: 52rem)");
  // Una sola parada de Tab y ← / → entre controles (Fase 13, `barra-teclado.ts`).
  const barra = useRef<HTMLDivElement>(null);
  const teclado = useBarraHerramientas(barra);
  return (
    <div className="pdf-toolbar flex flex-col border-b border-border bg-toolbar">
      <h1 ref={titulo} id="titulo-documento" tabIndex={-1} className="sr-only">
        {nombre}
      </h1>
      {!movil ? (
        <>
          <div className="pdf-close-desktop">
            <Boton etiqueta={t.close} onClick={onClose}>
              <X aria-hidden="true" className={icono} />
            </Boton>
          </div>
          <div
            ref={barra}
            role="toolbar"
            aria-label={t.toolbar}
            className="pdf-toolbar-desktop flex items-center gap-2 overflow-x-auto px-3 py-2 pr-16"
            onFocus={teclado.onFocus}
            onKeyDown={teclado.onKeyDown}
          >
            <ToolbarGroup label={t.thumbnails}>
              <Boton
                etiqueta={estado.miniaturas ? t.hideThumbnails : t.showThumbnails}
                {...atajo("miniaturas", estado.miniaturas ? t.hideThumbnails : t.showThumbnails)}
                aria-pressed={estado.miniaturas}
                onClick={() => despachar({ tipo: "miniaturas" })}
              >
                <PanelLeft aria-hidden="true" className={icono} />
              </Boton>
            </ToolbarGroup>
            <ToolbarGroup label={t.groups.navigation}>
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
            </ToolbarGroup>
            <ToolbarGroup label={t.groups.view}>
              <Boton
                etiqueta={t.zoomOut}
                {...atajo("alejar", t.zoomOut)}
                disabled={porcentaje <= ZOOM_MINIMO * 100}
                onClick={() =>
                  despachar({ tipo: "paso-zoom", actual: porcentaje / 100, direccion: -1 })
                }
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
                onClick={() =>
                  despachar({ tipo: "paso-zoom", actual: porcentaje / 100, direccion: 1 })
                }
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
            </ToolbarGroup>
            <ToolbarGroup label={t.groups.tools} className="ml-auto">
              <Boton
                etiqueta={t.search}
                {...atajo("buscar", t.search)}
                aria-pressed={estado.busqueda}
                onClick={() => despachar({ tipo: "busqueda", abierta: !estado.busqueda })}
              >
                <Search aria-hidden="true" className={icono} />
              </Boton>
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
            </ToolbarGroup>
          </div>
        </>
      ) : (
        <div className="pdf-toolbar-mobile" role="toolbar" aria-label={t.toolbar}>
          <Boton etiqueta={t.close} onClick={onClose}>
            <X aria-hidden="true" className={icono} />
          </Boton>
          <span className="pdf-mobile-page">{t.status.page(estado.pagina, estado.total)}</span>
          <Boton
            etiqueta={t.search}
            aria-pressed={estado.busqueda}
            onClick={() => despachar({ tipo: "busqueda", abierta: !estado.busqueda })}
          >
            <Search aria-hidden="true" className={icono} />
          </Boton>
          <Boton
            etiqueta={t.tools}
            aria-haspopup="dialog"
            aria-expanded={herramientas}
            onClick={() => setHerramientas(true)}
          >
            <Settings2 aria-hidden="true" className={icono} />
            <span>{t.tools}</span>
          </Boton>
        </div>
      )}
      {movil && herramientas && (
        <MobileSheet
          title={t.toolsTitle}
          closeLabel={t.closeTools}
          onClose={() => setHerramientas(false)}
          testId="herramientas-pdf"
        >
          <div className="ui-sheet-section">
            <h3>{t.groups.page}</h3>
            <div className="pdf-sheet-page">
              <Boton
                etiqueta={t.previous}
                disabled={estado.pagina <= 1}
                onClick={() => despachar({ tipo: "anterior" })}
              >
                <ChevronUp aria-hidden="true" className={icono} />
                {t.previous}
              </Boton>
              <CampoPagina id={`${ID_CAMPO_PAGINA}-mobile`} estado={estado} despachar={despachar} />
              <Boton
                etiqueta={t.next}
                disabled={estado.pagina >= estado.total}
                onClick={() => despachar({ tipo: "siguiente" })}
              >
                <ChevronDown aria-hidden="true" className={icono} />
                {t.next}
              </Boton>
            </div>
          </div>
          <div className="ui-sheet-section">
            <h3>{t.groups.zoom}</h3>
            <div className="ui-sheet-grid">
              <Boton
                etiqueta={t.zoomOut}
                disabled={porcentaje <= ZOOM_MINIMO * 100}
                onClick={() =>
                  despachar({ tipo: "paso-zoom", actual: porcentaje / 100, direccion: -1 })
                }
              >
                <ZoomOut aria-hidden="true" className={icono} />
                {t.zoomOut}
              </Boton>
              <Boton
                etiqueta={t.zoomIn}
                disabled={porcentaje >= ZOOM_MAXIMO * 100}
                onClick={() =>
                  despachar({ tipo: "paso-zoom", actual: porcentaje / 100, direccion: 1 })
                }
              >
                <ZoomIn aria-hidden="true" className={icono} />
                {t.zoomIn}
              </Boton>
              <Boton
                etiqueta={t.zoomReset(porcentaje)}
                onClick={() => despachar({ tipo: "zoom", zoom: { tipo: "fijo", valor: 1 } })}
              >
                {t.zoomPercent(porcentaje)}
              </Boton>
              <Boton
                etiqueta={t.fitWidth}
                aria-pressed={estado.zoom.tipo === "ancho"}
                onClick={() => despachar({ tipo: "zoom", zoom: { tipo: "ancho" } })}
              >
                <MoveHorizontal aria-hidden="true" className={icono} />
                {t.fitWidth}
              </Boton>
              <Boton
                etiqueta={t.fitPage}
                aria-pressed={estado.zoom.tipo === "pagina"}
                onClick={() => despachar({ tipo: "zoom", zoom: { tipo: "pagina" } })}
              >
                <Maximize aria-hidden="true" className={icono} />
                {t.fitPage}
              </Boton>
            </div>
          </div>
          <div className="ui-sheet-section">
            <h3>{t.groups.appearance}</h3>
            <div className="ui-sheet-grid">
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
              <Boton
                etiqueta={t.rotateLeft}
                onClick={() => despachar({ tipo: "girar", sentido: -1 })}
              >
                <RotateCcw aria-hidden="true" className={icono} />
                {t.rotateLeft}
              </Boton>
              <Boton etiqueta={t.rotate} onClick={() => despachar({ tipo: "girar" })}>
                <RotateCw aria-hidden="true" className={icono} />
                {t.rotate}
              </Boton>
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
              <Boton
                etiqueta={estado.miniaturas ? t.hideThumbnails : t.showThumbnails}
                aria-pressed={estado.miniaturas}
                onClick={() => {
                  despachar({ tipo: "miniaturas" });
                  setHerramientas(false);
                }}
              >
                <PanelLeft aria-hidden="true" className={icono} />
                {t.thumbnails}
              </Boton>
            </div>
          </div>
          <div className="ui-sheet-section">
            <h3>{t.groups.actions}</h3>
            <div className="ui-sheet-grid">
              <Boton
                etiqueta={t.search}
                onClick={() => {
                  despachar({ tipo: "busqueda", abierta: true });
                  setHerramientas(false);
                }}
              >
                <Search aria-hidden="true" className={icono} />
                {t.search}
              </Boton>
              {pantallaCompleta !== null && (
                <Boton
                  etiqueta={t.fullscreen}
                  aria-pressed={pantallaCompleta}
                  onClick={() => {
                    onPantallaCompleta();
                    setHerramientas(false);
                  }}
                >
                  <Fullscreen aria-hidden="true" className={icono} />
                  {t.fullscreen}
                </Boton>
              )}
              <Boton
                etiqueta={t.shortcuts}
                onClick={() => {
                  onAyuda();
                  setHerramientas(false);
                }}
              >
                <Keyboard aria-hidden="true" className={icono} />
                {t.shortcuts}
              </Boton>
            </div>
          </div>
        </MobileSheet>
      )}
    </div>
  );
}

/**
 * «Ir a página»: un campo de texto (no `type="number"`, que acepta «1e3» y
 * cambia con la rueda del ratón). Se valida al pulsar Intro o salir: solo un
 * entero entre 1 y el total; si no, se avisa y el visor no se mueve.
 */
function CampoPagina({
  estado,
  despachar,
  id = ID_CAMPO_PAGINA,
}: {
  estado: EstadoVisor;
  despachar: Dispatch<Accion>;
  id?: string;
}) {
  const [texto, setTexto] = useState(String(estado.pagina));
  const [invalido, setInvalido] = useState(false);
  const idAviso = useId();
  const idTotal = useId();
  /**
   * ¿Hay algo escrito sin confirmar? Entonces el campo NO sigue a la página actual:
   * si la vista aún se mueve mientras se escribe (desplazamiento por inercia, o un
   * evento de desplazamiento que llega tarde), lo escrito se perdía y Intro iba a la
   * página que hubiera en ese momento (Fase 13; lo destapó WebKit en los E2E).
   */
  const editado = useRef(false);

  useEffect(() => {
    if (editado.current) return;
    setTexto(String(estado.pagina));
    setInvalido(false);
  }, [estado.pagina]);

  const confirmar = () => {
    const pagina = leerPagina(texto, estado.total);
    if (pagina === null) {
      setInvalido(texto.trim() !== String(estado.pagina));
      return false;
    }
    editado.current = false;
    setInvalido(false);
    if (pagina !== estado.pagina) despachar({ tipo: "ir", pagina });
    return true;
  };
  /** Vuelve a mostrar la página actual y deja de considerar lo escrito. */
  const restaurar = () => {
    editado.current = false;
    setTexto(String(estado.pagina));
    setInvalido(false);
  };

  return (
    <span className="relative flex items-center gap-1 text-sm">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        aria-label={t.pageInput}
        aria-keyshortcuts={ATAJOS_BOTON.irAPagina.aria}
        aria-describedby={invalido ? `${idTotal} ${idAviso}` : idTotal}
        aria-invalid={invalido || undefined}
        value={texto}
        onChange={(e) => {
          editado.current = true;
          setTexto(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") confirmar();
          if (e.key === "Escape") restaurar();
        }}
        onBlur={() => {
          if (!confirmar()) restaurar();
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
