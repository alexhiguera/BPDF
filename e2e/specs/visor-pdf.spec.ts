import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";
import {
  ALTO,
  ANCHO,
  CARTA,
  crearPdfGrande,
  GEOMETRIA,
} from "../../tests/fixtures/pdf/modo-oscuro/generar.mjs";
import { BUSQUEDA, CJK, VISOR } from "../../tests/fixtures/pdf/visor/generar.mjs";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Visor PDF (Fase 5) contra la build de producción: pdf.js real, worker real,
 * CSP real y píxeles reales. Cada test termina comprobando cero errores de
 * consola, cero violaciones de CSP y ninguna petición fuera del propio origen.
 *
 * El modo oscuro se comprueba muestreando píxeles en el interior de superficies
 * lisas de posición conocida (GEOMETRIA, el método de la Fase 4), no con
 * capturas enteras.
 */

const t = messages.pdf;
const FIXTURES = "tests/fixtures/pdf";
const OSCURO = `${FIXTURES}/modo-oscuro/modo-oscuro.pdf`;
const VISOR_PDF = `${FIXTURES}/visor/visor.pdf`;
const PAGINA = [43, 43, 43]; // --rgb-page
const TEXTO = [236, 236, 236]; // --rgb-fg
const PT_A_CSS = 96 / 72;

type Fichero = string | { name: string; mimeType: string; buffer: Buffer };

async function abrirPdf(page: Page, fichero: Fichero): Promise<void> {
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: messages.open.button }).first().click(),
  ]);
  await selector.setFiles(fichero);
}

async function cargar(page: Page, fichero: Fichero = OSCURO): Promise<Vigilancia> {
  const v = await abrir(page);
  await abrirPdf(page, fichero);
  await listo(page, 1);
  return v;
}

const marco = (page: Page, n: number) => page.locator(`[data-pagina="${n}"]`);
const listo = (page: Page, n: number) =>
  expect(page.locator(`[data-pagina="${n}"][data-estado="lista"]`)).toBeVisible({
    timeout: 30_000,
  });
const estado = (page: Page) => page.getByTestId("estado-pagina");
const boton = (page: Page, nombre: string) =>
  page.getByRole("button", { name: nombre, exact: true });
const lector = (page: Page) => page.getByTestId("lector-pdf");

/** Espera a que ninguna página se esté pintando (tras un cambio de zoom, modo…). */
async function quieto(page: Page) {
  await expect(page.locator('[data-pagina][data-estado="pintando"]')).toHaveCount(0);
}

/** Pone el foco en el área de lectura (fuera de cualquier campo) para usar el teclado. */
async function enfocarLector(page: Page) {
  await lector(page).click({ position: { x: 4, y: 4 } });
}

/**
 * Color del lienzo de la página `n` en el punto (x, y) en puntos PDF (origen
 * abajo a la izquierda). Con la página girada 90°, el punto (x, y) cae en
 * (y, x) del lienzo girado.
 */
function pixel(page: Page, n: number, [x = 0, y = 0]: readonly number[], rotacion = 0) {
  return marco(page, n)
    .locator("canvas")
    .evaluate(
      (lienzo, { x, y, ancho, alto, rotacion }) => {
        const c = lienzo as HTMLCanvasElement;
        const [px, py, base] = rotacion === 90 ? [y, x, alto] : [x, alto - y, ancho];
        const k = c.width / base;
        const d = c
          .getContext("2d")
          ?.getImageData(Math.round(px * k), Math.round(py * k), 1, 1).data;
        return d ? [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0] : [];
      },
      { x, y, ancho: ANCHO, alto: ALTO, rotacion },
    );
}

function cerca(real: number[], esperado: readonly number[], tolerancia = 3) {
  expect(real).toHaveLength(3);
  for (const [i, c] of real.entries()) {
    expect(Math.abs(c - (esperado[i] ?? 0)), `${real} ≈ ${esperado}`).toBeLessThanOrEqual(
      tolerancia,
    );
  }
}

