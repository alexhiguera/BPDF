// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentError } from "@/documents/errors";
import { createWebPlatform } from "@/platform/web";
import { fichero, PDF_VALIDO } from "../../helpers/documentos";

/**
 * El selector web con un `<input type="file">` de verdad (jsdom). Lo que el
 * usuario haría en el diálogo del sistema se simula con los eventos que el
 * navegador dispara: `change` con ficheros o `cancel`.
 */
function selectorEspiado() {
  const inputs: HTMLInputElement[] = [];
  const crear = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const el = crear(tag);
    if (el instanceof HTMLInputElement) {
      vi.spyOn(el, "click").mockImplementation(() => {}); // jsdom no abre diálogos
      inputs.push(el);
    }
    return el;
  });
  return inputs;
}

function elegir(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, "files", { value: files });
  input.dispatchEvent(new Event("change"));
}

afterEach(() => vi.restoreAllMocks());

describe("plataforma web: selector de archivos", () => {
  it("usa un <input type=file> con el filtro de extensiones, fuera del DOM, y lo abre", async () => {
    const inputs = selectorEspiado();
    const promesa = createWebPlatform().pickDocument();
    const input = inputs[0]!;
    expect(input.type).toBe("file");
    expect(input.accept).toBe(".pdf,.md,.markdown");
    expect(input.multiple).toBe(false);
    expect(input.isConnected).toBe(false);
    expect(input.click).toHaveBeenCalledOnce();
    elegir(input, [fichero("a.md", "# a")]);
    await expect(promesa).resolves.toMatchObject({ kind: "markdown", text: "# a" });
  });

  it("cancelar el diálogo resuelve null", async () => {
    const inputs = selectorEspiado();
    const promesa = createWebPlatform().pickDocument();
    inputs[0]!.dispatchEvent(new Event("cancel"));
    await expect(promesa).resolves.toBeNull();
  });

  it("un change sin ficheros también cuenta como cancelar", async () => {
    const inputs = selectorEspiado();
    const promesa = createWebPlatform().pickDocument();
    elegir(inputs[0]!, []);
    await expect(promesa).resolves.toBeNull();
  });

  it("rechaza con DocumentError si el fichero elegido no vale", async () => {
    const inputs = selectorEspiado();
    const promesa = createWebPlatform().pickDocument();
    elegir(inputs[0]!, [fichero("nota.txt", "texto")]);
    await expect(promesa).rejects.toBeInstanceOf(DocumentError);
  });
});

describe("plataforma web: ficheros soltados", () => {
  it("valida y abre un fichero soltado", async () => {
    const doc = await createWebPlatform().openDroppedFile(fichero("a.pdf", PDF_VALIDO));
    expect(doc.kind).toBe("pdf");
  });
});

describe("plataforma web: nada sale del dispositivo", () => {
  it("abrir documentos no hace peticiones de red ni crea URL de objeto", async () => {
    const fetch = vi.spyOn(globalThis, "fetch");
    // jsdom no implementa `URL.createObjectURL`: se pone un espía y se retira al acabar.
    const original = URL.createObjectURL;
    const crearUrl = vi.fn();
    URL.createObjectURL = crearUrl;
    try {
      const inputs = selectorEspiado();
      const plataforma = createWebPlatform();
      const promesa = plataforma.pickDocument();
      elegir(inputs[0]!, [fichero("a.pdf", PDF_VALIDO)]);
      await promesa;
      await plataforma.openDroppedFile(fichero("b.md", "# b"));
      expect(fetch).not.toHaveBeenCalled();
      expect(crearUrl).not.toHaveBeenCalled();
    } finally {
      URL.createObjectURL = original;
    }
  });
});
