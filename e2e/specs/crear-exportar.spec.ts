import { readFileSync } from "node:fs";
import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Crear Markdown y exportar a PDF (Fase 17) contra la build de producción, con su
 * CSP, en los tres navegadores. El diálogo nativo de impresión no se puede
 * automatizar: `window.print` se sustituye por una sonda que fotografía, en el
 * momento de llamarse, la copia que se imprime; y la hoja de impresión se prueba
 * emulando `media: print`. En Chromium, además, se genera el PDF de verdad
 * (`page.pdf`, el mismo motor que «Guardar como PDF») y se lee su texto con pdf.js.
 * En todos: cero errores de consola, cero violaciones de CSP, ninguna petición
 * fuera del propio origen.
 */
const t = messages.markdown;
const s = t.saveAs;
const FIXTURES = path.join(import.meta.dirname, "../../tests/fixtures");
const PNG = readFileSync(path.join(FIXTURES, "markdown/recursos/imagen.png"));

function limpia(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

const editor = (page: Page) => page.getByRole("textbox", { name: t.editor.label });
const boton = (page: Page, nombre: string) =>
  page.getByRole("button", { name: nombre, exact: true });

type Foto = {
  tema?: string;
  texto: string;
  katex: number;
  diagramas: number;
  pendientes: number;
  imagenes: boolean[];
  preparando: boolean;
};

/** Sustituye `window.print` por una sonda que fotografía la copia imprimible. */
async function sondaDeImpresion(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __impresiones: unknown[] };
    w.__impresiones = [];
    window.print = () => {
      const r = document.querySelector<HTMLElement>(".bpdf-impresion");
      w.__impresiones.push({
        tema: r?.dataset.tema,
        texto: r?.textContent ?? "",
        katex: r?.querySelectorAll(".katex").length ?? 0,
        diagramas: r?.querySelectorAll('[data-diagrama="listo"] img').length ?? 0,
        pendientes:
          r?.querySelectorAll(
            '[data-formula="cargando"], [data-diagrama="esperando"], [data-diagrama="dibujando"]',
          ).length ?? -1,
        imagenes: [
          ...(r?.querySelectorAll<HTMLImageElement>('img[data-imagen="local"]') ?? []),
        ].map((i) => i.complete && i.naturalWidth > 0),
        preparando: document.body.textContent?.includes("Preparando PDF") ?? false,
      });
    };
  });
}
const impresiones = (page: Page) =>
  page.evaluate(() => (window as unknown as { __impresiones: Foto[] }).__impresiones);

async function exportarPdf(page: Page, tema: "claro" | "oscuro") {
  await boton(page, s.button).click();
  const dialogo = page.getByRole("dialog", { name: s.title });
  await dialogo.getByRole("radio", { name: s.pdf }).check();
  await dialogo.getByRole("radio", { name: tema === "claro" ? s.light : s.dark }).check();
  await dialogo.getByRole("button", { name: s.confirm }).click();
  await expect.poll(async () => (await impresiones(page)).length, { timeout: 30_000 }).toBe(1);
  return (await impresiones(page))[0] as Foto;
}

/** Un Markdown con sus imágenes, elegido con «Abrir archivo» (varios ficheros). */
async function abrirConImagen(page: Page, md: string) {
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: messages.open.button }).first().click(),
  ]);
  await selector.setFiles([
    { name: "informe.md", mimeType: "", buffer: Buffer.from(md) },
    { name: "imagen.png", mimeType: "image/png", buffer: PNG },
  ]);
  await expect(page.getByRole("heading", { level: 1, name: "informe.md" })).toBeVisible();
}

const COMPLETO = [
  "# Informe",
  "",
  "Párrafo con una fórmula $e^{i\\pi}+1=0$ y un [enlace](https://example.com/informe).",
  "",
  "$$\\int_0^1 x^2\\,dx = \\tfrac{1}{3}$$",
  "",
  "| a | b |",
  "|---|---|",
  "| 1 | 2 |",
  "",
  "![Imagen local](imagen.png)",
  "",
  "```mermaid",
  "graph TD",
  "  A --> B",
  "```",
  "",
  "```js",
  "const x = 1;",
  "```",
].join("\n");

test("Crear Markdown: se abre vacío en «Dividido» con el foco en el editor; sin cambios, cerrar no pregunta", async ({
  page,
}) => {
  const v = await abrir(page);
  await boton(page, messages.open.create).click();
  await expect(
    page.getByRole("heading", { level: 1, name: messages.document.newUntitled }),
  ).toBeVisible();
  await expect(boton(page, t.mode.dividido)).toHaveAttribute("aria-pressed", "true");
  await expect(editor(page)).toBeFocused();
  await expect(page.getByText(t.modified)).toHaveCount(0);
  await boton(page, t.close).click();
  await expect(
    page.getByRole("heading", { level: 1, name: messages.emptyState.title }),
  ).toBeVisible();
  // Nada del documento nuevo en el almacenamiento.
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  limpia(v);
});

