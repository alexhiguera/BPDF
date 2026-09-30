// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RUTA_MARCO_MERMAID } from "@/config/security-headers";
import {
  DiagramaConImagenesError,
  DiagramaGrandeError,
  DiagramaInvalidoError,
  ESPERA_MAXIMA_MS,
  MarcoMermaid,
} from "@/markdown/mermaid";
import {
  configuracionMermaid,
  esPeticion,
  esRespuesta,
  MAX_DIAGRAMA,
  MAX_SVG,
  NODO_CON_IMAGEN,
} from "@/markdown/mermaid-config";

const COLORES = {
  fondo: "#2b2b2b",
  nodo: "#303030",
  texto: "#ececec",
  linea: "#b4b4b4",
  acento: "#10a37f",
};
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect/></svg>';

describe("configuración de Mermaid", () => {
  const c = configuracionMermaid(COLORES);

  it("es estricta: sin HTML en etiquetas, sin arranque automático, con topes", () => {
    expect(c.securityLevel).toBe("strict");
    expect(c.htmlLabels).toBe(false);
    expect(c.flowchart?.htmlLabels).toBe(false);
    expect(c.startOnLoad).toBe(false);
    expect(c.maxTextSize).toBe(MAX_DIAGRAMA);
    expect(c.maxEdges).toBe(500);
    expect(c.suppressErrorRendering).toBe(true);
  });

  it("un diagrama no puede cambiar con %%{init}%% nada de seguridad ni de aspecto", () => {
    for (const clave of [
      "securityLevel",
      "htmlLabels",
      "flowchart",
      "themeCSS",
      "themeVariables",
      "dompurifyConfig",
      "maxTextSize",
      "maxEdges",
      "secure",
    ]) {
      expect(c.secure).toContain(clave);
    }
  });
});

describe("protocolo con el marco", () => {
  it("una petición mal formada se ignora", () => {
    const bien = { tipo: "bpdf-dibujar", id: 1, fuente: "graph TD", colores: COLORES };
    expect(esPeticion(bien)).toBe(true);
    for (const mal of [
      null,
      "x",
      { ...bien, tipo: "otra" },
      { ...bien, id: 1.5 },
      { ...bien, fuente: 1 },
      { ...bien, colores: { ...COLORES, fondo: "red;background:url(x)" } },
      { ...bien, colores: null },
    ]) {
      expect(esPeticion(mal)).toBe(false);
    }
  });

  it("una respuesta mal formada, o un SVG enorme, se ignora", () => {
    expect(esRespuesta({ tipo: "bpdf-listo" })).toBe(true);
    expect(esRespuesta({ tipo: "bpdf-svg", id: 1, svg: SVG })).toBe(true);
    expect(esRespuesta({ tipo: "bpdf-error", id: 1, motivo: "images" })).toBe(true);
    for (const mal of [
      null,
      { tipo: "bpdf-svg", id: "1", svg: SVG },
      { tipo: "bpdf-svg", id: 1, svg: 42 },
      { tipo: "bpdf-svg", id: 1, svg: "x".repeat(MAX_SVG + 1) },
      { tipo: "bpdf-error", id: 1, motivo: "otro" },
      { tipo: "desconocido", id: 1 },
    ]) {
      expect(esRespuesta(mal)).toBe(false);
    }
  });

  it("detecta los nodos con imagen, que no se dibujan", () => {
    expect(NODO_CON_IMAGEN.test('A@{ img: "https://x/y.png", label: "a" }')).toBe(true);
    expect(NODO_CON_IMAGEN.test("A@{img:'x'}")).toBe(true);
    expect(NODO_CON_IMAGEN.test('A@{ shape: rect, label: "img: no" }')).toBe(true); // conservador
    expect(NODO_CON_IMAGEN.test("A[img: texto] --> B")).toBe(false);
  });
});

