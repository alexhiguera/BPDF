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
