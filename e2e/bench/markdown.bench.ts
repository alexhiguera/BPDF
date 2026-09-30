import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";

/**
 * Benchmark del visor Markdown (Fase 7, docs/ARCHITECTURE.md → visor
 * Markdown). No es un test: mide e imprime. Fuera de la suite normal y de CI,
 * porque sus cifras dependen de la máquina. Uso: `npm run bench:markdown`.
 *
 * Mide, en la build de producción, desde que se elige el fichero hasta que su
 * primer encabezado está pintado (leer + parsear + pintar), y cuánto tarda
 * después el hilo principal en atender un `requestAnimationFrame` (si la
 * interfaz responde). Cada documento se genera aquí, sin ficheros de terceros.
 */
const seccionMixta = (i: number) =>
  `## Sección ${i}\n\nPárrafo con **negrita**, *cursiva*, \`código\` y un [enlace](https://example.com/${i}). ${"Texto de relleno para que el párrafo tenga una longitud normal de lectura. ".repeat(3)}\n\n| a | b |\n|---|---|\n| ${i} | x |\n\n\`\`\`js\nconst n = ${i};\n\`\`\`\n\n`;
const seccionConListas = (i: number) =>
  `## Sección ${i}\n\nPárrafo corto ${i}.\n\n- uno\n- dos\n\n`;
const encabezado = (i: number) => `${"#".repeat((i % 6) + 1)} Encabezado ${i}\n\n`;
const bloqueCodigo = (i: number) =>
  `\`\`\`${["ts", "python", "json", "bash", "sql", ""][i % 6]}\nfunction f${i}(x) {\n  return x * ${i}; // comentario\n}\n\`\`\`\n\n`;

/** Repite `parte` hasta llegar a `bytes`. */
function generar(bytes: number, parte: (i: number) => string) {
  let t = "# Documento\n\n";
  for (let i = 0; t.length < bytes; i++) t += parte(i);
  return t;
}

/** `n` repeticiones exactas: los casos de «cuántos», no de «cuánto pesa». */
function repetir(n: number, parte: (i: number) => string) {
  let t = "# Documento\n\n";
  for (let i = 0; i < n; i++) t += parte(i);
  return t;
}

const DOCUMENTOS: [string, () => string][] = [
  ["pequeño (basico.md, 1 KB)", () => readFileSync("tests/fixtures/markdown/basico.md", "utf8")],
  ["texto mixto 100 KB", () => generar(100_000, seccionMixta)],
  ["texto mixto 1 MB (pocas listas)", () => generar(1_000_000, seccionMixta)],
  ["5000 encabezados", () => repetir(5000, encabezado)],
  ["2000 bloques de código", () => repetir(2000, bloqueCodigo)],
  // Listas cortas y muchas: el caso cuadrático de mdast-util-from-markdown.
  ["listas: 50 KB", () => generar(50_000, seccionConListas)],
  ["listas: 100 KB", () => generar(100_000, seccionConListas)],
  ["listas: 200 KB", () => generar(200_000, seccionConListas)],
];

async function medir(page: Page, texto: string) {
  await page.goto("/");
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: messages.open.button }).click(),
  ]);
  const inicio = Date.now();
  await selector.setFiles({ name: "bench.md", mimeType: "", buffer: Buffer.from(texto) });
  await expect(page.getByRole("article").locator("h1, h2, h3, h4, h5, h6").first()).toBeVisible({
    timeout: 280_000,
  });
  const visible = Date.now() - inicio;
  const frame = await page.evaluate(
    () =>
      new Promise<number>((r) => {
        const t0 = performance.now();
        requestAnimationFrame(() => r(performance.now() - t0));
      }),
  );
  const elementos = await page.getByRole("article").evaluate((a) => a.querySelectorAll("*").length);
  return { visible, frame: Math.round(frame), elementos };
}

