import {
  type MutableRefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { MobileSheet } from "@/components/ui/Chrome";
import { messages } from "@/i18n/messages";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { cn } from "@/lib/utils";
import {
  type Coincidencia,
  type OpcionesBusqueda,
  primeraDesde,
  SIN_OPCIONES,
  siguienteIndice,
} from "@/pdf/visor/busqueda";
import type { ControladorVisor, EstadoBusqueda, Marco, Memoria } from "@/pdf/visor/controlador";
import {
  bytesLienzo,
  dentroDePresupuesto,
  disponer,
  girar,
  SEPARACION,
  type Tamano,
  tamanoTipico,
  ventana,
  zoomEfectivo,
} from "@/pdf/visor/disposicion";
import type { DestinoEnlace } from "@/pdf/visor/enlaces";
import { guardarPosicion, marcarUso, recuperarPosicion } from "@/preferences/positions";
import { cambiarPreferencias, obtenerPreferencias } from "@/preferences/store";
import { usePreferences } from "@/preferences/usePreferences";
import { AyudaAtajos } from "./AyudaAtajos";
import { atajoDe, type ContextoAtajos, ID_CAMPO_BUSQUEDA, ID_CAMPO_PAGINA } from "./atajos";
import { BarraBusqueda } from "./BarraBusqueda";
import { BarraHerramientas } from "./BarraHerramientas";
import { estadoInicial, reducir } from "./estado";
import { PanelMiniaturas } from "./PanelMiniaturas";

const t = messages.pdf;
const PASO_FLECHA = 60;
/** La posición se guarda tras este tiempo sin cambios (y al cerrar o salir). */
export const ESPERA_POSICION_MS = 1000;

export type PropsVisor = {
  controlador: ControladorVisor;
  primera: Tamano;
  nombre: string;
  onClose: () => void;
  onOpenExternal: (url: string) => void;
  alEnlace: MutableRefObject<(d: DestinoEnlace) => void>;
  alCambio: MutableRefObject<() => void>;
};

/**
 * El visor de un PDF ya abierto: barra de herramientas, área de lectura
 * (continua o página a página), miniaturas, búsqueda y barra de estado.
 *
 * La interfaz calcula la DISPOSICIÓN (dónde va cada página a este zoom) y qué
 * marcos existen: en la vista continua, solo los de las páginas visibles ±1
 * (el resto del documento es altura vacía). El controlador pinta en esos
 * marcos. Ver docs/ARCHITECTURE.md → visor PDF.
 *
 * Fase 6: pantalla completa del área de lectura, ayuda de atajos (con el
 * interruptor de los de una tecla), opciones de búsqueda y F3.
 *
 * Fase 10 (preferencias): al abrir, el zoom, la vista, el modo y las miniaturas
 * salen de `bpdf:prefs` y, si «Recordar la posición» está activado y el PDF
 * tiene una guardada (por su huella), la página y el zoom de ahí. La posición
 * se guarda 1 s después del último cambio, al cerrar el documento y al salir de
 * la página. Abrir o cerrar las miniaturas y el interruptor de atajos se
 * guardan al momento. Las opciones de búsqueda NO se guardan.
 */
export function Visor({
  controlador,
  primera,
  nombre,
  onClose,
  onOpenExternal,
  alEnlace,
  alCambio,
}: PropsVisor) {
  const total = controlador.total;
  const huella = controlador.documento.huella;
  // Lo que se lee al abrir: las preferencias de ese momento y la posición
  // guardada. Cambiarlas después no mueve el documento abierto. Solo lee: el
  // render no escribe en `localStorage` (el uso se marca en un efecto, abajo).
  const [inicial] = useState(() => {
    const prefs = obtenerPreferencias();
    const posicion = prefs.recordarPosicion && huella ? recuperarPosicion(huella) : null;
    return { pdf: prefs.pdf, posicion };
  });
  const [estado, despachar] = useReducer(reducir, total, (n) =>
    estadoInicial(n, {
      zoom: inicial.posicion?.zoom ?? inicial.pdf.zoom,
      vista: inicial.pdf.vista,
      modo: inicial.pdf.modo,
      miniaturas: inicial.pdf.miniaturas,
    }),
  );
  const preferencias = usePreferences();
  const [tamanos, setTamanos] = useState<Tamano[]>(() =>
    Array.from({ length: total }, () => primera),
  );
  const [area, setArea] = useState<Tamano>({ ancho: 800, alto: 600 });
  const [arriba, setArriba] = useState(0);
  const [memoria, setMemoria] = useState<Memoria>({ lienzos: 0, bytes: 0, pintando: 0 });
  const [aviso, setAviso] = useState("");
  const lector = useRef<HTMLDivElement>(null);
  const marcos = useRef(new Map<number, HTMLElement>());

  // Tamaños reales de todas las páginas, en segundo plano.
  useEffect(() => {
    void controlador.documento.tamanos(primera, setTamanos);
  }, [controlador, primera]);

  // Estado de pintura (para «pintando…» y las medidas de memoria).
  useEffect(() => {
    alCambio.current = () => {
      const m = controlador.memoria();
      setMemoria((a) =>
        a.lienzos === m.lienzos && a.bytes === m.bytes && a.pintando === m.pintando ? a : m,
      );
    };
    return () => {
      alCambio.current = () => {};
    };
  }, [controlador, alCambio]);

  const anunciar = useCallback((texto: string) => setAviso(texto), []);

  // Enlaces del documento.
  useEffect(() => {
    alEnlace.current = (d) => {
      if (d.tipo === "interno") {
        despachar({ tipo: "ir", pagina: d.pagina });
        anunciar(t.page(d.pagina, total));
      } else {
        anunciar(t.announce.externalLink(d.url));
        onOpenExternal(d.url);
      }
    };
    return () => {
      alEnlace.current = () => {};
    };
  }, [alEnlace, anunciar, onOpenExternal, total]);

  // Tamaño del área de lectura.
  useLayoutEffect(() => {
    const el = lector.current;
    if (!el) return;
    const medir = () => setArea({ ancho: el.clientWidth, alto: el.clientHeight });
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  // --- Disposición --------------------------------------------------------
  const continua = estado.vista === "continua";
  const girados = useMemo(
    () => tamanos.map((tam) => girar(tam, estado.rotacion)),
    [tamanos, estado.rotacion],
  );
  const actual = girados[estado.pagina - 1] ?? girar(primera, estado.rotacion);
  // Los ajustes (ancho, página) se calculan, en la vista continua, con el tamaño
  // TÍPICO del documento y no con el de la página actual: si no, el zoom saltaría
  // al pasar por una página apaisada.
  const referencia = useMemo(
    () => (continua ? tamanoTipico(girados) : actual),
    [continua, girados, actual],
  );
  const zoom = zoomEfectivo(estado.zoom, referencia, area);
  const disposicion = useMemo(
    () => (continua ? disponer(girados, zoom) : disponer([actual], zoom)),
    [continua, girados, actual, zoom],
  );
  const vent = continua ? ventana(disposicion, arriba, area.alto, 1) : null;
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  // Prioridad de pintura: la actual, las demás visibles y, después, las vecinas
  // (primero la siguiente: hacia donde se lee), dentro del presupuesto de memoria.
  const orden = [vent ? vent.actual : estado.pagina];
  if (vent) {
    for (let n = vent.visibles.desde; n <= vent.visibles.hasta; n++) {
      if (!orden.includes(n)) orden.push(n);
    }
  }
  const visibles = orden.length;
  if (vent) {
    for (const n of [vent.vivas.hasta, vent.vivas.desde]) if (!orden.includes(n)) orden.push(n);
  }
  const vivas = dentroDePresupuesto(orden, visibles, (n) =>
    bytesLienzo(disposicion.tamanos[continua ? n - 1 : 0] ?? { ancho: 0, alto: 0 }, dpr),
  );

  // Pintar lo vivo. Tras cada render, porque los marcos pueden haber cambiado.
  useEffect(() => {
    const lista: Marco[] = [];
    for (const numero of vivas) {
      const marco = marcos.current.get(numero);
      if (marco) lista.push({ numero, marco });
    }
    controlador.mostrar(lista, { zoom, rotacion: estado.rotacion, dpr, modo: estado.modo });
  });

  // --- Desplazamiento -----------------------------------------------------
  /** Dónde está la vista: página de arriba y fracción de ella ya pasada. */
  // Al abrir, el principio del documento (con su margen superior).
  const ancla = useRef({ pagina: 1, fraccion: -1 });
  /** El último desplazamiento puesto por código (no por el usuario). */
  const programado = useRef<number | null>(null);
  const saltoAplicado = useRef(estado.salto);
  const disposicionPrevia = useRef(disposicion);

  const desplazarA = useCallback((y: number) => {
    const el = lector.current;
    if (!el) return;
    el.scrollTop = Math.max(0, y);
    programado.current = el.scrollTop;
    setArriba(el.scrollTop);
  }, []);

  useLayoutEffect(() => {
    const d = disposicion;
    if (saltoAplicado.current !== estado.salto) {
      saltoAplicado.current = estado.salto;
      const i = continua ? estado.pagina - 1 : 0;
      // El borde superior de la página, con su separación encima.
      ancla.current = {
        pagina: i + 1,
        fraccion: -SEPARACION / Math.max(1, d.tamanos[i]?.alto ?? 1),
      };
      desplazarA(continua ? (d.arriba[i] ?? 0) - SEPARACION : 0);
    } else if (disposicionPrevia.current !== d) {
      // Otro zoom, giro o tamaños: la misma parte del documento sigue arriba.
      const i = Math.min(ancla.current.pagina, d.arriba.length) - 1;
      const y = (d.arriba[i] ?? 0) + ancla.current.fraccion * (d.tamanos[i]?.alto ?? 0);
      desplazarA(y);
    }
    disposicionPrevia.current = d;
  }, [disposicion, estado.salto, estado.pagina, continua, desplazarA]);

  const alDesplazar = useCallback(() => {
    const el = lector.current;
    if (!el) return;
    const y = el.scrollTop;
    setArriba(y);
    if (!continua) return;
    const v = ventana(disposicion, y, el.clientHeight, 0);
    const i = Math.max(0, v.visibles.desde - 1);
    ancla.current = {
      pagina: i + 1,
      fraccion: (y - (disposicion.arriba[i] ?? 0)) / Math.max(1, disposicion.tamanos[i]?.alto ?? 1),
    };
    // Un desplazamiento puesto por código (saltar a una página) no cambia la
    // página actual: al final del documento, la página pedida puede no
    // quedar arriba del todo.
    if (programado.current !== null && Math.abs(programado.current - y) < 2) return;
    programado.current = null;
    despachar({ tipo: "visible", pagina: ventana(disposicion, y, el.clientHeight).actual });
  }, [continua, disposicion]);

  // Ctrl/⌘ + rueda: zoom (y no el zoom del navegador).
  const zoomActual = useRef(zoom);
  zoomActual.current = zoom;
  useEffect(() => {
    const el = lector.current;
    if (!el) return;
    let ultimo = 0;
    const alRodar = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const ahora = performance.now();
      if (ahora - ultimo < 80 || e.deltaY === 0) return;
      ultimo = ahora;
      despachar({
        tipo: "paso-zoom",
        actual: zoomActual.current,
        direccion: e.deltaY < 0 ? 1 : -1,
      });
    };
    el.addEventListener("wheel", alRodar, { passive: false });
    return () => el.removeEventListener("wheel", alRodar);
  }, []);

  // --- Pantalla completa (Fase 6) ----------------------------------------
  // Solo el área de lectura. Sin soporte en el navegador, no hay botón.
  const soportaPantallaCompleta =
    typeof document !== "undefined" && document.fullscreenEnabled === true;
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  useEffect(() => {
    const alCambiar = () =>
      setPantallaCompleta(lector.current !== null && document.fullscreenElement === lector.current);
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, []);
  const alternarPantallaCompleta = useCallback(() => {
    const el = lector.current;
    if (!el || !document.fullscreenEnabled) return;
    // Un rechazo (sin gesto del usuario, política del navegador) no rompe nada.
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void el.requestFullscreen().catch(() => {});
  }, []);

  // --- Atajos de una tecla y su ayuda (Fase 6) ----------------------------
  // El interruptor es una preferencia guardada (Fase 10): el de la ayuda y el del
  // diálogo de preferencias escriben la misma.
  const unaTecla = preferencias.atajosUnaTecla;
  const setUnaTecla = useCallback((activos: boolean) => {
    cambiarPreferencias((p) => ({ ...p, atajosUnaTecla: activos }));
  }, []);
  const [ayuda, setAyuda] = useState(false);

  // Teclado. El contexto y las acciones se leen de referencias: el oyente se
  // pone una vez y siempre ve el estado actual.
  const contexto = useRef<Omit<ContextoAtajos, "modal">>({
    unaTecla,
    vista: estado.vista,
    busquedaAbierta: estado.busqueda,
  });
  contexto.current = { unaTecla, vista: estado.vista, busquedaAbierta: estado.busqueda };
  const acciones = useRef({ coincidencia: (_direccion: 1 | -1) => {} });
  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => {
      // Un diálogo modal abierto (la ayuda, u otro de la app) se queda las teclas.
      const modal = document.querySelector("dialog[open]") !== null;
      const atajo = atajoDe(e, { ...contexto.current, modal });
      if (!atajo) return;
      const el = lector.current;
      e.preventDefault();
      switch (atajo) {
        case "siguiente":
        case "anterior":
        case "primera":
        case "ultima":
          despachar({ tipo: atajo });
          break;
        case "bajar":
        case "subir": {
          if (!el) break;
          const abajo = atajo === "bajar";
          const enBorde = abajo
            ? el.scrollTop + el.clientHeight >= el.scrollHeight - 1
            : el.scrollTop <= 0;
          if (!continuaRef.current && enBorde)
            despachar({ tipo: abajo ? "siguiente" : "anterior" });
          else el.scrollBy({ top: abajo ? PASO_FLECHA : -PASO_FLECHA });
          break;
        }
        case "acercar":
        case "alejar":
          despachar({
            tipo: "paso-zoom",
            actual: zoomActual.current,
            direccion: atajo === "acercar" ? 1 : -1,
          });
          break;
        case "zoom-100":
          despachar({ tipo: "zoom", zoom: { tipo: "fijo", valor: 1 } });
          break;
        case "buscar":
          despachar({ tipo: "busqueda", abierta: true });
          // Si ya estaba abierta, el foco vuelve al campo.
          document.getElementById(ID_CAMPO_BUSQUEDA)?.focus();
          break;
        case "ir-a-pagina": {
          const campo = document.getElementById(ID_CAMPO_PAGINA);
          if (campo instanceof HTMLInputElement) {
            campo.focus();
            campo.select();
          }
          break;
        }
        case "coincidencia-siguiente":
        case "coincidencia-anterior":
          acciones.current.coincidencia(atajo === "coincidencia-siguiente" ? 1 : -1);
          break;
        case "pantalla-completa":
          alternarPantallaCompleta();
          break;
        case "miniaturas":
          despachar({ tipo: "miniaturas" });
          break;
        case "girar-derecha":
        case "girar-izquierda":
          despachar({ tipo: "girar", sentido: atajo === "girar-derecha" ? 1 : -1 });
          break;
        case "ayuda":
          setAyuda(true);
          break;
      }
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [alternarPantallaCompleta]);
  const continuaRef = useRef(continua);
  continuaRef.current = continua;

  // Anuncios de lo que cambia por acción del usuario (no al montar).
  const porcentaje = Math.round(zoom * 100);
  useAlCambiar(porcentaje, () => anunciar(t.announce.zoom(porcentaje)));
  useAlCambiar(estado.rotacion, () => anunciar(t.announce.rotation(estado.rotacion)));
  useAlCambiar(estado.modo, () =>
    anunciar(t.announce.mode(estado.modo === "oscuro" ? t.modeDark : t.modeOriginal)),
  );
  useAlCambiar(continua, () =>
    anunciar(t.announce.view(continua ? t.viewContinuous : t.viewSingle)),
  );
  useAlCambiar(estado.salto, () => anunciar(t.page(estado.pagina, total)));
  useAlCambiar(pantallaCompleta, () => anunciar(t.announce.fullscreen(pantallaCompleta)));

  // --- Preferencias y posición (Fase 10) ----------------------------------
  // Abrir o cerrar las miniaturas es un estado que se recuerda para el siguiente PDF.
  useAlCambiar(estado.miniaturas, () =>
    cambiarPreferencias((p) => ({ ...p, pdf: { ...p.pdf, miniaturas: estado.miniaturas } })),
  );

  // La página guardada se restaura con un salto, como cualquier «ir a»: los
  // tamaños reales llegan después y el ancla mantiene esa página arriba. Y abrir un
  // PDF con posición guardada cuenta como uso para el LRU (`marcarUso`).
  useEffect(() => {
    if (!inicial.posicion) return;
    if (huella) marcarUso(huella);
    if (inicial.posicion.page > 1) despachar({ tipo: "ir", pagina: inicial.posicion.page });
  }, [inicial, huella]);

  // Guardar la posición: 1 s después del último cambio de página o zoom, al
  // cerrar el documento (desmontar) y al salir de la página (`pagehide`). Solo si
  // «Recordar la posición» sigue activado en ese momento.
  const recordar = useRef(preferencias.recordarPosicion);
  recordar.current = preferencias.recordarPosicion;
  const pendiente = useRef<{ page: number; zoom: typeof estado.zoom } | null>(null);
  const guardarAhora = useCallback(() => {
    const p = pendiente.current;
    pendiente.current = null;
    if (p && huella && recordar.current) guardarPosicion(huella, p);
  }, [huella]);
  const posicionActual = useRef({ page: estado.pagina, zoom: estado.zoom });
  posicionActual.current = { page: estado.pagina, zoom: estado.zoom };
  // Solo cuando la posición cambia de verdad: abrir un PDF y no moverse no guarda nada.
  const clavePosicion = `${estado.pagina}|${JSON.stringify(estado.zoom)}`;
  const ultimaPosicion = useRef(clavePosicion);
  useEffect(() => {
    // (Con algo pendiente, sí: StrictMode monta el efecto dos veces y la segunda
    // tiene que volver a programar la espera que la primera canceló.)
    if (clavePosicion === ultimaPosicion.current && pendiente.current === null) return;
    ultimaPosicion.current = clavePosicion;
    pendiente.current = posicionActual.current;
    const espera = setTimeout(guardarAhora, ESPERA_POSICION_MS);
    return () => clearTimeout(espera);
  }, [clavePosicion, guardarAhora]);
  useEffect(() => {
    window.addEventListener("pagehide", guardarAhora);
    return () => {
      window.removeEventListener("pagehide", guardarAhora);
      guardarAhora();
    };
  }, [guardarAhora]);

  // --- Búsqueda -----------------------------------------------------------
  const [consulta, setConsulta] = useState("");
  // En memoria del visor, como la consulta (Fase 6; sin guardar: Fase 10).
  const [opciones, setOpciones] = useState<OpcionesBusqueda>(SIN_OPCIONES);
  const [resultado, setResultado] = useState<EstadoBusqueda | null>(null);
  const [activa, setActiva] = useState(-1);
  const llevar = useRef(false);
  const paginaRef = useRef(estado.pagina);
  paginaRef.current = estado.pagina;

  useEffect(() => {
    setResultado(null);
    setActiva(-1);
    controlador.cancelarBusqueda();
    if (!estado.busqueda || consulta.trim() === "") return;
    const espera = setTimeout(() => {
      void controlador.buscar(
        consulta,
        (r) => {
          setResultado(r);
          if (r.terminada)
            anunciar(r.sinTexto ? t.searchNoText : t.announce.results(r.coincidencias.length));
        },
        opciones,
      );
    }, 250);
    return () => clearTimeout(espera);
  }, [consulta, opciones, estado.busqueda, controlador, anunciar]);

  const coincidencias: readonly Coincidencia[] = resultado?.coincidencias ?? [];
  const irACoincidencia = useCallback(
    (i: number) => {
      const c = coincidencias[i];
      if (!c) return;
      llevar.current = true;
      setActiva(i);
      despachar({ tipo: "ir", pagina: c.pagina });
    },
    [coincidencias],
  );

  // F3 / Mayús+F3 (Fase 6): lo mismo que Intro / Mayús+Intro en el campo.
  acciones.current.coincidencia = (direccion) =>
    irACoincidencia(siguienteIndice(activa, coincidencias.length, direccion));

  // La primera coincidencia, en cuanto la hay: la de la página que se lee o la siguiente.
  useEffect(() => {
    if (activa === -1 && coincidencias.length > 0) {
      irACoincidencia(primeraDesde(coincidencias, paginaRef.current));
    }
  }, [activa, coincidencias, irACoincidencia]);

  useEffect(() => {
    controlador.resaltarBusqueda(coincidencias, activa, llevar.current);
    llevar.current = false;
  }, [controlador, coincidencias, activa]);

  // --- Render -------------------------------------------------------------
  const anchoContenido = Math.max(disposicion.ancho, area.ancho);
  const movil = useMediaQuery("(max-width: 52rem)");
  const paginasConMarco = continua ? vivas : [estado.pagina];
  const marcoDe = (numero: number, i: number) => ({
    top: disposicion.arriba[i] ?? SEPARACION,
    tamano: disposicion.tamanos[i] ?? { ancho: 0, alto: 0 },
    numero,
  });

  return (
    <section
      aria-labelledby="titulo-documento"
      className="flex min-h-0 flex-1 flex-col"
      data-testid="visor-pdf"
      data-paginas={total}
      data-lienzos={memoria.lienzos}
      data-bytes-lienzos={memoria.bytes}
      data-transformador={controlador.tipoTransformador ?? ""}
    >
      <BarraHerramientas
        nombre={nombre}
        estado={estado}
        porcentaje={porcentaje}
        despachar={despachar}
        onClose={onClose}
        pantallaCompleta={soportaPantallaCompleta ? pantallaCompleta : null}
        onPantallaCompleta={alternarPantallaCompleta}
        onAyuda={() => setAyuda(true)}
        unaTecla={unaTecla}
      />
      {estado.busqueda && (
        <BarraBusqueda
          consulta={consulta}
          onConsulta={setConsulta}
          resultado={resultado}
          activa={activa}
          onSiguiente={(dir) => acciones.current.coincidencia(dir)}
          opciones={opciones}
          onOpciones={setOpciones}
          onCerrar={() => {
            setConsulta("");
            despachar({ tipo: "busqueda", abierta: false });
          }}
        />
      )}
      <div className="flex min-h-0 flex-1">
        {estado.miniaturas &&
          (movil ? (
            <MobileSheet
              title={t.thumbnails}
              closeLabel={t.hideThumbnails}
              onClose={() => despachar({ tipo: "miniaturas" })}
              testId="miniaturas-movil"
            >
              <PanelMiniaturas
                variante="sheet"
                controlador={controlador}
                tamanos={girados}
                pagina={estado.pagina}
                parametros={{ rotacion: estado.rotacion, dpr, modo: estado.modo }}
                onIr={(n) => {
                  despachar({ tipo: "ir", pagina: n });
                  despachar({ tipo: "miniaturas" });
                }}
              />
            </MobileSheet>
          ) : (
            <PanelMiniaturas
              controlador={controlador}
              tamanos={girados}
              pagina={estado.pagina}
              parametros={{ rotacion: estado.rotacion, dpr, modo: estado.modo }}
              onIr={(n) => despachar({ tipo: "ir", pagina: n })}
            />
          ))}
        <div
          ref={lector}
          onScroll={alDesplazar}
          className="relative min-h-0 min-w-0 flex-1 overflow-auto bg-reading"
          data-testid="lector-pdf"
          data-vista={estado.vista}
        >
          <div className="relative" style={{ width: anchoContenido, height: disposicion.alto }}>
            {paginasConMarco.map((numero) => {
              const i = continua ? numero - 1 : 0;
              const { top, tamano } = marcoDe(numero, i);
              return (
                // biome-ignore lint/a11y/useSemanticElements: una página es un grupo con nombre, no un <fieldset> de formulario
                <div
                  key={numero}
                  ref={(el) => {
                    if (el) marcos.current.set(numero, el);
                    else marcos.current.delete(numero);
                  }}
                  role="group"
                  aria-label={t.page(numero, total)}
                  data-pagina={numero}
                  className={cn(
                    "pagina-pdf absolute shadow-md",
                    estado.modo === "oscuro" ? "bg-page" : "bg-fg",
                  )}
                  style={{
                    top,
                    // Centrada en lo que se ve; si es más ancha, desde el margen.
                    left: Math.max(SEPARACION, (area.ancho - tamano.ancho) / 2),
                    width: tamano.ancho,
                    height: tamano.alto,
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
      <footer className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border bg-app px-4 py-1 text-xs text-fg-muted">
        <span data-testid="estado-pagina">{t.status.page(estado.pagina, total)}</span>
        <span>{t.status.zoom(porcentaje)}</span>
        <span>{estado.modo === "oscuro" ? t.modeDark : t.modeOriginal}</span>
        <span>{continua ? t.viewContinuous : t.viewSingle}</span>
        {estado.rotacion !== 0 && <span>{t.status.rotation(estado.rotacion)}</span>}
        {memoria.pintando > 0 && <span>{t.rendering}</span>}
      </footer>
      <p role="status" className="sr-only">
        {aviso}
      </p>
      {ayuda && (
        <AyudaAtajos
          unaTecla={unaTecla}
          onUnaTecla={setUnaTecla}
          onCerrar={() => setAyuda(false)}
        />
      )}
    </section>
  );
}

/**
 * Llama a `efecto` cuando `valor` cambia respecto al render anterior; nunca al
 * montar (tampoco con el doble montaje de StrictMode).
 */
function useAlCambiar<T>(valor: T, efecto: () => void): void {
  const previo = useRef(valor);
  const actual = useRef(efecto);
  actual.current = efecto;
  useEffect(() => {
    if (Object.is(previo.current, valor)) return;
    previo.current = valor;
    actual.current();
  }, [valor]);
}
