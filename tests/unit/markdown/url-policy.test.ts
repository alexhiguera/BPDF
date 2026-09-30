import { describe, expect, it } from "vitest";
import { clasificarEnlace, clasificarImagen, transformarUrl } from "@/markdown/url-policy";

/**
 * La política de URLs de un Markdown (docs/SEGURIDAD.md §3.1–3.3). Solo
 * `externo` y `ancla` acaban en un `href`: todo lo hostil tiene que caer en
 * `bloqueado` o, como mucho, en `relativo` (que se pinta como texto).
 */
const NUNCA_HREF = new Set(["bloqueado", "relativo"]);

describe("clasificarEnlace: permitidos", () => {
  it.each([
    ["https://example.com/a?b=1#c", "https://example.com/a?b=1#c"],
    ["http://example.com", "http://example.com/"],
    ["HTTPS://EXAMPLE.COM/x", "https://example.com/x"],
    ["  https://example.com/espacios  ", "https://example.com/espacios"],
    ["mailto:hola@example.com", "mailto:hola@example.com"],
  ])("%s es externo", (url, normalizada) => {
    expect(clasificarEnlace(url)).toEqual({ tipo: "externo", url: normalizada });
  });

  it("un fragmento es un ancla, decodificado", () => {
    expect(clasificarEnlace("#uso")).toEqual({ tipo: "ancla", fragmento: "uso" });
    expect(clasificarEnlace("#instalaci%C3%B3n")).toEqual({
      tipo: "ancla",
      fragmento: "instalación",
    });
    expect(clasificarEnlace("#100%")).toEqual({ tipo: "ancla", fragmento: "100%" });
  });

  it("una ruta relativa se reconoce (y no se navega)", () => {
    expect(clasificarEnlace("otro.md")).toEqual({ tipo: "relativo", ruta: "otro.md" });
    expect(clasificarEnlace("./docs/a.md#x")).toEqual({ tipo: "relativo", ruta: "./docs/a.md#x" });
    expect(clasificarEnlace("../a.md")).toEqual({ tipo: "relativo", ruta: "../a.md" });
  });
});

describe("clasificarEnlace: hostiles", () => {
  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "JaVaScRiPt:alert(1)",
    " javascript:alert(1)",
    "\u0001javascript:alert(1)",
    "\u0000javascript:alert(1)",
    "java\tscript:alert(1)",
    "java\nscript:alert(1)",
    "java\rscript:alert(1)",
    "javascript\t:alert(1)",
    "vbscript:msgbox(1)",
    "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
    "DATA:text/html,<script>alert(1)</script>",
    "file:///etc/passwd",
    "blob:https://example.com/uuid",
    "ftp://example.com/x",
    "intent://x#Intent;end",
    "chrome://settings",
    "about:blank",
    "C:\\Windows\\x.md",
    "c:/x.md",
    "https://usuario:clave@example.com/",
    "https://",
    "//tracker.example/x",
    "/etc/passwd",
    "\\\\servidor\\x",
    "",
    "#",
    `https://example.com/${"a".repeat(2100)}`,
  ])("%j queda bloqueado", (url) => {
    expect(clasificarEnlace(url)).toEqual({ tipo: "bloqueado" });
  });

  it.each([
    // Formas que un navegador NO lee como `javascript:` (la entidad sin
    // decodificar, el escape por ciento): relativas, sin `href`.
    "java&#x73;cript:alert(1)",
    "jav&#x61;script:alert(1)",
    "&#106;avascript:alert(1)",
    "javascript&#58;alert(1)",
    "javascript&colon;alert(1)",
    "%6Aavascript:alert(1)",
    "java\u00a0script:alert(1)",
  ])("%j nunca da un href", (url) => {
    expect(NUNCA_HREF.has(clasificarEnlace(url).tipo)).toBe(true);
  });

  it("lo que no es una cadena queda bloqueado", () => {
    for (const valor of [undefined, null, 1, {}, ["https://example.com"]]) {
      expect(clasificarEnlace(valor)).toEqual({ tipo: "bloqueado" });
    }
  });
});

describe("clasificarImagen", () => {
  it("una ruta relativa es local", () => {
    expect(clasificarImagen("./logo.png")).toEqual({ tipo: "local", ruta: "./logo.png" });
    expect(clasificarImagen("images/example.jpg")).toEqual({
      tipo: "local",
      ruta: "images/example.jpg",
    });
  });

  it("http y https son remotas (y no se cargarán)", () => {
    expect(clasificarImagen("https://tracker.example/p.gif")).toEqual({
      tipo: "remota",
      url: "https://tracker.example/p.gif",
    });
    expect(clasificarImagen("http://tracker.example/p.gif").tipo).toBe("remota");
  });

  it.each([
    "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+",
    "data:image/png;base64,iVBORw0KGgo=",
    "mailto:a@example.com",
    "file:///etc/x.png",
    "/etc/x.png",
    "C:\\x.png",
    "//tracker.example/p.gif",
    "#ancla",
    "",
  ])("%j queda bloqueada", (url) => {
    expect(clasificarImagen(url)).toEqual({ tipo: "bloqueada" });
  });
});

describe("transformarUrl (urlTransform de react-markdown)", () => {
  it("vacía lo bloqueado y deja pasar lo demás para que los componentes decidan", () => {
    expect(transformarUrl("javascript:alert(1)")).toBe("");
    expect(transformarUrl("java\tscript:alert(1)")).toBe("");
    expect(transformarUrl("data:text/html,x")).toBe("");
    expect(transformarUrl("https://example.com/")).toBe("https://example.com/");
    expect(transformarUrl("#uso")).toBe("#uso");
    expect(transformarUrl("./a.png")).toBe("./a.png");
  });
});
