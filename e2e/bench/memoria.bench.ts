import { type CDPSession, expect, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";
import { crearPdfGrande } from "../../tests/fixtures/pdf/modo-oscuro/generar.mjs";

/**
 * Memoria real (Fase 13): no es un test, mide e imprime. Uso: `npm run bench:memoria`.
 *
 * Con el protocolo de depuración de Chromium (CDP), tras forzar la recolección de basura
 * (`HeapProfiler.collectGarbage`, dos veces): montón de JavaScript usado, nodos del DOM,
 * escuchadores de eventos y documentos vivos (`Performance.getMetrics`); además, los
 * workers vivos (Playwright) y las URL `blob:` creadas y no revocadas (contadas al vuelo).
 * `performance.memory` NO se usa: Chrome lo cuantiza (siempre ~10 MiB).
 *
 * Cada escenario abre y cierra el mismo documento varias veces: si algo se retuviera
 * entre aperturas, las cifras tras cerrar crecerían de un ciclo a otro.
 */

const t = messages;
const CICLOS = 4;

const seccion = (i: number) =>
  `## Sección ${i}\n\nPárrafo con **negrita**, *cursiva*, \`código\` y un [enlace](https://example.com/${i}). ${"Texto de relleno para que el párrafo tenga una longitud normal de lectura. ".repeat(3)}\n\n| a | b |\n|---|---|\n| ${i} | x |\n\n\`\`\`js\nconst n = ${i};\n\`\`\`\n\n`;
const conFormulas = (i: number) =>
  `${seccion(i)}Fórmula $e^{i\\pi} + ${i} = 0$ y bloque:\n\n$$\n\\sum_{k=1}^{${i}} k^2\n$$\n\n`;
const conDiagrama = (i: number) =>
  i % 50 === 0
    ? `${seccion(i)}\`\`\`mermaid\nflowchart LR\n  A${i} --> B${i}\n\`\`\`\n\n`
    : seccion(i);
function generar(bytes: number, parte: (i: number) => string) {
  let texto = "# Documento\n\n";
  for (let i = 0; texto.length < bytes; i++) texto += parte(i);
  return texto;
}

type Medida = {
  heapMiB: number;
  nodos: number;
  escuchadores: number;
  documentos: number;
  workers: number;
  blobVivas: number;
};

async function medir(page: Page, cdp: CDPSession): Promise<Medida> {
  await cdp.send("HeapProfiler.collectGarbage");
  await page.waitForTimeout(200);
  await cdp.send("HeapProfiler.collectGarbage");
  const { metrics } = await cdp.send("Performance.getMetrics");
  const m = (n: string) => metrics.find((x) => x.name === n)?.value ?? Number.NaN;
  const blobVivas = await page.evaluate(
    () => (window as unknown as { __blob: Set<string> }).__blob.size,
  );
  return {
    heapMiB: Math.round((m("JSHeapUsedSize") / 2 ** 20) * 10) / 10,
    nodos: m("Nodes"),
    escuchadores: m("JSEventListeners"),
    documentos: m("Documents"),
    workers: page.workers().length,
    blobVivas,
  };
}

const fila = (etiqueta: string, x: Medida) =>
  `${etiqueta.padEnd(34)} heap ${String(x.heapMiB).padStart(6)} MiB · nodos ${String(x.nodos).padStart(7)} · escuchadores ${String(x.escuchadores).padStart(5)} · documentos ${x.documentos} · workers ${x.workers} · blob: vivas ${x.blobVivas}`;

async function preparar(page: Page) {
  // Cuenta las URL `blob:` creadas y no revocadas (BPDF las crea para imágenes,
  // diagramas y descargas).
  await page.addInitScript(() => {
    const vivas = new Set<string>();
    (window as unknown as { __blob: Set<string> }).__blob = vivas;
    const crear = URL.createObjectURL.bind(URL);
    const revocar = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (o: Blob | MediaSource) => {
      const u = crear(o);
      vivas.add(u);
      return u;
    };
    URL.revokeObjectURL = (u: string) => {
      vivas.delete(u);
      revocar(u);
    };
  });
  await page.goto("/");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  return cdp;
}

async function abrirFichero(page: Page, nombre: string, buffer: Buffer) {
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: t.open.button }).first().click(),
  ]);
  await selector.setFiles({ name: nombre, mimeType: "", buffer });
}

async function cerrar(page: Page) {
  await page.getByRole("button", { name: t.pdf.close }).first().click();
  await expect(page.getByRole("button", { name: t.open.button }).first()).toBeVisible();
}

