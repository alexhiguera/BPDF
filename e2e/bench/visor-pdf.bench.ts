import { readFileSync } from "node:fs";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";
import { crearPdfGrande } from "../../tests/fixtures/pdf/modo-oscuro/generar.mjs";

/**
 * Benchmark del visor PDF (Fase 5, docs/ARCHITECTURE.md → visor PDF). No es un
 * test: mide e imprime. Fuera de la suite normal y de CI, porque sus cifras
 * dependen de la máquina. Uso: `npm run bench:pdf`.
 *
 * 1. Modo oscuro: render y transformación por página, con el worker y sin él
 *    (se impide crear el worker del modo oscuro y el visor usa el hilo
 *    principal), a DPR 1 y 2 y a varios zooms. «Hilo principal» es lo que la
 *    transformación bloquea la interfaz.
 * 2. Documento de 300 páginas: apertura, recorrido rápido, lienzos vivos y
 *    memoria.
 */
const t = messages.pdf;
const FIXTURE = "tests/fixtures/pdf/modo-oscuro/modo-oscuro.pdf";

async function abrirPdf(page: Page, nombre: string, buffer: Buffer): Promise<number> {
  await page.goto("/");
  const inicio = Date.now();
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: messages.open.button }).click(),
  ]);
  await selector.setFiles({ name: nombre, mimeType: "application/pdf", buffer });
  await expect(page.locator('[data-pagina="1"][data-estado="lista"]')).toBeVisible({
    timeout: 120_000,
  });
  return Date.now() - inicio;
}

const listo = (page: Page, n: number) =>
  expect(page.locator(`[data-pagina="${n}"][data-estado="lista"]`)).toBeVisible({
    timeout: 60_000,
  });

async function medirPagina(page: Page, n: number) {
  return page.locator(`[data-pagina="${n}"]`).evaluate((m) => {
    const c = m.querySelector("canvas");
    return {
      lienzo: `${c?.width}×${c?.height}`,
      mpx: (((c?.width ?? 0) * (c?.height ?? 0)) / 1e6).toFixed(1),
      render: (m as HTMLElement).dataset.msRender,
      oscuro: (m as HTMLElement).dataset.msOscuro,
      principal: (m as HTMLElement).dataset.msOscuroPrincipal,
    };
  });
}

async function contexto(browser: Browser, dpr: number, sinWorker: boolean) {
  const ctx = await browser.newContext({
    deviceScaleFactor: dpr,
    viewport: { width: 1280, height: 900 },
  });
  if (sinWorker) {
    await ctx.addInitScript(() => {
      const Original = window.Worker;
      window.Worker = class extends Original {
        constructor(url: string | URL, op?: WorkerOptions) {
          if (op?.name === "bpdf-modo-oscuro") throw new Error("sin worker (benchmark)");
          super(url, op);
        }
      };
    });
  }
  return ctx;
}

test("modo oscuro: worker frente a hilo principal", async ({ browser }) => {
  const filas: Record<string, string | undefined>[] = [];
  for (const dpr of [1, 2]) {
    for (const sinWorker of [false, true]) {
      const ctx = await contexto(browser, dpr, sinWorker);
      const page = await ctx.newPage();
      await abrirPdf(page, "modo-oscuro.pdf", readFileSync(FIXTURE));
      await page.getByRole("button", { name: t.viewSingle, exact: true }).click();
      for (const zoom of ["ancho", "200", "400"]) {
        if (zoom === "ancho") await page.getByRole("button", { name: t.fitWidth }).click();
        else {
          await page.keyboard.press("Control+0");
          const pasos = zoom === "200" ? 5 : 8; // 100 → 200 % y 100 → 400 % (PASOS_ZOOM)
          for (let i = 0; i < pasos; i++) await page.keyboard.press("Control+=");
        }
        for (const [n, nombre] of [
          [1, "texto"],
          [6, "compleja"],
          [2, "imágenes"],
        ] as const) {
          await page.getByLabel(t.pageInput).fill(String(n));
          await page.getByLabel(t.pageInput).press("Enter");
          await page.getByTestId("lector-pdf").click({ position: { x: 5, y: 5 } });
          await listo(page, n);
          await page.waitForTimeout(150);
          await listo(page, n);
          filas.push({
            dpr: String(dpr),
            worker: sinWorker ? "no" : "sí",
            zoom,
            pagina: nombre,
            ...(await medirPagina(page, n)),
          });
        }
      }
      await ctx.close();
    }
  }
  console.log("\nModo oscuro por página (ms; «principal» = hilo principal bloqueado):");
  console.table(filas);
});

test("documento de 300 páginas: apertura, recorrido y memoria", async ({ page }) => {
  const ms = await abrirPdf(page, "grande.pdf", crearPdfGrande(300));
  const lector = page.getByTestId("lector-pdf");
  const visor = page.getByTestId("visor-pdf");
  const muestras: { lienzos: number; mib: number }[] = [];
  const muestrear = async () => {
    const [l, b] = await Promise.all([
      visor.getAttribute("data-lienzos"),
      visor.getAttribute("data-bytes-lienzos"),
    ]);
    muestras.push({ lienzos: Number(l), mib: Number(b) / 2 ** 20 });
  };
  // Recorrido rápido: 60 saltos de desplazamiento sin esperar a que pinte.
  const inicio = Date.now();
  for (let i = 1; i <= 60; i++) {
    await lector.evaluate((el, f) => {
      el.scrollTop = el.scrollHeight * f;
    }, i / 60);
    await page.waitForTimeout(30);
    await muestrear();
  }
  const msRecorrido = Date.now() - inicio;
  await listo(page, 300);
  // Cambios rápidos de página con el teclado.
  await lector.click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Home");
  for (let i = 0; i < 40; i++) await page.keyboard.press("PageDown");
  await listo(page, 41);
  await muestrear();
  const heap = await page.evaluate(
    () =>
      (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize,
  );
  console.log(
    `\n300 páginas: apertura y primera página ${ms} ms · recorrido rápido ${msRecorrido} ms · ` +
      `máx. ${Math.max(...muestras.map((m) => m.lienzos))} lienzos · máx. ` +
      `${Math.max(...muestras.map((m) => m.mib)).toFixed(1)} MiB de lienzos · heap JS ` +
      `${heap ? (heap / 2 ** 20).toFixed(1) : "?"} MiB`,
  );
});