function limpia(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

async function irA(page: Page, n: number) {
  const campo = page.getByRole("textbox", { name: t.pageInput });
  await campo.fill(String(n));
  await campo.press("Enter");
  await expect(estado(page)).toHaveText(t.status.page(n, Number(await visorPaginas(page))));
  await listo(page, n);
}
const visorPaginas = (page: Page) => page.getByTestId("visor-pdf").getAttribute("data-paginas");

// ── 1-2. Abrir y primera página ────────────────────────────────────────────────

test("abre un PDF y muestra la primera página, en oscuro, sin incidencias", async ({ page }) => {
  const v = await cargar(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("modo-oscuro.pdf");
  await expect(estado(page)).toHaveText(t.status.page(1, GEOMETRIA.paginas));
  await expect(boton(page, t.modeDark)).toHaveAttribute("aria-pressed", "true");
  await expect(marco(page, 1)).toHaveAttribute("data-modo", "oscuro");
  // El modo oscuro corre en su worker, servido desde el propio origen.
  await expect(page.getByTestId("visor-pdf")).toHaveAttribute("data-transformador", "worker");
  limpia(v);
});

// ── 3-4. Cambiar de página y saltar ────────────────────────────────────────────

test("cambia de página con los botones y salta con el campo (y valida lo escrito)", async ({
  page,
}) => {
  const v = await cargar(page);
  await boton(page, t.next).click();
  await expect(estado(page)).toHaveText(t.status.page(2, 8));
  await listo(page, 2);
  await irA(page, 7);
  await expect(marco(page, 7)).toBeInViewport();
  for (const malo of ["0", "9", "abc", "2.5", "-1"]) {
    const campo = page.getByRole("textbox", { name: t.pageInput });
    await campo.fill(malo);
    await campo.press("Enter");
    await expect(page.getByRole("alert")).toHaveText(t.invalidPage(8));
    await expect(estado(page)).toHaveText(t.status.page(7, 8));
  }
  limpia(v);
});

// ── 5-7. Zoom y ajustes ─────────────────────────────────────────────────────────

test("zoom: botones, porcentaje, 100 %, Ctrl+rueda y límites; el lienzo cambia de resolución", async ({
  page,
}) => {
  const v = await cargar(page);
  await boton(page, t.viewSingle).click();
  await page.keyboard.press("Control+0");
  await expect(page.getByText(t.zoomPercent(100), { exact: true })).toBeVisible();
  await quieto(page);
  const ancho100 = await marco(page, 1)
    .locator("canvas")
    .evaluate((c) => (c as HTMLCanvasElement).width);
  await boton(page, t.zoomIn).click();
  await expect(page.getByText(t.zoomPercent(110), { exact: true })).toBeVisible();
  await boton(page, t.zoomOut).click();
  await boton(page, t.zoomOut).click();
  await expect(page.getByText(t.zoomPercent(90), { exact: true })).toBeVisible();
  // Ctrl + rueda acerca (y no hace zoom del navegador).
  await lector(page).hover();
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -100);
  await page.keyboard.up("Control");
  await expect(page.getByText(t.zoomPercent(100), { exact: true })).toBeVisible();
  // Hasta el máximo: el botón se desactiva y la resolución física queda acotada.
  for (let i = 0; i < 20; i++) {
    if (await boton(page, t.zoomIn).isDisabled()) break;
    await boton(page, t.zoomIn).click();
  }
  await expect(page.getByText(t.zoomPercent(500), { exact: true })).toBeVisible();
  await quieto(page);
  const lienzo = await marco(page, 1)
    .locator("canvas")
    .evaluate((c) => [(c as HTMLCanvasElement).width, (c as HTMLCanvasElement).height]);
  expect((lienzo[0] ?? 0) * (lienzo[1] ?? 0)).toBeLessThanOrEqual(4096 * 4096);
  expect(lienzo[0]).toBeGreaterThan(ancho100);
  expect(await page.evaluate(() => window.devicePixelRatio)).toBe(1); // sin zoom del navegador
  limpia(v);
});

test("ajustar al ancho y ajustar a la página", async ({ page }) => {
  const v = await cargar(page);
  const area = await lector(page).evaluate((el) => [el.clientWidth, el.clientHeight]);
  await boton(page, t.fitWidth).click();
  await quieto(page);
  const ancho = (await marco(page, 1).boundingBox())?.width ?? 0;
  expect(Math.abs(ancho - ((area[0] ?? 0) - 32))).toBeLessThanOrEqual(2);
  await boton(page, t.fitPage).click();
  await expect(boton(page, t.fitPage)).toHaveAttribute("aria-pressed", "true");
  await quieto(page);
  const caja = await marco(page, 1).boundingBox();
  expect(caja?.height ?? 0).toBeLessThanOrEqual((area[1] ?? 0) - 32 + 1);
  expect(caja?.width ?? 0).toBeLessThan(area[0] ?? 0);
  limpia(v);
});

// ── 8-9. Vista continua y página a página ──────────────────────────────────────

test("vista continua: al desplazarse cambia la página actual y solo viven las cercanas", async ({
  page,
}) => {
  const v = await cargar(page);
  await lector(page).evaluate((el) => {
    el.scrollTop = el.scrollHeight / 2;
  });
  await expect(estado(page)).not.toHaveText(t.status.page(1, 8));
  const lienzos = Number(await page.getByTestId("visor-pdf").getAttribute("data-lienzos"));
  expect(lienzos).toBeLessThanOrEqual(4);
  await expect(marco(page, 1)).toHaveCount(0); // lejos: sin marco ni lienzo
  limpia(v);
});

test("página a página: un solo lienzo; cambiar de vista conserva página, zoom y modo", async ({
  page,
}) => {
  const v = await cargar(page);
  await boton(page, t.modeOriginal).click();
  await irA(page, 3);
  await boton(page, t.viewSingle).click();
  await expect(page.locator("[data-pagina]")).toHaveCount(1);
  await listo(page, 3);
  await expect(marco(page, 3)).toHaveAttribute("data-modo", "original");
  await enfocarLector(page);
  await page.keyboard.press("PageDown");
  await expect(estado(page)).toHaveText(t.status.page(4, 8));
  await listo(page, 4);
  await boton(page, t.viewContinuous).click();
  await expect(estado(page)).toHaveText(t.status.page(4, 8));
  await expect(marco(page, 4)).toBeInViewport();
  limpia(v);
});

// ── 10-11. Oscuro y original ───────────────────────────────────────────────────

test("oscuro: fondo oscuro, tinta clara, la foto intacta y los gráficos con su color", async ({
  page,
}) => {
  const v = await cargar(page);
  const tx = GEOMETRIA.texto;
  cerca(await pixel(page, 1, tx.fondo), PAGINA);
  cerca(await pixel(page, 1, tx.tinta), TEXTO);
  const im = GEOMETRIA.imagen;
  await irA(page, im.pagina);
  cerca(await pixel(page, im.pagina, im.fondo), PAGINA);
  for (const [i, punto] of im.parches.entries()) {
    cerca(await pixel(page, im.pagina, punto), CARTA[i]?.slice(1) as number[]);
  }
  cerca(await pixel(page, im.pagina, im.nube), [255, 255, 255]);
  cerca(await pixel(page, im.pagina, im.sombra), [15, 15, 20]);
  const g = GEOMETRIA.graficos;
  await irA(page, g.pagina);
  const verde = g.barras[2];
  cerca(await pixel(page, g.pagina, verde?.punto ?? []), verde?.color ?? []);
  const linea = await pixel(page, g.pagina, [300, g.lineaNegra.y]);
  expect(Math.min(...linea)).toBeGreaterThan(200);
  // Escaneo a página completa: se oscurece. Diapositiva ya oscura: no se toca.
  await irA(page, 7);
  expect(Math.max(...(await pixel(page, 7, [560, 20])))).toBeLessThan(70);
  await irA(page, GEOMETRIA.oscura.pagina);
  cerca(await pixel(page, GEOMETRIA.oscura.pagina, GEOMETRIA.oscura.fondo), [24, 24, 28]);
  limpia(v);
});

test("original: lo que pinta pdf.js; y se puede volver a oscuro (nadie queda atrapado)", async ({
  page,
}) => {
  const v = await cargar(page);
  const tx = GEOMETRIA.texto;
  await boton(page, t.modeOriginal).click();
  await expect(marco(page, 1)).toHaveAttribute("data-modo", "original");
  await quieto(page);
  cerca(await pixel(page, 1, tx.fondo), [255, 255, 255]);
  cerca(await pixel(page, 1, tx.tinta), [0, 0, 0]);
  await boton(page, t.modeDark).click();
  await expect(marco(page, 1)).toHaveAttribute("data-modo", "oscuro");
  await quieto(page);
  cerca(await pixel(page, 1, tx.fondo), PAGINA);
  // Nunca un filtro CSS de inversión: el color sale del lienzo.
  const filtros = await page.evaluate(() =>
    [...document.querySelectorAll("*")]
      .map((e) => getComputedStyle(e).filter)
      .filter((f) => f !== "none"),
  );
  expect(filtros).toEqual([]);
  limpia(v);
});

// ── 12. Rotación ────────────────────────────────────────────────────────────────

test("girar 90°: la página se tumba, sigue en oscuro y la capa de texto gira con ella", async ({
  page,
}) => {
  const v = await cargar(page, VISOR_PDF);
  await page.keyboard.press("Control+0");
  await irA(page, 2);
  await boton(page, t.rotate).click();
  await expect(marco(page, 2)).toHaveAttribute("data-rotacion", "90");
  await quieto(page);
  const caja = await marco(page, 2).boundingBox();
  expect(caja?.width ?? 0).toBeGreaterThan(caja?.height ?? 0);
  cerca(await pixel(page, 2, [520, 60], 90), PAGINA);
  // «La canción del búho» (x = 72 pt): tras girar, vertical y a 72 pt del borde superior.
  const span = marco(page, 2).locator(".textLayer span", { hasText: "La canción del búho" });
  const s = await span.boundingBox();
  expect(s?.height ?? 0).toBeGreaterThan(s?.width ?? 0);
  expect(Math.abs((s?.y ?? 0) - (caja?.y ?? 0) - 72 * PT_A_CSS)).toBeLessThanOrEqual(4);
  limpia(v);
});

// ── 13. Miniaturas ─────────────────────────────────────────────────────────────

test("miniaturas: se pintan aparte, marcan la actual, navegan y se liberan al cerrar", async ({
  page,
}) => {
  const v = await cargar(page);
  await boton(page, t.showThumbnails).click();
  const panel = page.getByRole("navigation", { name: t.thumbnails });
  await expect(panel.locator("canvas").first()).toBeVisible();
  const anchoMini = await panel
    .locator("canvas")
    .first()
    .evaluate((c) => (c as HTMLCanvasElement).width);
  const anchoGrande = await marco(page, 1)
    .locator("canvas")
    .evaluate((c) => (c as HTMLCanvasElement).width);
  expect(anchoMini).toBeLessThan(anchoGrande / 4);
  await panel.getByRole("button", { name: t.thumbnail(5) }).click();
  await expect(estado(page)).toHaveText(t.status.page(5, 8));
  await expect(panel.getByRole("button", { name: t.thumbnail(5) })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await boton(page, t.hideThumbnails).click();
  await expect(panel).toHaveCount(0);
  await quieto(page);
  const lienzos = Number(await page.getByTestId("visor-pdf").getAttribute("data-lienzos"));
  expect(lienzos).toBeLessThanOrEqual(4);
  limpia(v);
});

// ── 14. Selección y copia ──────────────────────────────────────────────────────

test("el texto se selecciona y se copia, también a otro zoom", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const v = await cargar(page, VISOR_PDF);
  await page.keyboard.press("Control+0");
  await irA(page, 2);
  const span = marco(page, 2).locator(".textLayer span", { hasText: "La canción del búho" });
  const a100 = await span.boundingBox();
  // La capa está sobre el dibujo: el título empieza a 72 pt del borde izquierdo.
  const pagina = await marco(page, 2).boundingBox();
  expect(Math.abs((a100?.x ?? 0) - (pagina?.x ?? 0) - 72 * PT_A_CSS)).toBeLessThanOrEqual(3);
  await span.click({ clickCount: 3 });
  await page.keyboard.press("Control+c");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "La canción del búho",
  );
  // A 200 %, la misma frase mide el doble.
  for (let i = 0; i < 5; i++) await boton(page, t.zoomIn).click();
  await expect(page.getByText(t.zoomPercent(200), { exact: true })).toBeVisible();
  await quieto(page);
  const a200 = await span.boundingBox();
  expect((a200?.width ?? 0) / (a100?.width ?? 1)).toBeCloseTo(2, 1);
  limpia(v);
});

