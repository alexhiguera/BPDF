import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";
import { GEOMETRIA } from "../../tests/fixtures/pdf/modo-oscuro/generar.mjs";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Preferencias y posición de lectura (Fase 10, docs/FASES.md → Fase 10) contra la
 * build de producción, con la CSP real. Como siempre: cero errores de consola,
 * cero violaciones de CSP y ninguna petición externa.
 *
 * La posición se prueba con `modo-oscuro.pdf`, el fixture versionado con más
 * páginas (8): ir a la 7, recargar, reabrir.
 */

const p = messages.preferences;
const t = messages.pdf;
const OSCURO = "tests/fixtures/pdf/modo-oscuro/modo-oscuro.pdf";
const CLAVES = ["bpdf:positions", "bpdf:prefs"];

type Fichero = string | { name: string; mimeType: string; buffer: Buffer };

function limpia(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

async function abrirFichero(page: Page, fichero: Fichero) {
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: messages.open.button }).first().click(),
  ]);
  await selector.setFiles(fichero);
}

const estado = (page: Page) => page.getByTestId("estado-pagina");
const listo = (page: Page, n: number) =>
  expect(page.locator(`[data-pagina="${n}"][data-estado="lista"]`)).toBeVisible({
    timeout: 30_000,
  });

/**
 * Cerrar el PDF con todo ya pintado. Cerrar a mitad de un pintado deja hoy un
 * rechazo «worker-destruido» en consola: es anterior a la Fase 10 (medido también
 * con el código de antes) y está en TAREAS; aquí se prueba la posición, no eso.
 */
async function cerrarQuieto(page: Page) {
  await expect(page.locator('[data-pagina][data-estado="pintando"]')).toHaveCount(0);
  await page.getByRole("button", { name: t.close }).click();
}

async function abrirPdf(page: Page, fichero: Fichero = OSCURO) {
  await abrirFichero(page, fichero);
  await expect(page.getByTestId("visor-pdf")).toBeVisible({ timeout: 30_000 });
}

async function irA(page: Page, n: number) {
  const campo = page.getByRole("textbox", { name: t.pageInput });
  await campo.fill(String(n));
  await campo.press("Enter");
  await expect(estado(page)).toHaveText(t.status.page(n, GEOMETRIA.paginas));
}

const almacen = (page: Page) =>
  page.evaluate(() => ({
    local: Object.entries(localStorage),
    sesion: Object.entries(sessionStorage),
  }));
const leer = (page: Page, clave: string) => page.evaluate((k) => localStorage.getItem(k), clave);

async function abrirPreferencias(page: Page) {
  await page.getByRole("banner").getByRole("button", { name: p.open }).click();
  const dialogo = page.getByRole("dialog", { name: p.title });
  await expect(dialogo).toBeVisible();
  return dialogo;
}

test("posición: ir a la página 7, recargar y reabrir el mismo PDF vuelve a la 7 con su zoom", async ({
  page,
}) => {
  const v = await abrir(page);
  await abrirPdf(page);
  await listo(page, 1);
  await irA(page, 7);
  await page.getByRole("button", { name: t.zoomIn, exact: true }).click();
  const zoom = await page.getByRole("button", { name: /^Zoom \d+ %/ }).textContent();
  // Se guarda 1 s después del último cambio.
  await expect.poll(() => leer(page, "bpdf:positions"), { timeout: 5000 }).toContain('"page":7');
  await page.reload();
  await abrirPdf(page);
  await expect(estado(page)).toHaveText(t.status.page(7, GEOMETRIA.paginas));
  await listo(page, 7);
  await expect(page.getByRole("button", { name: /^Zoom \d+ %/ })).toHaveText(zoom ?? "");
  // La clave es la huella de pdf.js, no el nombre.
  const posiciones = JSON.parse((await leer(page, "bpdf:positions")) ?? "{}");
  expect(Object.keys(posiciones.docs)).toHaveLength(1);
  expect(Object.keys(posiciones.docs)[0]).toMatch(/^[0-9a-f]+$/i);
  limpia(v);
});

test("posición: al cerrar el documento se guarda sin esperar", async ({ page }) => {
  const v = await abrir(page);
  await abrirPdf(page);
  await listo(page, 1);
  await irA(page, 5);
  await listo(page, 5);
  await cerrarQuieto(page);
  expect(await leer(page, "bpdf:positions")).toContain('"page":5');
  limpia(v);
});

