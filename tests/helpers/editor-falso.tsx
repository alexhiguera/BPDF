import { type MutableRefObject, useEffect, useRef, useState } from "react";
import type { EstadoGuardado, ManejadorEditor } from "@/editor/tipos";

/**
 * Un editor falso con el MISMO contrato que `EditorMarkdown` (Fase 9), para
 * probar en jsdom la lógica de `MarkdownView` (modos, vista previa, cambios,
 * guardar). CodeMirror necesita medir y pintar: se prueba de verdad en
 * Playwright (`e2e/specs/editor.spec.ts`). Uso:
 *
 *   vi.mock("@/editor/EditorMarkdown", async () => import("../helpers/editor-falso"));
 */
export default function EditorFalso({
  textoInicial,
  estado,
  alCambiar,
  manejador,
  etiqueta,
  alMontar,
}: {
  textoInicial: string;
  estado: EstadoGuardado;
  alCambiar: MutableRefObject<() => void>;
  manejador: MutableRefObject<ManejadorEditor | null>;
  etiqueta: string;
  alMontar?: (montado: boolean) => void;
}) {
  const guardado = estado.actual as { doc: { toString(): string } } | null;
  const [valor, setValor] = useState(() => guardado?.doc.toString() ?? textoInicial);
  const actual = useRef(valor);
  actual.current = valor;
  const area = useRef<HTMLTextAreaElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: como el real, se monta una vez
  useEffect(() => {
    manejador.current = {
      texto: () => actual.current,
      lineaSuperior: () => 1,
      irALinea: () => {},
      totalLineas: () => actual.current.split("\n").length,
      desplazable: () => area.current as HTMLElement,
      enfocar: () => area.current?.focus(),
    };
    alMontar?.(true);
    return () => {
      estado.actual = { doc: { toString: () => actual.current } };
      manejador.current = null;
      alMontar?.(false);
    };
  }, []);

  return (
    <textarea
      ref={area}
      aria-label={etiqueta}
      value={valor}
      onChange={(e) => {
        actual.current = e.target.value;
        setValor(e.target.value);
        alCambiar.current();
      }}
    />
  );
}
