import path from "node:path";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { cspCabecera } from "../../src/config/security-headers";
import { messages } from "../../src/i18n/messages";
import { exceptoEn, soloChromium } from "../navegadores";
import { escribirPortapapeles } from "../portapapeles";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Editor de Markdown (Fase 9) contra la build de producción, con su CSP. En
 * todos: cero errores de consola, cero violaciones de CSP y ninguna petición
 * fuera del propio origen (`vigilancia.ts`).
 */
const t = messages.markdown;
const FIXTURES = path.join(import.meta.dirname, "../../tests/fixtures");
const md = (f: string) => path.join(FIXTURES, "markdown", f);

function limpia(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

type Eleccion = string | string[] | Fichero | Fichero[];
async function elegir(page: Page, control: Locator, fichero: Eleccion) {
  const [selector] = await Promise.all([page.waitForEvent("filechooser"), control.click()]);
  await selector.setFiles(fichero);
}
type Fichero = { name: string; mimeType: string; buffer: Buffer };
const texto = (name: string, contenido: string): Fichero => ({
  name,
  mimeType: "",
  buffer: Buffer.from(contenido),
});

const botonAbrir = (page: Page) => page.getByRole("button", { name: messages.open.button }).first();
const modo = (page: Page, m: "lectura" | "edicion" | "dividido") =>
  page.getByRole("button", { name: t.mode[m], exact: true });
const editor = (page: Page) => page.getByRole("textbox", { name: t.editor.label });
const articulo = (page: Page) => page.getByRole("article");

async function cargar(page: Page, fichero: Eleccion): Promise<Vigilancia> {
  const v = await abrir(page);
  await elegir(page, botonAbrir(page), fichero);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  return v;
}

/** Entra en un modo con editor y sustituye todo su texto (como un pegado). */
async function reescribir(page: Page, nuevo: string) {
  await expect(editor(page)).toBeVisible();
  await editor(page).click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(nuevo);
}

/** Añade texto al final del editor, tecla a tecla. */
async function teclearAlFinal(page: Page, nuevo: string) {
  await editor(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(nuevo);
}

const recurso = (f: string) => path.join(FIXTURES, "markdown/recursos", f);

test("CodeMirror carga a demanda, funciona y la CSP no cambia", async ({ page }) => {
  const scripts: string[] = [];
  page.on("request", (r) => {
    if (r.resourceType() === "script") scripts.push(new URL(r.url()).pathname);
  });
  const respuesta = page.waitForResponse((r) => new URL(r.url()).pathname === "/");
  const v = await cargar(page, md("basico.md"));
  // La CSP que llega es la de siempre: sin 'unsafe-inline', 'unsafe-eval' ni nonces.
  const csp = (await respuesta).headers()["content-security-policy"] ?? "";
  expect(csp).toBe(cspCabecera());
  expect(csp).toContain("style-src 'self';");
  expect(csp).not.toMatch(/unsafe|nonce-|sha256-/);
  // Leer no descarga el editor.
  const antes = scripts.length;
  await expect(articulo(page)).toBeVisible();
  await modo(page, "edicion").click();
  await expect(editor(page)).toBeVisible();
  expect(scripts.length).toBeGreaterThan(antes);
  // Escribir, deshacer y rehacer funcionan.
  await editor(page).click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\n\nTexto añadido desde el editor");
  await expect(editor(page)).toContainText("Texto añadido desde el editor");
  await page.keyboard.press("Control+z");
  await expect(editor(page)).not.toContainText("Texto añadido desde el editor");
  await page.keyboard.press("Control+y");
  await expect(editor(page)).toContainText("Texto añadido desde el editor");
  // Los estilos de CodeMirror están puestos (hojas construibles, en su Shadow DOM).
  const estilos = await page.getByTestId("editor-markdown").evaluate((el) => ({
    hojas: el.shadowRoot?.adoptedStyleSheets.length ?? 0,
    etiquetas: el.shadowRoot?.querySelectorAll("style").length ?? -1,
    documento: document.querySelectorAll("style").length,
  }));
  expect(estilos.hojas).toBeGreaterThan(0);
  expect(estilos.etiquetas).toBe(0);
  expect(estilos.documento).toBe(0);
  limpia(v);
});

test("escribir y pegar encima de una selección: texto correcto, se deshace y sin violaciones de CSP", async ({
  page,
  context,
}) => {
  // Sin el manejador propio, Chrome sustituye la selección con su edición nativa,
  // crea <span style="…"> y la CSP los bloquea (dos violaciones por pulsación).
  const v = await cargar(page, texto("sel.md", "# Título\n\nUno dos tres.\n\n- lista\n- otra"));
  await modo(page, "edicion").click();
  await editor(page).click();
  // Dentro de una línea.
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Shift+End");
  await page.keyboard.type("# Nuevo");
  await expect(editor(page).locator(".cm-line").first()).toHaveText("# Nuevo");
  // Varias líneas.
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.press("Shift+ArrowDown");
  await page.keyboard.type("X");
  // Deshacer vuelve al texto anterior a esa sustitución.
  await page.keyboard.press("Control+z");
  await expect(editor(page)).toContainText("Uno dos tres.");
  // Todo y pegar (el portapapeles de verdad).
  await escribirPortapapeles(context, "Pegado\n\nen dos párrafos");
  await page.bringToFront();
  await editor(page).focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+v");
  await expect(editor(page)).toHaveText("Pegadoen dos párrafos");
  await expect(editor(page).locator(".cm-line")).toHaveCount(3);
  limpia(v);
});

// Fase 13: escribir con un IME (composición, como el japonés o el chino) ENCIMA de una
// selección. El manejador propio de `beforeinput` cubre `insertText`; la composición va
// por otra ruta (`insertCompositionText`), y si la edición nativa del navegador crease ahí
// `<span style>`, la CSP lo bloquearía. Se simula con el protocolo de depuración: las
// mismas órdenes que manda un IME real (componer y confirmar). Solo Chromium.
test("IME: componer encima de una selección deja el texto correcto, sin violaciones de CSP", async ({
  page,
  browserName,
}) => {
  soloChromium(
    browserName,
    "la composición de un IME solo se simula con CDP (Input.imeSetComposition)",
  );
  const v = await cargar(page, texto("ime.md", "# Título\n\nUno dos tres."));
  await modo(page, "edicion").click();
  await editor(page).click();
  const cdp = await page.context().newCDPSession(page);
  // Dentro de una línea: «Uno dos tres.» seleccionada entera.
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Shift+Home");
  await cdp.send("Input.imeSetComposition", { text: "に", selectionStart: 1, selectionEnd: 1 });
  await cdp.send("Input.imeSetComposition", { text: "にほん", selectionStart: 3, selectionEnd: 3 });
  await cdp.send("Input.insertText", { text: "日本" });
  await expect(editor(page).locator(".cm-line").last()).toHaveText("日本");
  // Varias líneas seleccionadas.
  await page.keyboard.press("Control+a");
  await cdp.send("Input.imeSetComposition", { text: "ちゅう", selectionStart: 3, selectionEnd: 3 });
  await cdp.send("Input.insertText", { text: "中" });
  await expect(editor(page)).toHaveText("中");
  // Deshacer vuelve atrás y el resto de la edición sigue funcionando.
  await page.keyboard.press("Control+z");
  await expect(editor(page)).toContainText("日本");
  await expect(editor(page).locator("span[style]")).toHaveCount(0);
  limpia(v);
});

test("modos: escribir en edición, verlo en lectura y en dividido; nada se pierde al cambiar", async ({
  page,
}) => {
  const v = await cargar(page, texto("notas.md", "# Notas\n\nPrimer párrafo."));
  await expect(modo(page, "lectura")).toHaveAttribute("aria-pressed", "true");
  await modo(page, "edicion").click();
  await expect(modo(page, "edicion")).toHaveAttribute("aria-pressed", "true");
  await expect(articulo(page)).toBeHidden();
  await teclearAlFinal(page, "\n\n## Añadido");
  await expect(page.getByText(t.modified)).toBeVisible();
  await modo(page, "lectura").click();
  await expect(articulo(page).getByRole("heading", { name: "Añadido" })).toBeVisible();
  await modo(page, "dividido").click();
  await expect(editor(page)).toContainText("## Añadido");
  await expect(articulo(page)).toBeVisible();
  await expect(page.getByRole("separator", { name: t.split.separator })).toBeVisible();
  limpia(v);
});

test("dividido: la vista previa se refresca 200 ms después de la última tecla, no antes", async ({
  page,
}) => {
  await page.clock.install();
  const v = await cargar(page, texto("reloj.md", "# Antes"));
  await modo(page, "dividido").click();
  await expect(editor(page)).toBeVisible();
  await editor(page).click();
  await page.keyboard.press("Control+End");
  // CodeMirror aplica cada tecla un instante después (con el reloj parado, también
  // hay que hacer avanzar ese instante). El límite exacto de 200 ms lo prueba
  // `tests/components/markdown/edicion.test.tsx`; aquí: ni en cada tecla, ni antes.
  await page.keyboard.type(" y después");
  await page.clock.runFor(120);
  await expect(articulo(page).getByRole("heading", { level: 1 })).toHaveText("Antes");
  await page.keyboard.type("!");
  await page.clock.runFor(120); // menos de 200 ms desde la ÚLTIMA tecla: aún no
  await expect(articulo(page).getByRole("heading", { level: 1 })).toHaveText("Antes");
  await page.clock.runFor(300);
  await expect(articulo(page).getByRole("heading", { level: 1 })).toHaveText("Antes y después!");
  limpia(v);
});

test("recursos: la vista previa usa los entregados al abrir; nada fuera ni nada nuevo", async ({
  page,
}) => {
  const v = await cargar(page, [
    recurso("documento.md"),
    recurso("imagen.png"),
    recurso("logo.svg"),
  ]);
  await modo(page, "dividido").click();
  await reescribir(
    page,
    "# Recursos\n\n![Imagen entregada](imagen.png)\n\n![Fuera](../fuera.png)\n\n![Nueva](nueva.png)\n\n![Remota](https://example.com/x.png)",
  );
  const vista = articulo(page);
  await expect(vista.getByRole("img", { name: "Imagen entregada" })).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await expect(vista).toContainText(t.image.local.fuera);
  await expect(vista).toContainText(t.image.local["no-encontrado"]);
  await expect(vista).toContainText(t.image.remote);
  await expect(vista.locator("img")).toHaveCount(1);
  limpia(v);
});

test("KaTeX y Mermaid en la vista previa, también con contenido hostil", async ({ page }) => {
  const v = await cargar(page, texto("f.md", "# Fórmulas"));
  page.on("dialog", (d) => {
    v.errores.push(`diálogo inesperado: ${d.message()}`);
    return d.dismiss();
  });
  await modo(page, "dividido").click();
  await reescribir(
    page,
    [
      "# Fórmulas",
      "",
      "En línea $e^{i\\pi}+1=0$ y rota $\\frac{1}{$.",
      "",
      "$$",
      "\\href{javascript:alert(1)}{pulsa} \\url{https://example.com}",
      "$$",
      "",
      "```mermaid",
      "flowchart LR",
      '  A["<img src=https://example.com/x.png>"] --> B',
      '  click A "javascript:alert(1)"',
      "```",
      "",
      "```mermaid",
      "esto no es un diagrama",
      "```",
    ].join("\n"),
  );
  const vista = articulo(page);
  await expect(vista.locator('[data-formula="lista"]').first()).toBeVisible();
  await expect(vista.locator('[data-formula="error"]').first()).toBeVisible();
  await expect(vista.locator('a[href^="javascript"]')).toHaveCount(0);
  await expect(vista.locator('[data-diagrama="listo"] img')).toHaveAttribute("src", /^blob:/, {
    timeout: 20_000,
  });
  await expect(vista.locator('[data-diagrama="error"]')).toHaveCount(1, { timeout: 20_000 });
  limpia(v);
});

test("Markdown hostil escrito en el editor: no se ejecuta ni en el editor ni en la vista previa", async ({
  page,
}) => {
  const v = await cargar(page, texto("x.md", "# X"));
  page.on("dialog", (d) => {
    v.errores.push(`diálogo inesperado: ${d.message()}`);
    return d.dismiss();
  });
  await modo(page, "dividido").click();
  await reescribir(
    page,
    [
      "# X",
      "<script>window.__xss = 1</script>",
      '<img src=x onerror="window.__xss = 2">',
      '<svg onload="window.__xss = 3"></svg>',
      "[enlace](javascript:window.__xss=4)",
      "[remoto](https://example.com)",
    ].join("\n\n"),
  );
  await expect(articulo(page)).toContainText("<script>window.__xss = 1</script>");
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() => (window as unknown as { __xss?: number }).__xss),
  ).toBeUndefined();
  await expect(articulo(page).locator("script, img, iframe, object, embed")).toHaveCount(0);
  await expect(articulo(page).locator('[href^="javascript"]')).toHaveCount(0);
  limpia(v);
});

