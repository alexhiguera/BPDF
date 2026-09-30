import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Recursos locales de Markdown (Fase 7 bis) contra la build de producción, con
 * su CSP (`img-src 'self' blob:`). La regla que se comprueba: un Markdown solo
 * ve las imágenes que el usuario entregó; nunca las que existen en el disco
 * sin haberlas elegido (`fuera-de-recursos.png` está al lado de la carpeta).
 * En todos: cero errores de consola, cero violaciones de CSP, ninguna
 * petición fuera del propio origen.
 */
const t = messages.markdown.image;
const MD = path.join(import.meta.dirname, "../../tests/fixtures/markdown");
const RECURSOS = path.join(MD, "recursos");
const r = (...p: string[]) => path.join(RECURSOS, ...p);
const PDF = path.join(import.meta.dirname, "../../tests/fixtures/pdf/minimo.pdf");

const titulo = (page: Page) => page.getByRole("heading", { level: 1 }).first();
const articulo = (page: Page) => page.getByRole("article");
const imagen = (page: Page, nombre: string) =>
  articulo(page).getByRole("img", { name: nombre, exact: true });

function limpia(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

async function elegir(page: Page, boton: Locator, archivos: string | string[]) {
  const [selector] = await Promise.all([page.waitForEvent("filechooser"), boton.click()]);
  await selector.setFiles(archivos);
}
const botonArchivo = (page: Page) =>
  page.getByRole("button", { name: messages.open.button }).first();
const botonCarpeta = (page: Page) =>
  page.getByRole("button", { name: messages.open.folder }).first();

/** Tamaño real de la imagen pintada (0 si no se decodificó). */
async function anchoNatural(img: Locator) {
  await expect(img).toBeVisible();
  await expect
    .poll(() =>
      img.evaluate((e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  return img.evaluate((e) => (e as HTMLImageElement).naturalWidth);
}

async function vigilar(page: Page) {
  const v = await abrir(page);
  page.on("dialog", (d) => {
    v.errores.push(`diálogo inesperado: ${d.message()}`);
    return d.dismiss();
  });
  return v;
}

test("un Markdown suelto sigue abriéndose; sus imágenes locales son marcadores que explican cómo verlas", async ({
  page,
}) => {
  const v = await vigilar(page);
  await elegir(page, botonArchivo(page), r("documento.md"));
  await expect(titulo(page)).toHaveText("documento.md");
  await expect(articulo(page).locator("img")).toHaveCount(0);
  await expect(articulo(page).locator('[data-imagen="no-encontrado"]').first()).toContainText(
    t.local["no-encontrado"],
  );
  limpia(v);
});

test("Markdown + imagen elegidos a la vez: la imagen se ve; lo no elegido, no", async ({
  page,
}) => {
  const v = await vigilar(page);
  await elegir(page, botonArchivo(page), [r("documento.md"), r("imagen.png")]);
  await expect(titulo(page)).toHaveText("documento.md");
  expect(await anchoNatural(imagen(page, "Imagen"))).toBe(64);
  // Las dos referencias a imagen.png comparten URL.
  const srcs = await articulo(page)
    .locator('img[data-recurso="imagen.png"]')
    .evaluateAll((es) => es.map((e) => e.getAttribute("src")));
  expect(srcs).toHaveLength(2);
  expect(srcs[0]).toMatch(/^blob:http:\/\/localhost:\d+\//);
  expect(srcs[1]).toBe(srcs[0]);
  // El resto, que no se eligió (el subdirectorio no se puede elegir así), no.
  await expect(articulo(page).locator("img")).toHaveCount(2);
  limpia(v);
});

test("carpeta: todas las imágenes (subdirectorios, SVG, GIF, WebP, espacios, Unicode) y nada de fuera", async ({
  page,
}) => {
  const v = await vigilar(page);
  await elegir(page, botonCarpeta(page), RECURSOS);
  await expect(titulo(page)).toHaveText("documento.md");
  const anchos = {
    Imagen: 64,
    Logo: 120,
    Foto: 80,
    Diagrama: 96,
    "Dibujo WebP": 70,
    Píxel: 1,
    "Foto grande": 40,
    Año: 36,
  };
  for (const [nombre, ancho] of Object.entries(anchos)) {
    expect(await anchoNatural(imagen(page, nombre)), nombre).toBe(ancho);
  }
  const a = articulo(page);
  // Lo que no debe verse: inexistente, fuera de la carpeta (aunque EXISTE en disco), remota.
  await expect(a.locator('[data-imagen="no-encontrado"]')).toContainText("No existe");
  await expect(a.locator('[data-imagen="fuera"]')).toHaveCount(2);
  await expect(a.locator('[data-imagen="fuera"]').first()).toContainText(t.local.fuera);
  await expect(a.locator('[data-imagen="remota"]')).toContainText(t.remote);
  await expect(a.locator('img[data-recurso*="fuera"]')).toHaveCount(0);
  // El enlace a otro Markdown no se sigue.
  await expect(a.locator('[data-enlace="relativo"]')).toHaveText(/el otro/);
  // Solo imágenes blob: del propio origen; no-usada.png no tiene URL.
  const srcs = await a
    .locator("img")
    .evaluateAll((es) => es.map((e) => e.getAttribute("src") ?? ""));
  expect(srcs.every((s) => s.startsWith("blob:"))).toBe(true);
  await expect(a.locator('img[data-recurso="no-usada.png"]')).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  limpia(v);
});

test("SVG hostil: se ve como imagen, no ejecuta nada ni pide nada, tampoco abierto como página", async ({
  page,
}) => {
  const v = await vigilar(page);
  await elegir(page, botonCarpeta(page), RECURSOS);
  const svg = imagen(page, "SVG hostil");
  expect(await anchoNatural(svg)).toBe(90);
  await expect(page.locator("main svg:not(.lucide)")).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => (window as { __bpdfXss?: unknown }).__bpdfXss)).toBeUndefined();
  limpia(v);

  // Si alguien abriera la URL blob: como página (menú contextual → abrir imagen),
  // el documento SVG hereda la CSP de BPDF: su script en línea y su onload no se
  // ejecutan, y sus imágenes externas se INTENTAN pero la CSP las corta antes de
  // la red (`failure: csp`). Lo que se comprueba: ninguna llega a responder.
  const url = (await svg.getAttribute("src")) as string;
  const intentos: string[] = [];
  const respondidas: string[] = [];
  const cortadas: string[] = [];
  const esExterna = (u: string) => !u.startsWith("http://localhost") && !u.startsWith("blob:");
  page.context().on("request", (req) => {
    if (esExterna(req.url())) intentos.push(req.url());
  });
  page.context().on("response", (res) => {
    if (esExterna(res.url())) respondidas.push(res.url());
  });
  page.context().on("requestfailed", (req) => {
    if (esExterna(req.url()) && req.failure()?.errorText === "csp") cortadas.push(req.url());
  });
  const [ventana] = await Promise.all([
    page.waitForEvent("popup"),
    page.evaluate((u) => window.open(u, "_blank"), url),
  ]);
  await ventana.waitForLoadState();
  await ventana.waitForTimeout(300);
  expect(
    await ventana.evaluate(() => (window as { __bpdfXss?: unknown }).__bpdfXss),
  ).toBeUndefined();
  expect(respondidas).toEqual([]);
  expect(cortadas.sort()).toEqual(intentos.sort());
  // El script del SVG habría hecho este fetch: ni se intentó.
  expect(intentos).not.toContain("https://tracker.example/svg");
  await ventana.close();
});

test("varios Markdown elegidos a la vez: error claro, no se abre ninguno", async ({ page }) => {
  const v = await vigilar(page);
  await elegir(page, botonArchivo(page), [
    r("documento.md"),
    path.join(MD, "basico.md"),
    r("imagen.png"),
  ]);
  await expect(page.getByRole("alert")).toContainText(messages.documentError.severalMarkdown);
  await expect(titulo(page)).toHaveText(messages.emptyState.title);
  limpia(v);
});

test("carpeta con varios Markdown: se elige el principal y se ve con sus imágenes", async ({
  page,
}) => {
  const v = await vigilar(page);
  await elegir(page, botonCarpeta(page), path.join(MD, "recursos-varios"));
  const c = messages.chooseMarkdown;
  await expect(page.getByRole("heading", { name: c.title })).toBeFocused();
  const lista = page.getByRole("list", { name: c.list });
  await expect(lista.getByRole("button")).toHaveText(["a.md", "b.md"]);
  await lista.getByRole("button", { name: "b.md" }).click();
  await expect(titulo(page)).toHaveText("b.md");
  expect(await anchoNatural(imagen(page, "Img"))).toBe(30);
  limpia(v);
});

test("soltar un Markdown con su imagen la muestra", async ({ page }) => {
  const v = await vigilar(page);
  const ficheros = [
    { name: "documento.md", bytes: Array.from(readFileSync(r("documento.md"))) },
    { name: "imagen.png", bytes: Array.from(readFileSync(r("imagen.png"))) },
  ];
  const dt = await page.evaluateHandle((fs) => {
    const dt = new DataTransfer();
    for (const f of fs) dt.items.add(new File([new Uint8Array(f.bytes)], f.name));
    return dt;
  }, ficheros);
  const destino = page.getByRole("main");
  await destino.dispatchEvent("dragenter", { dataTransfer: dt });
  await destino.dispatchEvent("drop", { dataTransfer: dt });
  await expect(titulo(page)).toHaveText("documento.md");
  expect(await anchoNatural(imagen(page, "Imagen"))).toBe(64);
  limpia(v);
});

test("sustituir el documento revoca las URL del anterior; y de Markdown a PDF y vuelta", async ({
  page,
}) => {
  const v = await vigilar(page);
  await elegir(page, botonCarpeta(page), RECURSOS);
  await anchoNatural(imagen(page, "Imagen"));
  const viejas = await articulo(page)
    .locator("img")
    .evaluateAll((es) => [...new Set(es.map((e) => e.getAttribute("src") as string))]);
  expect(viejas.length).toBeGreaterThan(5);

  await elegir(
    page,
    page.getByRole("banner").getByRole("button", { name: messages.open.button }),
    path.join(MD, "basico.md"),
  );
  await expect(titulo(page)).toHaveText("basico.md");
  // Una URL revocada ya no carga (se prueba como imagen: img-src permite blob:).
  // Cada intento deja en consola «Failed to load resource»: son de esta sonda.
  const antes = v.errores.length;
  const cargan = await page.evaluate(
    (urls) =>
      Promise.all(
        urls.map(
          (u) =>
            new Promise<boolean>((ok) => {
              const i = new Image();
              i.onload = () => ok(true);
              i.onerror = () => ok(false);
              i.src = u;
            }),
        ),
      ),
    viejas,
  );
  expect(cargan.every((c) => c === false)).toBe(true);
  await expect.poll(() => v.errores.length - antes).toBe(viejas.length);
  const deLaSonda = v.errores.splice(antes);
  expect(deLaSonda.every((e) => /Failed to load resource/.test(e))).toBe(true);

  await elegir(
    page,
    page.getByRole("banner").getByRole("button", { name: messages.open.button }),
    PDF,
  );
  await expect(titulo(page)).toHaveText("minimo.pdf");
  await expect(page.getByRole("article")).toHaveCount(0);
  await elegir(page, page.getByRole("banner").getByRole("button", { name: messages.open.button }), [
    r("documento.md"),
    r("imagen.png"),
  ]);
  expect(await anchoNatural(imagen(page, "Imagen"))).toBe(64);
  limpia(v);
});
