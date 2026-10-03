import path from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Accesibilidad (Fase 13): axe en cada pantalla y estado contra la build real, y lo
 * que axe no ve (teclado, foco, diálogos, el separador y la barra del visor).
 *
 * axe no equivale a «accesible»: comprueba reglas automáticas (nombres, roles,
 * contraste, ARIA válido…). El teclado y el foco se prueban aquí aparte, y la revisión
 * con un lector de pantalla es manual (docs/FASES.md, Fase 13).
 */

const FIX = path.join(import.meta.dirname, "../../tests/fixtures");
const md = (f: string) => path.join(FIX, "markdown", f);
const PDF = path.join(FIX, "pdf/visor/visor.pdf");
const PROTEGIDO = path.join(FIX, "pdf/visor/protegido.pdf");
const t = messages.pdf;

/** WCAG 2.0, 2.1 y 2.2 A y AA: lo que exige el objetivo de BPDF (PLAN §10). */
const NORMAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function sinViolaciones(page: Page, pantalla: string, incluir?: string) {
  let builder = new AxeBuilder({ page }).withTags(NORMAS);
  if (incluir) builder = builder.include(incluir);
  const r = await builder.analyze();
  const resumen = r.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
  );
  expect(resumen, `${pantalla}: violaciones de axe`).toEqual([]);
}

function limpia(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

async function elegir(page: Page, boton: Locator, fichero: string | string[]) {
  const [selector] = await Promise.all([page.waitForEvent("filechooser"), boton.click()]);
  await selector.setFiles(fichero);
}
const botonAbrir = (page: Page) => page.getByRole("button", { name: messages.open.button }).first();
const pdfListo = (page: Page) =>
  expect(page.locator('[data-pagina="1"][data-estado="lista"]')).toBeVisible({
    timeout: 30_000,
  });
const foco = (page: Page) =>
  page.evaluate(() => {
    const e = document.activeElement;
    if (!e || e === document.body) return "body";
    return e.getAttribute("aria-label") || e.textContent?.trim().slice(0, 40) || e.tagName;
  });

// ── axe, pantalla a pantalla ───────────────────────────────────────────────────

test("axe: pantalla vacía, error de apertura y pantalla estrecha", async ({ page }) => {
  const v = await abrir(page);
  await sinViolaciones(page, "vacía");
  await elegir(page, botonAbrir(page), path.join(FIX, "otros/nota.txt"));
  await expect(page.getByRole("alert")).toBeVisible();
  await sinViolaciones(page, "error de apertura");
  await page.setViewportSize({ width: 375, height: 740 });
  await page.goto("/");
  await sinViolaciones(page, "vacía a 375 px");
  limpia(v);
});

test("axe: visor PDF con búsqueda, miniaturas y la ayuda de atajos", async ({ page }) => {
  const v = await abrir(page);
  await elegir(page, botonAbrir(page), PDF);
  await pdfListo(page);
  await sinViolaciones(page, "visor PDF");
  await page.getByRole("button", { name: t.search, exact: true }).click();
  await page.getByRole("searchbox", { name: t.searchLabel }).fill("búsqueda");
  await page.getByRole("button", { name: t.showThumbnails }).click();
  await expect(page.locator("[data-miniatura]").first()).toBeVisible();
  await sinViolaciones(page, "visor PDF con búsqueda y miniaturas");
  await page.getByRole("button", { name: t.shortcuts, exact: true }).click();
  await expect(page.getByRole("dialog", { name: t.help.title })).toBeVisible();
  await sinViolaciones(page, "ayuda de atajos");
  limpia(v);
});

test("axe: Markdown con índice, código, fórmulas y diagramas; editor en edición y dividido", async ({
  page,
}) => {
  const v = await abrir(page);
  await elegir(page, botonAbrir(page), md("indice.md"));
  await expect(page.getByRole("navigation", { name: messages.markdown.tocLabel })).toBeVisible();
  await sinViolaciones(page, "Markdown con índice");
  await elegir(
    page,
    page.getByRole("banner").getByRole("button", { name: messages.open.button }),
    md("codigo.md"),
  );
  await expect(page.locator(".md-codigo").first()).toBeVisible();
  await sinViolaciones(page, "Markdown con código");
  await elegir(
    page,
    page.getByRole("banner").getByRole("button", { name: messages.open.button }),
    md("diagramas.md"),
  );
  await expect(page.locator('article img[src^="blob:"]').first()).toBeVisible({ timeout: 30_000 });
  await sinViolaciones(page, "Markdown con diagramas");
  const m = messages.markdown;
  await page.getByRole("button", { name: m.mode.edicion, exact: true }).click();
  await expect(page.getByRole("textbox", { name: m.editor.label })).toBeVisible();
  await sinViolaciones(page, "editor (edición)");
  await page.getByRole("button", { name: m.mode.dividido, exact: true }).click();
  await expect(page.getByRole("separator", { name: m.split.separator })).toBeVisible();
  await sinViolaciones(page, "editor (dividido)");
  limpia(v);
});

test("axe: diálogos de preferencias, contraseña, cambios sin guardar y elección de Markdown", async ({
  page,
}) => {
  const v = await abrir(page);
  page.on("dialog", (d) => d.dismiss());
  // Preferencias.
  await page.getByRole("banner").getByRole("button", { name: messages.preferences.open }).click();
  await expect(page.getByRole("dialog", { name: messages.preferences.title })).toBeVisible();
  await sinViolaciones(page, "preferencias");
  await page.keyboard.press("Escape");
  // Contraseña.
  await elegir(page, botonAbrir(page), PROTEGIDO);
  await expect(page.getByRole("dialog", { name: t.password.title })).toBeVisible();
  await sinViolaciones(page, "contraseña");
  await page.keyboard.press("Escape");
  // Elegir Markdown de una carpeta con varios.
  await elegir(
    page,
    page.getByRole("button", { name: messages.open.folder }).first(),
    md("recursos-varios"),
  );
  await expect(page.getByRole("heading", { name: messages.chooseMarkdown.title })).toBeFocused();
  await sinViolaciones(page, "elegir Markdown");
  await page.getByRole("button", { name: "a.md" }).click();
  // Cambios sin guardar.
  await page.getByRole("button", { name: messages.markdown.mode.edicion, exact: true }).click();
  await page.getByRole("textbox", { name: messages.markdown.editor.label }).click();
  await page.keyboard.type("cambio");
  // Abrir otro con cambios: se elige el fichero y entonces se pide confirmar.
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.keyboard.press("ControlOrMeta+o"),
  ]);
  await selector.setFiles(md("basico.md"));
  await expect(page.getByRole("dialog", { name: messages.discard.title })).toBeVisible();
  await sinViolaciones(page, "cambios sin guardar");
  limpia(v);
});

