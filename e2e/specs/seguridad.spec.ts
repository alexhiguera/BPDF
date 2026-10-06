import { expect, type Page, test } from "@playwright/test";
import { cabecerasPara } from "../../src/config/security-headers";
import { messages } from "../../src/i18n/messages";
import { recolorearRgb } from "../../src/pdf/dark/recolor";
import { crearPdfFormulario, FORMULARIO } from "../../tests/fixtures/pdf/visor/generar.mjs";
import { soloChromium } from "../navegadores";
import { leerPortapapeles } from "../portapapeles";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Fase 12 (docs/SEGURIDAD.md, docs/auditoria.md): lo que la auditoría encontró sin
 * test. Cada recorrido termina con la vigilancia de siempre: cero errores de
 * consola, cero violaciones de CSP y ninguna petición fuera del propio origen.
 *
 * - las cabeceras de TODAS las rutas servidas, no solo las de `/`;
 * - `Permissions-Policy` en efecto: la app no puede leer el portapapeles;
 * - el almacenamiento tras un recorrido completo: solo las dos claves de
 *   preferencias (sin cookies, `sessionStorage`, IndexedDB, Cache API ni
 *   service workers);
 * - D14: un formulario PDF se ve, pero no se puede rellenar, y su JavaScript no
 *   se ejecuta.
 */

const CLAVES = ["bpdf:positions", "bpdf:prefs"];
const OSCURO = "tests/fixtures/pdf/modo-oscuro/modo-oscuro.pdf";
const PAGINA = recolorearRgb([255, 255, 255], {
  pagina: [14, 20, 37],
  texto: [236, 236, 236],
});

type Fichero = string | { name: string; mimeType: string; buffer: Buffer };

function limpia(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

/** Un diálogo del navegador (`alert`, `confirm`…) que nadie esperaba es un error. */
function sinDialogos(page: Page, v: Vigilancia) {
  page.on("dialog", (d) => {
    v.errores.push(`diálogo inesperado: ${d.message()}`);
    return d.dismiss();
  });
}

async function abrirFichero(page: Page, fichero: Fichero) {
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: messages.open.button }).first().click(),
  ]);
  await selector.setFiles(fichero);
}

const listo = (page: Page, n: number) =>
  expect(page.locator(`[data-pagina="${n}"][data-estado="lista"]`)).toBeVisible({
    timeout: 30_000,
  });

// ── Cabeceras ──────────────────────────────────────────────────────────────────

test("cada ruta servida lleva exactamente las cabeceras de la fuente única", async ({
  request,
}) => {
  const html = await (await request.get("/")).text();
  const modulo = html.match(/src="(\/assets\/index-[^"]+\.js)"/)?.[1];
  expect(modulo).toBeTruthy();
  const rutas = [
    "/",
    "/mermaid.html",
    modulo ?? "",
    "/pdfjs/pdf.worker.min.mjs",
    "/favicon.svg",
    "/robots.txt",
    "/no-existe",
  ];
  for (const ruta of rutas) {
    const res = await request.get(ruta);
    expect(res.status(), ruta).toBe(ruta === "/no-existe" ? 404 : 200);
    const h = res.headers();
    for (const [nombre, valor] of Object.entries(cabecerasPara(ruta))) {
      expect(h[nombre.toLowerCase()], `${ruta} → ${nombre}`).toBe(valor);
    }
    // `Access-Control-Allow-Origin` solo en `/assets/` (el marco pide sus módulos en CORS).
    if (!ruta.startsWith("/assets/")) {
      expect(h["access-control-allow-origin"], ruta).toBeUndefined();
    }
  }
});

// ── Permissions-Policy ─────────────────────────────────────────────────────────

test("Permissions-Policy: la app no puede leer el portapapeles, aunque el navegador lo permita; escribir sí", async ({
  page,
  context,
  browserName,
}) => {
  // Firefox no aplica `Permissions-Policy` y WebKit no la aplica al portapapeles; en
  // los dos, leer exige además un gesto y un menú del navegador (BPDF nunca lo hace).
  soloChromium(browserName, "Permissions-Policy (clipboard-read) solo la aplica Chromium");
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const v = await abrir(page);
  const lectura = await page.evaluate(() =>
    navigator.clipboard.readText().then(
      () => "leído",
      (e: Error) => e.name,
    ),
  );
  expect(lectura).toBe("NotAllowedError");
  // Lo bloquea la cabecera, no otra cosa: Chrome lo dice en consola (y solo eso).
  expect(v.errores).toEqual([
    expect.stringContaining(
      "Permissions policy violation: The Clipboard API has been blocked because of a permissions policy",
    ),
  ]);
  v.errores.length = 0;
  // `clipboard-write` no se niega: «Copiar» sigue funcionando.
  await page.evaluate(() => navigator.clipboard.writeText("escrito-por-bpdf"));
  expect(await leerPortapapeles(context)).toBe("escrito-por-bpdf");
  // Las capacidades negadas son todas conocidas: Chrome no se queja de ninguna.
  limpia(v);
});

// ── Almacenamiento ─────────────────────────────────────────────────────────────