describe("MarcoMermaid (la app)", () => {
  let marco: MarcoMermaid;
  const iframe = () => document.querySelector("iframe") as HTMLIFrameElement;
  /** Un mensaje como los del marco: de ese iframe, con origen opaco. */
  const delMarco = (data: unknown, opciones: Partial<MessageEventInit> = {}) =>
    window.dispatchEvent(
      new MessageEvent("message", {
        data,
        origin: "null",
        source: iframe().contentWindow,
        ...opciones,
      }),
    );
  const enviados: unknown[] = [];

  beforeEach(() => {
    enviados.length = 0;
    marco = new MarcoMermaid();
  });
  afterEach(() => {
    marco.destruir();
    vi.useRealTimers();
  });

  async function listo() {
    const promesa = marco.dibujar("graph TD; A-->B", COLORES);
    vi.spyOn(iframe().contentWindow as Window, "postMessage").mockImplementation((m) => {
      enviados.push(m);
    });
    delMarco({ tipo: "bpdf-listo" });
    await Promise.resolve();
    await Promise.resolve();
    return promesa;
  }

  it("no crea nada hasta el primer diagrama", () => {
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("crea un iframe aislado: sandbox solo allow-scripts, sin allow-same-origin", () => {
    void marco.dibujar("graph TD", COLORES).catch(() => {});
    const f = iframe();
    expect(f.getAttribute("sandbox")).toBe("allow-scripts");
    expect(f.getAttribute("src")).toBe(RUTA_MARCO_MERMAID);
    expect(f.getAttribute("aria-hidden")).toBe("true");
    expect(f.getAttribute("tabindex")).toBe("-1");
    expect(f.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("pide el diagrama cuando el marco está listo y devuelve el SVG verificado", async () => {
    const promesa = listo();
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    expect(enviados[0]).toMatchObject({ tipo: "bpdf-dibujar", id: 1, fuente: "graph TD; A-->B" });
    delMarco({ tipo: "bpdf-svg", id: 1, svg: SVG });
    await expect(promesa).resolves.toBe(SVG);
  });

  it("ignora mensajes de otras ventanas, sin origen opaco o mal formados", async () => {
    const promesa = listo();
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    delMarco({ tipo: "bpdf-svg", id: 1, svg: SVG }, { source: window }); // otra ventana
    delMarco({ tipo: "bpdf-svg", id: 1, svg: SVG }, { origin: "http://localhost" }); // sin sandbox
    delMarco({ tipo: "bpdf-svg", id: 1 }); // mal formado
    delMarco({ tipo: "bpdf-svg", id: 99, svg: SVG }); // de otra petición
    let resuelta = false;
    void promesa.then(() => {
      resuelta = true;
    });
    await Promise.resolve();
    expect(resuelta).toBe(false);
    delMarco({ tipo: "bpdf-svg", id: 1, svg: SVG });
    await expect(promesa).resolves.toBe(SVG);
  });

  it("rechaza un SVG que no pasa la verificación, venga del marco o no", async () => {
    const promesa = listo();
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    delMarco({ tipo: "bpdf-svg", id: 1, svg: SVG.replace("<rect/>", "<script>alert(1)</script>") });
    await expect(promesa).rejects.toBeInstanceOf(DiagramaInvalidoError);
  });

  it.each([
    ["invalid", DiagramaInvalidoError],
    ["tooLarge", DiagramaGrandeError],
    ["images", DiagramaConImagenesError],
  ])("el error %s del marco llega como su error", async (motivo, Clase) => {
    const promesa = listo();
    await vi.waitFor(() => expect(enviados).toHaveLength(1));
    delMarco({ tipo: "bpdf-error", id: 1, motivo });
    await expect(promesa).rejects.toBeInstanceOf(Clase);
  });

  it("un diagrama demasiado largo ni se envía", async () => {
    await expect(marco.dibujar("x".repeat(MAX_DIAGRAMA + 1), COLORES)).rejects.toBeInstanceOf(
      DiagramaGrandeError,
    );
    expect(document.querySelector("iframe")).toBeNull();
  });

  it("si el marco no responde, se da por fallido", async () => {
    vi.useFakeTimers();
    const promesa = marco.dibujar("graph TD", COLORES);
    vi.advanceTimersByTime(ESPERA_MAXIMA_MS);
    await expect(promesa).rejects.toBeInstanceOf(DiagramaGrandeError);
  });

  it("destruir quita el iframe y el listener y rechaza lo pendiente", async () => {
    const quitar = vi.spyOn(window, "removeEventListener");
    const promesa = marco.dibujar("graph TD", COLORES);
    marco.destruir();
    await expect(promesa).rejects.toBeInstanceOf(DiagramaInvalidoError);
    expect(document.querySelector("iframe")).toBeNull();
    expect(quitar).toHaveBeenCalledWith("message", expect.any(Function));
    await expect(marco.dibujar("graph TD", COLORES)).rejects.toBeInstanceOf(DiagramaInvalidoError);
  });
});
