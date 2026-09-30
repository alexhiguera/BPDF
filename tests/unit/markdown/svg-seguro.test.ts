// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { sanearSvg, verificarSvg } from "@/markdown/svg-seguro";

/**
 * El SVG de Mermaid como superficie de seguridad (Fase 8). `sanearSvg` corre
 * en el marco aislado; `verificarSvg`, en la app, sobre lo que el marco
 * devuelve. Aquí los dos con SVG hostiles.
 */
const NS = 'xmlns="http://www.w3.org/2000/svg"';
const svg = (dentro: string, raiz = "") =>
  `<svg ${NS} viewBox="0 0 200 100" width="100%" style="max-width: 200px"${raiz}>${dentro}</svg>`;

describe("sanearSvg (en el marco)", () => {
  it("conserva el dibujo, su <style> y fija el tamaño del viewBox", () => {
    const limpio = sanearSvg(
      svg(
        '<style>.a{fill:red}</style><g class="a"><rect width="10" height="10"/><text>Hola</text></g>',
      ),
    ) as string;
    expect(limpio).toContain("<rect");
    expect(limpio).toContain("<style>.a{fill:red}</style>");
    expect(limpio).toContain('width="200"');
    expect(limpio).toContain('height="100"');
    expect(limpio).not.toContain("max-width");
    expect(verificarSvg(limpio)).toBe(true);
  });

  it.each([
    ["script", "<script>alert(1)</script><rect/>"],
    [
      "foreignObject con HTML",
      '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml"><img src="x" onerror="alert(1)"/></div></foreignObject>',
    ],
    ["image externa", '<image href="https://tracker.example/x.png"/>'],
    ["iframe", '<iframe xmlns="http://www.w3.org/1999/xhtml" src="https://tracker.example"/>'],
    [
      "animate que cambia un href",
      '<a href="#x"><animate attributeName="href" to="javascript:alert(1)"/></a>',
    ],
    ["set", '<set attributeName="onmouseover" to="alert(1)"/>'],
  ])("quita %s con su contenido", (_caso, dentro) => {
    const limpio = sanearSvg(svg(dentro)) as string;
    expect(limpio).not.toMatch(/<(script|foreignObject|image|iframe|animate|set)\b/i);
    expect(limpio).not.toMatch(/alert|tracker/);
    expect(verificarSvg(limpio)).toBe(true);
  });

  it("desenvuelve los enlaces: queda el contenido, sin enlace", () => {
    const limpio = sanearSvg(
      svg(
        '<a href="javascript:alert(1)"><text>pulsa</text></a><a xlink:href="https://x"><rect/></a>',
        ' xmlns:xlink="http://www.w3.org/1999/xlink"',
      ),
    ) as string;
    expect(limpio).not.toMatch(/<a[\s>]/);
    expect(limpio).toContain("<text>pulsa</text>");
    expect(limpio).not.toContain("javascript");
  });

  it("quita atributos de evento, href externos y valores peligrosos", () => {
    const limpio = sanearSvg(
      svg(
        '<rect onclick="alert(1)" onload="alert(2)" fill="url(https://tracker.example/f)" stroke="url(#ok)"/>' +
          '<use href="#simbolo"/><use href="https://tracker.example/a.svg#x"/>' +
          '<rect style="background:url(https://tracker.example/s.png)" mask="url(data:image/png;base64,AA)"/>',
        ' onload="alert(3)"',
      ),
    ) as string;
    expect(limpio).not.toMatch(/\son\w+=/);
    expect(limpio).not.toContain("tracker");
    expect(limpio).not.toContain("data:");
    expect(limpio).toContain('stroke="url(#ok)"');
    expect(limpio).toContain('href="#simbolo"');
    expect(verificarSvg(limpio)).toBe(true);
  });

  it("limpia el CSS: sin @import ni url() externas", () => {
    const limpio = sanearSvg(
      svg(
        "<style>@import url(https://tracker.example/a.css); .n{fill:url(https://tracker.example/b.png)} .m{fill:url(#g)}</style>",
      ),
    ) as string;
    expect(limpio).not.toContain("@import");
    expect(limpio).not.toContain("tracker");
    expect(limpio).toContain("url(#g)");
  });

  it("quita comentarios e instrucciones de proceso", () => {
    const limpio = sanearSvg(
      svg("<!-- <script>alert(1)</script> --><?xml-stylesheet href='https://x'?><rect/>"),
    ) as string;
    expect(limpio).not.toMatch(/<!--|<\?/);
    expect(verificarSvg(limpio)).toBe(true);
  });

  it.each([
    ["no es XML", "<svg><rect></svg"],
    ["raíz que no es svg", `<html ${NS}><body/></html>`],
    ["svg sin espacio de nombres", "<svg><rect/></svg>"],
    ["vacío", ""],
  ])("rechaza %s", (_caso, entrada) => {
    expect(sanearSvg(entrada)).toBeNull();
  });
});

describe("verificarSvg (en la app, sin DOM)", () => {
  const bueno = svg('<style>.a{fill:#fff}</style><g id="x"><rect width="1"/><use href="#x"/></g>');

  it("acepta un SVG saneado", () => {
    expect(verificarSvg(bueno)).toBe(true);
  });

  it.each([
    ["script", svg("<script>alert(1)</script>")],
    ["script en mayúsculas", svg("<SCRIPT>alert(1)</SCRIPT>")],
    ["foreignObject", svg("<foreignObject/>")],
    ["image", svg('<image href="#x"/>')],
    ["a", svg('<a href="#x"/>')],
    ["elemento desconocido", svg("<blink/>")],
    ["atributo de evento", svg('<rect onload="alert(1)"/>')],
    ["atributo de evento en mayúsculas", svg('<rect OnClick="alert(1)"/>')],
    ["href externo", svg('<use href="https://tracker.example/x.svg#a"/>')],
    ["xlink:href javascript", svg('<use xlink:href="javascript:alert(1)"/>')],
    ["href con entidad", svg('<use href="&#35;x"/>')],
    ["javascript en un atributo", svg('<rect fill="javascript:alert(1)"/>')],
    ["javascript con entidades", svg('<rect fill="&#106;avascript:alert(1)"/>')],
    ["data: en un atributo", svg('<rect mask="url(data:image/png;base64,AA)"/>')],
    ["url() externa", svg('<rect fill="url(https://tracker.example/x)"/>')],
    ["@import en <style>", svg("<style>@import url(https://tracker.example/x.css);</style>")],
    ["url() externa en <style>", svg("<style>.a{fill:url(https://tracker.example/x)}</style>")],
    [
      "url() con entidades en <style>",
      svg("<style>.a{fill:url(&#104;ttps://tracker.example/x)}</style>"),
    ],
    ["comentario", svg("<!-- x --><rect/>")],
    ["CDATA", svg("<style><![CDATA[.a{}]]></style>")],
    ["DOCTYPE", `<!DOCTYPE svg [<!ENTITY x "y">]>${svg("<rect/>")}`],
    ["instrucción de proceso", svg("<?x y?><rect/>")],
    ["atributo sin comillas dobles", svg("<rect fill='red'/>")],
    ["> suelto en texto", svg("<text>a > b</text>")],
    ["raíz que no es svg", `<g ${NS}/>`],
    ["sin espacio de nombres", "<svg><rect/></svg>"],
    ["no es texto", 42 as unknown as string],
  ])("rechaza: %s", (_caso, entrada) => {
    expect(verificarSvg(entrada)).toBe(false);
  });
});
