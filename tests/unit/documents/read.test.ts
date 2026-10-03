import { describe, expect, it } from "vitest";
import { DocumentError } from "@/documents/errors";
import { MAX_BYTES } from "@/documents/limits";
import { type LocalFile, readDocument } from "@/documents/read";
import { BYTES_PNG, fichero, PDF_VALIDO } from "../../helpers/documentos";

/** El código del `DocumentError` con el que se rechaza, o falla si no se rechaza así. */
async function rechazo(file: LocalFile): Promise<DocumentError> {
  try {
    await readDocument(file);
  } catch (e) {
    expect(e).toBeInstanceOf(DocumentError);
    return e as DocumentError;
  }
  throw new Error("readDocument no rechazó el fichero");
}

/**
 * Un «fichero» que dice tener `size` bytes sin ocuparlos: para probar los
 * límites (512 MiB) sin reservar esa memoria.
 */
function ficheroDeTamano(name: string, size: number, contenido: string): LocalFile {
  const real = fichero(name, contenido);
  return { name, size, slice: real.slice.bind(real), arrayBuffer: () => real.arrayBuffer() };
}

describe("readDocument: PDF", () => {
  it("acepta un PDF y conserva su contenido como Blob, sin convertirlo a texto", async () => {
    const doc = await readDocument(fichero("informe.pdf", PDF_VALIDO));
    expect(doc).toMatchObject({ kind: "pdf", name: "informe.pdf", size: PDF_VALIDO.length });
    if (doc.kind !== "pdf") throw new Error("tipo inesperado");
    expect(doc.blob).toBeInstanceOf(Blob);
    expect(await doc.blob.text()).toBe(PDF_VALIDO);
    expect(doc).not.toHaveProperty("text");
  });

  it("solo lee la cabecera para validar un PDF, no el fichero entero", async () => {
    const real = fichero("grande.pdf", PDF_VALIDO + "x".repeat(10_000));
    const leidos: number[] = [];
    const espia: LocalFile = {
      name: real.name,
      size: real.size,
      arrayBuffer: () => {
        leidos.push(real.size);
        return real.arrayBuffer();
      },
      slice: (inicio?: number, fin?: number) => {
        const trozo = real.slice(inicio, fin);
        return Object.assign(trozo, {
          arrayBuffer: () => {
            leidos.push(trozo.size);
            return Blob.prototype.arrayBuffer.call(trozo);
          },
        });
      },
    };
    await readDocument(espia);
    expect(leidos).toEqual([1024]);
  });

  it("no se fía del MIME: un .pdf declarado como text/plain pero con contenido PDF vale", async () => {
    const doc = await readDocument(fichero("a.pdf", PDF_VALIDO, "text/plain"));
    expect(doc.kind).toBe("pdf");
  });

  it("rechaza con not-pdf un PNG renombrado a .pdf", async () => {
    expect((await rechazo(fichero("foto.pdf", BYTES_PNG, "application/pdf"))).code).toBe("not-pdf");
  });
});

describe("readDocument: Markdown", () => {
  it("acepta .md y .markdown y entrega solo su texto", async () => {
    const md = await readDocument(fichero("notas.md", "# Hola\n\n«año»"));
    expect(md).toMatchObject({ kind: "markdown", name: "notas.md", text: "# Hola\n\n«año»" });
    expect(md).not.toHaveProperty("blob");
    const markdown = await readDocument(fichero("notas.markdown", "texto"));
    expect(markdown.kind).toBe("markdown");
  });

  it("no ejecuta ni interpreta el contenido: el HTML y los scripts llegan como texto", async () => {
    const hostil = "<script>globalThis.__bpdfXss = true</script>\n<img src=x onerror=alert(1)>";
    const doc = await readDocument(fichero("hostil.md", hostil));
    expect(doc.kind === "markdown" && doc.text).toBe(hostil);
    expect((globalThis as { __bpdfXss?: boolean }).__bpdfXss).toBeUndefined();
  });

  it("rechaza con not-utf8 un Markdown en UTF-16", async () => {
    const utf16 = new Uint8Array([0xff, 0xfe, 0x23, 0x00, 0x20, 0x00, 0x68, 0x00]);
    expect((await rechazo(fichero("utf16.md", utf16))).code).toBe("not-utf8");
  });

  it("no se fía del MIME: un .txt declarado como text/markdown no vale", async () => {
    expect((await rechazo(fichero("nota.txt", "# hola", "text/markdown"))).code).toBe(
      "unsupported",
    );
  });
});

describe("readDocument: errores comunes", () => {
  it.each(["nota.txt", "foto.png", "sin-extension", "informe.pdf.exe"])(
    "rechaza %s con unsupported sin leerlo",
    async (nombre) => {
      const e = await rechazo(fichero(nombre, PDF_VALIDO));
      expect(e.code).toBe("unsupported");
      expect(e.fileName).toBe(nombre);
    },
  );

  it.each(["vacio.pdf", "vacio.md"])("rechaza %s (0 bytes) con empty", async (nombre) => {
    expect((await rechazo(fichero(nombre))).code).toBe("empty");
  });

  it.each([
    ["pdf", "limite.pdf", PDF_VALIDO],
    ["markdown", "limite.md", "# hola"],
  ] as const)(
    "acepta un %s justo en el límite y rechaza uno 1 byte por encima",
    async (tipo, nombre, contenido) => {
      const enElLimite = ficheroDeTamano(nombre, MAX_BYTES[tipo], contenido);
      expect((await readDocument(enElLimite)).kind).toBe(tipo);

      const porEncima = ficheroDeTamano(nombre, MAX_BYTES[tipo] + 1, contenido);
      const e = await rechazo(porEncima);
      expect(e.code).toBe("too-large");
      expect(e.kind).toBe(tipo);
    },
  );

  it("los límites son 512 MiB para PDF y 20 MiB para Markdown", () => {
    expect(MAX_BYTES).toEqual({ pdf: 512 * 1024 * 1024, markdown: 20 * 1024 * 1024 });
  });

  it.each(["roto.pdf", "roto.md"])(
    "convierte un fallo de lectura en unreadable (%s)",
    async (nombre) => {
      const fallo = new DOMException("El fichero cambió en disco", "NotReadableError");
      const ilegible: LocalFile = {
        name: nombre,
        size: 100,
        arrayBuffer: () => Promise.reject(fallo),
        slice: () => ({ arrayBuffer: () => Promise.reject(fallo) }) as unknown as Blob,
      };
      const e = await rechazo(ilegible);
      expect(e.code).toBe("unreadable");
      expect(e.cause).toBe(fallo);
    },
  );

  it("valida la extensión sobre el nombre saneado, el mismo que se muestra", async () => {
    const RLO = String.fromCodePoint(0x202e);
    const doc = await readDocument(fichero(`informe${RLO}fdp.md`, "# texto"));
    expect(doc).toMatchObject({ kind: "markdown", name: "informefdp.md" });
  });

  it("da a cada documento un id distinto que no deriva de su nombre", async () => {
    const a = await readDocument(fichero("mismo.md", "a"));
    const b = await readDocument(fichero("mismo.md", "a"));
    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toContain("mismo");
  });

  it("usa el id que se le dé, en vez del suyo", async () => {
    const doc = await readDocument(fichero("a.md", "a"), "id-del-main");
    expect(doc.id).toBe("id-del-main");
  });
});
