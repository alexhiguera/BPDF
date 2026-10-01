import { expect, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";

/**
 * Benchmark del editor de Markdown (Fase 9). No es un test: mide e imprime.
 * Uso: `npm run bench:editor`.
 *
 * Lo que importa (criterio de la fase): **teclear en un Markdown de 1 MB sin
 * retraso perceptible**. Se mide con la Event Timing API del navegador: la
 * duración de cada evento de teclado/entrada, desde que llega la tecla hasta
 * que se pinta el resultado (lo que el usuario percibe). Se escribe al
 * principio, en medio y al final del documento, se deshace y se rehace, en
 * «Edición» y en «Dividido» (con la vista previa refrescándose detrás, o en
 * pausa si el documento es grande).
 *
 * Ritmo de escritura: 50 ms entre teclas (≈ 240 palabras por minuto, más
 * deprisa de lo que escribe casi nadie). No en ráfaga sin pausas: ahí cada tecla
 * mide también la cola de las anteriores (lo que tarda el navegador en procesar
 * 20 teclas llegadas en 1 ms), no el retraso que percibe quien escribe.
 */
const RITMO_MS = 50;
const t = messages.markdown;

const seccion = (i: number) =>
  `## Sección ${i}\n\nPárrafo con **negrita**, *cursiva*, \`código\` y un [enlace](https://example.com/${i}). ${"Texto de relleno para que el párrafo tenga una longitud normal de lectura. ".repeat(3)}\n\n| a | b |\n|---|---|\n| ${i} | x |\n\n\`\`\`js\nconst n = ${i};\n\`\`\`\n\n`;
const conFormulas = (i: number) =>
  `${seccion(i)}Fórmula $e^{i\\pi} + ${i} = 0$ y bloque:\n\n$$\n\\sum_{k=1}^{${i}} k^2\n$$\n\n`;
const conDiagrama = (i: number) =>
  i % 50 === 0
    ? `${seccion(i)}\`\`\`mermaid\nflowchart LR\n  A${i} --> B${i}\n\`\`\`\n\n`
    : seccion(i);
const encabezados = (i: number) => `${"#".repeat((i % 6) + 1)} Encabezado ${i}\n\nLínea ${i}.\n\n`;

function generar(bytes: number, parte: (i: number) => string) {
  let texto = "# Documento\n\n";
  for (let i = 0; texto.length < bytes; i++) texto += parte(i);
  return texto;
}

const CASOS: [string, () => string][] = [
  ["A · pequeño (2 KB)", () => generar(2_000, seccion)],
  ["B · grande (200 KB)", () => generar(200_000, seccion)],
  ["C · 1 MB", () => generar(1_000_000, seccion)],
  ["D · 1 MB + KaTeX", () => generar(1_000_000, conFormulas)],
  ["E · 1 MB + Mermaid", () => generar(1_000_000, conDiagrama)],
  ["F · 1 MB de encabezados", () => generar(1_000_000, encabezados)],
];

/** Empieza a registrar la duración de los eventos de entrada (Event Timing API). */
async function vigilarEventos(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __eventos: number[]; __tareas: number[] };
    w.__eventos = [];
    w.__tareas = [];
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) {
        if (["keydown", "keypress", "keyup", "input", "beforeinput"].includes(e.name))
          w.__eventos.push(e.duration);
      }
    }).observe({
      type: "event",
      durationThreshold: 16,
      buffered: false,
    } as PerformanceObserverInit);
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) w.__tareas.push(e.duration);
    }).observe({ type: "longtask" });
  });
}

async function recoger(page: Page) {
  return page.evaluate(() => {
    const w = window as unknown as { __eventos: number[]; __tareas: number[] };
    const eventos = w.__eventos.splice(0);
    const tareas = w.__tareas.splice(0);
    return {
      // Event Timing solo informa de eventos de 16 ms o más: 0 es «ninguno lento».
      eventoMax: Math.round(Math.max(0, ...eventos)),
      eventoMediana: Math.round([...eventos].sort((a, b) => a - b)[eventos.length >> 1] ?? 0),
      eventosLentos: eventos.filter((d) => d >= 50).length,
      tareaMax: Math.round(Math.max(0, ...tareas)),
    };
  });
}