// ── Teclado y foco ─────────────────────────────────────────────────────────────

test("barra del visor: una sola parada de Tab, ← / → entre controles y foco visible", async ({
  page,
}) => {
  const v = await abrir(page);
  await elegir(page, botonAbrir(page), PDF);
  await pdfListo(page);
  const barra = page.getByRole("toolbar", { name: t.toolbar });
  const miniaturas = page.getByRole("button", { name: t.showThumbnails });
  // Desde «Cerrar documento», un Tab entra en la barra por su primer control…
  await page.getByRole("button", { name: t.close }).first().focus();
  await page.keyboard.press("Tab");
  await expect(miniaturas).toBeFocused();
  // …y el siguiente ya sale de ella.
  await page.keyboard.press("Tab");
  expect(await barra.evaluate((b) => b.contains(document.activeElement))).toBe(false);
  // Con las flechas, por dentro (el «anterior» desactivado de la página 1 se salta).
  await page.keyboard.press("Shift+Tab");
  await expect(miniaturas).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("textbox", { name: t.pageInput })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("button", { name: t.next })).toBeFocused();
  // El foco se ve: el navegador pinta su anillo (`:focus-visible`).
  expect(
    await page
      .getByRole("button", { name: t.next })
      .evaluate((b) => b.matches(":focus-visible") && getComputedStyle(b).outlineStyle !== "none"),
  ).toBe(true);
  // Volver a la barra con Tab lleva al último control usado.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: t.next })).toBeFocused();
  // Los atajos siguen: Fin lleva a la última página aunque el foco esté en la barra.
  await page.keyboard.press("End");
  await expect(page.getByTestId("estado-pagina")).toHaveText(t.status.page(5, 5));
  limpia(v);
});