test("guardar sin showSaveFilePicker: Ctrl+S descarga el texto nuevo y el documento queda limpio", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", { value: undefined, configurable: true });
  });
  const v = await cargar(page, texto("guardar.md", "# Original"));
  await modo(page, "edicion").click();
  await teclearAlFinal(page, "\n\nCambiado.");
  await expect(page.getByText(t.modified)).toBeVisible();
  const [descarga] = await Promise.all([
    page.waitForEvent("download"),
    page.keyboard.press("Control+s"),
  ]);
  expect(descarga.suggestedFilename()).toBe("guardar.md");
  const ruta = await descarga.path();
  const { readFileSync } = await import("node:fs");
  expect(readFileSync(ruta, "utf8")).toBe("# Original\n\nCambiado.");
  await expect(page.getByText(t.modified)).toHaveCount(0);
  await expect(page.getByText(t.downloaded)).toBeAttached();
  limpia(v);
});

test("guardar con showSaveFilePicker: pide destino la primera vez y lo reutiliza después", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __selector: unknown[];
      __escrito: string[];
      showSaveFilePicker: unknown;
    };
    w.__selector = [];
    w.__escrito = [];
    w.showSaveFilePicker = async (opciones: unknown) => {
      w.__selector.push(opciones);
      return {
        createWritable: async () => ({
          write: async (datos: Blob) => {
            w.__escrito.push(await datos.text());
          },
          close: async () => {},
        }),
      };
    };
  });
  const v = await cargar(page, texto("destino.md", "# A"));
  await modo(page, "edicion").click();
  await teclearAlFinal(page, "B");
  // `exact`: desde la Fase 17 también existe «Guardar como…».
  await page.getByRole("button", { name: t.save, exact: true }).click();
  await expect(page.getByText(t.modified)).toHaveCount(0);
  await teclearAlFinal(page, "C");
  await page.keyboard.press("Control+s");
  await expect(page.getByText(t.modified)).toHaveCount(0);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __selector: { suggestedName: string }[]; __escrito: string[] };
    return { selector: w.__selector, escrito: w.__escrito };
  });
  expect(r.selector).toHaveLength(1);
  expect(r.selector[0]?.suggestedName).toBe("destino.md");
  expect(r.escrito).toEqual(["# AB", "# ABC"]);
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  limpia(v);
});

