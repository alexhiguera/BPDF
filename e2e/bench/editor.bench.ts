import { type Browser, type CDPSession, expect, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";

/**
 * Benchmark del editor de Markdown (Fase 9). No es un test: mide e imprime.
 * Uso: `npm run bench:editor` (Chromium) y `npm run bench:editor:compat`
 * (Firefox y WebKit, escenarios críticos). Cada medición se puede lanzar sola con
 * `-g`: «latencia», «vista previa», «memoria», «Mermaid», «carga de CodeMirror».
 *
 * Lo que importa (criterio de la fase): **teclear en un Markdown de 1 MB sin
 * retraso perceptible**. Se escribe al principio, en medio y al final del
 * documento, se deshace y se rehace, en «Edición» y en «Dividido» (con la vista
 * previa refrescándose detrás, o en pausa si el documento es grande).
 *
 * Ritmo de escritura: 50 ms entre teclas (≈ 240 palabras por minuto, más
 * deprisa de lo que escribe casi nadie). No en ráfaga sin pausas: ahí cada tecla
 * mide también la cola de las anteriores (lo que tarda el navegador en procesar
 * 20 teclas llegadas en 1 ms), no el retraso que percibe quien escribe.
 *
 * Cómo se mide la latencia de cada pulsación, con dos métodos:
 * - **Event Timing** (Chromium y Firefox): duración de los eventos de teclado, de
 *   la tecla al pintado, agrupados por pulsación (`interactionId`, como INP). El
 *   navegador solo informa de los de 16 ms o más, con 8 ms de resolución: una
 *   pulsación sin informe es «< 16».
 * - **Tecla → fotograma** (todos, también WebKit, que no tiene Event Timing): del
 *   `timeStamp` del `keydown` a una tarea lanzada justo después del siguiente
 *   `requestAnimationFrame`. Mide lo mismo, algo por encima (incluye la espera
 *   hasta esa tarea).
 *
 * Instrumentación: solo desde aquí (`addInitScript`), sin tocar la app. Un
 * PerformanceObserver por página (hasta la iteración 15 se creaba uno por zona sin
 * desconectar los anteriores, y los recuentos de eventos salían multiplicados).
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

function generar(bytes: number, parte: (i: number) => string, titulo = "Documento") {
  let texto = `# ${titulo}\n\n`;
  for (let i = 0; texto.length < bytes; i++) texto += parte(i);
  return texto;
}

const CASOS = {
  "A · pequeño (2 KB)": () => generar(2_000, seccion),
  "A2 · 100 KB": () => generar(100_000, seccion),
  "B · grande (200 KB)": () => generar(200_000, seccion),
  "C · 1 MB": () => generar(1_000_000, seccion),
  "D · 1 MB + KaTeX": () => generar(1_000_000, conFormulas),
  "E · 1 MB + Mermaid": () => generar(1_000_000, conDiagrama),
  "F · 1 MB de encabezados": () => generar(1_000_000, encabezados),
} satisfies Record<string, () => string>;
type NombreCaso = keyof typeof CASOS;
type Modo = "edicion" | "dividido";
const TODOS: Modo[] = ["edicion", "dividido"];

/** Escenarios críticos fuera de Chromium (compatibilidad). */
const COMPAT: [NombreCaso, Modo[]][] = [
  ["C · 1 MB", ["edicion", "dividido"]],
  ["D · 1 MB + KaTeX", ["dividido"]],
];

// ---------------------------------------------------------------------------
// Instrumentación en la página

type Banco = {
  teclas: number[];
  nTeclas: number;
  ultimaTecla: number;
  clic: number;
  eventos: { n: string; d: number; id: number }[];
  tareas: number[];
  disparos: { ini: number; fin: number }[];
  respuestas: { tipo: string; t: number }[];
  observando: boolean;
  soporta: { eventos: boolean; tareas: boolean };
  vista: { armado: number; manual: boolean; commit: number; pintado: number } | null;
  temporizador: (f: () => void, ms: number) => unknown;
};

/**
 * Se inyecta antes que la app. Anota: cada `keydown` (y cuándo llega el
 * fotograma siguiente), cada clic, cada disparo de un temporizador de 200 ms (la
 * espera de la vista previa, `ESPERA_VISTA_PREVIA_MS`) y cada respuesta del marco
 * de Mermaid (`postMessage` hacia la página).
 */
function instrumentar() {
  const temporizador = window.setTimeout.bind(window);
  const b: Banco = {
    teclas: [],
    nTeclas: 0,
    ultimaTecla: 0,
    clic: 0,
    eventos: [],
    tareas: [],
    disparos: [],
    respuestas: [],
    observando: false,
    soporta: { eventos: false, tareas: false },
    vista: null,
    temporizador: (f, ms) => temporizador(f, ms),
  };
  (window as unknown as { __b: Banco }).__b = b;
  document.addEventListener(
    "keydown",
    (e) => {
      const t0 = e.timeStamp;
      b.nTeclas++;
      b.ultimaTecla = t0;
      requestAnimationFrame(() => {
        temporizador(() => b.teclas.push(performance.now() - t0), 0);
      });
    },
    true,
  );
  document.addEventListener(
    "click",
    (e) => {
      b.clic = e.timeStamp;
    },
    true,
  );
  type Temporizar = (f: TimerHandler, ms?: number, ...args: unknown[]) => number;
  const original = window.setTimeout.bind(window) as unknown as Temporizar;
  window.setTimeout = ((f: TimerHandler, ms?: number, ...args: unknown[]) => {
    if (ms === 200 && typeof f === "function") {
      const envuelta = (...a: unknown[]) => {
        const ini = performance.now();
        try {
          return f(...a);
        } finally {
          b.disparos.push({ ini, fin: performance.now() });
        }
      };
      return original(envuelta, ms, ...args);
    }
    return original(f, ms, ...args);
  }) as unknown as typeof window.setTimeout;
  window.addEventListener("message", (e) => {
    const d = e.data as { tipo?: unknown } | null;
    if (d && typeof d.tipo === "string" && d.tipo.startsWith("bpdf-") && d.tipo !== "bpdf-listo")
      b.respuestas.push({ tipo: d.tipo, t: performance.now() });
  });
}

/** Un observador de cada tipo por página (no uno por zona). */
async function observar(page: Page) {
  await page.evaluate(() => {
    const b = (window as unknown as { __b: Banco }).__b;
    if (b.observando) return;
    b.observando = true;
    const tipos = PerformanceObserver.supportedEntryTypes ?? [];
    b.soporta = { eventos: tipos.includes("event"), tareas: tipos.includes("longtask") };
    const DE_TECLADO = ["keydown", "keypress", "keyup", "input", "beforeinput"];
    if (b.soporta.eventos)
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries() as (PerformanceEntry & { interactionId?: number })[]) {
          if (DE_TECLADO.includes(e.name))
            b.eventos.push({ n: e.name, d: e.duration, id: e.interactionId ?? 0 });
        }
      }).observe({
        type: "event",
        durationThreshold: 16,
        buffered: false,
      } as PerformanceObserverInit);
    if (b.soporta.tareas)
      new PerformanceObserver((lista) => {
        for (const e of lista.getEntries()) b.tareas.push(e.duration);
      }).observe({ type: "longtask" });
  });
}

