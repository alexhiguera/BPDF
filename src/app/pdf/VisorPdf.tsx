import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { OpenedPdf } from "@/documents/types";
import { messages } from "@/i18n/messages";
import {
  AperturaCanceladaError,
  abrirPdf,
  cargarPdfjs,
  PdfProtegidoError,
  RUTAS_WEB,
} from "@/pdf/engine";
import { ControladorVisor } from "@/pdf/visor/controlador";
import type { Tamano } from "@/pdf/visor/disposicion";
import { DocumentoVisor } from "@/pdf/visor/documento";
import type { DestinoEnlace } from "@/pdf/visor/enlaces";
import { coloresOscuro } from "./colores";
import { DialogoContrasena } from "./DialogoContrasena";
import { Visor } from "./Visor";
import "@/styles/visor-pdf.css";

const t = messages.pdf;

type Carga =
  | { fase: "cargando" }
  /** Fase 6 (D13): el PDF tiene contraseña de apertura y se pide. */
  | { fase: "contrasena"; incorrecta: boolean; comprobando: boolean }
  | { fase: "error"; motivo: "unreadable" }
  | { fase: "listo"; controlador: ControladorVisor; primera: Tamano };

/**
 * Carga un PDF y monta el visor (docs/ARCHITECTURE.md → visor PDF).
 *
 * Ciclo de vida: se monta con `key={document.id}`, así que abrir otro
 * documento desmonta este. Al desmontar, se aborta la apertura si no había
 * terminado y se destruye el controlador (renders, worker del modo oscuro y
 * documento de pdf.js). Nada de este documento puede aparecer después: sus
 * marcos se van con él, y todo lo asíncrono comprueba su generación.
 *
 * Contraseña (Fase 6, D13): si pdf.js la pide, se muestra el diálogo; cada
 * «Abrir» es un intento nuevo (`intento`) que vuelve a abrir el PDF con ella.
 * La contraseña solo pasa por `contrasena` (una referencia) hasta que el
 * intento termina, y se borra también al desmontar. Abrir otro documento
 * desmonta el visor: cancela el intento en curso.
 */
export default function VisorPdf({
  documento,
  onClose,
  onOpenExternal,
}: {
  documento: OpenedPdf;
  onClose: () => void;
  onOpenExternal: (url: string) => void;
}) {
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  const [intento, setIntento] = useState(0);
  const contrasena = useRef<string | undefined>(undefined);
  useEffect(
    () => () => {
      contrasena.current = undefined;
    },
    [],
  );
  // Los enlaces los resuelve el visor montado; el controlador llega antes.
  const alEnlace = useRef<(d: DestinoEnlace) => void>(() => {});
  const alCambio = useRef<() => void>(() => {});
  const titulo = useRef<HTMLHeadingElement>(null);

  // Como el resto de vistas de documento: el foco va al título al abrir.
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `intento` es el disparador de cada reintento
  useEffect(() => {
    const abortar = new AbortController();
    let doc: DocumentoVisor | null = null;
    let controlador: ControladorVisor | null = null;
    const clave = contrasena.current;
    const olvidar = () => {
      if (contrasena.current === clave) contrasena.current = undefined;
    };
    (async () => {
      try {
        const pdfjs = await cargarPdfjs();
        const pdf = await abrirPdf(documento.blob, pdfjs, RUTAS_WEB, abortar.signal, clave);
        olvidar();
        doc = new DocumentoVisor(pdf);
        const primera = DocumentoVisor.tamanoDe(await doc.pagina(1));
        if (abortar.signal.aborted) {
          await doc.destruir();
          return;
        }
        controlador = new ControladorVisor(pdfjs, doc, {
          colores: coloresOscuro(),
          alEnlace: (d) => alEnlace.current(d),
          etiquetaEnlace: (d) =>
            d.tipo === "interno" ? t.link.internal(d.pagina) : t.link.external(d.url),
          alCambio: () => alCambio.current(),
        });
        setCarga({ fase: "listo", controlador, primera });
      } catch (error) {
        void doc?.destruir();
        if (abortar.signal.aborted || error instanceof AperturaCanceladaError) return;
        olvidar();
        if (error instanceof PdfProtegidoError) {
          // Con una contraseña dada, cualquier rechazo es «no es correcta».
          const incorrecta = clave !== undefined || error.motivo === "incorrecta";
          setCarga({ fase: "contrasena", incorrecta, comprobando: false });
          return;
        }
        setCarga({ fase: "error", motivo: "unreadable" });
      }
    })();
    return () => {
      abortar.abort();
      // El controlador destruye también el documento; si no llegó a crearse, se destruye este.
      void (controlador ? controlador.destruir() : doc?.destruir());
    };
  }, [documento.blob, intento]);

  if (carga.fase === "listo") {
    return (
      <Visor
        controlador={carga.controlador}
        primera={carga.primera}
        nombre={documento.name}
        onClose={onClose}
        onOpenExternal={onOpenExternal}
        alEnlace={alEnlace}
        alCambio={alCambio}
      />
    );
  }
  return (
    <section
      aria-labelledby="titulo-documento"
      aria-busy={carga.fase === "cargando" || (carga.fase === "contrasena" && carga.comprobando)}
      className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1
        ref={titulo}
        id="titulo-documento"
        tabIndex={-1}
        className="max-w-full truncate text-lg font-semibold"
      >
        {documento.name}
      </h1>
      {carga.fase === "cargando" && (
        <p role="status" className="text-fg-muted">
          {t.loading}
        </p>
      )}
      {carga.fase === "error" && (
        <p role="alert" className="max-w-prose text-danger">
          {t.errors[carga.motivo]}
        </p>
      )}
      {carga.fase === "contrasena" && (
        <DialogoContrasena
          incorrecta={carga.incorrecta}
          comprobando={carga.comprobando}
          intento={intento}
          onEnviar={(clave) => {
            contrasena.current = clave;
            setCarga({ fase: "contrasena", incorrecta: false, comprobando: true });
            setIntento((n) => n + 1);
          }}
          onCancelar={onClose}
        />
      )}
      <Button variant="secondary" onClick={onClose}>
        {t.close}
      </Button>
    </section>
  );
}
