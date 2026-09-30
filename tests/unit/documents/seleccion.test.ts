import { describe, expect, it } from "vitest";
import { DocumentError } from "@/documents/errors";
import { MAX_FICHEROS_CARPETA } from "@/documents/limits";
import { abrirSeleccion, type Seleccion } from "@/documents/seleccion";
import type { EleccionMarkdown, OpenedMarkdown } from "@/documents/types";
import { fichero, PDF_VALIDO } from "../../helpers/documentos";

const ficheros = (...files: File[]): Seleccion => ({
  origen: "ficheros",
  entregados: files.map((file) => ({ ruta: file.name, file })),
});
const carpeta = (entradas: Record<string, string>): Seleccion => ({
  origen: "carpeta",
  entregados: Object.entries(entradas).map(([ruta, contenido]) => ({
    ruta,
    file: fichero(ruta.slice(ruta.lastIndexOf("/") + 1), contenido),
  })),
});

async function error(promesa: Promise<unknown>) {
  try {
    await promesa;
  } catch (e) {
    expect(e).toBeInstanceOf(DocumentError);
    return e as DocumentError;
  }
  throw new Error("no falló");
}

const claves = (doc: unknown) => [...(doc as OpenedMarkdown).resources.ficheros.keys()].sort();

describe("abrirSeleccion: ficheros sueltos", () => {
  it("nada elegido: null", async () => {
    expect(await abrirSeleccion(ficheros())).toBeNull();
  });

  it("un Markdown solo se abre como siempre, sin recursos", async () => {
    const doc = await abrirSeleccion(ficheros(fichero("a.md", "# a")));
    expect(doc).toMatchObject({ kind: "markdown", name: "a.md", text: "# a" });
    expect(claves(doc)).toEqual([]);
  });

  it("un PDF solo también", async () => {
    expect(await abrirSeleccion(ficheros(fichero("a.pdf", PDF_VALIDO)))).toMatchObject({
      kind: "pdf",
    });
  });

  it("un Markdown con sus imágenes: las imágenes son sus recursos", async () => {
    const doc = await abrirSeleccion(
      ficheros(
        fichero("imagen.png", "png"),
        fichero("documento.md", "![x](imagen.png)"),
        fichero("logo.svg", "<svg/>"),
        fichero("foto.JPG", "jpg"),
      ),
    );
    expect(doc).toMatchObject({ kind: "markdown", name: "documento.md" });
    expect(claves(doc)).toEqual(["foto.JPG", "imagen.png", "logo.svg"]);
    expect((doc as OpenedMarkdown).resources.base).toBe("");
  });

  it("varios Markdown: several-markdown", async () => {
    const e = await error(
      abrirSeleccion(ficheros(fichero("a.md", "a"), fichero("b.md", "b"), fichero("i.png", "x"))),
    );
    expect(e.code).toBe("several-markdown");
  });

  it("solo imágenes: no-markdown", async () => {
    const e = await error(abrirSeleccion(ficheros(fichero("i.png", "x"), fichero("j.png", "y"))));
    expect(e.code).toBe("no-markdown");
  });

  it("un PDF acompañado, o un fichero de otro tipo: incompatible, con su nombre", async () => {
    const pdf = await error(
      abrirSeleccion(ficheros(fichero("a.md", "a"), fichero("b.pdf", PDF_VALIDO))),
    );
    expect(pdf).toMatchObject({ code: "incompatible", fileName: "b.pdf" });
    const txt = await error(abrirSeleccion(ficheros(fichero("a.md", "a"), fichero("n.txt", "t"))));
    expect(txt).toMatchObject({ code: "incompatible", fileName: "n.txt" });
  });

  it("el nombre del fichero incompatible se sanea (sin marcas bidireccionales)", async () => {
    const e = await error(abrirSeleccion(ficheros(fichero("a.md", "a"), fichero("x‮gnp.exe", "t"))));
    expect(e.fileName).toBe("xgnp.exe");
  });

  it("un Markdown no válido sigue dando su error aunque vaya acompañado", async () => {
    const e = await error(abrirSeleccion(ficheros(fichero("a.md", ""), fichero("i.png", "x"))));
    expect(e.code).toBe("empty");
  });
});

describe("abrirSeleccion: carpeta", () => {
  it("sin nada útil o sin Markdown: folder-no-markdown", async () => {
    expect((await error(abrirSeleccion(carpeta({})))).code).toBe("folder-no-markdown");
    expect((await error(abrirSeleccion(carpeta({ "a.png": "x" })))).code).toBe(
      "folder-no-markdown",
    );
  });

  it("un Markdown: se abre, con las imágenes de toda la carpeta y su directorio como base", async () => {
    const doc = await abrirSeleccion(
      carpeta({
        "docs/README.md": "# r",
        "docs/img/logo.png": "x",
        "assets/diagrama.svg": "<svg/>",
        "notas.txt": "t",
      }),
    );
    expect(doc).toMatchObject({ kind: "markdown", name: "README.md" });
    expect(claves(doc)).toEqual(["assets/diagrama.svg", "docs/img/logo.png"]);
    expect((doc as OpenedMarkdown).resources.base).toBe("docs");
  });

  it("varios Markdown: pide elegir, sin leer ninguno hasta entonces", async () => {
    const leidos: string[] = [];
    const sel = carpeta({ "z.md": "# z", "docs/b.md": "# b", "a.md": "# a", "i.png": "x" });
    for (const e of sel.entregados) {
      const original = e.file.arrayBuffer.bind(e.file);
      e.file.arrayBuffer = () => {
        leidos.push(e.ruta);
        return original();
      };
    }
    const eleccion = (await abrirSeleccion(sel)) as EleccionMarkdown;
    expect(eleccion.kind).toBe("choose-markdown");
    expect(eleccion.candidates).toEqual(["a.md", "z.md", "docs/b.md"]);
    expect(leidos).toEqual([]);
    const doc = await eleccion.choose(2);
    expect(doc).toMatchObject({ kind: "markdown", name: "b.md", text: "# b" });
    expect(leidos).toEqual(["docs/b.md"]);
    expect(claves(doc)).toEqual(["i.png"]);
    expect((doc as OpenedMarkdown).resources.base).toBe("docs");
    await expect(eleccion.choose(9)).rejects.toBeInstanceOf(DocumentError);
  });

  it("las rutas candidatas se sanean para mostrarlas", async () => {
    const eleccion = (await abrirSeleccion(
      carpeta({ "a‮/x.md": "x", "b.md": "b" }),
    )) as EleccionMarkdown;
    expect(eleccion.candidates).toEqual(["b.md", "a/x.md"]);
  });

  it("más de MAX_FICHEROS_CARPETA ficheros: folder-too-large, sin abrir nada", async () => {
    const entregados = Array.from({ length: MAX_FICHEROS_CARPETA + 1 }, (_, i) => ({
      ruta: `i${i}.png`,
      file: fichero(`i${i}.png`, "x"),
    }));
    const e = await error(abrirSeleccion({ origen: "carpeta", entregados }));
    expect(e.code).toBe("folder-too-large");
  });
});
