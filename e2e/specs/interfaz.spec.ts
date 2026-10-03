import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { project } from "../../src/config/project";
import { messages } from "../../src/i18n/messages";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Fase 11 (UI/UX final) contra la build de producción, con la CSP real:
 * pantalla estrecha (D12), título de la ventana, «Acerca de», favicon y atajos
 * anunciados. Como siempre: cero errores de consola, cero violaciones de CSP y
 * ninguna petición externa.
 */

const t = messages.pdf;
const p = messages.preferences;
const PDF = "tests/fixtures/pdf/visor/visor.pdf";
const PROTEGIDO = "tests/fixtures/pdf/visor/protegido.pdf";
const paquete = JSON.parse(readFileSync("package.json", "utf8")) as {
  version: string;
  license: string;
};

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

const pdfListo = (page: Page) =>
  expect(page.locator('[data-pagina="1"][data-estado="lista"]')).toBeVisible({
    timeout: 30_000,
  });

async function abrirPreferencias(page: Page) {
  await page.getByRole("banner").getByRole("button", { name: p.open }).click();
  const dialogo = page.getByRole("dialog", { name: p.title });
  await expect(dialogo).toBeVisible();
  return dialogo;
}

/**
 * D12 en una pantalla: sin desplazamiento horizontal y ningún control de interfaz
 * de menos de 24 × 24 px (WCAG 2.5.8). No cuenta el CONTENIDO del documento (los
 * enlaces del texto de un Markdown, las anotaciones de un PDF: tamaño de texto,
 * excepción de la norma) ni lo oculto (el enlace de salto antes de recibir el foco).
 */
async function comprobarEstrecha(page: Page, pantalla: string) {
  const r = await page.evaluate(() => {
    const doc = document.documentElement;
    const controles = [
      ...document.querySelectorAll(
        "button, a[href], input:not([type=hidden]), select, textarea, summary, [role=separator]",
      ),
    ] as HTMLElement[];
    const pequenos = controles
      .filter((el) => !el.closest("article, [data-testid=lector-pdf]"))
      .filter((el) => el.checkVisibility())
      .filter((el) => getComputedStyle(el).clipPath === "none")
      .map((el) => {
        const c = el.getBoundingClientRect();
        const nombre =
          el.getAttribute("aria-label") ||
          (el as HTMLInputElement).labels?.[0]?.textContent?.trim() ||
          (el.textContent ?? "").trim().slice(0, 40) ||
          el.tagName;
        return `${nombre} (${Math.round(c.width)}×${Math.round(c.height)})`;
      })
      .filter((s) => {
        const m = /\((\d+)×(\d+)\)$/.exec(s);
        return m !== null && (Number(m[1]) < 24 || Number(m[2]) < 24);
      });
    return { desborda: doc.scrollWidth > doc.clientWidth, pequenos };
  });
  expect(r.desborda, `${pantalla}: desplazamiento horizontal`).toBe(false);
  expect(r.pequenos, `${pantalla}: controles de menos de 24 px`).toEqual([]);
}

test.describe("pantalla estrecha (D12, 375 px)", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("vacía, preferencias, PDF (búsqueda, miniaturas, ayuda) y contraseña", async ({ page }) => {
    const v = await abrir(page);
    await comprobarEstrecha(page, "vacía");
    await abrirPreferencias(page);
    await comprobarEstrecha(page, "preferencias");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await abrirFichero(page, PDF);
    await pdfListo(page);
    await comprobarEstrecha(page, "PDF");
    await page.getByRole("button", { name: t.search, exact: true }).click();
    await page.getByRole("button", { name: t.showThumbnails }).click();
    await expect(page.getByRole("searchbox")).toBeVisible();
    await comprobarEstrecha(page, "PDF con búsqueda y miniaturas");
    await page.getByRole("button", { name: t.shortcuts }).click();
    await expect(page.getByRole("dialog", { name: t.help.title })).toBeVisible();
    await comprobarEstrecha(page, "ayuda de atajos");
    await page.keyboard.press("Escape");

    await abrirFichero(page, PROTEGIDO);
    await expect(page.getByRole("dialog", { name: t.password.title })).toBeVisible();
    await comprobarEstrecha(page, "contraseña");
    limpia(v);
  });

  test("Markdown: lectura con índice, edición, dividido y cambios sin guardar", async ({
    page,
  }) => {
    const v = await abrir(page);
    await abrirFichero(page, "tests/fixtures/markdown/indice.md");
    await expect(page.getByRole("article")).toBeVisible();
    await comprobarEstrecha(page, "Markdown");
    await page.getByRole("button", { name: messages.markdown.toc }).click();
    await expect(page.getByRole("navigation", { name: messages.markdown.tocLabel })).toBeVisible();
    await comprobarEstrecha(page, "Markdown con el índice");
    await page.getByRole("button", { name: messages.markdown.mode.edicion }).click();
    await expect(page.getByRole("textbox", { name: messages.markdown.editor.label })).toBeVisible();
    await comprobarEstrecha(page, "edición");
    await page.getByRole("textbox", { name: messages.markdown.editor.label }).press("End");
    await page.keyboard.type(" cambio");
    await page.getByRole("button", { name: messages.markdown.mode.dividido }).click();
    await comprobarEstrecha(page, "dividido");
    await abrirFichero(page, PDF);
    await expect(page.getByRole("dialog", { name: messages.discard.title })).toBeVisible();
    await comprobarEstrecha(page, "cambios sin guardar");
    limpia(v);
  });
});