// ── 15. Búsqueda ───────────────────────────────────────────────────────────────

test("búsqueda: cuenta, resalta, recorre y lleva a la página; sin tildes ni mayúsculas", async ({
  page,
}) => {
  const v = await cargar(page, VISOR_PDF);
  await enfocarLector(page);
  await page.keyboard.press("Control+f");
  const caja = page.getByRole("searchbox", { name: t.searchLabel });
  await expect(caja).toBeFocused();
  await caja.fill("busqueda");
  await expect(page.getByTestId("estado-busqueda")).toHaveText(
    t.searchCount(1, VISOR.busqueda.total),
  );
  await expect(estado(page)).toHaveText(t.status.page(2, 5));
  await expect(marco(page, 2).locator("mark.coincidencia")).toHaveCount(3);
  await expect(marco(page, 2).locator("mark.activa")).toHaveText("búsqueda");
  await expect(marco(page, 2).locator("mark.activa")).toBeInViewport();
  await caja.press("Enter");
  await caja.press("Enter");
  await caja.press("Enter");
  await expect(page.getByTestId("estado-busqueda")).toHaveText(t.searchCount(4, 4));
  await expect(estado(page)).toHaveText(t.status.page(5, 5));
  await expect(marco(page, 5).locator("mark.activa")).toHaveText("búsqueda");
  await caja.fill("no aparece en ninguna parte");
  await expect(page.getByTestId("estado-busqueda")).toHaveText(t.searchNone);
  await caja.press("Escape");
  await expect(caja).toHaveCount(0);
  await expect(page.locator("mark")).toHaveCount(0);
  limpia(v);
});