/**
 * Espera a que el hilo principal esté libre (dos fotogramas seguidos en menos de
 * 50 ms): tras abrir 1 MB, el navegador sigue maquetando y pintando un rato, y
 * medir antes mezclaría ese trabajo con lo que se quiere medir.
 */
async function esperarQuieto(page: Page) {
  await page.evaluate(async () => {
    const fotograma = () =>
      new Promise<number>((r) => {
        const t0 = performance.now();
        requestAnimationFrame(() => r(performance.now() - t0));
      });
    const limite = performance.now() + 120_000;
    let seguidos = 0;
    while (seguidos < 2 && performance.now() < limite) {
      seguidos = (await fotograma()) < 50 ? seguidos + 1 : 0;
    }
  });
}

const editor = (page: Page) => page.getByRole("textbox", { name: t.editor.label });

/** Lleva el cursor a una zona del documento (0 principio, 0,5 medio, 1 final). */
async function colocar(page: Page, donde: number) {
  if (donde === 0) return page.keyboard.press("Control+Home");
  if (donde === 1) return page.keyboard.press("Control+End");
  await page.getByTestId("editor-markdown").evaluate((el, f) => {
    const scroll = el.shadowRoot?.querySelector(".cm-scroller") as HTMLElement;
    scroll.scrollTop = scroll.scrollHeight * f;
  }, donde);
  await page.waitForTimeout(100);
  await editor(page).locator(".cm-line").nth(3).click();
}

async function abrirDocumento(page: Page, texto: string) {
  await page.goto("/");
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: messages.open.button }).click(),
  ]);
  await selector.setFiles({ name: "bench.md", mimeType: "", buffer: Buffer.from(texto) });
  await expect(page.getByRole("article").locator("h1, h2").first()).toBeVisible({
    timeout: 120_000,
  });
}

test("editor: teclear en documentos grandes", async ({ page }) => {
  test.setTimeout(1_800_000);
  await page.setViewportSize({ width: 1400, height: 900 });
  // Con cambios, recargar pide confirmar (beforeunload): se acepta.
  page.on("dialog", (d) => d.accept());
  const filas: Record<string, unknown>[] = [];
  for (const [nombre, crear] of CASOS) {
    const texto = crear();
    await abrirDocumento(page, texto);
    for (const modoActual of ["edicion", "dividido"] as const) {
      await esperarQuieto(page);
      const inicio = Date.now();
      await page.getByRole("button", { name: t.mode[modoActual], exact: true }).click();
      await expect(editor(page)).toBeVisible({ timeout: 120_000 });
      await esperarQuieto(page);
      const cargaModo = Date.now() - inicio;
      await page.waitForTimeout(500);
      for (const [zona, donde] of [
        ["principio", 0],
        ["medio", 0.5],
        ["final", 1],
      ] as const) {
        await colocar(page, donde);
        await vigilarEventos(page);
        // Ráfaga (sin pausas) y después teclas sueltas con pausas mayores que la
        // espera de la vista previa: en «Dividido» cada pausa la refresca, y la
        // tecla siguiente es la que notaría si la vista previa bloquea.
        await page.keyboard.type("texto escrito deprisa ", { delay: RITMO_MS });
        for (const c of "lento") {
          await page.waitForTimeout(400);
          await page.keyboard.type(c);
        }
        await page.keyboard.press("Control+z");
        await page.keyboard.press("Control+y");
        await page.waitForTimeout(400);
        filas.push({
          caso: nombre,
          KB: Math.round(texto.length / 1000),
          modo: modoActual,
          zona,
          cargaModoMs: cargaModo,
          ...(await recoger(page)),
          vistaEnPausa: await page.getByText(t.previewPaused).isVisible(),
        });
        console.log(JSON.stringify(filas.at(-1)));
      }
    }
    await page.getByRole("button", { name: t.mode.lectura, exact: true }).click();
  }
  console.table(filas);
});
