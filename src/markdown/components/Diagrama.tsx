import { useEffect, useRef, useState } from "react";
import { messages } from "@/i18n/messages";
import { DiagramaConImagenesError, DiagramaGrandeError } from "../mermaid";
import type { ColoresDiagrama } from "../mermaid-config";
import { useDiagramas, useImpresion } from "./acciones";

const t = messages.markdown.diagram;

type Estado =
  | { fase: "esperando" }
  | { fase: "dibujando" }
  | { fase: "listo"; url: string }
  | { fase: "error"; motivo: "invalid" | "tooLarge" | "images" };

/**
 * Un diagrama Mermaid (bloque ```` ```mermaid ````, Fase 8).
 *
 * - Se dibuja **al entrar en pantalla** (un `IntersectionObserver` por
 *   bloque, desconectado al primer cruce o al desmontar): un documento con
 *   muchos diagramas no los dibuja todos al abrirse.
 * - El SVG (ya saneado, `svg-seguro.ts`) se muestra como `<img>` con una URL
 *   `blob:` propia de este bloque, revocada al desmontarse o cambiar.
 * - Mientras tanto, o si falla (sintaxis, tamaño), se ve el código fuente,
 *   con un aviso: el documento nunca se rompe por un diagrama.
 * - Accesibilidad: la imagen dice qué tipo de diagrama es y el código queda
 *   disponible en un desplegable.
 */
export function Diagrama({ fuente }: { fuente: string }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<Estado>({ fase: "esperando" });
  const diagramas = useDiagramas();
  const impresion = useImpresion();

  // Empezar al entrar en pantalla (o ya, si el navegador no tiene IntersectionObserver,
  // o en la copia para imprimir, que no se ve: Fase 17).
  // Depende de `fuente` aunque no la lea: otra fuente vuelve a empezar.
  // biome-ignore lint/correctness/useExhaustiveDependencies: ver arriba
  useEffect(() => {
    setEstado({ fase: "esperando" });
    const el = contenedor.current;
    if (!el || impresion || typeof IntersectionObserver === "undefined") {
      setEstado({ fase: "dibujando" });
      return;
    }
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) {
          observador.disconnect();
          setEstado({ fase: "dibujando" });
        }
      },
      { rootMargin: "400px 0px" },
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, [fuente, impresion]);

  const dibujando = estado.fase === "dibujando";
  useEffect(() => {
    if (!dibujando) return;
    let vigente = true;
    const marco = diagramas?.marco();
    if (!marco) {
      setEstado({ fase: "error", motivo: "invalid" });
      return;
    }
    marco.dibujar(fuente, coloresDelTema(contenedor.current)).then(
      (svg) => {
        // La URL solo se crea si el bloque sigue montado y con esta fuente.
        if (!vigente) return;
        setEstado({
          fase: "listo",
          url: URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" })),
        });
      },
      (e) => {
        if (!vigente) return;
        setEstado({
          fase: "error",
          motivo:
            e instanceof DiagramaGrandeError
              ? "tooLarge"
              : e instanceof DiagramaConImagenesError
                ? "images"
                : "invalid",
        });
      },
    );
    return () => {
      vigente = false;
    };
  }, [dibujando, fuente, diagramas]);

  // Cada URL vive lo que su estado: se revoca al cambiar de estado o al desmontar.
  const url = estado.fase === "listo" ? estado.url : null;
  useEffect(() => {
    if (!url) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  const tipo = tipoDe(fuente);
  if (estado.fase === "listo") {
    return (
      <figure className="md-diagrama" data-diagrama="listo">
        <img src={estado.url} alt={t.alt(tipo)} />
        <details>
          <summary>{t.source}</summary>
          <pre>
            <code>{fuente}</code>
          </pre>
        </details>
      </figure>
    );
  }
  return (
    <div ref={contenedor} className="md-diagrama" data-diagrama={estado.fase}>
      {estado.fase === "error" ? (
        <p className="md-diagrama-aviso" role="note">
          {t.errors[estado.motivo]}
        </p>
      ) : (
        <p className="md-diagrama-aviso flex items-center gap-2" role="status">
          <span aria-hidden="true" className="ui-spinner ui-spinner-sm" />
          {t.drawing}
        </p>
      )}
      <pre>
        <code>{fuente}</code>
      </pre>
    </div>
  );
}

/**
 * El tipo de diagrama (`flowchart`, `sequenceDiagram`…) para el texto
 * alternativo: la primera palabra que no es un comentario ni una directiva.
 */
export function tipoDe(fuente: string): string {
  for (const linea of fuente.split("\n")) {
    const l = linea.trim();
    if (!l || l.startsWith("%%") || l === "---") continue;
    return (l.split(/\s/)[0] ?? "").replace(/[^\w-]/g, "").slice(0, 40);
  }
  return "";
}

/**
 * Colores de los tokens de BPDF (globals.css), como `#rrggbb`, vistos desde el
 * propio bloque: en la copia para imprimir en claro (Fase 17) los tokens son los
 * de ese tema (`impresion.css`) y el diagrama se dibuja con ellos.
 */
function coloresDelTema(desde: Element | null): ColoresDiagrama {
  const estilo = getComputedStyle(desde ?? document.documentElement);
  const hex = (token: string, reserva: string) => {
    const partes = estilo.getPropertyValue(`--rgb-${token}`).trim().split(/\s+/).map(Number);
    if (partes.length !== 3 || partes.some((n) => !Number.isFinite(n))) return reserva;
    return `#${partes.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  };
  return {
    fondo: hex("page", "#0e1425"),
    nodo: hex("elevated", "#303030"),
    texto: hex("fg", "#ececec"),
    linea: hex("fg-muted", "#b4b4b4"),
    acento: hex("accent", "#10a37f"),
  };
}
