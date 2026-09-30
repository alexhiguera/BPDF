import path from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Visor Markdown (Fase 7) contra la build de producción, con su CSP. En todos:
 * cero errores de consola, cero violaciones de CSP y ninguna petición fuera
 * del propio origen (`vigilancia.ts`).
 */
const t = messages.markdown;
const FIXTURES = path.join(import.meta.dirname, "../../tests/fixtures");
const md = (f: string) => path.join(FIXTURES, "markdown", f);
const PDF = path.join(FIXTURES, "pdf/minimo.pdf");

const titulo = (page: Page) => page.getByRole("heading", { level: 1 }).first();
const articulo = (page: Page) => page.getByRole("article");

function limpia(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

/** Pulsa el control y elige el fichero en el diálogo del sistema. */
async function elegir(page: Page, control: Locator, fichero: string) {
  const [selector] = await Promise.all([page.waitForEvent("filechooser"), control.click()]);
  await selector.setFiles(fichero);
}

const botonAbrir = (page: Page) => page.getByRole("button", { name: messages.open.button }).first();

/** Abre la app vigilada y un Markdown. Cualquier diálogo (`alert`) es un fallo. */
async function cargar(page: Page, fichero: string): Promise<Vigilancia> {
  const v = await abrir(page);
  page.on("dialog", (d) => {
    v.errores.push(`diálogo inesperado: ${d.message()}`);
    return d.dismiss();
  });
  await elegir(page, botonAbrir(page), md(fichero));
  await expect(titulo(page)).toHaveText(fichero);
  return v;
}

/** Sustituye `window.open` para ver qué pide abrir la app sin abrir nada. */
async function interceptarVentanas(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __abiertas: unknown[][] };
    w.__abiertas = [];
    window.open = (...args: unknown[]) => {
      w.__abiertas.push(args);
      return null;
    };
  });
}
const abiertas = (page: Page) =>
  page.evaluate(() => (window as unknown as { __abiertas: unknown[][] }).__abiertas);

test("abre un Markdown y muestra encabezados, listas, tabla, cita y código", async ({ page }) => {
  const v = await cargar(page, "basico.md");
  await expect(titulo(page)).toBeFocused();
  const a = articulo(page);
  await expect(
    a.getByRole("heading", { level: 1, name: "Documento de prueba de BPDF" }),
  ).toBeVisible();
  await expect(a.getByRole("heading", { level: 2, name: "Lista" })).toBeVisible();
  await expect(a.locator("ul > li")).toHaveCount(4);
  await expect(a.locator("ul ul ul > li")).toHaveText(["Y de tercero"]);
  await expect(a.locator("ol > li")).toHaveText(["Uno", "Dos", "Tres"]);
  await expect(a.getByRole("table")).toBeVisible();
  await expect(a.getByRole("cell", { name: "B" })).toBeVisible();
  await expect(a.locator("blockquote")).toContainText("Leer de noche");
  await expect(a.locator("hr")).toHaveCount(1);
  await expect(a.locator("pre code")).toHaveText('const saludo = "hola";');
  // Viñetas y numeración visibles (el reset de Tailwind las quita).
  expect(
    await a
      .locator("ul")
      .first()
      .evaluate((e) => getComputedStyle(e).listStyleType),
  ).toBe("disc");
  limpia(v);
});

test("GFM: tabla alineada, tabla ancha con desplazamiento propio, tareas y notas al pie", async ({
  page,
}) => {
  const v = await cargar(page, "gfm.md");
  const a = articulo(page);
  await expect(a.getByRole("checkbox")).toHaveCount(3);
  await expect(a.getByRole("checkbox").first()).toBeChecked();
  await expect(a.getByRole("checkbox").first()).toBeDisabled();
  await expect(a.locator("del").first()).toHaveText("tachado");
  // La tabla ancha se desplaza dentro de su contenedor; la hoja no se ensancha.
  const ancha = a.locator(".md-tabla").nth(1);
  const medidas = await ancha.evaluate((e) => ({ scroll: e.scrollWidth, cliente: e.clientWidth }));
  expect(medidas.scroll).toBeGreaterThan(medidas.cliente);
  expect(await a.evaluate((e) => e.scrollWidth - e.clientWidth)).toBe(0);
  // La llamada a la nota lleva a la nota.
  await a.getByRole("link", { name: "1", exact: true }).click();
  await expect(page.locator("#md-fn-1")).toBeFocused();
  limpia(v);
});