test("búsqueda en un PDF sin texto: explica que no hay OCR", async ({ page }) => {
  const v = await cargar(page, `${FIXTURES}/visor/sin-texto.pdf`);
  await enfocarLector(page);
  await page.keyboard.press("Control+f");
  await page.getByRole("searchbox", { name: t.searchLabel }).fill("hola");
  await expect(page.getByTestId("estado-busqueda")).toHaveText(t.searchNoText);
  limpia(v);
});

test("texto CJK con fuente no incrustada: se ve, se selecciona y se busca (cmaps del propio origen)", async ({
  page,
}) => {
  const peticiones: string[] = [];
  page.on("request", (r) => peticiones.push(new URL(r.url()).pathname));
  const v = await cargar(page, `${FIXTURES}/visor/cjk.pdf`);
  // pdf.js pide los cmaps DESDE SU WORKER: una violación de CSP ahí no llega al
  // documento (la vigilancia no la vería); se comprueba por el resultado.
  await expect(marco(page, 1).locator(".textLayer")).toContainText(CJK.texto);
  expect(peticiones).toContain("/pdfjs/cmaps/UniJIS-UCS2-H.bcmap");
  await enfocarLector(page);
  await page.keyboard.press("Control+f");
  await page.getByRole("searchbox", { name: t.searchLabel }).fill("本語");
  await expect(page.getByTestId("estado-busqueda")).toHaveText(t.searchCount(1, 1));
  limpia(v);
});

// ── 16-17. Enlaces ─────────────────────────────────────────────────────────────

test("enlaces internos: destino explícito, con nombre y «página siguiente»", async ({ page }) => {
  const v = await cargar(page, VISOR_PDF);
  await marco(page, 1)
    .getByRole("link", { name: t.link.internal(3) })
    .click();
  await expect(estado(page)).toHaveText(t.status.page(3, 5));
  await irA(page, 1);
  await marco(page, 1)
    .getByRole("link", { name: t.link.internal(5) })
    .click();
  await expect(estado(page)).toHaveText(t.status.page(5, 5));
  await irA(page, 1);
  await marco(page, 1)
    .getByRole("link", { name: t.link.internal(2) })
    .click();
  await expect(estado(page)).toHaveText(t.status.page(2, 5));
  expect(new URL(page.url()).pathname).toBe("/");
  limpia(v);
});