test("cambios sin guardar: abrir otro pide confirmar; «Seguir editando» conserva, «Descartar» sustituye", async ({
  page,
}) => {
  const v = await cargar(page, texto("uno.md", "# Uno"));
  await modo(page, "edicion").click();
  await teclearAlFinal(page, " modificado");
  const cabecera = page.getByRole("banner").getByRole("button", { name: messages.open.button });
  await elegir(page, cabecera, texto("dos.md", "# Dos"));
  const dialogo = page.getByRole("dialog", { name: messages.discard.title });
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByRole("button", { name: messages.discard.cancel })).toBeFocused();
  await dialogo.getByRole("button", { name: messages.discard.cancel }).click();
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText("uno.md");
  await expect(editor(page)).toContainText("# Uno modificado");
  // Esc también es «seguir editando».
  await elegir(page, cabecera, texto("dos.md", "# Dos"));
  await expect(dialogo).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogo).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText("uno.md");
  // Descartar.
  await elegir(page, cabecera, texto("dos.md", "# Dos"));
  await dialogo.getByRole("button", { name: messages.discard.confirm }).click();
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText("dos.md");
  await expect(page.getByText(t.modified)).toHaveCount(0);
  limpia(v);
});

test("beforeunload: con cambios avisa al cerrar la pestaña; sin cambios, no", async ({ page }) => {
  const v = await cargar(page, texto("aviso.md", "# Aviso"));
  const dialogos: string[] = [];
  page.on("dialog", (d) => {
    dialogos.push(d.type());
    return d.dismiss();
  });
  await modo(page, "edicion").click();
  await teclearAlFinal(page, "!");
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => dialogos).toEqual(["beforeunload"]);
  expect(page.isClosed()).toBe(false);
  limpia(v);
});

