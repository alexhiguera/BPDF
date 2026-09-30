import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Apertura local de documentos (Fase 3) contra la build de producción: selector
 * del sistema, atajo, arrastrar y soltar, rechazo de ficheros no válidos y
 * nombres hostiles. En todos, al final: cero errores de consola, cero
 * violaciones de CSP y ninguna petición fuera del propio origen.
 */

const FIXTURES = path.join(import.meta.dirname, "../../tests/fixtures");
const PDF = path.join(FIXTURES, "pdf/minimo.pdf");
const MD = path.join(FIXTURES, "markdown/basico.md");
const TXT = path.join(FIXTURES, "otros/nota.txt");

/** Primeros bytes de un PNG, para un «PDF» falso. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

type Eleccion = Parameters<import("@playwright/test").FileChooser["setFiles"]>[0];

/** El título de la vista: el nombre del documento (el Markdown puede traer sus propios h1 después). */
const titulo = (page: Page) => page.getByRole("heading", { level: 1 }).first();
const botonAbrir = (page: Page) => page.getByRole("button", { name: messages.open.button });
const aviso = (page: Page) => page.getByRole("alert");

/** Pulsa el control y elige en el diálogo del sistema (que Playwright intercepta). */
async function elegir(page: Page, control: Locator, archivos: Eleccion) {
  const [selector] = await Promise.all([page.waitForEvent("filechooser"), control.click()]);
  expect(selector.isMultiple()).toBe(false);
  await selector.setFiles(archivos);
}

type Soltable = { name: string; bytes: number[] };

/**
 * Arrastra y suelta ficheros sobre la app con eventos sintéticos y un
 * `DataTransfer` real del navegador (Playwright no arrastra ficheros del
 * sistema). Comprueba de paso el aviso visual durante el arrastre.
 */
async function soltar(page: Page, ficheros: Soltable[]) {
  const dt = await page.evaluateHandle((fs) => {
    const dt = new DataTransfer();
    for (const f of fs) dt.items.add(new File([new Uint8Array(f.bytes)], f.name));
    return dt;
  }, ficheros);
  const destino = page.getByRole("main");
  await destino.dispatchEvent("dragenter", { dataTransfer: dt });
  await destino.dispatchEvent("dragover", { dataTransfer: dt });
  await expect(page.getByText(messages.dropZone.hint)).toBeVisible();
  await destino.dispatchEvent("drop", { dataTransfer: dt });
  await expect(page.getByText(messages.dropZone.hint)).toHaveCount(0);
}

const soltable = (ruta: string): Soltable => ({
  name: path.basename(ruta),
  bytes: Array.from(readFileSync(ruta)),
});

function limpia(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

test("estado inicial: sin documento, con el botón para abrir, el atajo y sin avisos", async ({
  page,
}) => {
  const v = await abrir(page);
  await expect(titulo(page)).toHaveText(messages.emptyState.title);
  await expect(botonAbrir(page)).toHaveCount(1);
  await expect(page.getByText(messages.open.shortcut)).toBeVisible();
  await expect(aviso(page)).toHaveCount(0);
  limpia(v);
});

test("abre un PDF con el selector y lo muestra en el visor", async ({ page }) => {
  const v = await abrir(page);
  await elegir(page, botonAbrir(page), PDF);
  await expect(titulo(page)).toHaveText("minimo.pdf");
  await expect(titulo(page)).toBeFocused();
  await expect(page.locator('[data-pagina="1"][data-estado="lista"]')).toBeVisible();
  await expect(page.getByTestId("estado-pagina")).toHaveText(messages.pdf.status.page(1, 1));
  limpia(v);
});

test("abre un Markdown con el selector y muestra su contenido", async ({ page }) => {
  const v = await abrir(page);
  await elegir(page, botonAbrir(page), MD);
  await expect(titulo(page)).toHaveText("basico.md");
  await expect(titulo(page)).toBeFocused();
  await expect(
    page.getByRole("article").getByRole("heading", { name: "Documento de prueba de BPDF" }),
  ).toBeVisible();
  limpia(v);
});

test("abrir otro documento sustituye al anterior", async ({ page }) => {
  const v = await abrir(page);
  await elegir(page, botonAbrir(page), PDF);
  await expect(titulo(page)).toHaveText("minimo.pdf");
  // Con un documento abierto, el botón está en la cabecera.
  await elegir(page, page.getByRole("banner").getByRole("button"), MD);
  await expect(titulo(page)).toHaveText("basico.md");
  await expect(page.getByText("minimo.pdf")).toHaveCount(0);
  // Del PDF no queda nada: ni su visor ni sus páginas.
  await expect(page.getByTestId("visor-pdf")).toHaveCount(0);
  await expect(page.locator("[data-pagina]")).toHaveCount(0);
  limpia(v);
});

test("cancelar el selector deja el documento abierto como estaba", async ({ page }) => {
  const v = await abrir(page);
  await elegir(page, botonAbrir(page), MD);
  await expect(titulo(page)).toHaveText("basico.md");
  await elegir(page, botonAbrir(page), []); // cerrar el diálogo sin elegir nada
  await expect(titulo(page)).toHaveText("basico.md");
  await expect(aviso(page)).toHaveCount(0);
  limpia(v);
});

test("Ctrl+O abre el selector de BPDF en lugar del del navegador", async ({ page }) => {
  const v = await abrir(page);
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.keyboard.press("Control+o"),
  ]);
  await selector.setFiles(PDF);
  await expect(titulo(page)).toHaveText("minimo.pdf");
  expect(page.url()).toMatch(/\/$/); // la pestaña sigue en la app
  limpia(v);
});

