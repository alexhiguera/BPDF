import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";
import { ALTO, ANCHO, CARTA, GEOMETRIA } from "../../tests/fixtures/pdf/modo-oscuro/generar.mjs";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Laboratorio del spike de modo oscuro (Fase 4) contra la build de producción:
 * pdf.js real, CSP real y píxeles reales. No compara capturas enteras: muestrea
 * píxeles en el interior de superficies lisas de posición conocida (GEOMETRIA).
 */

const FIXTURE = "tests/fixtures/pdf/modo-oscuro/modo-oscuro.pdf";
const PAGINA = [43, 43, 43]; // --rgb-page
const TEXTO = [236, 236, 236]; // --rgb-fg
type Rgb = number[];

async function cargar(page: Page): Promise<Vigilancia> {
  const v = await abrir(page, "/spike.html");
  await page.getByLabel(messages.pdfSpike.file).setInputFiles(FIXTURE);
  await expect(page.getByTestId("estado")).toContainText(
    messages.pdfSpike.ready(GEOMETRIA.paginas),
  );
  return v;
}

async function ver(
  page: Page,
  { pagina, modo, escala = 1 }: { pagina: number; modo: string; escala?: number },
) {
  await page.getByRole("spinbutton", { name: messages.pdfSpike.page }).fill(String(pagina));
  await page.getByLabel(messages.pdfSpike.scale).selectOption(String(escala));
  await page.locator(`input[type="radio"][value="${modo}"]`).check();
  await expect(page.getByTestId("lienzo")).toHaveAttribute("data-estado", "listo");
  await expect(page.getByTestId("lienzo")).toHaveAttribute("data-modo", modo);
}

/** Color del píxel del lienzo en el punto (x, y) en puntos PDF (origen abajo a la izquierda). */
function pixel(page: Page, [x, y]: readonly number[]): Promise<Rgb> {
  return page.getByTestId("lienzo").evaluate(
    (lienzo, { x, y, ancho, alto }) => {
      const c = lienzo as HTMLCanvasElement;
      const k = c.width / ancho;
      const ctx = c.getContext("2d");
      const d = ctx?.getImageData(Math.round(x * k), Math.round((alto - y) * k), 1, 1).data;
      return d ? [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0] : [];
    },
    { x: x ?? 0, y: y ?? 0, ancho: ANCHO, alto: ALTO },
  );
}

function cerca(real: Rgb, esperado: readonly number[], tolerancia = 3) {
  expect(real).toHaveLength(3);
  for (const [i, c] of real.entries()) {
    expect(Math.abs(c - (esperado[i] ?? 0)), `${real} ≈ ${esperado}`).toBeLessThanOrEqual(
      tolerancia,
    );
  }
}

