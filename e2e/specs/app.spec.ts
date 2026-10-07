import { expect, test } from "@playwright/test";
import { project } from "../../src/config/project";
import { cspCabecera, cspMeta } from "../../src/config/security-headers";
import { messages } from "../../src/i18n/messages";
import { abrir } from "../vigilancia";

/**
 * La app base contra la build de producción (`vite preview`). Cada carga vigila
 * errores de consola, violaciones de CSP y peticiones fuera del propio origen
 * (`e2e/vigilancia.ts`).
 */

test("la app carga sin errores, sin violaciones de CSP y sin salir del propio origen", async ({
  page,
}) => {
  const v = await abrir(page);
  await expect(page).toHaveTitle(project.name);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.emptyState.title);
  await expect(page.getByRole("banner")).toContainText(project.name);
  // Tailwind y los tokens están aplicados: la portada tiene su fondo propio.
  await expect(page.getByRole("main")).toHaveCSS("background-color", "rgb(7, 11, 24)");
  await expect(page.getByTestId("bpdf-logo")).toHaveCount(2);
  await expect(page.locator(".home-feature-card")).toHaveCount(6);
  await expect(page.getByText(messages.emptyState.privacyDetail)).toBeVisible();
  await expect(page.getByText(messages.open.shortcut)).toHaveCount(0);
  await page.waitForLoadState("networkidle");
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
});

test("control: la CSP bloquea un script en línea y la vigilancia lo detecta", async ({ page }) => {
  // Sin este control, «cero violaciones» también pasaría si la CSP no se
  // aplicara o si el listener no funcionara.
  const v = await abrir(page);
  const ejecutado = await page.evaluate(() => {
    const w = window as unknown as { __inyectado?: boolean };
    const s = document.createElement("script");
    s.textContent = "window.__inyectado = true";
    document.body.append(s);
    return w.__inyectado === true;
  });
  expect(ejecutado).toBe(false);
  await expect.poll(() => v.violaciones.length).toBeGreaterThan(0);
});

test("la respuesta lleva la CSP y las cabeceras de seguridad", async ({ request }) => {
  const res = await request.get("/");
  expect(res.status()).toBe(200);
  const h = res.headers();
  expect(h["content-security-policy"]).toBe(cspCabecera());
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["referrer-policy"]).toBe("no-referrer");
  expect(h["cross-origin-opener-policy"]).toBe("same-origin");
  // El HTML lleva además la CSP como <meta>, por si el hosting no manda cabeceras.
  expect(await res.text()).toContain(
    `<meta http-equiv="Content-Security-Policy" content="${cspMeta().replaceAll("'", "&#39;")}">`,
  );
});

test("con el teclado, el primer Tab llega al enlace de salto y este lleva al contenido", async ({
  page,
}) => {
  await abrir(page);
  await page.keyboard.press("Tab");
  const salto = page.getByRole("link", { name: messages.app.skipToContent });
  await expect(salto).toBeFocused();
  await expect(salto).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
});

test("robots.txt y sitemap.xml se generan con el dominio del proyecto", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(`Sitemap: https://${project.domain}/sitemap.xml`);
  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toContain(`<loc>https://${project.domain}/</loc>`);
  const html = await (await request.get("/index.html")).text();
  expect(html).toContain(`rel="canonical" href="https://${project.domain}/"`);
});

test("el HTML explica con la identidad de BPDF que JavaScript es necesario", async ({
  request,
}) => {
  const html = await (await request.get("/index.html")).text();
  expect(html).toContain(`<noscript>`);
  expect(html).toContain(messages.app.noscriptTitle);
  expect(html).toContain(messages.app.noscriptBody);
  expect(html).toContain(`href="/"`);
  expect(html).not.toContain("__BPDF_");
});

test("una ruta que no existe muestra la 404 propia sin fallback de SPA", async ({
  page,
  request,
}) => {
  for (const ruta of ["/no-existe", "/login", "/inicio", "/api/health"]) {
    const res = await request.get(ruta, { maxRedirects: 0 });
    expect(res.status(), ruta).toBe(404);
    expect(await res.text(), ruta).toContain(messages.notFound.title);
  }
  const respuesta = await page.goto("/no-existe");
  expect(respuesta?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.notFound.title);
  await expect(page.getByRole("link", { name: messages.app.backHome })).toHaveAttribute(
    "href",
    "/",
  );
  await expect(page.getByTestId("bpdf-logo")).toHaveCount(0);
});