test("arrastrar y soltar abre un PDF y después un Markdown", async ({ page }) => {
  const v = await abrir(page);
  await soltar(page, [soltable(PDF)]);
  await expect(titulo(page)).toHaveText("minimo.pdf");
  await soltar(page, [soltable(MD)]);
  await expect(titulo(page)).toHaveText("basico.md");
  limpia(v);
});

test("rechaza un .txt, un PDF falso, un fichero vacío y soltar varios a la vez", async ({
  page,
}) => {
  const v = await abrir(page);
  const t = messages.documentError;

  await elegir(page, botonAbrir(page), TXT);
  await expect(aviso(page)).toContainText(t.title("nota.txt"));
  await expect(aviso(page)).toContainText(t.unsupported);

  await elegir(page, botonAbrir(page), {
    name: "falso.pdf",
    mimeType: "application/pdf",
    buffer: PNG,
  });
  await expect(aviso(page)).toContainText(t.notPdf);

  await elegir(page, botonAbrir(page), {
    name: "vacio.md",
    mimeType: "text/markdown",
    buffer: Buffer.alloc(0),
  });
  await expect(aviso(page)).toContainText(t.empty);

  await soltar(page, [soltable(PDF), soltable(MD)]);
  await expect(aviso(page)).toContainText(t.multiple);

  // Nada de eso abrió un documento, y el aviso se puede descartar.
  await expect(titulo(page)).toHaveText(messages.emptyState.title);
  await aviso(page).getByRole("button", { name: t.dismiss }).click();
  await expect(aviso(page)).toHaveCount(0);
  limpia(v);
});

test("un fichero rechazado no cierra el documento abierto", async ({ page }) => {
  const v = await abrir(page);
  await elegir(page, botonAbrir(page), PDF);
  await soltar(page, [soltable(TXT)]);
  await expect(aviso(page)).toContainText(messages.documentError.unsupported);
  await expect(titulo(page)).toHaveText("minimo.pdf");
  limpia(v);
});

test("un Markdown no UTF-8 se rechaza con su mensaje", async ({ page }) => {
  const v = await abrir(page);
  const utf16 = Buffer.from(`${String.fromCharCode(0xfeff)}# Hola`, "utf16le");
  await elegir(page, botonAbrir(page), {
    name: "utf16.md",
    mimeType: "text/markdown",
    buffer: utf16,
  });
  await expect(aviso(page)).toContainText(messages.documentError.notUtf8);
  limpia(v);
});

test.describe("nombres de fichero hostiles se muestran como texto", () => {
  const NOMBRES = [
    `<img src=x onerror="window.__bpdfXss='nombre'">.md`,
    `"><svg onload=alert(1)>.pdf`,
    `comillas "dobles" y 'simples'.md`,
    `año ñandú 日本語 🙂.md`,
    `con   varios   espacios.md`,
  ];
  for (const nombre of NOMBRES) {
    test(nombre, async ({ page }) => {
      const v = await abrir(page);
      page.on("dialog", (d) => {
        v.errores.push(`diálogo inesperado: ${d.message()}`);
        return d.dismiss();
      });
      const buffer = nombre.endsWith(".pdf") ? readFileSync(PDF) : Buffer.from("texto x");
      await elegir(page, botonAbrir(page), { name: nombre, mimeType: "", buffer });
      await expect(titulo(page)).toHaveText(nombre);
      // El nombre es texto: ni elementos dentro del título ni atributos de evento
      // en ninguna parte. (Los iconos SVG de la barra del visor son de BPDF.)
      await expect(titulo(page).locator("*")).toHaveCount(0);
      await expect(page.locator("main script, main [onload], main [onerror]")).toHaveCount(0);
      expect(
        await page.evaluate(() => (window as { __bpdfXss?: string }).__bpdfXss),
      ).toBeUndefined();
      limpia(v);
    });
  }
});

test("cerrar el documento vuelve al estado vacío", async ({ page }) => {
  const v = await abrir(page);
  await elegir(page, botonAbrir(page), MD);
  await page.getByRole("button", { name: messages.markdown.close }).click();
  await expect(titulo(page)).toHaveText(messages.emptyState.title);
  await expect(page.getByRole("main")).toBeFocused();
  limpia(v);
});
