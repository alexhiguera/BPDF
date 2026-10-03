import { type Page, test } from "@playwright/test";

/**
 * Carga la app vigilando tres cosas que ninguna otra puerta ve: errores en
 * consola, violaciones de CSP y peticiones fuera del propio origen
 * (docs/SEGURIDAD.md §2 y §6). Cada spec comprueba al final que las tres listas
 * siguen vacías.
 */
export type Vigilancia = {
  errores: string[];
  violaciones: string[];
  externas: string[];
  /** Avisos del navegador que no son fallos de BPDF (`AVISOS_CONOCIDOS`): se guardan aparte. */
  conocidos: string[];
};

/**
 * Avisos de consola de un navegador que NO son fallos de BPDF (Fase 13, compatibilidad).
 * Cada uno, con su motivo; ninguno es una violación de CSP (esas van aparte y siempre
 * cuentan). Solo se aceptan en el navegador que los produce.
 */
export const AVISOS_CONOCIDOS: { navegador: string; patron: RegExp; motivo: string }[] = [
  {
    navegador: "firefox",
    patron: /Ignoring ‘x-frame-options’ because of ‘frame-ancestors’ directive/,
    motivo:
      "Firefox anuncia que aplica `frame-ancestors` en vez de `X-Frame-Options`: es lo previsto (las dos se mandan; SEGURIDAD §2.2)",
  },
  {
    navegador: "firefox",
    patron: /Layout was forced before the page was fully loaded/,
    motivo: "aviso de desarrollo de Firefox en el marco de Mermaid, que no lleva hoja de estilos",
  },
  {
    navegador: "firefox",
    patron: /mathvariant='double-struck'.* is deprecated/,
    motivo: "el MathML que genera KaTeX para \\mathbb; se ve bien, es un aviso de obsolescencia",
  },
  {
    navegador: "firefox",
    patron: /scroll-linked positioning effect/,
    motivo:
      "aviso de rendimiento de Firefox por el desplazamiento sincronizado de Dividido (Fase 9); funciona",
  },
  {
    navegador: "webkit",
    patron:
      /was preloaded using link preload but not used within a few seconds from the window's load event/,
    motivo:
      "aviso de rendimiento de WebKit sobre los módulos que Vite precarga para las importaciones a demanda: si pasan unos segundos hasta usarlos (un test lento, axe analizando), lo anota; se usan igual",
  },
  {
    navegador: "firefox",
    patron: /XML Parsing Error: prefix not bound to a namespace[\s\S]*mermaid\.html/,
    motivo:
      "el marco de Mermaid analiza el SVG con DOMParser para sanearlo; Firefox anota en consola el SVG que no es XML válido, que el saneador rechaza (Chromium lo rechaza igual, en silencio)",
  },
];

export async function abrir(page: Page, ruta = "/"): Promise<Vigilancia> {
  const v: Vigilancia = { errores: [], violaciones: [], externas: [], conocidos: [] };
  const origen = new URL(test.info().project.use.baseURL ?? "").origin;
  const navegador = page.context().browser()?.browserType().name() ?? "";
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    const conocido = AVISOS_CONOCIDOS.some(
      (a) => a.navegador === navegador && a.patron.test(m.text()),
    );
    (conocido ? v.conocidos : v.errores).push(m.text());
  });
  page.on("pageerror", (e) => v.errores.push(e.message));
  // Los workers (el de pdf.js, el del modo oscuro) tienen su propia consola: sus
  // errores también cuentan. OJO: una violación de CSP DENTRO de un worker no dispara
  // `securitypolicyviolation` en el documento y Chromium tampoco la pasa a esta
  // consola, así que esta vigilancia no la ve. Lo que un worker necesita de la CSP se
  // prueba por su efecto (p. ej. el texto CJK de visor-pdf.spec.ts, que necesita
  // `connect-src 'self'` para los cmaps de pdf.js).
  page.on("worker", (w) =>
    w.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") v.errores.push(`[worker] ${m.text()}`);
    }),
  );
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== origen) v.externas.push(r.url());
  });
  await page.exposeFunction("__violacionCsp", (d: string) => v.violaciones.push(d));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __violacionCsp: (d: string) => void }).__violacionCsp(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  await page.goto(ruta);
  return v;
}
