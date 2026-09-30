import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { cspMarcoCabecera } from "../../src/config/security-headers";
import { messages } from "../../src/i18n/messages";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Fórmulas (KaTeX) y diagramas (Mermaid, en su marco aislado) contra la build
 * de producción (Fase 8). En todos: cero errores de consola (también los del
 * marco), cero violaciones de CSP y ninguna petición fuera del propio origen.
 */
const t = messages.markdown;
const MD = path.join(import.meta.dirname, "../../tests/fixtures/markdown");
const titulo = (page: Page) => page.getByRole("heading", { level: 1 }).first();
const articulo = (page: Page) => page.getByRole("article");

function limpia(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

async function cargar(page: Page, fichero: string, peticiones?: string[]) {
  const v = await abrir(page);
  page.on("dialog", (d) => {
    v.errores.push(`diálogo inesperado: ${d.message()}`);
    return d.dismiss();
  });
  if (peticiones) page.on("request", (r) => peticiones.push(new URL(r.url()).pathname));
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: messages.open.button }).first().click(),
  ]);
  await selector.setFiles(path.join(MD, fichero));
  await expect(titulo(page)).toHaveText(fichero);
  return v;
}

/** Recorre el documento para que cada diagrama entre en pantalla. */
async function recorrer(page: Page) {
  for (let i = 0; i < 10; i++) {
    await articulo(page).evaluate((a) => a.scrollBy(0, 500));
    await page.waitForTimeout(150);
  }
}

const estados = (page: Page, atributo: "formula" | "diagrama") =>
  articulo(page)
    .locator(`[data-${atributo}]`)
    .evaluateAll((es, a) => es.map((e) => (e as HTMLElement).dataset[a]), atributo);

test("fórmulas: en línea, en bloque, matrices, \\vec y \\oiint, sin violaciones de CSP", async ({
  page,
}) => {
  const v = await cargar(page, "matematicas.md");
  await expect.poll(() => estados(page, "formula")).not.toContain("cargando");
  const e = await estados(page, "formula");
  expect(e.filter((x) => x === "lista")).toHaveLength(8);
  expect(e.filter((x) => x === "error")).toHaveLength(1);
  const a = articulo(page);
  await expect(a.locator(".katex-display")).toHaveCount(3);
  await expect(a.locator(".katex-mathml math").first()).toBeAttached();
  // La fórmula no válida: su código, con aviso.
  await expect(a.locator("code.md-formula-error")).toHaveText("\\frac{1}{");
  // Los dólares escapados son texto.
  await expect(a).toContainText("cuesta $5 y $10");
  // Las fuentes de KaTeX, del propio origen (limpia: ninguna externa ni `data:`).
  limpia(v);
});

