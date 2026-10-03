import { expect, type Page, test } from "@playwright/test";
import { project, siteUrl } from "../../src/config/project";
import { robotsTxt, sitemapXml } from "../../src/config/public-site";
import { cabecerasPara } from "../../src/config/security-headers";
import { messages } from "../../src/i18n/messages";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Prueba de humo de la web publicada (Fase 15; `playwright.produccion.config.ts`). Pequeña a
 * propósito: lo que un despliegue puede romper sin que lo vea ningún test local (dominio,
 * cabeceras de Vercel, módulos a demanda, worker de pdf.js, robots y sitemap). El resto lo
 * cubre la suite E2E contra la misma build. Los documentos son del repo o se crean aquí: el
 * smoke no pide nada fuera del sitio, y la vigilancia (`abrir`) falla si alguien lo hace.
 */

const PDF = "tests/fixtures/pdf/minimo.pdf";
const MARKDOWN = {
  name: "humo.md",
  mimeType: "text/markdown",
  buffer: Buffer.from("# Prueba de humo\n\nUn párrafo y una fórmula: $e^{i\\pi} + 1 = 0$.\n"),
};

/** ¿Apunta el smoke al dominio oficial (y no a un ensayo local)? */
const OFICIAL = () => new URL(test.info().project.use.baseURL ?? "").origin === siteUrl();

function limpia(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

async function elegir(page: Page, fichero: string | typeof MARKDOWN) {
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: messages.open.button }).first().click(),
  ]);
  await selector.setFiles(fichero);
}

test("la portada carga: título, favicon, Preferencias y el crédito de R3ZON", async ({ page }) => {
  const v = await abrir(page);
  if (OFICIAL()) expect(new URL(page.url()).origin).toBe(siteUrl());
  await expect(page).toHaveTitle(project.name);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.emptyState.title);
  const icono = page.locator('link[rel="icon"]');
  await expect(icono).toHaveAttribute("href", "/favicon.svg");
  const favicon = await page.request.get("/favicon.svg");
  expect(favicon.status()).toBe(200);
  expect(favicon.headers()["content-type"]).toContain("image/svg+xml");
  await expect(
    page.getByRole("banner").getByRole("button", { name: messages.preferences.open }),
  ).toBeVisible();
  // El crédito, sin pulsarlo: abriría r3zon.com, que es otro origen.
  const pie = page.getByRole("contentinfo");
  await expect(pie).toContainText(messages.credits.free);
  await expect(pie.getByRole("link", { name: project.organization })).toHaveAttribute(
    "href",
    project.organizationUrl,
  );
  await page.waitForLoadState("networkidle");
  limpia(v);
});

test("abre un Markdown con una fórmula (módulos a demanda y fuentes de KaTeX)", async ({
  page,
}) => {
  const v = await abrir(page);
  await elegir(page, MARKDOWN);
  await expect(page.getByRole("heading", { name: "Prueba de humo" })).toBeVisible();
  await expect(page.locator(".katex").first()).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  limpia(v);
});

test("abre un PDF (pdf.js, su worker y el modo oscuro)", async ({ page }) => {
  const v = await abrir(page);
  await elegir(page, PDF);
  await expect(page.locator('[data-pagina="1"][data-estado="lista"]')).toBeVisible({
    timeout: 30_000,
  });
  await page.waitForLoadState("networkidle");
  limpia(v);
});

test("las cabeceras críticas llegan y coinciden con security-headers.ts", async ({ request }) => {
  // `npm run cabeceras:verificar` compara además `/mermaid.html` y un módulo del marco.
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  const h = res.headers();
  for (const [nombre, valor] of Object.entries(cabecerasPara("/"))) {
    expect(h[nombre.toLowerCase()], nombre).toBe(valor);
  }
});

test("robots.txt y sitemap.xml son los de la build, con el dominio oficial", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toBe(robotsTxt());
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toBe(sitemapXml());
});

test("http:// redirige a https:// en el dominio oficial", async ({ request }) => {
  test.skip(!OFICIAL(), "solo contra el dominio oficial: `vite preview` no sirve HTTPS");
  const res = await request.get(`http://${project.domain}/`, { maxRedirects: 0 });
  expect(res.status()).toBeGreaterThanOrEqual(300);
  expect(res.status()).toBeLessThan(400);
  expect([siteUrl(), `${siteUrl()}/`]).toContain(res.headers().location);
});