async function vaciar(page: Page) {
  await page.evaluate(() => {
    const b = (window as unknown as { __b: Banco }).__b;
    b.teclas = [];
    b.nTeclas = 0;
    b.eventos = [];
    b.tareas = [];
  });
}

type Muestra = {
  teclas: number[];
  nTeclas: number;
  eventos: { n: string; d: number; id: number }[];
  tareas: number[];
  soporta: { eventos: boolean; tareas: boolean };
};
async function recoger(page: Page): Promise<Muestra> {
  // Deja llegar las últimas entradas (el observador las entrega tras pintar).
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const b = (window as unknown as { __b: Banco }).__b;
    return {
      teclas: [...b.teclas],
      nTeclas: b.nTeclas,
      eventos: [...b.eventos],
      tareas: [...b.tareas],
      soporta: b.soporta,
    };
  });
}

// ---------------------------------------------------------------------------
// Estadística

function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return Number.NaN;
  const orden = [...valores].sort((a, b) => a - b);
  return (
    orden[Math.min(orden.length - 1, Math.max(0, Math.ceil((p / 100) * orden.length) - 1))] ??
    Number.NaN
  );
}
/** Latencia por pulsación según Event Timing: la más larga de sus eventos; sin informe, 0 (< 16). */
function porPulsacion(m: Muestra): number[] | null {
  const conId = m.eventos.filter((e) => e.id > 0);
  if (!m.soporta.eventos || (m.eventos.length > 0 && conId.length === 0)) return null;
  const maximo = new Map<number, number>();
  for (const e of conId) maximo.set(e.id, Math.max(maximo.get(e.id) ?? 0, e.d));
  const v = [...maximo.values()];
  while (v.length < m.nTeclas) v.push(0);
  return v;
}
const et = (v: number) => (Number.isNaN(v) ? "n/d" : v < 16 ? "<16" : String(Math.round(v)));
const ms = (v: number) => (Number.isNaN(v) ? "n/d" : String(Math.round(v)));
function resumen(muestras: Muestra[]) {
  const pulsaciones = muestras.map(porPulsacion);
  const etTodas = pulsaciones.every((p) => p !== null) ? pulsaciones.flatMap((p) => p ?? []) : null;
  const raf = muestras.flatMap((m) => m.teclas);
  const eventos = muestras.flatMap((m) => m.eventos.map((e) => e.d));
  const tareas = muestras.flatMap((m) => m.tareas);
  const conTareas = muestras.every((m) => m.soporta.tareas);
  const conEventos = muestras.every((m) => m.soporta.eventos);
  return {
    teclas: muestras.reduce((s, m) => s + m.nTeclas, 0),
    etP50: etTodas ? et(percentil(etTodas, 50)) : "n/d",
    etP95: etTodas ? et(percentil(etTodas, 95)) : "n/d",
    etP99: etTodas ? et(percentil(etTodas, 99)) : "n/d",
    etMax: etTodas ? et(Math.max(0, ...etTodas)) : "n/d",
    rafP50: ms(percentil(raf, 50)),
    rafP95: ms(percentil(raf, 95)),
    rafP99: ms(percentil(raf, 99)),
    rafMax: ms(raf.length ? Math.max(...raf) : Number.NaN),
    ev50: conEventos ? eventos.filter((d) => d >= 50).length : "n/d",
    ev100: conEventos ? eventos.filter((d) => d >= 100).length : "n/d",
    tareaMax: conTareas ? ms(Math.max(0, ...tareas)) : "n/d",
  };
}