test("beforeunload: sin cambios, cerrar no pregunta", async ({ page, browserName }) => {
  // Playwright no cierra en WebKit una página con `runBeforeUnload` (ni una vacía:
  // medido en la Fase 13). En Safari, a mano (TAREAS).
  exceptoEn(browserName, "webkit", "Playwright no cierra páginas con runBeforeUnload en WebKit");
  await cargar(page, texto("limpio.md", "# Limpio"));
  const dialogos: string[] = [];
  page.on("dialog", (d) => {
    dialogos.push(d.type());
    return d.dismiss();
  });
  await modo(page, "edicion").click();
  await expect(editor(page)).toBeVisible();
  await page.close({ runBeforeUnload: true });
  await expect.poll(() => page.isClosed()).toBe(true);
  expect(dialogos).toEqual([]);
});

test("1 MB: se edita con fluidez; en dividido la vista previa se pausa y se actualiza a mano", async ({
  page,
}) => {
  test.setTimeout(180_000);
  let grande = "# Grande\n\n";
  for (let i = 0; grande.length < 1_000_000; i++) {
    grande += `## Sección ${i}\n\nPárrafo ${i} con **negrita** y \`código\`. ${"Relleno de lectura. ".repeat(8)}\n\n`;
  }
  const v = await cargar(page, texto("grande.md", grande));
  await expect(articulo(page).getByRole("heading", { name: "Sección 0" })).toBeVisible({
    timeout: 60_000,
  });
  await modo(page, "edicion").click();
  await expect(editor(page)).toBeVisible({ timeout: 60_000 });
  await editor(page).click();
  await page.keyboard.press("Control+End");
  await page.evaluate(() => {
    const w = window as unknown as { __teclas: number[] };
    w.__teclas = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (e.name === "keydown") w.__teclas.push(e.duration);
    }).observe({ type: "event", durationThreshold: 16 } as PerformanceObserverInit);
  });
  await page.keyboard.type("\n\nFinal escrito a mano", { delay: 60 });
  await page.waitForTimeout(300);
  const lentas = await page.evaluate(() => (window as unknown as { __teclas: number[] }).__teclas);
  // Holgado para no depender de la máquina de CI; medido: < 70 ms (docs/ARCHITECTURE.md).
  expect(Math.max(0, ...lentas)).toBeLessThan(250);
  await modo(page, "dividido").click();
  await teclearAlFinal(page, "!");
  await expect(page.getByText(t.previewPaused)).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: t.previewRefresh }).click();
  await expect(articulo(page)).toContainText("Final escrito a mano!", { timeout: 60_000 });
  limpia(v);
});

