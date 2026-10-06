// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ESPERA_IMPRESION_MS,
  esperarImpresion,
  imprimir,
  pendientesDeImpresion,
} from "@/markdown/impresion";

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

/** Un contenedor con el marcado que dejan las fórmulas, los diagramas y las imágenes. */
function raiz(html: string): HTMLElement {
  const div = document.createElement("div");
  // Solo en el test: el marcado de ejemplo, escrito a mano (la app nunca usa innerHTML).
  div.append(document.createRange().createContextualFragment(html));
  document.body.append(div);
  return div;
}

const completa = (img: HTMLImageElement, valor: boolean) =>
  Object.defineProperty(img, "complete", { value: valor, configurable: true });

describe("pendientesDeImpresion", () => {
  it("cuenta fórmulas cargando, diagramas sin dibujar e imágenes sin cargar", () => {
    const r = raiz(
      '<span data-formula="cargando"></span><span data-formula="lista"></span>' +
        '<div data-diagrama="esperando"></div><div data-diagrama="dibujando"></div>' +
        '<figure data-diagrama="listo"></figure><img alt="a"><img alt="b">',
    );
    const [a, b] = r.querySelectorAll("img");
    completa(a as HTMLImageElement, false);
    completa(b as HTMLImageElement, true);
    expect(pendientesDeImpresion(r)).toBe(4);
  });

  it("una fórmula o un diagrama con error ya están listos (se ven como código)", () => {
    const r = raiz('<span data-formula="error"></span><div data-diagrama="error"></div>');
    expect(pendientesDeImpresion(r)).toBe(0);
  });
});

describe("esperarImpresion", () => {
  it("resuelve tras DOS miradas seguidas sin nada pendiente", async () => {
    vi.useFakeTimers();
    const r = raiz('<span data-formula="cargando"></span>');
    let listo = false;
    const p = esperarImpresion(r, { intervaloMs: 50 }).then(() => {
      listo = true;
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(listo).toBe(false);
    r.querySelector("[data-formula]")?.setAttribute("data-formula", "lista");
    await vi.advanceTimersByTimeAsync(50);
    expect(listo).toBe(false); // una mirada limpia no basta
    await vi.advanceTimersByTimeAsync(50);
    await p;
    expect(listo).toBe(true);
  });

  it("si algo nunca termina, rechaza al agotar el tiempo (no imprime huecos)", async () => {
    vi.useFakeTimers();
    const r = raiz('<div data-diagrama="dibujando"></div>');
    const p = esperarImpresion(r);
    const fallo = expect(p).rejects.toThrow(/no terminó/);
    await vi.advanceTimersByTimeAsync(ESPERA_IMPRESION_MS + 100);
    await fallo;
  });

  it("se cancela con su señal", async () => {
    const r = raiz('<div data-diagrama="dibujando"></div>');
    const control = new AbortController();
    const p = esperarImpresion(r, { senal: control.signal });
    control.abort();
    await expect(p).rejects.toMatchObject({ name: "AbortError" });
  });
});

describe("imprimir", () => {
  it("llama a print y limpia al cerrarse el diálogo (afterprint), no antes", () => {
    const ventana = new EventTarget() as Window;
    const print = vi.fn();
    Object.assign(ventana, { print });
    const limpiar = vi.fn();
    expect(imprimir(ventana, limpiar)).toBe(true);
    expect(print).toHaveBeenCalledOnce();
    expect(limpiar).not.toHaveBeenCalled();
    ventana.dispatchEvent(new Event("afterprint"));
    ventana.dispatchEvent(new Event("afterprint"));
    expect(limpiar).toHaveBeenCalledOnce();
  });

  it("cancelar (la vista se va, u otra exportación) quita el oyente sin limpiar; un afterprint tardío no hace nada", () => {
    const ventana = new EventTarget() as Window;
    Object.assign(ventana, { print: vi.fn() });
    const limpiar = vi.fn();
    const control = new AbortController();
    expect(imprimir(ventana, limpiar, control.signal)).toBe(true);
    control.abort();
    ventana.dispatchEvent(new Event("afterprint"));
    expect(limpiar).not.toHaveBeenCalled();
  });

  it("sin window.print, o si lanza, limpia y devuelve false: la app no se queda bloqueada", () => {
    const sinPrint = new EventTarget() as Window;
    Object.assign(sinPrint, { print: undefined });
    const limpiar = vi.fn();
    expect(imprimir(sinPrint, limpiar)).toBe(false);
    expect(limpiar).toHaveBeenCalledOnce();

    const conFallo = new EventTarget() as Window;
    Object.assign(conFallo, {
      print: () => {
        throw new Error("bloqueado");
      },
    });
    const otra = vi.fn();
    expect(imprimir(conFallo, otra)).toBe(false);
    expect(otra).toHaveBeenCalledOnce();
  });
});

describe("impresion.css", () => {
  const css = readFileSync("src/styles/impresion.css", "utf8");

  it("solo actúa si hay una copia que imprimir, y entonces oculta todo lo demás", () => {
    expect(css).toContain("body:has(> .bpdf-impresion) > :not(.bpdf-impresion)");
    expect(css).toMatch(/\.bpdf-impresion \{\s*display: none;/);
  });

  it("no fija el tamaño de papel ni añade nada al documento (sin cabeceras ni pies)", () => {
    expect(css).not.toMatch(/@page[^{]*\{[^}]*\bsize\s*:/);
    expect(css).not.toMatch(/@(top|bottom)-(left|center|right)/);
    expect(css).not.toMatch(/content:\s*["']/);
  });
});
