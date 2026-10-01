import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, LanguageSupport, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { type MutableRefObject, useEffect, useRef } from "react";
import type { EstadoGuardado, ManejadorEditor } from "./tipos";

/**
 * El editor de Markdown (Fase 9, D9: CodeMirror 6). Se carga a demanda: solo al
 * entrar en «Edición» o «Dividido» (`React.lazy` en `MarkdownView`).
 *
 * **Dentro de un Shadow DOM, por la CSP.** CodeMirror inyecta sus estilos con
 * `style-mod`: si la raíz es el `document` (que tiene `<head>`), con una
 * etiqueta `<style>`, que la CSP de BPDF (`style-src 'self'`, sin
 * `'unsafe-inline'`) bloquea. En una raíz sin `<head>` (un `ShadowRoot`) usa
 * hojas construibles (`adoptedStyleSheets`), que no son estilos en línea y la
 * CSP no bloquea. Los atributos `style` los pone por CSSOM (`style.cssText`),
 * que la CSP tampoco bloquea. Así la CSP no cambia (E2E `editor.spec.ts`).
 * Los tokens de color (`--rgb-*`) son propiedades personalizadas: cruzan la
 * frontera del Shadow DOM, y el tema los usa.
 *
 * Trabaja sobre texto: no convierte nada a HTML ni ejecuta nada del documento.
 * El texto vive en el `EditorState` de CodeMirror (una cuerda, no un `string`):
 * teclear no copia el documento, y cambiar de modo conserva el estado con su
 * historial (`estado`).
 */
export default function EditorMarkdown({
  textoInicial,
  estado,
  alCambiar,
  manejador,
  etiqueta,
  alMontar,
}: {
  textoInicial: string;
  /** Donde se guarda el estado al desmontar, y de donde se retoma al volver. */
  estado: EstadoGuardado;
  /** Se llama en cada cambio del texto. Referencia estable: el estado la conserva. */
  alCambiar: MutableRefObject<() => void>;
  /** Se rellena al montar y se vacía al desmontar. */
  manejador: MutableRefObject<ManejadorEditor | null>;
  etiqueta: string;
  /** Avisa de que el editor está montado (`true`) o se ha desmontado (`false`). */
  alMontar?: (montado: boolean) => void;
}) {
  const anfitrion = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: el editor se crea una vez por montaje
  useEffect(() => {
    const el = anfitrion.current;
    if (!el) return;
    // Con StrictMode el efecto se monta dos veces: el ShadowRoot ya existe.
    const raiz = el.shadowRoot ?? el.attachShadow({ mode: "open" });
    const previo = estado.actual instanceof EditorState ? estado.actual : null;
    const view = new EditorView({
      state:
        previo ?? EditorState.create({ doc: textoInicial, extensions: extensiones(alCambiar) }),
      parent: raiz,
      root: raiz,
    });
    view.contentDOM.setAttribute("aria-label", etiqueta);
    manejador.current = manejadorDe(view);
    alMontar?.(true);
    return () => {
      estado.actual = view.state;
      manejador.current = null;
      view.destroy();
      alMontar?.(false);
    };
  }, []);

  // `contain: strict`: teclear no obliga a volver a maquetar ni pintar la vista previa.
  return (
    <div
      ref={anfitrion}
      className="min-h-0 flex-1 [contain:strict]"
      data-testid="editor-markdown"
    />
  );
}