test("enlace externo: se abre por el mecanismo controlado, sin navegar la app; los hostiles no existen", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __abiertas: unknown[][] };
    w.__abiertas = [];
    window.open = (...args: unknown[]) => {
      w.__abiertas.push(args);
      return null;
    };
  });
  const v = await cargar(page, VISOR_PDF);
  const enlaces = marco(page, 1).locator(".enlaces-pdf a");
  // Solo los 4 permitidos: javascript:, file: y la acción JavaScript no son enlaces.
  await expect(enlaces).toHaveCount(4);
  await expect(marco(page, 1).locator('a[href^="javascript"], a[href^="file"]')).toHaveCount(0);
  await marco(page, 1)
    .getByRole("link", { name: t.link.external(VISOR.urlExterna) })
    .click();
  const abiertas = await page.evaluate(
    () => (window as unknown as { __abiertas: unknown[][] }).__abiertas,
  );
  expect(abiertas).toEqual([[VISOR.urlExterna, "_blank", "noopener,noreferrer"]]);
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(page.getByTestId("visor-pdf")).toBeVisible();
  limpia(v);
});

// ── 18. Teclado ────────────────────────────────────────────────────────────────

test("teclado: AvPág, RePág, Fin, Inicio, Ctrl+/−/0; nada se intercepta al escribir", async ({
  page,
}) => {
  const v = await cargar(page);
  await enfocarLector(page);
  await page.keyboard.press("PageDown");
  await expect(estado(page)).toHaveText(t.status.page(2, 8));
  await page.keyboard.press("End");
  await expect(estado(page)).toHaveText(t.status.page(8, 8));
  await page.keyboard.press("PageUp");
  await expect(estado(page)).toHaveText(t.status.page(7, 8));
  await page.keyboard.press("Home");
  await expect(estado(page)).toHaveText(t.status.page(1, 8));
  await page.keyboard.press("Control+0");
  await expect(page.getByText(t.zoomPercent(100), { exact: true })).toBeVisible();
  await page.keyboard.press("Control+=");
  await expect(page.getByText(t.zoomPercent(110), { exact: true })).toBeVisible();
  await page.keyboard.press("Control+-");
  await expect(page.getByText(t.zoomPercent(100), { exact: true })).toBeVisible();
  // En el campo de página, Fin e Inicio mueven el cursor, no el documento.
  const campo = page.getByRole("textbox", { name: t.pageInput });
  await campo.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("PageDown");
  await expect(estado(page)).toHaveText(t.status.page(1, 8));
  limpia(v);
});

// ── 19. Abrir otro PDF ─────────────────────────────────────────────────────────

// Regresión (deuda de la Fase 5): cerrar o sustituir un PDF con el modo oscuro a
// mitad (franjas en el worker) dejaba un rechazo «worker-destruido» sin capturar en la
// consola. Se cierra a distintos tiempos tras empezar a pintar, para cruzar la ventana
// en la que hay franjas en vuelo; la vigilancia exige la consola limpia.
test("cerrar o sustituir el PDF mientras se pintan páginas no deja errores ni rastro", async ({
  page,
}) => {
  const v = await abrir(page);
  for (const [i, espera] of [0, 20, 40, 60, 90, 120, 160, 220].entries()) {
    await abrirPdf(page, OSCURO);
    // En cuanto existe el visor, sus páginas empiezan a pintarse (render y modo oscuro).
    await expect(page.getByTestId("visor-pdf")).toBeVisible({ timeout: 30_000 });
    if (espera > 0) await page.waitForTimeout(espera);
    if (i % 2 === 0) {
      await boton(page, t.close).click();
      await expect(page.getByTestId("visor-pdf")).toHaveCount(0);
    } else {
      // Sustituir: el anterior se destruye con el nuevo ya pedido.
      await abrirPdf(page, VISOR_PDF);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("visor.pdf");
      await expect(page.getByTestId("visor-pdf")).toHaveAttribute(
        "data-paginas",
        String(VISOR.paginas),
      );
      // Nada del documento anterior: solo las páginas del nuevo.
      await expect(page.locator(`[data-pagina="${GEOMETRIA.paginas}"]`)).toHaveCount(0);
      await boton(page, t.close).click();
    }
  }
  // Los rechazos sueltos llegan a la consola en cuanto se vacían las microtareas.
  await page.waitForTimeout(300);
  limpia(v);
});

test("abrir otro PDF sustituye al anterior sin dejar rastro de él", async ({ page }) => {
  const v = await cargar(page, VISOR_PDF);
  await expect(marco(page, 1).locator(".textLayer")).toContainText("Manual de prueba");
  await abrirPdf(page, OSCURO);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("modo-oscuro.pdf");
  await listo(page, 1);
  await expect(page.getByTestId("visor-pdf")).toHaveAttribute("data-paginas", "8");
  await expect(page.getByText("Manual de prueba")).toHaveCount(0);
  await expect(page.locator(".enlaces-pdf a")).toHaveCount(0);
  limpia(v);
});