// ---------------------------------------------------------------------------
// Acciones

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

/*
 * Localizadores baratos: CSS acotado, no por rol ni por texto en toda la página. En
 * Firefox, `getByRole`/`getByText` calculan roles y nombres de todo el documento en
 * cada sondeo (≈ 280 000 nodos con 1 MB + KaTeX): bloqueaban el hilo principal decenas de
 * segundos y el benchmark medía eso como «cambiar de modo» (perfil de Gecko, iteración 17).
 * Apuntan a los mismos elementos que antes.
 */
const editor = (page: Page) => page.getByTestId("editor-markdown").locator(".cm-content");
const avisoPausa = (page: Page) =>
  page.locator('[role="status"]').filter({ hasText: t.previewPaused });
const botonActualizar = (page: Page) => page.locator('[role="status"] button');
const botonModo = (page: Page, m: Modo | "lectura") =>
  page.locator("fieldset button").getByText(t.mode[m], { exact: true });

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

/** La escritura de siempre (iteraciones 14 y 15): comparable con sus cifras. */
async function escribir(page: Page) {
  await page.keyboard.type("texto escrito deprisa ", { delay: RITMO_MS });
  for (const c of "lento") {
    await page.waitForTimeout(400);
    await page.keyboard.type(c);
  }
  await page.keyboard.press("Control+z");
  await page.keyboard.press("Control+y");
  await page.waitForTimeout(400);
}

async function nuevaPagina(page: Page) {
  await page.addInitScript(instrumentar);
  await page.setViewportSize({ width: 1400, height: 900 });
  // Con cambios, recargar pide confirmar (beforeunload): se acepta.
  page.on("dialog", (d) => d.accept());
}

/** Abre un Markdown. Si hay cambios sin guardar, los descarta en el diálogo de BPDF. */
async function abrir(
  page: Page,
  texto: string,
  opciones: { descartar?: boolean; titulo?: string } = {},
) {
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator("button").filter({ hasText: messages.open.button }).first().click(),
  ]);
  await selector.setFiles({ name: "bench.md", mimeType: "", buffer: Buffer.from(texto) });
  if (opciones.descartar)
    await page.locator("dialog button").filter({ hasText: messages.discard.confirm }).click();
  const titulo = opciones.titulo ?? "Documento";
  await expect(page.locator("article h1").filter({ hasText: titulo })).toBeVisible({
    timeout: 120_000,
  });
  await expect(page.locator("article .md-contenido")).toHaveAttribute("aria-busy", "false", {
    timeout: 120_000,
  });
}

async function abrirDocumento(page: Page, texto: string) {
  await page.goto("/");
  await abrir(page, texto);
  await observar(page);
}

async function entrarEn(page: Page, m: Modo) {
  await esperarQuieto(page);
  const inicio = Date.now();
  await botonModo(page, m).click();
  // Se espera desde la página, no con `expect(locator).toBeVisible()`: en Firefox, con
  // 1 MB + KaTeX, ese sondeo de Playwright tardaba ~85 s en dar por visible un editor
  // que la página tenía listo en < 1 s (medido, iteración 17).
  await page.waitForFunction(
    () => {
      const contenido = document
        .querySelector('[data-testid="editor-markdown"]')
        ?.shadowRoot?.querySelector(".cm-content");
      return !!contenido && contenido.getBoundingClientRect().height > 0;
    },
    undefined,
    { timeout: 120_000, polling: "raf" },
  );
  await esperarQuieto(page);
  return Date.now() - inicio;
}

const imprimir = (tipo: string, fila: Record<string, unknown>) =>
  console.log(`BENCH ${tipo} ${JSON.stringify(fila)}`);

// ---------------------------------------------------------------------------
// 1. Latencia de edición

test("latencia: teclear en documentos grandes", async ({ page, browserName }) => {
  test.setTimeout(3_600_000);
  await nuevaPagina(page);
  // `BENCH_CASOS=KaTeX,Mermaid` limita los casos (por subcadena del nombre).
  const filtro = process.env.BENCH_CASOS?.split(",").filter(Boolean) ?? [];
  const plan: [NombreCaso, Modo[]][] = (
    browserName === "chromium"
      ? (Object.keys(CASOS) as NombreCaso[]).map((c): [NombreCaso, Modo[]] => [c, TODOS])
      : COMPAT
  ).filter(([c]) => filtro.length === 0 || filtro.some((f) => c.includes(f)));
  const filas: Record<string, unknown>[] = [];
  for (const [nombre, modos] of plan) {
    const texto = CASOS[nombre]();
    await abrirDocumento(page, texto);
    for (const modoActual of modos) {
      const cargaModoMs = await entrarEn(page, modoActual);
      await page.waitForTimeout(500);
      const muestras: Muestra[] = [];
      for (const [zona, donde] of [
        ["principio", 0],
        ["medio", 0.5],
        ["final", 1],
      ] as const) {
        // Se escribe nada más llegar, como en las iteraciones 14 y 15: el primer
        // fotograma tras saltar a una zona también lo paga quien escribe.
        await colocar(page, donde);
        await vaciar(page);
        await escribir(page);
        const m = await recoger(page);
        muestras.push(m);
        imprimir("zona", {
          navegador: browserName,
          caso: nombre,
          modo: modoActual,
          zona,
          ...resumen([m]),
        });
      }
      const fila = {
        navegador: browserName,
        caso: nombre,
        modo: modoActual,
        cargaModoMs,
        ...resumen(muestras),
        enPausa: await avisoPausa(page).isVisible(),
      };
      filas.push(fila);
      imprimir("latencia", fila);
      // En bruto, para juntar varias ejecuciones (con 93 pulsaciones, P99 = máximo).
      imprimir("crudo", {
        navegador: browserName,
        caso: nombre,
        modo: modoActual,
        et: muestras.map(porPulsacion),
        raf: muestras.map((m) => m.teclas),
        eventos: muestras.map((m) => m.eventos.map((e) => e.d)),
        tareas: muestras.map((m) => m.tareas),
      });
    }
    await botonModo(page, "lectura").click();
  }
  console.table(filas);
});

