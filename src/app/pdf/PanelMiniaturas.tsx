import { useEffect, useRef, useState } from "react";
import { messages } from "@/i18n/messages";
import { cn } from "@/lib/utils";
import { ANCHO_MINIATURA, type ControladorVisor, type Marco } from "@/pdf/visor/controlador";
import type { Tamano } from "@/pdf/visor/disposicion";
import type { ParametrosPintura } from "@/pdf/visor/superficie";

const t = messages.pdf;

/**
 * Panel de miniaturas. Cada miniatura es un botón con su marco; solo las que
 * están a la vista en el panel (±200 px) tienen lienzo, pintado aparte y a baja
 * resolución (nunca se reutiliza el lienzo de la página grande). Al cerrar el
 * panel se liberan todas.
 *
 * Teclado (Fase 6): índice de tabulación móvil. Solo una miniatura está en el
 * orden de tabulación (la de la página actual, o la última a la que se llegó con
 * las flechas); ↑ / ↓ mueven el foco a la anterior o la siguiente, e Intro o
 * Espacio la activan (es un botón). Las flechas del panel no llegan al visor:
 * no desplazan el área de lectura.
 */
export function PanelMiniaturas({
  variante = "lateral",
  controlador,
  tamanos,
  pagina,
  parametros,
  onIr,
}: {
  variante?: "lateral" | "sheet";
  controlador: ControladorVisor;
  /** Tamaños en puntos, ya girados. */
  tamanos: readonly Tamano[];
  pagina: number;
  parametros: Omit<ParametrosPintura, "zoom">;
  onIr: (pagina: number) => void;
}) {
  const panel = useRef<HTMLElement>(null);
  const marcos = useRef(new Map<number, HTMLElement>());
  const botones = useRef(new Map<number, HTMLButtonElement>());
  const [visibles, setVisibles] = useState<number[]>([]);
  const [enfocable, setEnfocable] = useState(pagina);
  useEffect(() => setEnfocable(pagina), [pagina]);

  // Qué miniaturas se ven en el panel.
  useEffect(() => {
    const raiz = panel.current;
    if (!raiz || typeof IntersectionObserver === "undefined") return;
    const vistas = new Set<number>();
    const observador = new IntersectionObserver(
      (entradas) => {
        for (const e of entradas) {
          const n = Number((e.target as HTMLElement).dataset.miniatura);
          if (e.isIntersecting) vistas.add(n);
          else vistas.delete(n);
        }
        setVisibles([...vistas].sort((a, b) => a - b));
      },
      { root: raiz, rootMargin: "200px 0px" },
    );
    for (const marco of marcos.current.values()) observador.observe(marco);
    return () => observador.disconnect();
  }, []);

  // Pintar las visibles; al desmontar el panel, liberarlas todas.
  const { rotacion, dpr, modo } = parametros;
  useEffect(() => {
    const lista: Marco[] = [];
    for (const numero of visibles) {
      const marco = marcos.current.get(numero);
      if (marco) lista.push({ numero, marco });
    }
    controlador.mostrarMiniaturas(lista, (n) => tamanos[n - 1]?.ancho ?? 1, {
      rotacion,
      dpr,
      modo,
    });
  }, [controlador, visibles, tamanos, rotacion, dpr, modo]);
  useEffect(
    () => () =>
      controlador.mostrarMiniaturas([], () => 1, { rotacion: 0, dpr: 1, modo: "original" }),
    [controlador],
  );

  // La miniatura de la página actual, a la vista.
  useEffect(() => {
    marcos.current.get(pagina)?.closest("li")?.scrollIntoView?.({ block: "nearest" });
  }, [pagina]);

  return (
    <nav
      ref={panel}
      aria-label={t.thumbnails}
      className={cn(
        "pdf-thumbnails overflow-y-auto bg-app p-2",
        variante === "lateral" ? "w-44 shrink-0 border-r border-border" : "pdf-thumbnails-sheet",
      )}
      data-testid="miniaturas"
    >
      <ol
        className="flex flex-col items-center gap-3"
        onKeyDown={(e) => {
          if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
          if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
          e.preventDefault();
          e.stopPropagation();
          const actual = Number((e.target as HTMLElement).closest("button")?.dataset.numero);
          const desde = Number.isFinite(actual) && actual > 0 ? actual : enfocable;
          const destino = Math.min(
            Math.max(1, desde + (e.key === "ArrowDown" ? 1 : -1)),
            tamanos.length,
          );
          setEnfocable(destino);
          botones.current.get(destino)?.focus();
        }}
      >
        {tamanos.map((tamano, i) => {
          const numero = i + 1;
          const actual = numero === pagina;
          return (
            <li key={numero}>
              <button
                ref={(el) => {
                  if (el) botones.current.set(numero, el);
                  else botones.current.delete(numero);
                }}
                type="button"
                data-numero={numero}
                tabIndex={numero === enfocable ? 0 : -1}
                aria-label={t.thumbnail(numero)}
                aria-current={actual ? "page" : undefined}
                onClick={() => onIr(numero)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md p-1 text-xs text-fg-muted",
                  "hover:bg-elevated",
                  actual && "bg-elevated text-fg outline outline-2 outline-accent",
                )}
              >
                <div
                  ref={(el) => {
                    if (el) marcos.current.set(numero, el);
                    else marcos.current.delete(numero);
                  }}
                  data-miniatura={numero}
                  className={cn("pagina-pdf relative", modo === "oscuro" ? "bg-page" : "bg-fg")}
                  style={{
                    width: ANCHO_MINIATURA,
                    height: Math.round((ANCHO_MINIATURA * tamano.alto) / Math.max(1, tamano.ancho)),
                  }}
                />
                <span aria-hidden="true">{numero}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