test("cambiar de PDF muy deprisa acaba mostrando el último", async ({ page }) => {
  const v = await abrir(page);
  await abrirPdf(page, VISOR_PDF);
  await abrirPdf(page, OSCURO);
  await abrirPdf(page, VISOR_PDF);
  await listo(page, 1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("visor.pdf");
  await expect(page.getByTestId("visor-pdf")).toHaveAttribute("data-paginas", "5");
  limpia(v);
});

// ── 20. PDF dañado o protegido ─────────────────────────────────────────────────

test("un PDF dañado muestra su aviso y se puede cerrar", async ({ page }) => {
  const v = await abrir(page);
  await abrirPdf(page, {
    name: "danado.pdf",
    mimeType: "application/pdf",
    buffer: readFileSync(OSCURO).subarray(0, 400),
  });
  await expect(page.getByRole("alert")).toHaveText(t.errors.unreadable);
  await page.getByRole("button", { name: t.close }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.emptyState.title);
  limpia(v);
});

const PROTEGIDO = `${FIXTURES}/visor/protegido.pdf`;
const pw = t.password;

test("contraseña (F6, D13): incorrecta, reintento y correcta; no queda guardada en ningún sitio", async ({
  page,
}) => {
  const v = await abrir(page);
  await abrirPdf(page, PROTEGIDO);
  const dialogo = page.getByRole("dialog", { name: pw.title });
  await expect(dialogo).toBeVisible();
  const campo = dialogo.getByLabel(pw.label, { exact: true });
  await expect(campo).toBeFocused();
  await expect(campo).toHaveAttribute("type", "password");
  // Modal de verdad: el resto de la página es inerte.
  expect(await page.evaluate(() => document.querySelector("dialog")?.matches(":modal"))).toBe(true);
  await campo.fill("mala-e2e-1");
  await campo.press("Enter");
  await expect(dialogo.getByRole("alert")).toHaveText(pw.wrong);
  await expect(campo).toHaveValue("");
  await expect(campo).toBeFocused();
  await expect(campo).toHaveAttribute("aria-invalid", "true");
  await campo.fill("mala-e2e-2");
  await dialogo.getByRole("button", { name: pw.open }).click();
  await expect(dialogo.getByRole("alert")).toHaveText(pw.wrong);
  await campo.fill("bpdf");
  await campo.press("Enter");
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByTestId("visor-pdf")).toHaveAttribute("data-paginas", "1");
  await listo(page, 1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("protegido.pdf");
  // Con las preferencias de la Fase 10 en uso (miniaturas y posición guardadas), la
  // contraseña tampoco aparece. Las únicas claves son las de preferencias: su nombre
  // empieza por «bpdf:», que coincide con la contraseña de este fixture, así que se
  // comprueba que las claves son exactamente esas y que ningún VALOR la contiene.
  await boton(page, t.showThumbnails).click();
  await boton(page, t.zoomIn).click();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("bpdf:positions")), { timeout: 5000 })
    .not.toBeNull();
  const guardado = await page.evaluate(() => ({
    local: Object.entries(localStorage),
    sesion: Object.entries(sessionStorage),
    cookies: document.cookie,
  }));
  expect(guardado.local.map(([clave]) => clave).sort()).toEqual(["bpdf:positions", "bpdf:prefs"]);
  expect(guardado.sesion).toEqual([]);
  expect(guardado.cookies).toBe("");
  for (const [, valor] of guardado.local) {
    for (const c of ["bpdf", "mala-e2e"]) expect(valor).not.toContain(c);
  }
  expect(await page.content()).not.toContain("mala-e2e");
  limpia(v);
});

test("contraseña: Cancelar y Esc cierran el documento", async ({ page }) => {
  const v = await abrir(page);
  await abrirPdf(page, PROTEGIDO);
  await page
    .getByRole("dialog", { name: pw.title })
    .getByRole("button", { name: pw.cancel })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.emptyState.title);
  await abrirPdf(page, PROTEGIDO);
  await expect(page.getByRole("dialog", { name: pw.title })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.emptyState.title);
  limpia(v);
});

test("contraseña: abrir otro documento (Ctrl+O) con el diálogo abierto lo sustituye", async ({
  page,
}) => {
  const v = await abrir(page);
  await abrirPdf(page, PROTEGIDO);
  const campo = page.getByRole("dialog", { name: pw.title }).getByLabel(pw.label, { exact: true });
  await campo.fill("mala-e2e-3");
  // Con el diálogo modal, la cabecera es inerte; Ctrl+O (de la app) sigue abriendo.
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.keyboard.press("Control+o"),
  ]);
  await selector.setFiles(VISOR_PDF);
  await listo(page, 1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("visor.pdf");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.content()).not.toContain("mala-e2e");
  limpia(v);
});

// ── 20 bis. Fase 6: pantalla completa, atajos, búsqueda avanzada, miniaturas ──