test("memoria: PDF (300 páginas, oscuro, recorrido, zoom, original) abrir y cerrar", async ({
  page,
}) => {
  const cdp = await preparar(page);
  const pdf = crearPdfGrande(300);
  console.log(fila("inicio (sin documento)", await medir(page, cdp)));
  for (let ciclo = 1; ciclo <= CICLOS; ciclo++) {
    await abrirFichero(page, "grande.pdf", pdf);
    // Al reabrirlo, BPDF vuelve a la página donde se dejó (Fase 10): no tiene por qué
    // ser la 1.
    await expect(page.locator('[data-pagina][data-estado="lista"]').first()).toBeVisible({
      timeout: 30_000,
    });
    const lector = page.getByTestId("lector-pdf");
    for (let i = 0; i < 12; i++) {
      await lector.evaluate((l) => l.scrollBy(0, 1500));
      await page.waitForTimeout(120);
    }
    // BPDF recuerda el zoom de cada PDF: se vuelve al 100 % antes de acercar.
    await lector.click({ position: { x: 5, y: 5 } });
    await page.keyboard.press("Control+0");
    for (let i = 0; i < 3; i++)
      await page.getByRole("button", { name: t.pdf.zoomIn, exact: true }).click();
    await page.getByRole("button", { name: t.pdf.modeOriginal, exact: true }).click();
    await page.getByRole("button", { name: t.pdf.modeDark, exact: true }).click();
    await expect(page.locator('[data-pagina][data-estado="pintando"]')).toHaveCount(0, {
      timeout: 30_000,
    });
    console.log(fila(`ciclo ${ciclo} · PDF abierto y recorrido`, await medir(page, cdp)));
    await cerrar(page);
    console.log(fila(`ciclo ${ciclo} · cerrado`, await medir(page, cdp)));
  }
});

const MARKDOWN: [string, () => string][] = [
  ["pequeño (2 KB)", () => generar(2_000, seccion)],
  ["1 MB", () => generar(1_000_000, seccion)],
  ["1 MB + KaTeX", () => generar(1_000_000, conFormulas)],
  ["1 MB + Mermaid", () => generar(1_000_000, conDiagrama)],
];

for (const [nombre, crear] of MARKDOWN) {
  test(`memoria: Markdown ${nombre}: leer, Edición, Dividido, cerrar`, async ({ page }) => {
    const cdp = await preparar(page);
    const texto = Buffer.from(crear());
    console.log(fila(`${nombre} · inicio`, await medir(page, cdp)));
    for (let ciclo = 1; ciclo <= CICLOS - 1; ciclo++) {
      await abrirFichero(page, "doc.md", texto);
      await expect(page.getByRole("article").locator("h1").first()).toBeVisible({
        timeout: 120_000,
      });
      await page.waitForTimeout(1500);
      console.log(fila(`${nombre} · ciclo ${ciclo} · lectura`, await medir(page, cdp)));
      await page.getByRole("button", { name: t.markdown.mode.edicion, exact: true }).click();
      await expect(page.getByRole("textbox", { name: t.markdown.editor.label })).toBeVisible();
      await page.getByRole("button", { name: t.markdown.mode.dividido, exact: true }).click();
      await page.waitForTimeout(1500);
      console.log(fila(`${nombre} · ciclo ${ciclo} · dividido`, await medir(page, cdp)));
      await page.getByRole("button", { name: t.markdown.close }).first().click();
      await expect(page.getByRole("button", { name: t.open.button }).first()).toBeVisible();
      console.log(fila(`${nombre} · ciclo ${ciclo} · cerrado`, await medir(page, cdp)));
    }
  });
}

test("memoria: cambiar de documento (Markdown 1 MB → PDF → Markdown) sin cerrar", async ({
  page,
}) => {
  const cdp = await preparar(page);
  const md = Buffer.from(generar(1_000_000, conFormulas));
  const pdf = crearPdfGrande(50);
  for (let ciclo = 1; ciclo <= CICLOS - 1; ciclo++) {
    await abrirFichero(page, "doc.md", md);
    await expect(page.getByRole("article").locator("h1").first()).toBeVisible({ timeout: 120_000 });
    await page.getByRole("button", { name: t.markdown.mode.dividido, exact: true }).click();
    await page.waitForTimeout(1500);
    await abrirFichero(page, "doc.pdf", pdf);
    await expect(page.locator('[data-pagina="1"][data-estado="lista"]')).toBeVisible({
      timeout: 30_000,
    });
    console.log(fila(`ciclo ${ciclo} · tras pasar a PDF`, await medir(page, cdp)));
  }
});