test("código: resaltado con los colores del tema y botón de copiar que copia de verdad", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const v = await cargar(page, "codigo.md");
  const a = articulo(page);
  const bloques = a.locator(".md-codigo");
  await expect(bloques).toHaveCount(14);
  const python = bloques.nth(8);
  await expect(python.locator(".md-codigo-lenguaje")).toHaveText("python");
  const palabraClave = python.locator(".hljs-keyword").first();
  await expect(palabraClave).toHaveText("def");
  expect(await palabraClave.evaluate((e) => getComputedStyle(e).color)).toBe("rgb(198, 146, 234)");
  // El bloque de HTML es texto: ningún script ni enlace dentro.
  await expect(bloques.nth(5).locator("script, a")).toHaveCount(0);

  const copiar = python.getByRole("button", { name: t.code.copy });
  await copiar.click();
  await expect(python.getByRole("button", { name: t.code.copied })).toBeVisible();
  const copiado = await page.evaluate(() => navigator.clipboard.readText());
  expect(copiado).toBe(
    'def fib(n: int) -> int:\n    """Fibonacci."""\n    return n if n < 2 else fib(n - 1) + fib(n - 2)',
  );
  await expect(python.getByRole("button", { name: t.code.copy })).toBeVisible({ timeout: 5000 });
  limpia(v);
});

test("índice: lista los encabezados y salta a cada uno, también a los repetidos", async ({
  page,
}) => {
  const v = await cargar(page, "indice.md");
  // En escritorio el índice empieza abierto.
  const boton = page.getByRole("button", { name: t.toc });
  await expect(boton).toHaveAttribute("aria-expanded", "true");
  const indice = page.getByRole("navigation", { name: t.tocLabel });
  await expect(indice.getByRole("link")).toHaveCount(13);

  await indice.getByRole("link", { name: "Sección final" }).click();
  const destino = articulo(page).getByRole("heading", { name: "Sección final" });
  await expect(destino).toBeFocused();
  await expect(destino).toBeInViewport();

  await indice.getByRole("link", { name: "Requisitos" }).nth(1).click();
  await expect(page.locator("#md-requisitos-1")).toBeFocused();
  // La URL de la app no cambia: no hay navegación.
  expect(new URL(page.url()).hash).toBe("");

  // Los enlaces del propio documento a secciones también.
  await articulo(page).getByRole("link", { name: "instalación" }).click();
  await expect(page.locator('[id="md-instalación"]')).toBeFocused();
  limpia(v);
});

test("enlace externo: lo abre la plataforma en otra pestaña, sin navegar la app", async ({
  page,
}) => {
  await interceptarVentanas(page);
  const v = await cargar(page, "basico.md");
  const enlace = articulo(page).getByRole("link", { name: "enlace externo" });
  await expect(enlace).toHaveAttribute("rel", "noopener noreferrer");
  await expect(enlace).toHaveAttribute("target", "_blank");
  await enlace.click();
  await enlace.click({ button: "middle" });
  expect(await abiertas(page)).toEqual([
    ["https://example.com/bpdf", "_blank", "noopener,noreferrer"],
  ]);
  expect(new URL(page.url()).pathname).toBe("/");
  await expect(titulo(page)).toHaveText("basico.md");
  limpia(v);
});