test("pantalla completa: F y el botón entran y salen, solo con el área de lectura", async ({
  page,
}) => {
  const v = await cargar(page, VISOR_PDF);
  const enCompleta = () =>
    page.evaluate(() => document.fullscreenElement?.getAttribute("data-testid") ?? null);
  await enfocarLector(page);
  await page.keyboard.press("f");
  await expect.poll(enCompleta).toBe("lector-pdf");
  await expect(boton(page, t.fullscreen)).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("f");
  await expect.poll(enCompleta).toBeNull();
  await expect(boton(page, t.fullscreen)).toHaveAttribute("aria-pressed", "false");
  await boton(page, t.fullscreen).click();
  await expect.poll(enCompleta).toBe("lector-pdf");
  await listo(page, 1);
  await page.evaluate(() => document.exitFullscreen());
  await expect.poll(enCompleta).toBeNull();
  await expect(boton(page, t.fullscreen)).toHaveAttribute("aria-pressed", "false");
  // Con las cabeceras reales (Permissions-Policy sin `fullscreen`): permitida.
  expect(await page.evaluate(() => document.fullscreenEnabled)).toBe(true);
  limpia(v);
});

test("atajos de una tecla: T, R, Mayús+R y ?; desactivados desde la ayuda, no actúan", async ({
  page,
}) => {
  const v = await cargar(page, VISOR_PDF);
  await enfocarLector(page);
  await page.keyboard.press("t");
  await expect(page.getByRole("navigation", { name: t.thumbnails })).toBeVisible();
  await page.keyboard.press("t");
  await expect(page.getByRole("navigation", { name: t.thumbnails })).toHaveCount(0);
  await page.keyboard.press("r");
  await expect(page.getByText(t.status.rotation(90))).toBeVisible();
  await page.keyboard.press("Shift+R");
  await page.keyboard.press("Shift+R");
  await expect(page.getByText(t.status.rotation(270))).toBeVisible();
  await page.keyboard.press("r");
  await expect(page.getByText(/Girado/)).toHaveCount(0);
  // En un campo de texto no actúan.
  await page.getByRole("textbox", { name: t.pageInput }).focus();
  await page.keyboard.press("r");
  await expect(page.getByText(/Girado/)).toHaveCount(0);
  // La ayuda: modal, con la tabla; mientras está abierta, nada se intercepta.
  await enfocarLector(page);
  await page.keyboard.press("?");
  const ayuda = page.getByRole("dialog", { name: t.help.title });
  await expect(ayuda).toBeVisible();
  await expect(ayuda.getByRole("table", { name: t.help.table })).toBeVisible();
  await ayuda.getByRole("checkbox", { name: t.help.singleKey }).uncheck();
  await page.keyboard.press("Escape");
  await expect(ayuda).toHaveCount(0);
  await enfocarLector(page);
  for (const k of ["r", "t", "f", "?"]) await page.keyboard.press(k);
  await expect(page.getByText(/Girado/)).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: t.thumbnails })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
  // Siguen desactivados al abrir otro documento; el botón de la barra reabre la ayuda.
  await abrirPdf(page, OSCURO);
  await listo(page, 1);
  await enfocarLector(page);
  await page.keyboard.press("r");
  await expect(page.getByText(/Girado/)).toHaveCount(0);
  await boton(page, t.shortcuts).click();
  const otraVez = page.getByRole("dialog", { name: t.help.title });
  await otraVez.getByRole("checkbox", { name: t.help.singleKey }).check();
  await otraVez.getByRole("button", { name: t.help.close, exact: true }).click();
  await enfocarLector(page);
  await page.keyboard.press("r");
  await expect(page.getByText(t.status.rotation(90))).toBeVisible();
  limpia(v);
});

test("navegación: Espacio, Mayús+Espacio, → / ← en página a página y Ctrl+G", async ({ page }) => {
  const v = await cargar(page);
  await enfocarLector(page);
  await page.keyboard.press(" ");
  await expect(estado(page)).toHaveText(t.status.page(2, 8));
  await page.keyboard.press(" ");
  await page.keyboard.press("Shift+ ");
  await expect(estado(page)).toHaveText(t.status.page(2, 8));
  // En la vista continua, → no pasa de página.
  await page.keyboard.press("ArrowRight");
  await expect(estado(page)).toHaveText(t.status.page(2, 8));
  await boton(page, t.viewSingle).click();
  await enfocarLector(page);
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await expect(estado(page)).toHaveText(t.status.page(3, 8));
  await page.keyboard.press("Control+g");
  const campo = page.getByRole("textbox", { name: t.pageInput });
  await expect(campo).toBeFocused();
  await page.keyboard.type("6");
  await page.keyboard.press("Enter");
  await expect(estado(page)).toHaveText(t.status.page(6, 8));
  // Espacio sobre un botón lo activa, no pasa de página.
  await boton(page, t.viewContinuous).focus();
  await page.keyboard.press(" ");
  await expect(boton(page, t.viewContinuous)).toHaveAttribute("aria-pressed", "true");
  await expect(estado(page)).toHaveText(t.status.page(6, 8));
  limpia(v);
});