test("posición: con «Recordar» desactivado el PDF vuelve a la página 1", async ({ page }) => {
  const v = await abrir(page);
  await abrirPdf(page);
  await listo(page, 1);
  await irA(page, 7);
  await expect.poll(() => leer(page, "bpdf:positions"), { timeout: 5000 }).toContain('"page":7');
  const dialogo = await abrirPreferencias(page);
  await dialogo.getByRole("checkbox", { name: p.remember }).uncheck();
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await page.reload();
  await abrirPdf(page);
  await listo(page, 1);
  await expect(estado(page)).toHaveText(t.status.page(1, GEOMETRIA.paginas));
  // Desactivar no borra lo guardado.
  expect(await leer(page, "bpdf:positions")).toContain('"page":7');
  limpia(v);
});

test("«Olvidar posiciones guardadas» vacía bpdf:positions y el PDF vuelve a empezar", async ({
  page,
}) => {
  const v = await abrir(page);
  await abrirPdf(page);
  await listo(page, 1);
  await irA(page, 6);
  await expect.poll(() => leer(page, "bpdf:positions"), { timeout: 5000 }).not.toBeNull();
  await cerrarQuieto(page);
  const dialogo = await abrirPreferencias(page);
  await dialogo.getByRole("button", { name: p.forget }).click();
  await expect(dialogo.getByRole("status")).toHaveText(p.forgotten);
  expect(await leer(page, "bpdf:positions")).toBeNull();
  await dialogo.getByRole("button", { name: p.close }).click();
  await abrirPdf(page);
  await listo(page, 1);
  await expect(estado(page)).toHaveText(t.status.page(1, GEOMETRIA.paginas));
  limpia(v);
});