function sinIncidencias(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

test("carga el PDF con pdf.js y el original es blanco con tinta negra", async ({ page }) => {
  const v = await cargar(page);
  const { pagina, fondo, tinta } = GEOMETRIA.texto;
  await ver(page, { pagina, modo: "original" });
  cerca(await pixel(page, fondo), [255, 255, 255]);
  cerca(await pixel(page, tinta), [0, 0, 0]);
  sinIncidencias(v);
});

for (const escala of [1, 2]) {
  test(`selectivo a escala ${escala}: fondo oscuro, tinta clara y la foto intacta`, async ({
    page,
  }) => {
    const v = await cargar(page);
    const t = GEOMETRIA.texto;
    await ver(page, { pagina: t.pagina, modo: "selectivo", escala });
    cerca(await pixel(page, t.fondo), PAGINA);
    cerca(await pixel(page, t.tinta), TEXTO);

    const im = GEOMETRIA.imagen;
    await ver(page, { pagina: im.pagina, modo: "selectivo", escala });
    cerca(await pixel(page, im.fondo), PAGINA);
    for (const [i, punto] of im.parches.entries()) {
      cerca(await pixel(page, punto), CARTA[i]?.slice(1) as number[]);
    }
    cerca(await pixel(page, im.nube), [255, 255, 255]);
    cerca(await pixel(page, im.sombra), [15, 15, 20]);
    sinIncidencias(v);
  });
}

test("gráficos: conservan el color, las líneas negras se aclaran y los pastel se oscurecen", async ({
  page,
}) => {
  const v = await cargar(page);
  const g = GEOMETRIA.graficos;
  await ver(page, { pagina: g.pagina, modo: "selectivo", escala: 2 });
  const [rojo, azul, verde, naranja] = g.barras;
  cerca(await pixel(page, verde?.punto ?? []), verde?.color ?? []);
  cerca(await pixel(page, naranja?.punto ?? []), naranja?.color ?? []);
  // El rojo y el azul se aclaran lo justo para 3:1 sobre la página, sin cambiar de tono.
  cerca(await pixel(page, rojo?.punto ?? []), rojo?.color ?? [], 8);
  const [r, gg, b] = await pixel(page, azul?.punto ?? []);
  expect(b).toBeGreaterThan(Math.max(r ?? 0, gg ?? 0));
  const linea = await pixel(page, [300, g.lineaNegra.y]);
  expect(Math.min(...linea)).toBeGreaterThan(200);
  const [pr, pg, pb] = await pixel(page, g.pastel.punto);
  expect(Math.max(pr ?? 0, pg ?? 0, pb ?? 0)).toBeLessThan(110);
  expect(pb).toBeGreaterThan(pr ?? 0);
  sinIncidencias(v);
});

test("referencias negativas: la inversión destruye la foto y la heurística sola oscurece las nubes", async ({
  page,
}) => {
  const v = await cargar(page);
  const im = GEOMETRIA.imagen;
  await ver(page, { pagina: im.pagina, modo: "invertido" });
  cerca(await pixel(page, im.parches[0] ?? []), [35, 215, 215]);
  await ver(page, { pagina: im.pagina, modo: "heuristica" });
  expect(Math.max(...(await pixel(page, im.nube)))).toBeLessThan(60);
  // Volver al original restaura el blanco: cada modo parte del render de pdf.js.
  await ver(page, { pagina: im.pagina, modo: "original" });
  cerca(await pixel(page, im.fondo), [255, 255, 255]);
  sinIncidencias(v);
});

test("un escaneo a página completa se oscurece y una diapositiva ya oscura no se toca", async ({
  page,
}) => {
  const v = await cargar(page);
  await ver(page, { pagina: 7, modo: "selectivo" });
  expect(Math.max(...(await pixel(page, [560, 20])))).toBeLessThan(70);
  await ver(page, { pagina: GEOMETRIA.oscura.pagina, modo: "selectivo" });
  cerca(await pixel(page, GEOMETRIA.oscura.fondo), [24, 24, 28]);
  await expect(page.getByTestId("estado")).toContainText(messages.pdfSpike.darkPageSkipped);
  sinIncidencias(v);
});

test("un PDF dañado muestra un aviso y no rompe la página", async ({ page }) => {
  const v = await abrir(page, "/spike.html");
  const truncado = readFileSync(FIXTURE).subarray(0, 400);
  await page.getByLabel(messages.pdfSpike.file).setInputFiles({
    name: "danado.pdf",
    mimeType: "application/pdf",
    buffer: truncado,
  });
  await expect(page.getByRole("alert")).toHaveText(messages.pdfSpike.invalidPdf);
  sinIncidencias(v);
});

test("el propio origen no sirve WebAssembly, el motor de JavaScript de PDF ni el sandbox", async ({
  request,
}) => {
  for (const ruta of [
    "/pdfjs/wasm/openjpeg.wasm",
    "/pdfjs/wasm/qcms_bg.wasm",
    "/pdfjs/wasm/quickjs-eval.wasm",
    "/pdfjs/pdf.sandbox.min.mjs",
  ]) {
    expect((await request.get(ruta)).status(), ruta).toBe(404);
  }
  expect((await request.get("/pdfjs/pdf.worker.min.mjs")).status()).toBe(200);
});