test("diagramas: cuatro imágenes blob: con alt, ninguno en línea, y el no válido como código", async ({
  page,
}) => {
  const v = await cargar(page, "diagramas.md");
  await recorrer(page);
  await expect
    .poll(() => estados(page, "diagrama"))
    .toEqual(["listo", "listo", "listo", "listo", "error"]);
  const imgs = articulo(page).locator(".md-diagrama img");
  await expect(imgs).toHaveCount(4);
  for (const img of await imgs.all()) {
    expect(await img.getAttribute("src")).toMatch(/^blob:http:\/\/localhost:\d+\//);
    expect(await img.evaluate((i) => (i as HTMLImageElement).naturalWidth)).toBeGreaterThan(50);
  }
  await expect(imgs.first()).toHaveAttribute("alt", t.diagram.alt("flowchart"));
  await expect(page.locator("main svg:not(.lucide)")).toHaveCount(0);
  await expect(articulo(page).locator('[data-diagrama="error"] [role="note"]')).toHaveText(
    t.diagram.errors.invalid,
  );
  limpia(v);
});

test("el marco de Mermaid está aislado: sandbox sin same-origin, no alcanza la app y desaparece al cerrar", async ({
  page,
}) => {
  const v = await cargar(page, "diagramas.md");
  await expect(articulo(page).locator('[data-diagrama="listo"]').first()).toBeVisible();
  const iframe = page.locator("iframe.bpdf-marco-mermaid");
  await expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
  const marco = page.frames().find((f) => f.url().endsWith("/mermaid.html"));
  expect(marco).toBeDefined();
  const dentro = await marco!.evaluate(() => {
    let padre = "accesible";
    try {
      void window.parent.document.title;
    } catch {
      padre = "bloqueado";
    }
    let almacen = "accesible";
    try {
      void window.localStorage.length;
    } catch {
      almacen = "bloqueado";
    }
    return { origen: self.origin, padre, almacen };
  });
  expect(dentro).toEqual({ origen: "null", padre: "bloqueado", almacen: "bloqueado" });
  await page.getByRole("button", { name: t.close }).click();
  await expect(iframe).toHaveCount(0);
  limpia(v);
});

test("KaTeX hostil: nada se ejecuta, ni enlaces ni ids ni peticiones", async ({ page }) => {
  const v = await cargar(page, "katex-hostil.md");
  await expect.poll(() => estados(page, "formula")).not.toContain("cargando");
  const a = articulo(page);
  await expect(a.locator(".katex a, .katex [href], .katex [src], .katex [onclick]")).toHaveCount(0);
  await expect(a.locator('.katex [id], .katex [class*="md-contenido"]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as { __bpdfXss?: unknown }).__bpdfXss)).toBeUndefined();
  expect((await estados(page, "formula")).filter((e) => e === "error").length).toBeGreaterThan(3);
  limpia(v);
});

test("Mermaid hostil: click, HTML, %%{init}%%, imágenes e ids no ejecutan ni piden nada", async ({
  page,
}) => {
  const v = await cargar(page, "mermaid-hostil.md");
  await recorrer(page);
  await expect.poll(() => estados(page, "diagrama")).not.toContain("dibujando");
  await expect.poll(() => estados(page, "diagrama")).not.toContain("esperando");
  const a = articulo(page);
  // Los que se dibujan son imágenes; el de imágenes externas no se dibuja.
  expect((await estados(page, "diagrama")).filter((e) => e === "listo").length).toBeGreaterThan(1);
  await expect(a.getByText(t.diagram.errors.images)).toBeVisible();
  await expect(page.locator("main svg:not(.lucide), main iframe, main script")).toHaveCount(0);
  expect(await page.evaluate(() => (window as { __bpdfXss?: unknown }).__bpdfXss)).toBeUndefined();
  limpia(v);
});

test("un Markdown sin fórmulas ni diagramas no descarga KaTeX, Mermaid ni el marco", async ({
  page,
}) => {
  const peticiones: string[] = [];
  const v = await cargar(page, "basico.md", peticiones);
  await expect(articulo(page).getByRole("heading", { name: "Lista" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(peticiones.filter((p) => /katex|mermaid/i.test(p))).toEqual([]);
  await expect(page.locator("iframe")).toHaveCount(0);
  limpia(v);
});

test("mermaid.html: su propia CSP y, abierto directamente, no hace nada", async ({
  page,
  request,
}) => {
  const respuesta = await request.get("/mermaid.html");
  expect(respuesta.headers()["content-security-policy"]).toBe(cspMarcoCabecera());
  expect(respuesta.headers()["x-frame-options"]).toBe("SAMEORIGIN");
  const v = await abrir(page, "/mermaid.html");
  await page.waitForLoadState("networkidle");
  // Sin sandbox (origen no opaco) el marco no escucha: ni anuncia que está listo
  // ni responde a una petición bien formada (que aquí le llega de sí misma).
  const delMarco = await page.evaluate(
    () =>
      new Promise<string[]>((ok) => {
        const tipos: string[] = [];
        window.addEventListener("message", (e) => {
          const tipo = (e.data as { tipo?: string })?.tipo ?? "";
          if (tipo !== "bpdf-dibujar") tipos.push(tipo);
        });
        const colores = {
          fondo: "#000000",
          nodo: "#000000",
          texto: "#ffffff",
          linea: "#ffffff",
          acento: "#ffffff",
        };
        window.postMessage(
          { tipo: "bpdf-dibujar", id: 1, fuente: "graph TD; A-->B", colores },
          "*",
        );
        setTimeout(() => ok(tipos), 1500);
      }),
  );
  expect(delMarco).toEqual([]);
  expect(await page.locator("svg").count()).toBe(0);
  limpia(v);
});