test("escribir, guardar el .md (descarga), cerrar sin aviso; volver a cambiar recupera el aviso", async ({
  page,
}) => {
  // Sin showSaveFilePicker: el camino de Firefox y Safari, también en Chromium.
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true });
  });
  const v = await abrir(page);
  await boton(page, messages.open.create).click();
  await expect(editor(page)).toBeFocused();
  await page.keyboard.type("# Nuevo documento");
  await expect(page.getByRole("banner").getByText(t.modified)).toBeVisible();
  // La vista previa se pone al día sola en «Dividido».
  await expect(
    page.getByRole("article").getByRole("heading", { name: "Nuevo documento" }),
  ).toBeVisible();
  const [descarga] = await Promise.all([
    page.waitForEvent("download"),
    page.keyboard.press("Control+s"),
  ]);
  expect(readFileSync(await descarga.path(), "utf8")).toBe("# Nuevo documento");
  await expect(page.getByText(t.modified)).toHaveCount(0);
  // Otro cambio: cerrar vuelve a preguntar.
  await editor(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("!");
  await boton(page, t.close).click();
  await expect(page.getByRole("dialog", { name: messages.discard.title })).toBeVisible();
  await page.getByRole("button", { name: messages.discard.cancel }).click();
  await expect(editor(page)).toBeVisible();
  limpia(v);
});

test("Guardar como… es accesible (axe) y Markdown pide destino aunque ya haya uno", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __destinos: string[]; showSaveFilePicker: unknown };
    w.__destinos = [];
    w.showSaveFilePicker = async (o: { suggestedName: string }) => {
      w.__destinos.push(o.suggestedName);
      return { createWritable: async () => ({ write: async () => {}, close: async () => {} }) };
    };
  });
  const v = await abrir(page);
  await boton(page, messages.open.create).click();
  await expect(editor(page)).toBeFocused(); // el visor se carga a demanda
  await page.keyboard.type("# Uno");
  await expect(page.getByRole("banner").getByText(t.modified)).toBeVisible();
  await page.keyboard.press("Control+s"); // primer destino
  await expect(page.getByText(t.modified)).toHaveCount(0);
  await boton(page, s.button).click();
  const dialogo = page.getByRole("dialog", { name: s.title });
  await expect(dialogo).toBeVisible();
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(axe.violations.map((x) => x.id)).toEqual([]);
  // Con el teclado: el formato por defecto es Markdown; Intro guarda.
  await expect(dialogo.getByRole("radio", { name: s.markdown })).toBeChecked();
  await dialogo.getByRole("button", { name: s.confirm }).focus();
  await page.keyboard.press("Enter");
  await expect(dialogo).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as unknown as { __destinos: string[] }).__destinos),
  ).toEqual([`${messages.document.newUntitled}.md`, `${messages.document.newUntitled}.md`]);
  limpia(v);
});

for (const tema of ["claro", "oscuro"] as const) {
  test(`exportar a PDF (${tema}): espera a KaTeX, Mermaid e imágenes, imprime solo el documento y limpia`, async ({
    page,
  }) => {
    await sondaDeImpresion(page);
    const v = await abrir(page);
    await abrirConImagen(page, COMPLETO);
    const foto = await exportarPdf(page, tema);
    expect(foto).toMatchObject({ tema, pendientes: 0, preparando: false });
    expect(foto.katex).toBeGreaterThanOrEqual(2);
    expect(foto.diagramas).toBe(1);
    expect(foto.imagenes).toEqual([true]);
    expect(foto.texto).toContain("Informe");
    for (const ui of [s.button, t.mode.dividido, messages.preferences.open, "R3ZON"]) {
      expect(foto.texto).not.toContain(ui);
    }

    // La hoja de impresión: solo la copia se ve; la app, no.
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".bpdf-impresion")).toBeVisible();
    await expect(page.getByRole("banner")).toBeHidden();
    await expect(page.locator("#root")).toBeHidden();
    const fondo = await page
      .locator(".bpdf-impresion")
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(fondo).toBe(tema === "claro" ? "rgb(255, 255, 255)" : "rgb(14, 20, 37)");
    await page.emulateMedia({ media: "screen" });

    // Al cerrar el diálogo del navegador, la copia se va.
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(page.locator(".bpdf-impresion")).toHaveCount(0);
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    limpia(v);
  });
}

test("exportar desde «Edición» imprime el texto editado", async ({ page }) => {
  await sondaDeImpresion(page);
  const v = await abrir(page);
  await boton(page, messages.open.create).click();
  await boton(page, t.mode.edicion).click();
  await editor(page).click();
  await page.keyboard.type("# Escrito en edición");
  const foto = await exportarPdf(page, "claro");
  expect(foto.texto).toContain("Escrito en edición");
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  limpia(v);
});

/**
 * Los rellenos que cubren más de media página, con su color: el fondo de cada página
 * tal como lo dibuja el PDF (leído con pdf.js, sin rasterizar).
 */