// ---------------------------------------------------------------------------
// 2. Vista previa: de la última tecla a la vista previa pintada

/**
 * Fases, en la página: última tecla (`keydown`) → disparo de la espera de 200 ms
 * (inicio del procesamiento) → fin de ese callback (sacar el texto del editor) →
 * primera mutación del artículo (React ha pintado el árbol nuevo en el DOM) →
 * tarea tras el siguiente fotograma (pintado). Si la vista previa está en pausa
 * (documento caro), no hay espera: se mide desde el clic en «Actualizar».
 */
type Medida = {
  esperaMs: number;
  extraccionMs: number;
  procesamientoMs: number;
  pintadoMs: number;
  totalMs: number;
};

test("vista previa: fases del refresco", async ({ page }) => {
  test.setTimeout(3_600_000);
  await nuevaPagina(page);
  const casos: NombreCaso[] = [
    "A · pequeño (2 KB)",
    "A2 · 100 KB",
    "B · grande (200 KB)",
    "C · 1 MB",
    "D · 1 MB + KaTeX",
    "E · 1 MB + Mermaid",
  ];
  const filas: Record<string, unknown>[] = [];
  for (const nombre of casos) {
    await abrirDocumento(page, CASOS[nombre]());
    await entrarEn(page, "dividido");
    await page.waitForTimeout(500);
    // En pausa, el aviso solo sale cuando hay cambios sin mostrar: se mira tras teclear.
    let enPausa = false;
    const repeticiones = nombre.includes("1 MB") ? 3 : 5;
    await editor(page).click();
    await page.keyboard.press("Control+End");
    await esperarQuieto(page);
    const medidas: (Medida & { manual: boolean })[] = [];
    for (let r = 0; r < repeticiones; r++) {
      await page.evaluate(() => {
        const b = (window as unknown as { __b: Banco }).__b;
        const vista = { armado: performance.now(), manual: false, commit: 0, pintado: 0 };
        b.vista = vista;
        const articulo = document.querySelector("article");
        if (!articulo) throw new Error("sin artículo");
        const observador = new MutationObserver(() => {
          const disparado = b.clic > vista.armado || b.disparos.some((d) => d.ini > vista.armado);
          if (!disparado || vista.commit) return;
          vista.commit = performance.now();
          observador.disconnect();
          requestAnimationFrame(() => {
            b.temporizador(() => {
              vista.pintado = performance.now();
            }, 0);
          });
        });
        observador.observe(articulo, { subtree: true, childList: true, characterData: true });
      });
      // «Actualizar» se queda con el foco: se devuelve al editor (conserva el cursor).
      await editor(page).focus();
      await page.keyboard.type(`x${r}`, { delay: RITMO_MS });
      await page.waitForTimeout(400);
      enPausa = await avisoPausa(page).isVisible();
      if (enPausa) await botonActualizar(page).click();
      await expect
        .poll(
          () => page.evaluate(() => (window as unknown as { __b: Banco }).__b.vista?.pintado ?? 0),
          {
            timeout: 120_000,
          },
        )
        .toBeGreaterThan(0);
      const m = await page.evaluate(() => {
        const b = (window as unknown as { __b: Banco }).__b;
        const v = b.vista as NonNullable<Banco["vista"]>;
        const disparo = b.disparos.find((d) => d.ini > v.armado);
        return {
          manual: b.clic > v.armado,
          tecla: b.ultimaTecla,
          clic: b.clic,
          disparo,
          commit: v.commit,
          pintado: v.pintado,
        };
      });
      const medida = m.manual
        ? {
            esperaMs: Number.NaN,
            extraccionMs: Number.NaN,
            procesamientoMs: m.commit - m.clic,
            pintadoMs: m.pintado - m.commit,
            totalMs: m.pintado - m.clic,
          }
        : {
            esperaMs: (m.disparo?.ini ?? Number.NaN) - m.tecla,
            extraccionMs: (m.disparo?.fin ?? Number.NaN) - (m.disparo?.ini ?? Number.NaN),
            procesamientoMs: m.commit - (m.disparo?.fin ?? Number.NaN),
            pintadoMs: m.pintado - m.commit,
            totalMs: m.pintado - m.tecla,
          };
      medidas.push({ ...medida, manual: m.manual });
      imprimir("vista-muestra", { caso: nombre, enPausa, r, ...medida });
      await esperarQuieto(page);
      await page.waitForTimeout(300);
    }
    // Una fila por camino: un documento cerca del umbral puede empezar en pausa y
    // reanudarse (o al revés) según lo que cueste cada refresco.
    for (const manual of [false, true]) {
      const grupo = medidas.filter((x) => x.manual === manual);
      if (grupo.length === 0) continue;
      const cifra = (k: keyof Medida) =>
        `${ms(
          percentil(
            grupo.map((x) => x[k]),
            50,
          ),
        )} (máx. ${ms(Math.max(...grupo.map((x) => x[k])))})`;
      const fila = {
        caso: nombre,
        desde: manual ? "clic en Actualizar (en pausa)" : "última tecla",
        n: grupo.length,
        espera: manual ? "—" : cifra("esperaMs"),
        extraccion: manual ? "—" : cifra("extraccionMs"),
        procesamiento: cifra("procesamientoMs"),
        pintado: cifra("pintadoMs"),
        total: cifra("totalMs"),
      };
      filas.push(fila);
      imprimir("vista", fila);
    }
    await botonModo(page, "lectura").click();
  }
  console.table(filas);
});