// Con fórmulas, sus bloques se saltan fuera de la vista (`content-visibility`,
// markdown.css) y miden una altura estimada (4rem) hasta pintarse; párrafos largos
// para que la estimación se aleje de la real. La sincronía debe acertar igual.
for (const formulas of [false, true]) {
  test(`dividido: el desplazamiento del editor lleva a la vista previa a la misma sección${formulas ? " (con fórmulas)" : ""}`, async ({
    page,
  }) => {
    let doc = "# Sincronía\n\n";
    for (let i = 1; i <= 60; i++)
      doc += `## Sección ${i}\n\n${"Texto de la sección. ".repeat(formulas ? 80 : 20)}${formulas ? `$x^{${i}}$` : ""}\n\n`;
    const v = await cargar(page, texto("sincronia.md", doc));
    await modo(page, "dividido").click();
    await expect(editor(page)).toBeVisible();
    const vista = articulo(page);
    await expect(vista).toBeVisible();
    await editor(page).hover();
    await page.mouse.wheel(0, 4000);
    // El editor manda: la vista previa se desplaza a la zona equivalente.
    await expect
      .poll(() => vista.evaluate((a) => a.scrollTop), { timeout: 5000 })
      .toBeGreaterThan(500);
    const arribaEditor = await page.getByTestId("editor-markdown").evaluate((el) => {
      const scroller = el.shadowRoot?.querySelector(".cm-scroller") as HTMLElement;
      const lineas = [...(el.shadowRoot?.querySelectorAll(".cm-line") ?? [])] as HTMLElement[];
      const caja = scroller.getBoundingClientRect();
      const visible = lineas.filter((l) => l.getBoundingClientRect().bottom > caja.top);
      return visible.map((l) => l.textContent ?? "").find((t) => t.startsWith("## Sección")) ?? "";
    });
    const n = Number(arribaEditor.replace("## Sección ", ""));
    expect(n).toBeGreaterThan(1);
    const cercano = await vista.evaluate((a) => {
      const caja = a.getBoundingClientRect();
      const hs = [...a.querySelectorAll("h2")] as HTMLElement[];
      const visible = hs.find((h) => h.getBoundingClientRect().bottom > caja.top);
      return Number((visible?.textContent ?? "").replace("Sección ", ""));
    });
    expect(Math.abs(cercano - n)).toBeLessThanOrEqual(1);
    // La vista previa manda al revés, sin bucle: el editor sigue a la vista previa.
    await vista.hover();
    const antes = await page
      .getByTestId("editor-markdown")
      .evaluate((el) => el.shadowRoot?.querySelector<HTMLElement>(".cm-scroller")?.scrollTop ?? -1);
    await page.mouse.wheel(0, -2000);
    await expect
      .poll(() =>
        page
          .getByTestId("editor-markdown")
          .evaluate(
            (el) => el.shadowRoot?.querySelector<HTMLElement>(".cm-scroller")?.scrollTop ?? -1,
          ),
      )
      .toBeLessThan(antes);
    limpia(v);
  });
}