async function fondosDePagina(pdf: Buffer, pagina: number) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf) }).promise;
  const p = await doc.getPage(Math.min(pagina, doc.numPages));
  const [x0, y0, x1, y1] = p.view as [number, number, number, number];
  // Chromium dibuja en px CSS (96 por pulgada); la página se mide en puntos (72).
  const anchoPx = ((x1 - x0) * 96) / 72;
  const altoPx = ((y1 - y0) * 96) / 72;
  const ops = await p.getOperatorList();
  const fondos: { color: string; cubre: boolean }[] = [];
  let color = "";
  ops.fnArray.forEach((fn, i) => {
    const args = ops.argsArray[i] as unknown[];
    if (fn === pdfjs.OPS.setFillRGBColor) color = String(args[0]);
    if (fn !== pdfjs.OPS.constructPath) return;
    const caja = args.at(-1) as number[] | null;
    if (caja?.length !== 4) return;
    const [a, b, c, d] = caja as [number, number, number, number];
    if ((c - a) * (d - b) <= anchoPx * altoPx * 0.5) return;
    fondos.push({ color, cubre: c - a >= anchoPx - 2 && d - b >= altoPx - 2 });
  });
  return fondos;
}

test("el PDF real (Chromium): claro, papel blanco hasta el borde; oscuro, oscuro hasta el borde", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "page.pdf() solo existe en Chromium");
  await sondaDeImpresion(page);
  const v = await abrir(page);
  const largo = Array.from({ length: 40 }, (_, i) => `Párrafo ${i}. ${"relleno ".repeat(30)}`);
  await abrirConImagen(page, `# Largo\n\n${largo.join("\n\n")}`);
  for (const tema of ["claro", "oscuro"] as const) {
    await page.evaluate(() => {
      (window as unknown as { __impresiones: unknown[] }).__impresiones = [];
    });
    await exportarPdf(page, tema);
    const pdf = await page.pdf({ printBackground: true });
    for (const pagina of [1, 2]) {
      const fondos = await fondosDePagina(pdf, pagina);
      if (tema === "claro") {
        // Regresión: con el `color-scheme: dark` de la app, el margen salía #121212.
        expect(
          fondos.filter((f) => f.color !== "#ffffff"),
          `claro, página ${pagina}`,
        ).toEqual([]);
      } else {
        expect(
          fondos.some((f) => f.color === "#0e1425" && f.cubre),
          `oscuro, página ${pagina}`,
        ).toBe(true);
      }
    }
    await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
    await expect(page.locator(".bpdf-impresion")).toHaveCount(0);
  }
  limpia(v);
});

test("un Markdown hostil se exporta sin ejecutar nada ni pedir nada fuera", async ({ page }) => {
  await sondaDeImpresion(page);
  const v = await abrir(page);
  const hostil = [
    "# Hostil",
    "<script>window.__x = 1</script>",
    '<img src=x onerror="window.__x = 2">',
    "![remota](https://example.com/rastreo.png)",
    "[pulsa](javascript:alert(1))",
    "```mermaid",
    'graph TD\n  A["<img src=https://example.com/x.png>"] --> B',
    "```",
  ].join("\n\n");
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: messages.open.button }).first().click(),
  ]);
  await selector.setFiles({ name: "hostil.md", mimeType: "", buffer: Buffer.from(hostil) });
  const foto = await exportarPdf(page, "oscuro");
  expect(foto.texto).toContain("<script>window.__x = 1</script>");
  expect(await page.evaluate(() => (window as unknown as { __x?: number }).__x)).toBeUndefined();
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  limpia(v);
});

test("el PDF real (Chromium): el texto del documento, sin nada de la interfaz", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "page.pdf() solo existe en Chromium");
  await sondaDeImpresion(page);
  const v = await abrir(page);
  await abrirConImagen(page, COMPLETO);
  await exportarPdf(page, "claro");
  // Con la copia aún montada (la sonda no lanza `afterprint`): lo mismo que imprimiría.
  const pdf = await page.pdf({ printBackground: true });
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: true }).promise;
  let texto = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const contenido = await (await doc.getPage(i)).getTextContent();
    texto += contenido.items.map((x) => ("str" in x ? x.str : "")).join(" ");
  }
  expect(texto).toContain("Informe");
  // pdf.js devuelve el texto en trozos (el código resaltado, partido por colores): se
  // compara sin espacios y en NFC.
  const compacto = texto.normalize("NFC").replace(/\s+/g, "");
  expect(compacto).toContain("Párrafoconunafórmula");
  expect(compacto).toContain("constx=1;");
  for (const ui of [s.button, messages.open.button, messages.preferences.open, "R3ZON", "BPDF"]) {
    expect(texto).not.toContain(ui);
  }
  // El enlace del documento llega al PDF como enlace (anotación), no solo como texto.
  const enlaces = (await (await doc.getPage(1)).getAnnotations()).map((a) => a.url);
  expect(enlaces).toContain("https://example.com/informe");
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  limpia(v);
});