// ---------------------------------------------------------------------------
// 3. Memoria (CDP)

/**
 * `Runtime.getHeapUsage` (montón de V8 y, si el navegador lo da, el de Blink, que
 * guarda el DOM) y `Memory.getDOMCounters`. Con recolección forzada
 * (`HeapProfiler.collectGarbage`, dos veces) salvo «sin GC», que es lo que hay en
 * ese momento. No incluye memoria de la GPU, de la rasterización ni del proceso
 * del marco de Mermaid.
 */
test("memoria: CDP", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "CDP solo existe en Chromium");
  test.setTimeout(1_800_000);
  // Sin la instrumentación de las otras mediciones: que nada del benchmark
  // retenga nodos u objetos de la página.
  await page.setViewportSize({ width: 1400, height: 900 });
  page.on("dialog", (d) => d.accept());
  const cdp = await page.context().newCDPSession(page);
  /**
   * Cuántas instancias de un prototipo hay vivas en el montón
   * (`Runtime.queryObjects`, tras recolectar): si son más que las que hay en el
   * documento, hay nodos fuera del árbol que algo retiene.
   */
  const vivas = async (prototipo: string) => {
    const { result } = (await cdp.send("Runtime.evaluate", {
      expression: `${prototipo}.prototype`,
    })) as { result: { objectId: string } };
    const { objects } = (await cdp.send("Runtime.queryObjects", {
      prototypeObjectId: result.objectId,
    })) as { objects: { objectId: string } };
    const { result: n } = (await cdp.send("Runtime.callFunctionOn", {
      objectId: objects.objectId,
      functionDeclaration: "function () { return this.length; }",
      returnByValue: true,
    })) as { result: { value: number } };
    await cdp.send("Runtime.releaseObject", { objectId: objects.objectId });
    await cdp.send("Runtime.releaseObject", { objectId: result.objectId });
    return n.value;
  };
  const filas: Record<string, unknown>[] = [];
  const medir = async (momento: string, gc = true) => {
    await esperarQuieto(page);
    if (gc) {
      await cdp.send("HeapProfiler.collectGarbage");
      await cdp.send("HeapProfiler.collectGarbage");
    }
    const heap = (await cdp.send("Runtime.getHeapUsage")) as {
      usedSize: number;
      totalSize: number;
      embedderHeapUsedSize?: number;
      backingStorageSize?: number;
    };
    const dom = (await cdp.send("Memory.getDOMCounters")) as {
      documents: number;
      nodes: number;
      jsEventListeners: number;
    };
    const mb = (b?: number) => (b === undefined ? "n/d" : (b / 1024 / 1024).toFixed(1));
    const fila = {
      momento,
      gc: gc ? "sí" : "no",
      v8UsadoMB: mb(heap.usedSize),
      v8TotalMB: mb(heap.totalSize),
      blinkMB: mb(heap.embedderHeapUsedSize),
      nodos: dom.nodes,
      oyentes: dom.jsEventListeners,
      tablasVivas: gc ? await vivas("HTMLTableElement") : "—",
      tablasEnDocumento: await page.evaluate(() => document.querySelectorAll("table").length),
    };
    filas.push(fila);
    imprimir("memoria", fila);
  };
  const dibujado = () =>
    expect(page.locator('.md-diagrama[data-diagrama="listo"]').first()).toBeAttached({
      timeout: 120_000,
    });
  await page.goto("/");
  await expect(page.getByRole("button", { name: messages.open.button }).first()).toBeVisible();
  await medir("inicial (sin documento)");
  const unMega = CASOS["C · 1 MB"]();
  await abrir(page, unMega);
  await medir("1 MB abierto (Lectura)");
  await entrarEn(page, "edicion");
  await editor(page).click();
  await escribir(page);
  await medir("1 MB, editando en Edición", false);
  await medir("1 MB, tras editar en Edición");
  await entrarEn(page, "dividido");
  await editor(page).click();
  await escribir(page);
  await medir("1 MB, editando en Dividido", false);
  await medir("1 MB, tras editar en Dividido");
  await abrir(page, generar(2_000, seccion, "Otro"), { descartar: true, titulo: "Otro" });
  await medir("tras cambiar a otro documento (2 KB)");
  await page.waitForTimeout(5000);
  await medir("tras cambiar a otro documento (2 KB), 5 s después");
  await abrir(page, unMega);
  await medir("tras volver al 1 MB (Lectura)");
  await abrir(page, generar(1_000_000, conFormulas, "Fórmulas"), { titulo: "Fórmulas" });
  await medir("1 MB + KaTeX (Lectura)");
  await entrarEn(page, "dividido");
  await editor(page).click();
  await escribir(page);
  await medir("1 MB + KaTeX, tras editar en Dividido");
  await abrir(page, generar(1_000_000, conDiagrama, "Diagramas"), {
    descartar: true,
    titulo: "Diagramas",
  });
  await dibujado();
  await medir("1 MB + Mermaid (Lectura; se dibujan los diagramas a la vista)");
  await entrarEn(page, "dividido");
  await editor(page).click();
  await escribir(page);
  await medir("1 MB + Mermaid, tras editar en Dividido");
  console.table(filas);
});