test("Markdown malicioso: nada se ejecuta, nada se pide a la red y ningún href es peligroso", async ({
  page,
}) => {
  await interceptarVentanas(page);
  const v = await cargar(page, "seguridad.md");
  const a = articulo(page);
  await page.waitForLoadState("networkidle");

  // El HTML está a la vista como texto…
  await expect(a).toContainText(`<script>window.__bpdfXss = "script";</script>`);
  // …y nada de él es DOM.
  await expect(
    page.locator("main script, main iframe, main object, main embed, main img, main style"),
  ).toHaveCount(0);
  await expect(page.locator("main svg:not(.lucide)")).toHaveCount(0);
  await expect(
    page.locator("main [onload], main [onerror], main [ontoggle], main [onmouseover]"),
  ).toHaveCount(0);
  // La hoja de estilos del documento no se aplicó.
  expect(await page.evaluate(() => getComputedStyle(document.body).display)).not.toBe("none");

  // Solo dos enlaces con href: el externo permitido y el de la imagen remota.
  const hrefs = await a
    .locator("[href]")
    .evaluateAll((es) => es.map((e) => e.getAttribute("href")));
  expect(hrefs.sort()).toEqual([
    "https://example.com/permitido",
    "https://tracker.example/pixel.gif",
  ]);

  // Pulsar los enlaces bloqueados (y el relativo) no hace nada.
  const inertes = a.locator("[data-enlace]");
  await expect(inertes).toHaveCount(10);
  for (const inerte of await inertes.all()) await inerte.click();
  expect(await abiertas(page)).toEqual([]);
  expect(await page.evaluate(() => (window as { __bpdfXss?: unknown }).__bpdfXss)).toBeUndefined();
  expect(new URL(page.url()).href).toMatch(/\/$/);

  // Las imágenes no se cargan: marcadores, y el píxel espía nunca se pide.
  await expect(a.locator('[data-imagen="remota"]')).toContainText(t.image.remote);
  await expect(a.locator('[data-imagen="no-encontrado"]')).toContainText(
    t.image.local["no-encontrado"],
  );
  await expect(a.locator('[data-imagen="bloqueada"]')).toHaveCount(2);

  // Encabezados con prefijo: `location` sigue siendo la de la ventana.
  expect(await page.evaluate(() => typeof window.location.href)).toBe("string");
  await expect(page.locator("#md-location")).toHaveCount(1);
  limpia(v);
});

test("pasar de Markdown a PDF y de PDF a Markdown sustituye el documento", async ({ page }) => {
  const v = await cargar(page, "indice.md");
  await elegir(
    page,
    page.getByRole("banner").getByRole("button", { name: messages.open.button }),
    PDF,
  );
  await expect(titulo(page)).toHaveText("minimo.pdf");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: t.tocLabel })).toHaveCount(0);
  await expect(page.locator('[data-pagina="1"][data-estado="lista"]')).toBeVisible();

  await elegir(
    page,
    page.getByRole("banner").getByRole("button", { name: messages.open.button }),
    md("basico.md"),
  );
  await expect(titulo(page)).toHaveText("basico.md");
  await expect(page.locator("[data-pagina]")).toHaveCount(0);
  await expect(articulo(page).getByRole("heading", { name: "Lista" })).toBeVisible();

  await elegir(
    page,
    page.getByRole("banner").getByRole("button", { name: messages.open.button }),
    md("gfm.md"),
  );
  await expect(titulo(page)).toHaveText("gfm.md");
  await expect(page.getByRole("heading", { name: "Documento de prueba de BPDF" })).toHaveCount(0);

  await page.getByRole("button", { name: t.close }).click();
  await expect(titulo(page)).toHaveText(messages.emptyState.title);
  limpia(v);
});

test.describe("ventana estrecha", () => {
  test.use({ viewport: { width: 375, height: 740 } });

  test("sin desplazamiento horizontal de la página; el índice es un panel que se cierra al elegir", async ({
    page,
  }) => {
    const v = await cargar(page, "gfm.md");
    const ancho = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      cliente: document.documentElement.clientWidth,
    }));
    expect(ancho.scroll).toBeLessThanOrEqual(ancho.cliente);
    expect(await articulo(page).evaluate((e) => e.scrollWidth - e.clientWidth)).toBe(0);

    const boton = page.getByRole("button", { name: t.toc });
    await expect(boton).toHaveAttribute("aria-expanded", "false");
    await boton.click();
    const indice = page.getByRole("navigation", { name: t.tocLabel });
    await expect(indice).toBeVisible();
    await indice.getByRole("link", { name: "Notas al pie" }).click();
    await expect(indice).toHaveCount(0);
    await expect(
      articulo(page).getByRole("heading", { name: "Notas al pie" }).first(),
    ).toBeFocused();
    limpia(v);
  });
});

