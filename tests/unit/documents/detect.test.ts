import { describe, expect, it } from "vitest";
import {
  ACCEPT,
  decodeMarkdown,
  displayName,
  hasPdfSignature,
  kindFromName,
} from "@/documents/detect";
import { DocumentError } from "@/documents/errors";
import { PDF_SIGNATURE_WINDOW } from "@/documents/limits";
import { BYTES_PNG } from "../../helpers/documentos";

const bytes = (s: string) => new TextEncoder().encode(s);
const RLO = String.fromCodePoint(0x202e); // «right-to-left override»

describe("kindFromName", () => {
  it.each([
    ["informe.pdf", "pdf"],
    ["INFORME.PDF", "pdf"],
    ["notas.md", "markdown"],
    ["notas.MD", "markdown"],
    ["notas.markdown", "markdown"],
    ["versión 2.final.md", "markdown"],
  ])("%s → %s", (nombre, tipo) => {
    expect(kindFromName(nombre)).toBe(tipo);
  });

  it.each(["nota.txt", "imagen.png", "pdf", "md", "sin-extension", "informe.pdf.exe", "doc.mdx"])(
    "%s no es un tipo admitido",
    (nombre) => {
      expect(kindFromName(nombre)).toBeNull();
    },
  );

  it("el filtro del selector lista exactamente las extensiones admitidas", () => {
    expect(ACCEPT).toBe(".pdf,.md,.markdown");
  });
});

describe("hasPdfSignature", () => {
  it("reconoce un PDF que empieza por %PDF-", () => {
    expect(hasPdfSignature(bytes("%PDF-1.7\n..."))).toBe(true);
  });

  it("acepta basura antes de la firma si está dentro de los primeros 1024 bytes", () => {
    const delante = "x".repeat(PDF_SIGNATURE_WINDOW - 5);
    expect(hasPdfSignature(bytes(`${delante}%PDF-`))).toBe(true);
  });

  it("no la busca más allá de los primeros 1024 bytes", () => {
    const delante = "x".repeat(PDF_SIGNATURE_WINDOW - 4);
    expect(hasPdfSignature(bytes(`${delante}%PDF-1.7`))).toBe(false);
  });

  it("rechaza un PNG, un texto que solo menciona PDF, una firma incompleta y nada", () => {
    expect(hasPdfSignature(BYTES_PNG)).toBe(false);
    expect(hasPdfSignature(bytes("esto es un PDF"))).toBe(false);
    expect(hasPdfSignature(bytes("%PDF"))).toBe(false);
    expect(hasPdfSignature(new Uint8Array())).toBe(false);
  });
});

describe("decodeMarkdown", () => {
  it("decodifica UTF-8 con caracteres no ASCII", () => {
    expect(decodeMarkdown(bytes("# Año\n\n«pingüino» 🐧"))).toBe("# Año\n\n«pingüino» 🐧");
  });

  it("quita el BOM de UTF-8", () => {
    const conBom = new Uint8Array([0xef, 0xbb, 0xbf, ...bytes("# hola")]);
    expect(decodeMarkdown(conBom)).toBe("# hola");
  });

  const noUtf8: [string, Uint8Array][] = [
    ["UTF-16 LE con BOM", new Uint8Array([0xff, 0xfe, 0x23, 0x00, 0x20, 0x00, 0x68, 0x00])],
    ["UTF-16 LE sin BOM (NUL entre letras)", new Uint8Array([0x23, 0x00, 0x20, 0x00, 0x68, 0x00])],
    ["Latin-1 («año» con ñ = F1)", new Uint8Array([0x61, 0xf1, 0x6f])],
    ["un binario (PNG)", BYTES_PNG],
  ];
  it.each(noUtf8)("rechaza %s con not-utf8", (_, contenido) => {
    expect(() => decodeMarkdown(contenido, "x.md")).toThrow(DocumentError);
    try {
      decodeMarkdown(contenido, "x.md");
    } catch (e) {
      expect((e as DocumentError).code).toBe("not-utf8");
      expect((e as DocumentError).fileName).toBe("x.md");
    }
  });
});

describe("displayName", () => {
  const F = "Sin nombre";

  it("deja intacto un nombre normal, con espacios, Unicode y símbolos de HTML", () => {
    expect(displayName(`Informe "final" <v2> & 'año' 🙂.pdf`, F)).toBe(
      `Informe "final" <v2> & 'año' 🙂.pdf`,
    );
  });

  it("quita cualquier ruta que venga delante", () => {
    expect(displayName("/home/ana/secreto/notas.md", F)).toBe("notas.md");
  });

  it("conserva la barra invertida, válida en nombres de Linux", () => {
    expect(displayName("a\\b.md", F)).toBe("a\\b.md");
  });

  it("quita caracteres de control y de dirección de texto (nombre que finge otra extensión)", () => {
    const tramposo = `informe${RLO}fdp.md`; // se vería como «informedm.pdf»
    expect(displayName(tramposo, F)).toBe("informefdp.md");
    expect(displayName("a\tb\nc\u0000.md", F)).toBe("abc.md");
  });

  it("normaliza a NFC (una «ñ» descompuesta y una compuesta son la misma)", () => {
    expect(displayName("an\u0303o.md", F)).toBe("año.md");
  });

  it("usa el nombre de reserva si no queda nada", () => {
    expect(displayName("", F)).toBe(F);
    expect(displayName(`  ${RLO} `, F)).toBe(F);
    expect(displayName("carpeta/", F)).toBe(F);
  });
});