// ---------------------------------------------------------------------------
// 4. Mermaid en el navegador

/**
 * Cronometra en la página cuándo aparece el primer diagrama dibujado. Los
 * diagramas se dibujan al acercarse a la vista (IntersectionObserver, 400 px de
 * margen): en un documento largo, los de más abajo esperan a que se llegue.
 */
async function cronometrarDiagramas(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __crono: { ini: number; primero: number }; __b: Banco };
    const c = { ini: performance.now(), primero: 0 };
    w.__crono = c;
    w.__b.respuestas = [];
    // Los del documento anterior no cuentan.
    const viejos = new Set(document.querySelectorAll(".md-diagrama"));
    const vuelta = () => {
      const listos = document.querySelectorAll('.md-diagrama[data-diagrama="listo"]');
      if ([...listos].some((d) => !viejos.has(d))) {
        c.primero = performance.now() - c.ini;
        return;
      }
      requestAnimationFrame(vuelta);
    };
    requestAnimationFrame(vuelta);
  });
}
const crono = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __crono: { primero: number }; __b: Banco };
    return {
      primerDiagramaMs: Math.round(w.__crono.primero),
      dibujados: document.querySelectorAll('.md-diagrama[data-diagrama="listo"]').length,
      diagramas: document.querySelectorAll(".md-diagrama").length,
      respuestasDelMarco: w.__b.respuestas.length,
    };
  });