test("dividido: el editor va por encima en el apilado, y cada panel sigue recibiendo su puntero", async ({
  page,
}) => {
  // El hit test del ratón tras cada tecla no recorre la vista previa (SplitView.tsx).
  const v = await cargar(page, texto("apilado.md", "# Apilado\n\nTexto de la vista previa."));
  await modo(page, "dividido").click();
  await expect(editor(page)).toBeVisible();
  const panel = page.getByTestId("paneles").locator("> div").first();
  await expect(panel).toHaveCSS("position", "relative");
  await expect(panel).toHaveCSS("z-index", "1");
  const enPunto = async (caja: { x: number; y: number; width: number; height: number }) =>
    page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        if (el?.closest('[data-testid="editor-markdown"]')) return "editor";
        if (el?.closest("article")) return "vista";
        return el?.tagName ?? "nada";
      },
      { x: caja.x + caja.width / 2, y: caja.y + caja.height / 2 },
    );
  const cajaEditor = await page.getByTestId("editor-markdown").boundingBox();
  const cajaVista = await articulo(page).boundingBox();
  if (!cajaEditor || !cajaVista) throw new Error("sin cajas");
  expect(await enPunto(cajaEditor)).toBe("editor");
  expect(await enPunto(cajaVista)).toBe("vista");
  limpia(v);
});

test("separador: se mueve con el teclado y ningún panel desaparece", async ({ page }) => {
  const v = await cargar(page, texto("sep.md", "# Sep"));
  await modo(page, "dividido").click();
  const sep = page.getByRole("separator", { name: t.split.separator });
  await sep.focus();
  await page.keyboard.press("End");
  await expect(sep).toHaveAttribute("aria-valuenow", "80");
  await page.keyboard.press("ArrowRight");
  await expect(sep).toHaveAttribute("aria-valuenow", "80");
  await page.keyboard.press("Home");
  await expect(sep).toHaveAttribute("aria-valuenow", "20");
  const anchos = await page
    .getByTestId("paneles")
    .evaluate((p) =>
      [...p.children]
        .filter((c) => !(c as HTMLElement).hidden)
        .map((c) => c.getBoundingClientRect().width),
    );
  for (const ancho of anchos) expect(ancho).toBeGreaterThan(5);
  limpia(v);
});

test("pantalla estrecha: en dividido los paneles se apilan y siguen usables", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  const v = await cargar(page, texto("movil.md", "# Móvil\n\ntexto"));
  await modo(page, "dividido").click();
  await expect(editor(page)).toBeVisible();
  await expect(articulo(page)).toBeVisible();
  await expect(page.getByRole("separator")).toBeHidden();
  const [a, b] = await page
    .getByTestId("paneles")
    .evaluate((p) =>
      [...p.children]
        .filter((c) => getComputedStyle(c).display !== "none")
        .map((c) => c.getBoundingClientRect()),
    );
  expect(b!.top).toBeGreaterThanOrEqual(a!.bottom - 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  limpia(v);
});