test("título de la ventana: siempre el del producto, nunca el nombre del documento", async ({
  page,
}) => {
  const v = await abrir(page);
  await expect(page).toHaveTitle(project.name);
  const nombrePdf = "zq-titulo-privado-8812.pdf";
  await abrirFichero(page, { name: nombrePdf, mimeType: "", buffer: readFileSync(PDF) });
  await pdfListo(page);
  expect(await page.title()).toBe(project.name);
  const nombreMd = "zq-titulo-privado-5530.md";
  await abrirFichero(page, { name: nombreMd, mimeType: "", buffer: Buffer.from("# Hola") });
  await expect(page.getByRole("heading", { level: 1, name: nombreMd })).toBeVisible();
  expect(await page.title()).toBe(project.name);
  expect(await page.title()).not.toContain("zq-");
  limpia(v);
});

test("«Acerca de» en Preferencias: versión real, licencia y privacidad, sin enlaces", async ({
  page,
}) => {
  const v = await abrir(page);
  const dialogo = await abrirPreferencias(page);
  const acerca = dialogo.getByRole("region", { name: p.about.title(project.name) });
  await expect(acerca).toContainText(p.about.version(paquete.version));
  await expect(acerca).toContainText(p.about.license(paquete.license));
  await expect(acerca).toContainText(messages.emptyState.privacy);
  await expect(acerca.getByRole("link")).toHaveCount(0);
  limpia(v);
});

test("favicon: del propio origen, SVG, con las cabeceras de la app y sin 404", async ({ page }) => {
  const v = await abrir(page);
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute("href", "/favicon.svg");
  const r = await page.request.get("/favicon.svg");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("image/svg+xml");
  expect(r.headers()["content-security-policy"]).toContain("default-src 'none'");
  expect(r.headers()["x-content-type-options"]).toBe("nosniff");
  limpia(v);
});

test("los botones anuncian su atajo, y los de una tecla solo si están activados", async ({
  page,
}) => {
  const v = await abrir(page);
  await expect(page.getByRole("button", { name: messages.open.button }).first()).toHaveAttribute(
    "aria-keyshortcuts",
    "Control+O Meta+O",
  );
  await abrirFichero(page, PDF);
  await pdfListo(page);
  const acercar = page.getByRole("button", { name: t.zoomIn, exact: true });
  await expect(acercar).toHaveAttribute(
    "title",
    messages.withShortcut(t.zoomIn, messages.keys.acercar),
  );
  await expect(acercar).toHaveAttribute("aria-keyshortcuts", "Control+Plus Meta+Plus");
  const miniaturas = page.getByRole("button", { name: t.showThumbnails });
  await expect(miniaturas).toHaveAttribute("aria-keyshortcuts", "T");
  const dialogo = await abrirPreferencias(page);
  await dialogo.getByRole("checkbox", { name: p.singleKey }).uncheck();
  await page.keyboard.press("Escape");
  await expect(miniaturas).not.toHaveAttribute("aria-keyshortcuts");
  await expect(miniaturas).toHaveAttribute("title", t.showThumbnails);
  limpia(v);
});

test("mención a R3ZON: discreta, solo sin documento, y abre r3zon.com por el mecanismo externo", async ({
  page,
}) => {
  // Se sustituye `window.open` para ver qué pide abrir la app sin abrir nada.
  await page.addInitScript(() => {
    const w = window as unknown as { __abiertas: unknown[][] };
    w.__abiertas = [];
    window.open = (...args: unknown[]) => {
      w.__abiertas.push(args);
      return null;
    };
  });
  const v = await abrir(page);
  const pie = page.getByRole("contentinfo");
  await expect(pie).toContainText(project.name);
  await expect(pie).toContainText(messages.credits.free);
  const enlace = pie.getByRole("link", { name: project.organization });
  await expect(enlace).toHaveAttribute("href", "https://r3zon.com");
  await expect(pie.getByRole("link")).toHaveCount(1);
  await enlace.click();
  await enlace.click({ button: "middle" });
  expect(
    await page.evaluate(() => (window as unknown as { __abiertas: unknown[][] }).__abiertas),
  ).toEqual([["https://r3zon.com/", "_blank", "noopener,noreferrer"]]); // la forma canónica que da `URL` al revalidarla
  expect(new URL(page.url()).pathname).toBe("/");
  // Con un documento abierto, el pie no está: no quita sitio al visor.
  await abrirFichero(page, PDF);
  await pdfListo(page);
  await expect(page.getByRole("link", { name: project.organization })).toHaveCount(0);
  // Ninguna petición a r3zon.com ni a ningún otro origen (lo vigila `limpia`).
  limpia(v);
});