test("tema oscuro: la hoja, el texto y los enlaces usan los tokens, sin filtros", async ({
  page,
}) => {
  const v = await cargar(page, "basico.md");
  const estilos = await articulo(page).evaluate((a) => {
    const c = a.querySelector(".md-contenido") as HTMLElement;
    const enlace = a.querySelector('a[href^="https"]') as HTMLElement;
    const codigo = a.querySelector(".md-codigo") as HTMLElement;
    return {
      fondo: getComputedStyle(a).backgroundColor,
      texto: getComputedStyle(c).color,
      enlace: getComputedStyle(enlace).color,
      subrayado: getComputedStyle(enlace).textDecorationLine,
      fondoCodigo: getComputedStyle(codigo).backgroundColor,
      filtros: [a, c, ...a.querySelectorAll("*")].filter(
        (e) => getComputedStyle(e).filter !== "none",
      ).length,
      esquema: getComputedStyle(document.documentElement).colorScheme,
    };
  });
  expect(estilos).toEqual({
    fondo: "rgb(43, 43, 43)",
    texto: "rgb(236, 236, 236)",
    enlace: "rgb(128, 182, 255)",
    subrayado: "underline",
    fondoCodigo: "rgb(23, 23, 23)",
    filtros: 0,
    esquema: "dark",
  });
  limpia(v);
});

test("un Markdown grande (~1 MB): primero la barra y el aviso, después el contenido", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const v = await abrir(page);
  // Texto de lectura normal, con pocas listas. Muchas listas cortas son un caso
  // cuadrático del parser (mdast-util-from-markdown) que se mide aparte
  // (`npm run bench:markdown`, docs/ARCHITECTURE.md → visor Markdown).
  const relleno = "Texto de relleno de lectura normal. ".repeat(4);
  const seccion = (i: number) =>
    `## Sección ${i}\n\nPárrafo con **negrita**, *cursiva*, \`código\` y un [enlace](https://example.com/${i}). ${relleno}\n\n| a | b |\n|---|---|\n| ${i} | x |\n\n\`\`\`js\nconst n = ${i};\n\`\`\`\n\n`;
  let texto = "# Documento grande\n\n";
  for (let i = 0; texto.length < 1_000_000; i++) texto += seccion(i);
  // Anota si el aviso «Preparando…» llegó a estar en el DOM antes que el contenido.
  await page.evaluate(() => {
    const w = window as unknown as { __vioAviso: boolean };
    w.__vioAviso = false;
    new MutationObserver((_, o) => {
      if (document.querySelector("article [role=status]")) {
        w.__vioAviso = true;
        o.disconnect();
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    botonAbrir(page).click(),
  ]);
  const inicio = Date.now();
  await selector.setFiles({ name: "grande.md", mimeType: "", buffer: Buffer.from(texto) });
  await expect(
    articulo(page).getByRole("heading", { level: 1, name: "Documento grande" }),
  ).toBeVisible({ timeout: 60_000 });
  const ms = Date.now() - inicio;
  test.info().annotations.push({ type: "ms hasta ver 1 MB", description: String(ms) });
  const vioAviso = await page.evaluate(
    () => (window as unknown as { __vioAviso: boolean }).__vioAviso,
  );
  expect(vioAviso).toBe(true);
  await expect(articulo(page).locator(".md-contenido")).toHaveAttribute("aria-busy", "false");
  // Holgado: es una red contra regresiones, no la medición.
  expect(ms).toBeLessThan(30_000);
  // Después, la interfaz responde: el índice salta al último encabezado.
  await page.getByRole("navigation", { name: t.tocLabel }).getByRole("link").last().click();
  await expect(page.locator(":focus")).toHaveText(/Sección \d+/);
  limpia(v);
});
