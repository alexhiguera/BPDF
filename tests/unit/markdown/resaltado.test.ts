import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { lenguajeDe, lenguajeSoportado, resaltar } from "@/markdown/resaltado";

/** Texto plano de lo que devuelve `resaltar`. */
function texto(nodos: ReactNode): string {
  if (typeof nodos === "string") return nodos;
  if (Array.isArray(nodos)) return nodos.map(texto).join("");
  if (isValidElement(nodos)) {
    return texto((nodos as ReactElement<{ children?: ReactNode }>).props.children);
  }
  return "";
}

/** Tipos y clases de todos los elementos que devuelve `resaltar`. */
function elementos(nodos: ReactNode, fuera: { tipo: unknown; clase: unknown }[] = []) {
  if (Array.isArray(nodos)) for (const n of nodos) elementos(n, fuera);
  else if (isValidElement(nodos)) {
    const props = (nodos as ReactElement<{ className?: string; children?: ReactNode }>).props;
    fuera.push({ tipo: nodos.type, clase: props.className });
    elementos(props.children, fuera);
  }
  return fuera;
}

describe("lenguajeDe", () => {
  it("lee el lenguaje de la clase del bloque", () => {
    expect(lenguajeDe("language-ts")).toBe("ts");
    expect(lenguajeDe("otra language-Python")).toBe("python");
    expect(lenguajeDe("")).toBeNull();
    expect(lenguajeDe(undefined)).toBeNull();
    expect(lenguajeDe(["language-ts"])).toBeNull();
  });
});

describe("resaltar", () => {
  it.each([
    ["javascript", "const a = 1;"],
    ["js", "const a = 1;"],
    ["jsx", "const x = <p className='a'>hola</p>;"],
    ["typescript", "let a: number = 1;"],
    ["ts", "let a: number = 1;"],
    ["tsx", "const x = <B onClick={() => {}} />;"],
    ["json", '{"a": [1, true, null]}'],
    ["html", "<p class='a'>x</p>"],
    ["css", ".a { color: red; }"],
    ["bash", "echo $HOME"],
    ["sh", "ls -la"],
    ["shell", "ls -la"],
    ["python", "def f(): return 1"],
    ["py", "def f(): return 1"],
    ["markdown", "# Título"],
    ["md", "# Título"],
    ["sql", "SELECT * FROM t;"],
  ])("%s: resalta con spans hljs-* y conserva el texto exacto", (lenguaje, codigo) => {
    expect(lenguajeSoportado(lenguaje)).toBe(true);
    const r = resaltar(codigo, lenguaje);
    expect(r).not.toBeNull();
    expect(texto(r)).toBe(codigo);
    const els = elementos(r);
    expect(els.length).toBeGreaterThan(0);
    for (const e of els) {
      expect(e.tipo).toBe("span");
      expect(String(e.clase ?? "hljs-")).toMatch(/^hljs-/);
    }
  });

  it("sin lenguaje o con uno no soportado no resalta (el llamador pinta el texto)", () => {
    expect(resaltar("x", null)).toBeNull();
    expect(resaltar("x", "cobol")).toBeNull();
    expect(resaltar("x", "__proto__")).toBeNull();
    expect(resaltar("x", "constructor")).toBeNull();
  });

  it("el código con HTML o scripts sigue siendo texto", () => {
    const codigo = '<script>alert("x")</script><img src=x onerror=alert(1)>';
    const r = resaltar(codigo, "html");
    expect(texto(r)).toBe(codigo);
    expect(elementos(r).every((e) => e.tipo === "span")).toBe(true);
  });
});
