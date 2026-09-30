import { describe, expect, it } from "vitest";
import { MAX_BYTES_IMAGEN } from "@/documents/limits";
import {
  crearRecursos,
  directorio,
  normalizarRuta,
  resolverRecurso,
  tipoImagen,
} from "@/documents/recursos";

/**
 * Recursos locales (Fase 7 bis). La regla que se prueba: una referencia del
 * documento solo puede acabar en un fichero que el usuario ENTREGÓ, y nunca
 * fuera del conjunto, lo escriba como lo escriba.
 */
const f = (size = 10) => ({
  size,
  slice: (_inicio?: number, _fin?: number, tipo?: string) => new Blob([], { type: tipo }),
});

function recursos(rutas: string[], base = "") {
  return crearRecursos(
    rutas.map((ruta) => ({ ruta, file: f() })),
    base,
  );
}

const estado = (ref: string, r = PLANO) => resolverRecurso(ref, r).estado;
const ruta = (ref: string, r = PLANO) => {
  const res = resolverRecurso(ref, r);
  return res.estado === "ok" ? res.recurso.ruta : res.estado;
};

// Selección plana: el .md y sus imágenes, todos en la raíz.
const PLANO = recursos([
  "imagen.png",
  "logo.svg",
  "foto grande.jpg",
  "año ñandú 🙂.png",
  "a.gif",
  "b.webp",
]);
// Carpeta: el .md en `docs/`, imágenes por toda la carpeta.
const CARPETA = recursos(
  ["docs/img/uno.png", "img/dos.png", "docs/tres.png", "raiz.png", "images/foto.jpg"],
  "docs",
);

describe("tipoImagen", () => {
  it.each([
    ["a.png", "png"],
    ["a.PNG", "png"],
    ["a.jpg", "jpeg"],
    ["a.JPEG", "jpeg"],
    ["a.gif", "gif"],
    ["a.webp", "webp"],
    ["a.svg", "svg"],
  ])("%s → %s", (nombre, tipo) => {
    expect(tipoImagen(nombre)).toBe(tipo);
  });

  it.each(["a.bmp", "a.tiff", "a.md", "a.pdf", "png", "a.png/b", ".png.txt", "a.svgz", "a.html"])(
    "%s no es una imagen admitida",
    (nombre) => {
      expect(tipoImagen(nombre)).toBeNull();
    },
  );
});

describe("normalizarRuta", () => {
  it("quita vacíos y puntos, aplica .. y normaliza a NFC", () => {
    expect(normalizarRuta("./a//b/./c.png".split("/"))).toBe("a/b/c.png");
    expect(normalizarRuta("a/b/../c.png".split("/"))).toBe("a/c.png");
    expect(normalizarRuta(["a\u0301.png"])).toBe("\u00e1.png");
  });

  it("devuelve null si sube por encima de la raíz", () => {
    expect(normalizarRuta("../a.png".split("/"))).toBeNull();
    expect(normalizarRuta("a/../../a.png".split("/"))).toBeNull();
  });

  it("directorio", () => {
    expect(directorio("docs/a.md")).toBe("docs");
    expect(directorio("a.md")).toBe("");
  });
});

describe("resolverRecurso: lo que sí resuelve", () => {
  it.each([
    ["imagen.png", "imagen.png"],
    ["./imagen.png", "imagen.png"],
    [".//imagen.png", "imagen.png"],
    ["logo.svg", "logo.svg"],
    ["foto%20grande.jpg", "foto grande.jpg"],
    ["foto grande.jpg", "foto grande.jpg"],
    ["a%C3%B1o%20%C3%B1and%C3%BA%20%F0%9F%99%82.png", "año ñandú 🙂.png"],
    ["año ñandú 🙂.png", "año ñandú 🙂.png"],
    ["an\u0303o n\u0303andu\u0301 🙂.png", "año ñandú 🙂.png"], // NFD → NFC
    ["imagen.png?v=2", "imagen.png"],
    ["imagen.png#fragmento", "imagen.png"],
    ["a.gif", "a.gif"],
    ["b.webp", "b.webp"],
  ])("%j → %j", (ref, esperada) => {
    expect(ruta(ref)).toBe(esperada);
  });

  it("en una carpeta, relativo al directorio del .md, también subiendo dentro de ella", () => {
    expect(ruta("img/uno.png", CARPETA)).toBe("docs/img/uno.png");
    expect(ruta("./tres.png", CARPETA)).toBe("docs/tres.png");
    expect(ruta("../img/dos.png", CARPETA)).toBe("img/dos.png");
    expect(ruta("../raiz.png", CARPETA)).toBe("raiz.png");
    expect(ruta("img/../tres.png", CARPETA)).toBe("docs/tres.png");
    expect(ruta("../images/foto.jpg", CARPETA)).toBe("images/foto.jpg");
  });
});