test("Mermaid: primer dibujo y qué se vuelve a dibujar al editar", async ({ page }) => {
  test.setTimeout(1_800_000);
  await nuevaPagina(page);
  await page.goto("/");
  const doc =
    "# Diagramas\n\nPárrafo inicial.\n\n```mermaid\nflowchart LR\n  A1 --> B1\n```\n\nTexto entre medias.\n\n```mermaid\nflowchart LR\n  A2 --> B2\n```\n\nPárrafo final.\n";
  await cronometrarDiagramas(page);
  await abrir(page, doc, { titulo: "Diagramas" });
  await expect.poll(() => page.locator('.md-diagrama[data-diagrama="listo"]').count()).toBe(2);
  imprimir("mermaid", {
    prueba: "primer dibujo (2 diagramas, marco en frío)",
    ...(await crono(page)),
  });

  await entrarEn(page, "dividido");
  await page.waitForTimeout(500);
  // Cada diagrama dibujado es un <img> con una URL blob: propia. El mismo nodo y
  // la misma URL = no se ha vuelto a montar ni a dibujar.
  const imagenes = () =>
    page.evaluate(() => {
      const w = window as unknown as { __imgs?: { el: Element; src: string }[] };
      const ahora = [...document.querySelectorAll("article figure.md-diagrama img")].map((el) => ({
        el,
        src: el.getAttribute("src") ?? "",
      }));
      const antes = w.__imgs ?? [];
      w.__imgs = ahora;
      return ahora.map((x, i) => x.el === antes[i]?.el && x.src === antes[i]?.src);
    });
  const respuestas = () =>
    page.evaluate(() => (window as unknown as { __b: Banco }).__b.respuestas.length);

  // Edición que NO toca ningún diagrama.
  await imagenes();
  let antes = await respuestas();
  await editor(page).locator(".cm-line", { hasText: "Párrafo final." }).click();
  await page.keyboard.press("End");
  await page.keyboard.type(" más", { delay: RITMO_MS });
  await expect(page.locator("article")).toContainText("Párrafo final. más");
  await page.waitForTimeout(1500);
  await esperarQuieto(page);
  imprimir("mermaid", {
    prueba: "edición fuera de los diagramas",
    respuestasDelMarco: (await respuestas()) - antes,
    mismoNodoYUrl: await imagenes(),
  });

  // Edición que cambia el primer diagrama.
  antes = await respuestas();
  await editor(page).locator(".cm-line", { hasText: "A1 --> B1" }).click();
  await page.keyboard.press("End");
  await page.evaluate(() => {
    const w = window as unknown as { __cambio: number; __b: Banco };
    w.__cambio = 0;
    const vuelta = () => {
      const primero = document.querySelector("article .md-diagrama");
      if (
        primero?.getAttribute("data-diagrama") === "listo" &&
        primero.querySelector("code")?.textContent?.includes("B1X")
      ) {
        w.__cambio = performance.now() - w.__b.ultimaTecla;
        return;
      }
      requestAnimationFrame(vuelta);
    };
    requestAnimationFrame(vuelta);
  });
  await page.keyboard.type("X");
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __cambio: number }).__cambio), {
      timeout: 30_000,
    })
    .toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  imprimir("mermaid", {
    prueba: "edición dentro del primer diagrama",
    teclaADiagramaNuevoMs: Math.round(
      await page.evaluate(() => (window as unknown as { __cambio: number }).__cambio),
    ),
    respuestasDelMarco: (await respuestas()) - antes,
    mismoNodoYUrl: await imagenes(),
  });

  // 1 MB + Mermaid: primer dibujo y refresco (en pausa: con «Actualizar»).
  await cronometrarDiagramas(page);
  await abrir(page, CASOS["E · 1 MB + Mermaid"](), { descartar: true });
  await expect
    .poll(async () => (await crono(page)).primerDiagramaMs, { timeout: 120_000 })
    .toBeGreaterThan(0);
  await esperarQuieto(page);
  await page.waitForTimeout(2000);
  imprimir("mermaid", {
    prueba: "1 MB + Mermaid: primer dibujo (Lectura)",
    ...(await crono(page)),
  });
  await entrarEn(page, "dividido");
  await page.waitForTimeout(1000);
  await imagenes();
  await editor(page).click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("End");
  antes = await respuestas();
  await page.keyboard.type(" fin", { delay: RITMO_MS });
  await page.waitForTimeout(400);
  const enPausa = await avisoPausa(page).isVisible();
  if (enPausa) await botonActualizar(page).click();
  await expect(page.locator("article h1")).toContainText("fin", {
    timeout: 120_000,
  });
  await esperarQuieto(page);
  await page.waitForTimeout(2000);
  const iguales = await imagenes();
  imprimir("mermaid", {
    prueba: "1 MB + Mermaid: refresco tras editar fuera de los diagramas",
    enPausa,
    ...(await crono(page)),
    respuestasDelMarco: (await respuestas()) - antes,
    imagenesConMismoNodoYUrl: `${iguales.filter(Boolean).length} de ${iguales.length}`,
  });
});

// ---------------------------------------------------------------------------
// 5. Carga de CodeMirror

/** Lee una traza de CDP pequeña entera. */
type EventoTraza = {
  name: string;
  ph: string;
  pid: number;
  tid: number;
  dur?: number;
  args?: { name?: string };
};
async function leerTraza(cdp: CDPSession, stream: string) {
  let texto = "";
  for (;;) {
    const r = (await cdp.send("IO.read", { handle: stream })) as {
      data: string;
      eof: boolean;
      base64Encoded?: boolean;
    };
    texto += r.base64Encoded ? Buffer.from(r.data, "base64").toString() : r.data;
    if (r.eof) break;
  }
  await cdp.send("IO.close", { handle: stream });
  const json = JSON.parse(texto) as { traceEvents: EventoTraza[] } | EventoTraza[];
  return Array.isArray(json) ? json : json.traceEvents;
}

/**
 * Del clic en «Edición» al editor estable, con el documento ya abierto y quieto
 * (no se mezcla con su carga). Cada muestra en un contexto nuevo: el trozo del
 * editor no está en caché ni evaluado. Con traza (solo Chromium), además, cuánto
 * tarda en compilarse y evaluarse el trozo.
 */