test("diálogos: foco inicial, Esc cierra y el foco vuelve a donde estaba", async ({ page }) => {
  const v = await abrir(page);
  // Preferencias: desde su botón, y de vuelta a él.
  const prefs = page.getByRole("banner").getByRole("button", { name: messages.preferences.open });
  await prefs.focus();
  await page.keyboard.press("Enter");
  const dialogo = page.getByRole("dialog", { name: messages.preferences.title });
  await expect(dialogo).toBeVisible();
  expect(await dialogo.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  // El foco no sale del diálogo con Tab (modal: el resto de la página es inerte).
  for (let i = 0; i < 25; i++) {
    await page.keyboard.press("Tab");
    const dentro = await dialogo.evaluate(
      (d) => d.contains(document.activeElement) || document.activeElement === document.body,
    );
    expect(dentro, `Tab ${i + 1} sale del diálogo`).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(prefs).toBeFocused();

  // Ayuda de atajos del visor: con «?» y de vuelta.
  await elegir(page, botonAbrir(page), PDF);
  await pdfListo(page);
  const ayuda = page.getByRole("button", { name: t.shortcuts, exact: true });
  await ayuda.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: t.help.title })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(ayuda).toBeFocused();

  // Contraseña: el foco empieza en el campo; Esc cancela y el foco no se pierde.
  await elegir(
    page,
    page.getByRole("banner").getByRole("button", { name: messages.open.button }),
    PROTEGIDO,
  );
  await expect(page.getByRole("textbox", { name: t.password.label })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: t.password.title })).toBeHidden();
  // El foco se asienta un fotograma después (`requestAnimationFrame`): nunca en <body>.
  await expect.poll(() => foco(page)).not.toBe("body");
  limpia(v);
});

test("cambios sin guardar: el foco empieza en «Seguir editando» y, al seguir, vuelve al editor", async ({
  page,
}) => {
  const v = await abrir(page);
  await elegir(page, botonAbrir(page), md("basico.md"));
  const m = messages.markdown;
  await page.getByRole("button", { name: m.mode.edicion, exact: true }).click();
  const editor = page.getByRole("textbox", { name: m.editor.label });
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" cambio");
  // Ctrl/⌘+O desde el editor: se elige otro documento y entonces se pide confirmar.
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.keyboard.press("ControlOrMeta+o"),
  ]);
  await selector.setFiles(md("gfm.md"));
  const dialogo = page.getByRole("dialog", { name: messages.discard.title });
  await expect(dialogo).toBeVisible();
  await expect(page.getByRole("button", { name: messages.discard.cancel })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialogo).toBeHidden();
  await expect(editor).toBeFocused();
  limpia(v);
});

test("elegir Markdown de una carpeta: Esc cancela, como el botón", async ({ page }) => {
  const v = await abrir(page);
  await elegir(
    page,
    page.getByRole("button", { name: messages.open.folder }).first(),
    md("recursos-varios"),
  );
  const titulo = page.getByRole("heading", { name: messages.chooseMarkdown.title });
  await expect(titulo).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(titulo).toBeHidden();
  // El foco se asienta un fotograma después (`requestAnimationFrame`): nunca en <body>.
  await expect.poll(() => foco(page)).not.toBe("body");
  limpia(v);
});

test("separador de Dividido: 24 px de área, una línea fina, arrastrable con el puntero y sin desplazar con el dedo", async ({
  page,
}) => {
  const v = await abrir(page);
  await elegir(page, botonAbrir(page), md("basico.md"));
  const m = messages.markdown;
  await page.getByRole("button", { name: m.mode.dividido, exact: true }).click();
  const sep = page.getByRole("separator", { name: m.split.separator });
  const caja = await sep.boundingBox();
  if (!caja) throw new Error("sin caja");
  // WCAG 2.5.8: al menos 24 px de ancho para el puntero; lo pintado sigue siendo fino.
  expect(caja.width).toBeGreaterThanOrEqual(24);
  const linea = await sep.evaluate((s) => Number.parseFloat(getComputedStyle(s, "::before").width));
  expect(linea).toBeLessThanOrEqual(6);
  expect(await sep.evaluate((s) => getComputedStyle(s).touchAction)).toBe("none");
  // Arrastrar desde el BORDE del área (a 10 px de la línea): también funciona.
  const y = caja.y + caja.height / 2;
  await page.mouse.move(caja.x + 2, y);
  await page.mouse.down();
  await page.mouse.move(caja.x - 200, y, { steps: 5 });
  await page.mouse.up();
  expect(Number(await sep.getAttribute("aria-valuenow"))).toBeLessThan(50);
  limpia(v);
});