function manejadorDe(view: EditorView): ManejadorEditor {
  return {
    texto: () => view.state.doc.toString(),
    totalLineas: () => view.state.doc.lines,
    desplazable: () => view.scrollDOM,
    enfocar: () => view.focus(),
    // Las alturas de CodeMirror se miden desde el principio del documento, que
    // empieza `documentPadding.top` por debajo del borde del área desplazable.
    lineaSuperior() {
      const alto = Math.max(0, view.scrollDOM.scrollTop - view.documentPadding.top);
      const bloque = view.lineBlockAtHeight(alto);
      const linea = view.state.doc.lineAt(bloque.from).number;
      const fraccion = bloque.height > 0 ? (alto - bloque.top) / bloque.height : 0;
      return linea + Math.min(Math.max(fraccion, 0), 0.999);
    },
    irALinea(linea) {
      const doc = view.state.doc;
      const n = Math.min(Math.max(Math.floor(linea), 1), doc.lines);
      const bloque = view.lineBlockAt(doc.line(n).from);
      view.scrollDOM.scrollTop =
        bloque.top + view.documentPadding.top + (linea - n) * bloque.height;
    },
  };
}

/** Colores de sintaxis: los mismos tokens que el resaltado de código del lector. */
const resaltado = HighlightStyle.define([
  { tag: t.heading, color: "rgb(var(--rgb-code-function))", fontWeight: "600" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.link, t.url], color: "rgb(var(--rgb-link))" },
  { tag: t.monospace, color: "rgb(var(--rgb-code-string))" },
  { tag: t.quote, color: "rgb(var(--rgb-fg-muted))" },
  {
    tag: [t.processingInstruction, t.meta, t.contentSeparator],
    color: "rgb(var(--rgb-code-comment))",
  },
  { tag: t.list, color: "rgb(var(--rgb-code-keyword))" },
]);

const tema = EditorView.theme(
  {
    "&": {
      height: "100%",
      color: "rgb(var(--rgb-fg))",
      backgroundColor: "rgb(var(--rgb-page))",
      fontSize: "14px",
    },
    "&.cm-focused": { outline: "2px solid rgb(var(--rgb-accent))", outlineOffset: "-2px" },
    ".cm-scroller": {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      lineHeight: "1.6",
    },
    ".cm-content": { padding: "16px 0", caretColor: "rgb(var(--rgb-fg))" },
    ".cm-line": { padding: "0 16px" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "rgb(var(--rgb-fg))" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection": {
      backgroundColor: "rgb(var(--rgb-accent) / 0.35)",
    },
  },
  { dark: true },
);

/**
 * Escribir encima de una selección, sin la edición nativa del navegador. En
 * escritorio, CodeMirror deja que el navegador modifique el DOM y después lo
 * lee; al sustituir una selección, Chrome crea `<span style="…">` para
 * conservar el aspecto, y la CSP (`style-src 'self'`) los bloquea: dos
 * violaciones por pulsación (medido en E2E). Aquí, solo si hay algo
 * seleccionado, se cancela la entrada nativa y el cambio se aplica como una
 * transacción del propio CodeMirror (igual que hace él con Intro o Retroceso).
 * La escritura normal, pegar, soltar y la composición (IME) siguen su camino.
 */
const escribirSobreSeleccion = EditorView.domEventHandlers({
  beforeinput(evento, view) {
    if (evento.inputType !== "insertText" && evento.inputType !== "insertReplacementText")
      return false;
    if (view.state.selection.ranges.every((r) => r.empty)) return false;
    const texto = evento.data ?? evento.dataTransfer?.getData("text/plain") ?? null;
    if (texto === null) return false;
    evento.preventDefault();
    view.dispatch(view.state.replaceSelection(texto), {
      userEvent: "input.type",
      scrollIntoView: true,
    });
    return true;
  },
});

function extensiones(alCambiar: MutableRefObject<() => void>): Extension[] {
  return [
    escribirSobreSeleccion,
    history(),
    // `indentWithTab`: Tab indenta. Para salir del editor con el teclado: Esc y
    // después Tab (lo resuelve CodeMirror; se dice en la ayuda del editor).
    keymap.of([...markdownKeymap, ...defaultKeymap, ...historyKeymap, indentWithTab]),
    new LanguageSupport(markdownLanguage),
    syntaxHighlighting(resaltado),
    EditorView.lineWrapping,
    tema,
    EditorView.updateListener.of((u) => {
      if (u.docChanged) alCambiar.current();
    }),
  ];
}
