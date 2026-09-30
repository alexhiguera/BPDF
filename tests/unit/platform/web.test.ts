// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { DocumentError } from "@/documents/errors";
import { MAX_FICHEROS_CARPETA, MAX_PROFUNDIDAD_CARPETA } from "@/documents/limits";
import type { OpenedMarkdown } from "@/documents/types";
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
    expect(input.accept).toBe(".pdf,.md,.markdown,.png,.jpg,.jpeg,.gif,.webp,.svg");
    expect(input.multiple).toBe(true);
    expect(input.webkitdirectory).not.toBe(true);
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
    const doc = await createWebPlatform().openDropped({
      ficheros: [fichero("a.pdf", PDF_VALIDO)],
      entradas: [null],
    });
    expect(doc).toMatchObject({ kind: "pdf" });
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
      await plataforma.openDropped({ ficheros: [fichero("b.md", "# b")], entradas: [null] });
      expect(fetch).not.toHaveBeenCalled();
      expect(crearUrl).not.toHaveBeenCalled();
    } finally {
      URL.createObjectURL = original;
    }
  });
});

/** Un `File` como los que da `<input webkitdirectory>`, con su ruta relativa. */
function enCarpeta(ruta: string, contenido = "x") {
  const f = fichero(ruta.slice(ruta.lastIndexOf("/") + 1), contenido);
  Object.defineProperty(f, "webkitRelativePath", { value: ruta });
  return f;
}

describe("plataforma web: selector de carpeta", () => {
  it("usa webkitdirectory, sin filtro, y abre el Markdown con las imágenes de la carpeta", async () => {
    const inputs = selectorEspiado();
    const promesa = createWebPlatform().pickFolder();
    const input = inputs[0]!;
    expect(input.webkitdirectory).toBe(true);
    expect(input.accept).toBe("");
    elegir(input, [
      enCarpeta("mi-doc/README.md", "![l](img/logo.png)"),
      enCarpeta("mi-doc/img/logo.png"),
      enCarpeta("mi-doc/notas.txt"),
      enCarpeta("mi-doc/node_modules/x/logo.png"),
      enCarpeta("mi-doc/.git/logo.png"),
    ]);
    const doc = (await promesa) as OpenedMarkdown;
    expect(doc).toMatchObject({ kind: "markdown", name: "README.md" });
    // Sin el nombre de la carpeta elegida, sin lo ignorado y sin lo que no es imagen.
    expect([...doc.resources.ficheros.keys()]).toEqual(["img/logo.png"]);
  });

  it("cancelar resuelve null", async () => {
    const inputs = selectorEspiado();
    const promesa = createWebPlatform().pickFolder();
    inputs[0]!.dispatchEvent(new Event("cancel"));
    await expect(promesa).resolves.toBeNull();
  });
});

/** Entradas de carpeta (File and Directory Entries) de mentira: jsdom no las tiene. */
type Arbol = { [nombre: string]: string | Arbol };
function entrada(nombre: string, nodo: string | Arbol, lote = 2): FileSystemEntry {
  if (typeof nodo === "string") {
    return {
      name: nombre,
      isFile: true,
      isDirectory: false,
      file: (ok: (f: File) => void) => ok(fichero(nombre, nodo)),
    } as unknown as FileSystemEntry;
  }
  return {
    name: nombre,
    isFile: false,
    isDirectory: true,
    createReader() {
      const hijos = Object.entries(nodo).map(([n, h]) => entrada(n, h, lote));
      let i = 0;
      // Por lotes, como Chrome: hay que llamar hasta que devuelva vacío.
      return {
        readEntries: (ok: (e: FileSystemEntry[]) => void) => {
          ok(hijos.slice(i, i + lote));
          i += lote;
        },
      };
    },
  } as unknown as FileSystemEntry;
}

describe("plataforma web: carpeta soltada", () => {
  it("recorre la carpeta por lotes y abre su Markdown con las imágenes", async () => {
    const carpeta = entrada("doc", {
      "README.md": "# r",
      img: { "a.png": "a", "b.png": "b", sub: { "c.svg": "<svg/>" } },
      "otro.txt": "t",
      node_modules: { "x.png": "x" },
    });
    const doc = (await createWebPlatform().openDropped({
      ficheros: [fichero("doc", "")],
      entradas: [carpeta],
    })) as OpenedMarkdown;
    expect(doc).toMatchObject({ kind: "markdown", name: "README.md" });
    expect([...doc.resources.ficheros.keys()].sort()).toEqual([
      "img/a.png",
      "img/b.png",
      "img/sub/c.svg",
    ]);
  });

  it("una carpeta junto con otras cosas: mixed-drop", async () => {
    await expect(
      createWebPlatform().openDropped({
        ficheros: [fichero("doc", ""), fichero("a.md", "a")],
        entradas: [entrada("doc", { "a.md": "a" }), entrada("a.md", "a")],
      }),
    ).rejects.toMatchObject({ code: "mixed-drop" });
  });

  it("ficheros sueltos (entradas de fichero o sin entradas): Markdown con sus imágenes", async () => {
    const md = fichero("a.md", "![x](i.png)");
    const png = fichero("i.png", "x");
    const doc = (await createWebPlatform().openDropped({
      ficheros: [md, png],
      entradas: [entrada("a.md", "x"), null],
    })) as OpenedMarkdown;
    expect([...doc.resources.ficheros.keys()]).toEqual(["i.png"]);
  });

  it("una carpeta con demasiados ficheros: folder-too-large", async () => {
    const muchos: Arbol = {};
    for (let i = 0; i <= MAX_FICHEROS_CARPETA; i++) muchos[`f${i}.txt`] = "";
    await expect(
      createWebPlatform().openDropped({
        ficheros: [fichero("doc", "")],
        entradas: [entrada("doc", muchos, 5000)],
      }),
    ).rejects.toMatchObject({ code: "folder-too-large" });
  });

  it("no baja más allá de la profundidad máxima", async () => {
    let arbol: Arbol = { "hondo.png": "x" };
    for (let i = 0; i < MAX_PROFUNDIDAD_CARPETA + 2; i++) arbol = { d: arbol };
    arbol["a.md"] = "# a";
    const doc = (await createWebPlatform().openDropped({
      ficheros: [fichero("doc", "")],
      entradas: [entrada("doc", arbol)],
    })) as OpenedMarkdown;
    expect(doc.resources.ficheros.size).toBe(0);
  });

  it("si leer la carpeta falla: unreadable", async () => {
    const rota = {
      name: "doc",
      isDirectory: true,
      isFile: false,
      createReader: () => ({
        readEntries: (_ok: unknown, mal: (e: Error) => void) => mal(new Error("sin permiso")),
      }),
    } as unknown as FileSystemEntry;
    await expect(
      createWebPlatform().openDropped({ ficheros: [], entradas: [rota] }),
    ).rejects.toMatchObject({ code: "unreadable" });
  });
});