test("preferencias sin documento abierto: el botón está, el diálogo es modal y el foco vuelve", async ({
  page,
}) => {
  const v = await abrir(page);
  const boton = page.getByRole("banner").getByRole("button", { name: p.open });
  await expect(boton).toBeVisible();
  await boton.focus();
  const dialogo = await abrirPreferencias(page);
  expect(await page.evaluate(() => document.querySelector("dialog")?.matches(":modal"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await expect(boton).toBeFocused();
  // Abrir el diálogo no escribe nada.
  expect(await almacen(page)).toEqual({ local: [], sesion: [] });
  limpia(v);
});

test("las preferencias sobreviven a recargar y se aplican: PDF, atajos y tipografía de Markdown", async ({
  page,
}) => {
  const v = await abrir(page);
  let dialogo = await abrirPreferencias(page);
  await dialogo.getByRole("combobox", { name: p.mode }).selectOption("original");
  await dialogo.getByRole("combobox", { name: p.view }).selectOption("pagina");
  await dialogo.getByRole("combobox", { name: p.zoom }).selectOption("fijo:1.5");
  await dialogo.getByRole("combobox", { name: p.fontSize }).selectOption("22");
  await dialogo.getByRole("combobox", { name: p.width }).selectOption("estrecho");
  await dialogo.getByRole("checkbox", { name: p.singleKey }).uncheck();
  await page.keyboard.press("Escape");
  await page.reload();

  dialogo = await abrirPreferencias(page);
  await expect(dialogo.getByRole("combobox", { name: p.fontSize })).toHaveValue("22");
  await expect(dialogo.getByRole("checkbox", { name: p.singleKey })).not.toBeChecked();
  await page.keyboard.press("Escape");

  await abrirPdf(page);
  await listo(page, 1);
  await expect(page.getByTestId("lector-pdf")).toHaveAttribute("data-vista", "pagina");
  await expect(page.getByRole("button", { name: /^Zoom 150 %/ })).toBeVisible();
  await expect(page.getByRole("button", { name: t.modeOriginal, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  // Atajos de una tecla desactivados: T no abre las miniaturas.
  await page.getByTestId("lector-pdf").click({ position: { x: 4, y: 4 } });
  await page.keyboard.press("t");
  await expect(page.getByRole("navigation", { name: t.thumbnails })).toHaveCount(0);

  await abrirFichero(page, {
    name: "tipografia.md",
    mimeType: "",
    buffer: Buffer.from("# Tipografía\n\nUn párrafo."),
  });
  const contenido = page.locator(".md-contenido");
  await expect(contenido).toHaveAttribute("data-letra", "22");
  const estilo = await contenido.evaluate((el) => {
    const c = getComputedStyle(el);
    const ch = document.createElement("span");
    ch.textContent = "0";
    el.append(ch);
    const anchoCh = ch.getBoundingClientRect().width;
    ch.remove();
    return { letra: c.fontSize, maximo: Number.parseFloat(c.maxWidth) / anchoCh };
  });
  expect(estilo.letra).toBe("22px");
  expect(Math.round(estilo.maximo)).toBe(60);
  limpia(v);
});

test("tipografía por defecto: exactamente la de antes (17 px y 72 ch)", async ({ page }) => {
  const v = await abrir(page);
  await abrirFichero(page, { name: "a.md", mimeType: "", buffer: Buffer.from("# A\n\nTexto.") });
  const contenido = page.locator(".md-contenido");
  await expect(contenido).toHaveAttribute("data-letra", "17");
  expect(await contenido.evaluate((el) => getComputedStyle(el).fontSize)).toBe("17px");
  expect(await contenido.evaluate((el) => el.getAttribute("style"))).toBeNull();
  limpia(v);
});

test("abrir o cerrar las miniaturas se recuerda para el siguiente PDF", async ({ page }) => {
  const v = await abrir(page);
  await abrirPdf(page);
  await listo(page, 1);
  await page.getByRole("button", { name: t.showThumbnails }).click();
  await page.reload();
  await abrirPdf(page);
  await expect(page.getByRole("navigation", { name: t.thumbnails })).toBeVisible();
  limpia(v);
});

test("preferencias corruptas o de una versión futura: la app arranca con los valores por defecto y no las pisa", async ({
  page,
}) => {
  const v = await abrir(page);
  await page.evaluate(() => {
    localStorage.setItem("bpdf:prefs", "{esto no es json");
    localStorage.setItem("bpdf:positions", '{"v":1,"docs":"x"}');
  });
  await page.reload();
  let dialogo = await abrirPreferencias(page);
  await expect(dialogo.getByRole("combobox", { name: p.fontSize })).toHaveValue("17");
  await page.keyboard.press("Escape");
  await abrirPdf(page);
  await listo(page, 1);

  const futura = JSON.stringify({ v: 99, novedad: true });
  await page.evaluate((f) => {
    localStorage.setItem("bpdf:prefs", f);
    localStorage.setItem("bpdf:positions", f);
  }, futura);
  await page.reload();
  dialogo = await abrirPreferencias(page);
  await expect(dialogo.getByRole("checkbox", { name: p.remember })).toBeChecked();
  await page.keyboard.press("Escape");
  await abrirPdf(page);
  await listo(page, 1);
  await irA(page, 3);
  await cerrarQuieto(page);
  // Ninguna escritura automática las pisa.
  expect(await leer(page, "bpdf:prefs")).toBe(futura);
  expect(await leer(page, "bpdf:positions")).toBe(futura);
  limpia(v);
});

test("varias pestañas: un cambio en una se ve en la otra", async ({ page, context }) => {
  const v = await abrir(page);
  const otra = await context.newPage();
  await otra.goto("/");
  const dialogoOtra = await abrirPreferencias(otra);
  const dialogo = await abrirPreferencias(page);
  await dialogo.getByRole("combobox", { name: p.width }).selectOption("ancho");
  await expect(dialogoOtra.getByRole("combobox", { name: p.width })).toHaveValue("ancho");
  await otra.close();
  limpia(v);
});

test("privacidad: ni nombres ni contenido ni posición de Markdown en el almacenamiento", async ({
  page,
}) => {
  const v = await abrir(page);
  const NOMBRE_PDF = "zq-confidencial-7731.pdf";
  const NOMBRE_MD = "zq-diario-4412.md";
  const SECRETO = "contenido-ultrasecreto-5521";
  // Un Markdown abierto y recorrido: nada se guarda.
  await abrirFichero(page, {
    name: NOMBRE_MD,
    mimeType: "",
    buffer: Buffer.from(`# Diario\n\n${`${SECRETO}\n\n`.repeat(200)}`),
  });
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText(NOMBRE_MD);
  await page.getByRole("article").evaluate((a) => a.scrollTo(0, a.scrollHeight));
  await page.waitForTimeout(1500);
  expect(await almacen(page)).toEqual({ local: [], sesion: [] });

  // Un PDF con nombre conocido, con posición y preferencias guardadas.
  await abrirPdf(page, { name: NOMBRE_PDF, mimeType: "", buffer: readFileSync(OSCURO) });
  await listo(page, 1);
  await page.getByRole("button", { name: t.showThumbnails }).click();
  await irA(page, 4);
  await expect.poll(() => leer(page, "bpdf:positions"), { timeout: 5000 }).not.toBeNull();

  const { local, sesion } = await almacen(page);
  expect(local.map(([k]) => k).sort()).toEqual(CLAVES);
  expect(sesion).toEqual([]);
  const todo = JSON.stringify(local);
  for (const prohibido of [NOMBRE_PDF, NOMBRE_MD, SECRETO, "zq-", "7731", "4412", "Diario"]) {
    expect(todo).not.toContain(prohibido);
  }
  // Las preferencias guardadas no incluyen nada de búsqueda ni del editor.
  expect(Object.keys(JSON.parse((await leer(page, "bpdf:prefs")) ?? "{}")).sort()).toEqual([
    "atajosUnaTecla",
    "markdown",
    "pdf",
    "recordarPosicion",
    "v",
  ]);
  limpia(v);
});
