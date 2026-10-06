// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { crearGuardadoWeb, nombreSugerido, VIDA_URL_DESCARGA_MS } from "@/platform/guardar-web";
import { createWebPlatform } from "@/platform/web";

type Ventana = Window & typeof globalThis;
const DOC = { id: "doc-1", name: "notas.md" };

/** Un destino de `showSaveFilePicker` que recuerda lo escrito. */
function destinoFalso(fallar = false) {
  const escrito: string[] = [];
  return {
    escrito,
    createWritable: vi.fn(async () => ({
      write: async (datos: Blob) => {
        if (fallar) throw new DOMException("sin permiso", "NotAllowedError");
        escrito.push(await datos.text());
      },
      close: async () => {},
    })),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("nombreSugerido", () => {
  it("conserva .md y .markdown y añade .md si falta", () => {
    expect(nombreSugerido("notas.md")).toBe("notas.md");
    expect(nombreSugerido("Notas.MARKDOWN")).toBe("Notas.MARKDOWN");
    expect(nombreSugerido("notas")).toBe("notas.md");
    expect(nombreSugerido("  ")).toBe("documento.md");
  });
});

describe("guardar con showSaveFilePicker", () => {
  it("la primera vez pide el destino; las siguientes del MISMO documento lo reutilizan", async () => {
    const destino = destinoFalso();
    const selector = vi.fn(async (_opciones: { suggestedName: string }) => destino);
    const guardar = crearGuardadoWeb({ showSaveFilePicker: selector } as unknown as Ventana);
    expect(await guardar(DOC, "uno")).toBe("guardado");
    expect(await guardar(DOC, "dos")).toBe("guardado");
    expect(selector).toHaveBeenCalledOnce();
    expect(selector.mock.calls[0]?.[0]).toMatchObject({ suggestedName: "notas.md" });
    expect(destino.escrito).toEqual(["uno", "dos"]);
  });

  it("«Guardar como» (nuevoDestino) pide destino aunque haya uno, y el nuevo pasa a ser el del documento", async () => {
    const primero = destinoFalso();
    const segundo = destinoFalso();
    const selector = vi.fn().mockResolvedValueOnce(primero).mockResolvedValueOnce(segundo);
    const guardar = crearGuardadoWeb({ showSaveFilePicker: selector } as unknown as Ventana);
    await guardar(DOC, "uno");
    expect(await guardar(DOC, "dos", { nuevoDestino: true })).toBe("guardado");
    await guardar(DOC, "tres");
    expect(selector).toHaveBeenCalledTimes(2);
    expect(primero.escrito).toEqual(["uno"]);
    expect(segundo.escrito).toEqual(["dos", "tres"]);
  });

  it("cancelar un «Guardar como» deja el destino que ya tenía", async () => {
    const destino = destinoFalso();
    const selector = vi
      .fn()
      .mockResolvedValueOnce(destino)
      .mockRejectedValueOnce(new DOMException("cancelado", "AbortError"));
    const guardar = crearGuardadoWeb({ showSaveFilePicker: selector } as unknown as Ventana);
    await guardar(DOC, "uno");
    expect(await guardar(DOC, "dos", { nuevoDestino: true })).toBe("cancelado");
    await guardar(DOC, "tres");
    expect(destino.escrito).toEqual(["uno", "tres"]);
  });

  it("otro documento vuelve a pedir destino (nunca escribe en el del anterior)", async () => {
    const selector = vi.fn(async () => destinoFalso());
    const guardar = crearGuardadoWeb({ showSaveFilePicker: selector } as unknown as Ventana);
    await guardar(DOC, "uno");
    await guardar({ id: "doc-2", name: "otro.md" }, "dos");
    expect(selector).toHaveBeenCalledTimes(2);
  });

  it("cerrar el diálogo sin elegir es «cancelado», no un error", async () => {
    const selector = vi.fn(async () => {
      throw new DOMException("cancelado", "AbortError");
    });
    const guardar = crearGuardadoWeb({ showSaveFilePicker: selector } as unknown as Ventana);
    expect(await guardar(DOC, "x")).toBe("cancelado");
  });

  it("si escribir falla, rechaza y el siguiente guardado vuelve a preguntar", async () => {
    const selector = vi
      .fn()
      .mockResolvedValueOnce(destinoFalso(true))
      .mockResolvedValueOnce(destinoFalso());
    const guardar = crearGuardadoWeb({ showSaveFilePicker: selector } as unknown as Ventana);
    await expect(guardar(DOC, "x")).rejects.toThrow("sin permiso");
    expect(await guardar(DOC, "x")).toBe("guardado");
    expect(selector).toHaveBeenCalledTimes(2);
  });

  it("un error del diálogo que no es cancelar se propaga", async () => {
    const selector = vi.fn(async () => {
      throw new DOMException("sin gesto", "SecurityError");
    });
    const guardar = crearGuardadoWeb({ showSaveFilePicker: selector } as unknown as Ventana);
    await expect(guardar(DOC, "x")).rejects.toThrow("sin gesto");
  });
});

describe("guardar sin showSaveFilePicker: descarga", () => {
  it("descarga una copia con el nombre del documento y revoca la URL después", async () => {
    vi.useFakeTimers();
    const crear = vi.fn((_datos: Blob | MediaSource) => "blob:bpdf/descarga");
    const revocar = vi.fn();
    const ventana = window as Ventana;
    vi.spyOn(ventana.URL, "createObjectURL").mockImplementation(crear);
    vi.spyOn(ventana.URL, "revokeObjectURL").mockImplementation(revocar);
    const clics: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clics.push(this);
    });
    const guardar = crearGuardadoWeb(ventana);
    expect(await guardar({ id: "d", name: "informe" }, "# hola")).toBe("descargado");
    expect(clics).toHaveLength(1);
    expect(clics[0]?.download).toBe("informe.md");
    expect(clics[0]?.getAttribute("href")).toBe("blob:bpdf/descarga");
    expect(clics[0]?.isConnected).toBe(false); // se quita en el acto
    const blob = crear.mock.calls[0]?.[0] as unknown as Blob;
    expect(await blob.text()).toBe("# hola");
    expect(blob.type).toContain("text/markdown");
    expect(revocar).not.toHaveBeenCalled();
    vi.advanceTimersByTime(VIDA_URL_DESCARGA_MS);
    expect(revocar).toHaveBeenCalledWith("blob:bpdf/descarga");
  });

  it("la plataforma web expone saveText y no guarda nada en el almacenamiento", async () => {
    vi.spyOn(window.URL, "createObjectURL").mockImplementation(() => "blob:x");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const plataforma = createWebPlatform(document);
    expect(await plataforma.saveText(DOC, "texto")).toBe("descargado");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });
});