async function cargarEditor(browser: Browser, baseURL: string, texto: string, conTraza: boolean) {
  const contexto = await browser.newContext({ baseURL, viewport: { width: 1400, height: 900 } });
  const page = await contexto.newPage();
  await page.addInitScript(instrumentar);
  await page.goto("/");
  await abrir(page, texto);
  await esperarQuieto(page);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const w = window as unknown as { __carga: { visible: number; estable: number } };
    const c = { visible: 0, estable: 0 };
    w.__carga = c;
    let anterior = performance.now();
    let rapidos = 0;
    let desde = 0;
    const vuelta = () => {
      const ahora = performance.now();
      const delta = ahora - anterior;
      anterior = ahora;
      if (!c.visible) {
        const contenido = document
          .querySelector('[data-testid="editor-markdown"]')
          ?.shadowRoot?.querySelector(".cm-content");
        if (contenido && contenido.getBoundingClientRect().height > 0 && contenido.textContent)
          c.visible = ahora;
      } else {
        if (delta < 50) {
          if (rapidos === 0) desde = ahora;
          rapidos++;
        } else rapidos = 0;
        if (rapidos >= 3) {
          c.estable = desde;
          return;
        }
      }
      requestAnimationFrame(vuelta);
    };
    requestAnimationFrame(vuelta);
  });
  let cdp: CDPSession | null = null;
  if (conTraza) {
    cdp = await contexto.newCDPSession(page);
    await cdp.send("Tracing.start", {
      categories: "toplevel,devtools.timeline,v8,v8.execute,disabled-by-default-devtools.timeline",
      transferMode: "ReturnAsStream",
    } as never);
  }
  await botonModo(page, "edicion").click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => (window as unknown as { __carga: { estable: number } }).__carga.estable,
        ),
      { timeout: 120_000 },
    )
    .toBeGreaterThan(0);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __carga: { visible: number; estable: number }; __b: Banco };
    const clic = w.__b.clic;
    const trozos = (performance.getEntriesByType("resource") as PerformanceResourceTiming[])
      .filter((e) => e.startTime >= clic && e.name.endsWith(".js"))
      .map((e) => ({
        nombre: e.name.split("/").pop() ?? "",
        solicitud: e.startTime - clic,
        descarga: e.responseEnd - e.startTime,
        bytes: e.encodedBodySize,
      }));
    return { trozos, visible: w.__carga.visible - clic, estable: w.__carga.estable - clic };
  });
  const evaluacion: Record<string, number> = {};
  if (cdp) {
    const fin = new Promise<string>((ok) =>
      cdp?.on("Tracing.tracingComplete", (e: { stream?: string }) => ok(e.stream ?? "")),
    );
    await cdp.send("Tracing.end");
    const eventos = await leerTraza(cdp, await fin);
    for (const e of eventos) {
      if (e.ph !== "X" || typeof e.dur !== "number") continue;
      if (!JSON.stringify(e.args ?? {}).includes("EditorMarkdown")) continue;
      evaluacion[e.name] = (evaluacion[e.name] ?? 0) + e.dur / 1000;
    }
    // Cuánto trabaja el hilo principal del renderizador durante la traza (del clic
    // al editor estable): si es mucho menos que el tiempo hasta verlo, el resto es
    // espera, no trabajo.
    const principales = new Set(
      eventos
        .filter(
          (e) => e.ph === "M" && e.name === "thread_name" && e.args?.name === "CrRendererMain",
        )
        .map((e) => `${e.pid}:${e.tid}`),
    );
    const porHilo = new Map<string, number>();
    for (const e of eventos) {
      const clave = `${e.pid}:${e.tid}`;
      if (e.ph === "X" && e.name === "ThreadControllerImpl::RunTask" && principales.has(clave))
        porHilo.set(clave, (porHilo.get(clave) ?? 0) + (e.dur ?? 0) / 1000);
    }
    evaluacion["hilo principal ocupado (total de tareas)"] = Math.max(0, ...porHilo.values());
  }
  await contexto.close();
  return { ...r, evaluacion };
}

test("carga de CodeMirror: del clic al editor estable", async ({ browser, browserName }, info) => {
  test.setTimeout(1_800_000);
  const baseURL = String(info.project.use.baseURL);
  const filas: Record<string, unknown>[] = [];
  for (const nombre of ["A · pequeño (2 KB)", "C · 1 MB"] as NombreCaso[]) {
    const texto = CASOS[nombre]();
    const muestras: Awaited<ReturnType<typeof cargarEditor>>[] = [];
    for (let i = 0; i < 5; i++) muestras.push(await cargarEditor(browser, baseURL, texto, false));
    const editorTrozo = (m: (typeof muestras)[number]) =>
      m.trozos.find((x) => x.nombre.startsWith("EditorMarkdown"));
    const mediana = (f: (m: (typeof muestras)[number]) => number) =>
      ms(percentil(muestras.map(f), 50));
    const maximo = (f: (m: (typeof muestras)[number]) => number) =>
      ms(Math.max(...muestras.map(f)));
    const fila: Record<string, unknown> = {
      navegador: browserName,
      caso: nombre,
      n: muestras.length,
      trozosPedidos: muestras[0]?.trozos.map((x) => `${x.nombre} (${x.bytes} B)`).join(", "),
      hastaSolicitar: `${mediana((m) => editorTrozo(m)?.solicitud ?? Number.NaN)} (máx. ${maximo((m) => editorTrozo(m)?.solicitud ?? Number.NaN)})`,
      descarga: `${mediana((m) => editorTrozo(m)?.descarga ?? Number.NaN)} (máx. ${maximo((m) => editorTrozo(m)?.descarga ?? Number.NaN)})`,
      hastaVisible: `${mediana((m) => m.visible)} (máx. ${maximo((m) => m.visible)})`,
      hastaEstable: `${mediana((m) => m.estable)} (máx. ${maximo((m) => m.estable)})`,
    };
    if (browserName === "chromium") {
      const conTraza: Awaited<ReturnType<typeof cargarEditor>>[] = [];
      for (let i = 0; i < 3; i++) conTraza.push(await cargarEditor(browser, baseURL, texto, true));
      const nombres = new Set(conTraza.flatMap((m) => Object.keys(m.evaluacion)));
      fila.trazaEditorMarkdown = Object.fromEntries(
        [...nombres].map((n) => [
          n,
          `${ms(
            percentil(
              conTraza.map((m) => m.evaluacion[n] ?? 0),
              50,
            ),
          )} (máx. ${ms(Math.max(...conTraza.map((m) => m.evaluacion[n] ?? 0)))})`,
        ]),
      );
    }
    filas.push(fila);
    imprimir("carga", fila);
  }
  console.table(filas);
});