describe("resolverRecurso: traversal y rutas fuera del conjunto", () => {
  it.each([
    "../imagen.png",
    "../../imagen.png",
    "./../imagen.png",
    "a/../../imagen.png",
    "%2e%2e/imagen.png",
    "%2E%2E/imagen.png",
    ".%2e/imagen.png",
    "%2e%2e%2fimagen.png",
    "..%2fimagen.png",
    "/imagen.png",
    "//imagen.png",
    "%2fimagen.png",
    "/etc/passwd.png",
    "C:\\Users\\x\\imagen.png",
    "C:/imagen.png",
    "c:imagen.png",
    "..\\imagen.png",
    "img\\imagen.png",
    "%5c..%5cimagen.png",
    "file:///etc/imagen.png",
    "file:imagen.png",
    "data:image/png;base64,iVBORw0KGgo=",
    "javascript:alert(1)//.png",
    "blob:https://x/uuid",
    "https://example.com/imagen.png",
  ])("%j queda fuera", (ref) => {
    expect(estado(ref)).toBe("fuera");
  });

  it("desde un .md en docs/, subir por encima de la carpeta elegida queda fuera", () => {
    expect(estado("../../raiz.png", CARPETA)).toBe("fuera");
    expect(estado("../../../etc/passwd.png", CARPETA)).toBe("fuera");
  });

  it("un escape doble no se decodifica dos veces: %252e%252e es un nombre, no ..", () => {
    expect(estado("%252e%252e/imagen.png")).toBe("no-encontrado");
  });
});

describe("resolverRecurso: el resto de estados", () => {
  it("una ruta válida que no se entregó: no-encontrado (no se busca en disco)", () => {
    expect(estado("otra.png")).toBe("no-encontrado");
    expect(estado("Imagen.png")).toBe("no-encontrado"); // mayúsculas exactas
    expect(estado("images/imagen.png")).toBe("no-encontrado"); // plano: sin subcarpetas
  });

  it("formatos no admitidos", () => {
    expect(estado("doc.md")).toBe("no-soportado");
    expect(estado("x.bmp")).toBe("no-soportado");
    expect(estado("sin-extension")).toBe("no-soportado");
  });

  it("rutas que no se pueden interpretar", () => {
    for (const ref of ["", " ", ".", "./", "%", "%zz.png", "a\u0000.png", "a%00.png", "a%0a.png"]) {
      expect(estado(ref), ref).toBe("invalido");
    }
    expect(resolverRecurso(undefined, PLANO).estado).toBe("invalido");
    expect(resolverRecurso(42, PLANO).estado).toBe("invalido");
  });

  it("dos ficheros entregados que corresponden a la misma ruta: ambiguo, no se elige", () => {
    const r = recursos(["caf\u00e9.png", "cafe\u0301.png", "otra.png"]);
    expect(estado("café.png", r)).toBe("ambiguo");
    expect(estado("otra.png", r)).toBe("ok");
  });

  it("una imagen que supera el máximo: demasiado-grande", () => {
    const r = crearRecursos([{ ruta: "enorme.png", file: f(MAX_BYTES_IMAGEN + 1) }], "");
    expect(estado("enorme.png", r)).toBe("demasiado-grande");
  });
});

describe("crearRecursos", () => {
  it("solo imágenes admitidas, con el tipo MIME de su extensión, sin leer nada", () => {
    let leidos = 0;
    const file = (size: number) => ({
      size,
      slice: (inicio?: number, fin?: number, tipo?: string) => {
        expect([inicio, fin]).toEqual([0, size]);
        return new Blob([], { type: tipo });
      },
      arrayBuffer: () => {
        leidos++;
        return Promise.resolve(new ArrayBuffer(0));
      },
    });
    const r = crearRecursos(
      [
        { ruta: "a.png", file: file(1) },
        { ruta: "b.SVG", file: file(2) },
        { ruta: "doc.md", file: file(3) },
        { ruta: "notas.txt", file: file(4) },
      ],
      "",
    );
    expect([...r.ficheros.keys()]).toEqual(["a.png", "b.SVG"]);
    expect(r.ficheros.get("a.png")?.blob.type).toBe("image/png");
    expect(r.ficheros.get("b.SVG")?.blob.type).toBe("image/svg+xml");
    expect(r.ficheros.get("b.SVG")?.tipo).toBe("svg");
    expect(leidos).toBe(0);
  });

  it("descarta rutas que la plataforma diera fuera de la raíz y normaliza la base", () => {
    const r = crearRecursos(
      [
        { ruta: "../fuera.png", file: f() },
        { ruta: "a/./b.png", file: f() },
      ],
      "docs/./",
    );
    expect([...r.ficheros.keys()]).toEqual(["a/b.png"]);
    expect(r.base).toBe("docs");
  });
});