test("visor Markdown: tiempo hasta verlo", async ({ page }) => {
  test.setTimeout(1_800_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const filas = [];
  for (const [nombre, crear] of DOCUMENTOS) {
    const texto = crear();
    const r = await medir(page, texto);
    filas.push({ documento: nombre, KB: Math.round(texto.length / 1000), ms: r.visible, ...r });
    console.log(filas.at(-1));
  }
  console.table(filas);
});

/**
 * Imágenes locales (Fase 7 bis): un Markdown con 50 imágenes de 3000×2000
 * (6 Mpx cada una) elegido junto con ellas y 50 más que el texto no usa.
 * Mide cuánto tarda en verse el texto, cuántas URL `blob:` se crean (solo las
 * usadas) y cuánto tardan en decodificarse las que están a la vista.
 */
test("visor Markdown: 50 imágenes grandes", async ({ page }) => {
  test.setTimeout(600_000);
  const { png } = await import("../../tests/fixtures/markdown/recursos/generar.mjs");
  await page.setViewportSize({ width: 1280, height: 900 });
  const grande = png(3000, 2000, [
    [200, 40, 40],
    [40, 200, 40],
    [40, 40, 200],
  ]) as Buffer;
  let texto = "# Galería\n\n";
  const ficheros = [];
  for (let i = 0; i < 50; i++) {
    texto += `## Imagen ${i}\n\n![Imagen ${i}](img-${i}.png)\n\n`;
    ficheros.push({ name: `img-${i}.png`, mimeType: "image/png", buffer: grande });
    ficheros.push({ name: `sin-usar-${i}.png`, mimeType: "image/png", buffer: grande });
  }
  await page.goto("/");
  await page.evaluate(() => {
    const w = window as unknown as { __urls: number };
    w.__urls = 0;
    const crear = URL.createObjectURL;
    URL.createObjectURL = (b: Blob | MediaSource) => {
      w.__urls++;
      return crear(b);
    };
  });
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: messages.open.button }).click(),
  ]);
  const inicio = Date.now();
  await selector.setFiles([
    { name: "galeria.md", mimeType: "", buffer: Buffer.from(texto) },
    ...ficheros,
  ]);
  await expect(page.getByRole("article").getByRole("heading", { name: "Galería" })).toBeVisible();
  const texto_ms = Date.now() - inicio;
  const primera = page.getByRole("article").locator("img").first();
  await expect
    .poll(
      () =>
        primera.evaluate(
          (e) => (e as HTMLImageElement).complete && (e as HTMLImageElement).naturalWidth,
        ),
      {
        timeout: 60_000,
      },
    )
    .toBe(3000);
  const primera_ms = Date.now() - inicio;
  const datos = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll("article img")] as HTMLImageElement[];
    return {
      urls: (window as unknown as { __urls: number }).__urls,
      imgs: imgs.length,
      decodificadas: imgs.filter((i) => i.complete && i.naturalWidth > 0).length,
      heapMiB: Math.round(
        ((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
          ?.usedJSHeapSize ?? 0) /
          2 ** 20,
      ),
    };
  });
  console.table([
    {
      "KB por imagen": Math.round(grande.length / 1024),
      "ms hasta el texto": texto_ms,
      "ms hasta la 1.ª imagen": primera_ms,
      ...datos,
    },
  ]);
});

/**
 * Fórmulas y diagramas (Fase 8). Por documento: hasta ver el texto, hasta que
 * todas las fórmulas están pintadas y hasta que todos los diagramas lo están
 * (recorriendo el documento, porque se dibujan al entrar en pantalla), qué se
 * descargó y el heap de JavaScript.
 */
const formula = (i: number) =>
  `Párrafo ${i} con $x_${i}^2 + \frac{a}{b}$ y $sum_{k=1}^{n} k$.\n\n$$\nint_0^{${i}} e^{-x^2},dx\n$$\n\n`;
const diagrama = (i: number) =>
  `## Diagrama ${i}\n\n\`\`\`mermaid\nflowchart LR\n  A${i}[Inicio ${i}] --> B${i}{¿Sigue?}\n  B${i} -- Sí --> C${i}[Fin]\n  B${i} -- No --> A${i}\n\`\`\`\n\n`;

