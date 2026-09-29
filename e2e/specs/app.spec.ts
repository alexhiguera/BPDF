import { expect, test } from "@playwright/test";
import { project } from "../../src/config/project";
import { cspCabecera, cspMeta } from "../../src/config/security-headers";
import { messages } from "../../src/i18n/messages";

/**
 * La app base contra la build de producción (`vite preview`). Cada carga vigila
 * tres cosas que ninguna otra puerta ve: errores en consola, violaciones de CSP
 * y peticiones fuera del propio origen (docs/SEGURIDAD.md §2 y §6).
 */

type Vigilancia = { errores: string[]; violaciones: string[]; externas: string[] };

async function abrir(page: import("@playwright/test").Page, ruta = "/"): Promise<Vigilancia> {
  const v: Vigilancia = { errores: [], violaciones: [], externas: [] };
  const origen = new URL(test.info().project.use.baseURL ?? "").origin;
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning") v.errores.push(m.text());
  });
  page.on("pageerror", (e) => v.errores.push(e.message));
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== origen) v.externas.push(r.url());
  });
  await page.exposeFunction("__violacionCsp", (d: string) => v.violaciones.push(d));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __violacionCsp: (d: string) => void }).__violacionCsp(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  await page.goto(ruta);
  return v;
}

test("la app carga sin errores, sin violaciones de CSP y sin salir del propio origen", async ({
  page,
}) => {
  const v = await abrir(page);
  await expect(page).toHaveTitle(project.name);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(messages.emptyState.title);
  await expect(page.getByRole("banner")).toContainText(project.name);
  // Tailwind y los tokens están aplicados: el área de lectura tiene su color.
  await expect(page.getByRole("main")).toHaveCSS("background-color", "rgb(33, 33, 33)");
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
});

test("una ruta que no existe da 404 (sin fallback de SPA ni rutas del SaaS)", async ({
  request,
}) => {
  for (const ruta of ["/no-existe", "/login", "/inicio", "/api/health"]) {
    const res = await request.get(ruta, { maxRedirects: 0 });
    expect(res.status(), ruta).toBe(404);
  }
});