test("tras un recorrido completo solo quedan las dos claves de preferencias: sin cookies, sesión, IndexedDB, Cache API ni service workers", async ({
  page,
  context,
}) => {
  const v = await abrir(page);
  sinDialogos(page, v);

  // PDF: posición y una preferencia (miniaturas) guardadas.
  await abrirFichero(page, OSCURO);
  await listo(page, 1);
  await page.getByRole("button", { name: messages.pdf.showThumbnails }).click();
  const campo = page.getByRole("textbox", { name: messages.pdf.pageInput });
  await campo.fill("3");
  await campo.press("Enter");
  await listo(page, 3);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem("bpdf:positions")), { timeout: 5000 })
    .not.toBeNull();

  // Markdown con fórmula y diagrama (KaTeX y el marco de Mermaid), y el editor.
  await abrirFichero(page, {
    name: "recorrido.md",
    mimeType: "",
    buffer: Buffer.from(
      "# Recorrido\n\nUna fórmula: $e^{i\\pi} + 1 = 0$\n\n```mermaid\ngraph TD\n  A --> B\n```\n",
    ),
  });
  const articulo = page.getByRole("article");
  await expect(articulo.locator(".katex").first()).toBeVisible({ timeout: 30_000 });
  await expect(articulo.locator('img[src^="blob:"]')).toHaveCount(1, { timeout: 30_000 });
  await page.getByRole("button", { name: messages.markdown.mode.edicion, exact: true }).click();
  const editor = page.getByRole("textbox", { name: messages.markdown.editor.label });
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n\nTexto escrito en el editor");
  await expect(editor).toContainText("Texto escrito en el editor");

  const almacenamiento = await page.evaluate(async () => ({
    local: Object.keys(localStorage).sort(),
    sesion: sessionStorage.length,
    cookie: document.cookie,
    indexedDb: (await indexedDB.databases()).map((d) => d.name),
    caches: await caches.keys(),
    serviceWorkers: (await navigator.serviceWorker.getRegistrations()).length,
  }));
  expect(almacenamiento).toEqual({
    local: CLAVES,
    sesion: 0,
    cookie: "",
    indexedDb: [],
    caches: [],
    serviceWorkers: 0,
  });
  expect(await context.cookies()).toEqual([]);
  limpia(v);
});

// ── PDF: formularios (D14) ─────────────────────────────────────────────────────

test("formulario PDF (D14): los campos se ven pero no se pueden rellenar, y su JavaScript no se ejecuta", async ({
  page,
}) => {
  const v = await abrir(page);
  sinDialogos(page, v);
  await abrirFichero(page, {
    name: "formulario.pdf",
    mimeType: "",
    buffer: crearPdfFormulario(),
  });
  await listo(page, 1);
  const pagina = page.locator('[data-pagina="1"]');

  // Se ven: la apariencia de cada campo está pintada en el lienzo.
  const color = ([x = 0, y = 0]: readonly number[]) =>
    pagina.locator("canvas").evaluate(
      (lienzo, { x, y }) => {
        const c = lienzo as HTMLCanvasElement;
        const k = c.width / 595;
        const d = c
          .getContext("2d")
          ?.getImageData(Math.round(x * k), Math.round((842 - y) * k), 1, 1).data;
        return d ? [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0] : [];
      },
      { x, y },
    );
  const centro = ([x1 = 0, y1 = 0, x2 = 0, y2 = 0]: readonly number[]) => [
    (x1 + x2) / 2,
    (y1 + y2) / 2,
  ];
  const distancia = (a: readonly number[], b: readonly number[]) =>
    Math.max(...a.map((c, i) => Math.abs(c - (b[i] ?? 0))));
  expect(distancia(await color(FORMULARIO.vacio), PAGINA)).toBeLessThanOrEqual(3);
  expect(distancia(await color(centro(FORMULARIO.campo)), PAGINA)).toBeGreaterThan(100);
  expect(distancia(await color(centro(FORMULARIO.casilla)), PAGINA)).toBeGreaterThan(100);

  // No se rellenan: ni capa de anotaciones de pdf.js ni ningún control en la página.
  await expect(
    pagina.locator("input, textarea, select, button, [contenteditable], .annotationLayer"),
  ).toHaveCount(0);
  await expect(page.locator(".annotationLayer, [data-annotation-id]")).toHaveCount(0);
  // El valor del campo solo existe como dibujo, no como texto editable ni seleccionable.
  await expect(page.getByText(FORMULARIO.valor)).toHaveCount(0);

  // Pulsar en el campo y teclear no escribe en él, y su JavaScript (al abrir y en
  // las acciones del campo) no corre: ningún diálogo (`sinDialogos`).
  const caja = await pagina.boundingBox();
  const [cx = 0, cy = 0] = centro(FORMULARIO.campo);
  await pagina.click({
    position: { x: (cx / 595) * (caja?.width ?? 0), y: ((842 - cy) / 842) * (caja?.height ?? 0) },
  });
  // Letras que no son atajos del visor (F, T, R, G y ? sí lo son).
  await page.keyboard.type("zqxw");
  await expect(page.getByText("zqxw")).toHaveCount(0);
  expect(distancia(await color(centro(FORMULARIO.campo)), PAGINA)).toBeGreaterThan(100);
  limpia(v);
});