const CASOS_F8: [string, () => string][] = [
  [
    "normal (basico.md), sin fórmulas ni diagramas",
    () => readFileSync("tests/fixtures/markdown/basico.md", "utf8"),
  ],
  ["pocas fórmulas (10 × 3)", () => repetir(10, formula)],
  ["muchas fórmulas (500 × 3)", () => repetir(500, formula)],
  ["pocos diagramas (3)", () => repetir(3, diagrama)],
  ["muchos diagramas (30)", () => repetir(30, diagrama)],
  [
    "grande: 1 MB mixto + 200 fórmulas + 10 diagramas",
    () => generar(1_000_000, seccionMixta) + repetir(200, formula) + repetir(10, diagrama),
  ],
  [
    "hostil: katex-hostil.md",
    () => readFileSync("tests/fixtures/markdown/katex-hostil.md", "utf8"),
  ],
  [
    "hostil: mermaid-hostil.md",
    () => readFileSync("tests/fixtures/markdown/mermaid-hostil.md", "utf8"),
  ],
];

test("visor Markdown: fórmulas y diagramas", async ({ page }) => {
  test.setTimeout(1_800_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const filas = [];
  for (const [nombre, crear] of CASOS_F8) {
    const texto = crear();
    await page.goto("/");
    const descargas: { url: string; bytes: number }[] = [];
    const escuchar = async (r: import("@playwright/test").Response) => {
      const u = new URL(r.url()).pathname;
      if (!/katex|mermaid|chunk|KaTeX/i.test(u)) return;
      descargas.push({ url: u, bytes: Number((await r.headerValue("content-length")) ?? 0) });
    };
    page.on("response", escuchar);
    const [selector] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: messages.open.button }).click(),
    ]);
    const inicio = Date.now();
    await selector.setFiles({ name: "bench.md", mimeType: "", buffer: Buffer.from(texto) });
    await expect(page.locator(".md-contenido[aria-busy=false]")).toBeVisible({ timeout: 280_000 });
    const texto_ms = Date.now() - inicio;
    await expect
      .poll(() => page.locator('[data-formula="cargando"]').count(), { timeout: 280_000 })
      .toBe(0);
    const formulas_ms = Date.now() - inicio;
    // Lleva a la vista cada diagrama pendiente (se dibujan al entrar en pantalla).
    // Saltar a cada uno, y no bajar pantalla a pantalla: en un documento de 1 MB
    // (más de un millón de píxeles) eso mediría Playwright, no BPDF.
    const pendiente = page.locator('[data-diagrama="esperando"]').first();
    for (let i = 0; i < 500 && (await pendiente.count()) > 0; i++) {
      // Si el diagrama empieza a dibujarse mientras tanto, se vuelve a montar: vale.
      await pendiente.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(20);
    }
    await expect
      .poll(() => page.locator('[data-diagrama="dibujando"]').count(), { timeout: 120_000 })
      .toBe(0);
    const diagramas_ms = Date.now() - inicio;
    const datos = await page.evaluate(() => ({
      formulas: document.querySelectorAll("[data-formula]").length,
      diagramas: document.querySelectorAll('[data-diagrama="listo"]').length,
      heapMiB: Math.round(
        ((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
          ?.usedJSHeapSize ?? 0) /
          2 ** 20,
      ),
    }));
    page.off("response", escuchar);
    filas.push({
      caso: nombre,
      KB: Math.round(texto.length / 1000),
      "ms texto": texto_ms,
      "ms fórmulas": formulas_ms,
      "ms diagramas": diagramas_ms,
      ...datos,
      "KB katex/mermaid": Math.round(descargas.reduce((s, d) => s + d.bytes, 0) / 1024),
      trozos: descargas.length,
    });
    console.log(filas.at(-1));
  }
  console.table(filas);
});