test("búsqueda avanzada: mayúsculas, palabra completa, F3 y palabra partida con guion", async ({
  page,
}) => {
  const v = await cargar(page, `${FIXTURES}/visor/busqueda.pdf`);
  const cuenta = page.getByTestId("estado-busqueda");
  await enfocarLector(page);
  await page.keyboard.press("Control+f");
  const caja = page.getByRole("searchbox", { name: t.searchLabel });
  await caja.fill("rosa");
  await expect(cuenta).toHaveText(t.searchCount(1, BUSQUEDA.rosa.todas));
  await boton(page, t.searchWholeWord).click();
  await expect(cuenta).toHaveText(t.searchCount(1, BUSQUEDA.rosa.palabra));
  // F3 / Mayús+F3 desde el campo y desde fuera.
  await caja.press("F3");
  await expect(cuenta).toHaveText(t.searchCount(2, BUSQUEDA.rosa.palabra));
  await enfocarLector(page);
  await page.keyboard.press("F3");
  await expect(cuenta).toHaveText(t.searchCount(3, BUSQUEDA.rosa.palabra));
  await page.keyboard.press("Shift+F3");
  await expect(cuenta).toHaveText(t.searchCount(2, BUSQUEDA.rosa.palabra));
  await boton(page, t.searchWholeWord).click();
  await boton(page, t.searchMatchCase).click();
  await caja.fill("ROSA");
  await expect(cuenta).toHaveText(t.searchCount(1, BUSQUEDA.rosa.mayusculas));
  await expect(marco(page, 1).locator("mark.activa")).toHaveText("ROSA");
  await boton(page, t.searchMatchCase).click();
  await caja.fill(BUSQUEDA.partida);
  await expect(cuenta).toHaveText(t.searchCount(1, 1));
  // Las dos mitades de «pala-⏎bra», resaltadas cada una en su línea.
  await expect(marco(page, 1).locator("mark.activa")).toHaveCount(2);
  await expect(marco(page, 1).locator("mark.activa").first()).toHaveText("pala");
  await expect(marco(page, 1).locator("mark.activa").last()).toHaveText("bra");
  // Con la búsqueda cerrada, F3 no es de BPDF.
  await caja.press("Escape");
  await enfocarLector(page);
  await page.keyboard.press("F3");
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  limpia(v);
});

test("miniaturas: ↑ / ↓ mueven el foco en el panel sin mover el documento", async ({ page }) => {
  const v = await cargar(page);
  await boton(page, t.showThumbnails).click();
  const panel = page.getByRole("navigation", { name: t.thumbnails });
  const mini = (n: number) => panel.getByRole("button", { name: t.thumbnail(n), exact: true });
  await mini(1).focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(mini(3)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(mini(2)).toBeFocused();
  await expect(estado(page)).toHaveText(t.status.page(1, 8));
  await page.keyboard.press("Enter");
  await expect(estado(page)).toHaveText(t.status.page(2, 8));
  // Tab sale del panel: solo una miniatura está en el orden de tabulación.
  await expect(panel.locator('button[tabindex="0"]')).toHaveCount(1);
  limpia(v);
});

// ── 21. 300 páginas ────────────────────────────────────────────────────────────

test("300 páginas: abre enseguida, recorre y salta sin acumular lienzos", async ({ page }) => {
  const v = await abrir(page);
  const inicio = Date.now();
  await abrirPdf(page, {
    name: "grande.pdf",
    mimeType: "application/pdf",
    buffer: crearPdfGrande(300),
  });
  await listo(page, 1);
  expect(Date.now() - inicio).toBeLessThan(10_000);
  const visor = page.getByTestId("visor-pdf");
  const maximo = { lienzos: 0 };
  const medir = async () => {
    maximo.lienzos = Math.max(maximo.lienzos, Number(await visor.getAttribute("data-lienzos")));
  };
  for (let i = 1; i <= 20; i++) {
    await lector(page).evaluate((el, f) => {
      el.scrollTop = el.scrollHeight * f;
    }, i / 20);
    await medir();
  }
  await irA(page, 150);
  await medir();
  await enfocarLector(page);
  for (let i = 0; i < 15; i++) await page.keyboard.press("PageDown");
  await expect(estado(page)).toHaveText(t.status.page(165, 300));
  await listo(page, 165);
  await medir();
  expect(maximo.lienzos).toBeLessThanOrEqual(4);
  await expect(page.locator("[data-pagina]")).not.toHaveCount(300);
  limpia(v);
});

test("el propio origen no sirve WebAssembly, el motor de JavaScript de PDF ni el sandbox", async ({
  request,
}) => {
  for (const ruta of [
    "/pdfjs/wasm/openjpeg.wasm",
    "/pdfjs/wasm/qcms_bg.wasm",
    "/pdfjs/wasm/quickjs-eval.wasm",
    "/pdfjs/pdf.sandbox.min.mjs",
    "/spike.html",
  ]) {
    expect((await request.get(ruta)).status(), ruta).toBe(404);
  }
  expect((await request.get("/pdfjs/pdf.worker.min.mjs")).status()).toBe(200);
});
