# Desarrollo en local

## Requisitos

- **Node 24** (`nvm use`, lee `.nvmrc`). `engines` rechaza otras versiones mayores.
- En **Windows**, trabaja dentro de WSL: el repo en el sistema de ficheros de Linux y
  `npm` ejecutado desde WSL. Instalar desde Windows sobre `\\wsl.localhost\…` es lento y
  deja binarios nativos de la plataforma equivocada.
- Ojo: en WSL, `nvm` se carga desde `~/.bashrc`, que un `bash -lc` no interactivo no lee.
  Si `node -v` dice otra cosa que 24, carga nvm (`. ~/.nvm/nvm.sh && nvm use`).
- Sin Docker, base de datos ni servicios externos: BPDF no los usa.

## Arranque

```bash
nvm use
npm ci
npm run dev           # http://localhost:5173
```

**Variables de entorno: ninguna.** BPDF es una build estática sin servicios que
configurar, idéntica en local, en CI y en producción. Si alguna fase llegara a necesitar
una, antes se decide si de verdad hace falta ([`CLAUDE.md`](../CLAUDE.md) §1).

### Desarrollo frente a build

| | `npm run dev` | `npm run build` + `npm run preview` |
|---|---|---|
| Qué sirve | Los fuentes, transformados al vuelo | `dist/`, la build de producción |
| CSP y cabeceras | **No** (Vite inyecta código en línea que una CSP estricta bloquearía) | **Sí**: cabeceras en `preview` y `<meta>` en `dist/index.html` |
| Recarga | Completa al guardar (sin `@vitejs/plugin-react`, no hay Fast Refresh) | — |
| `robots.txt`, `sitemap.xml` | No | Sí (generados desde `project.ts`) |

Por eso todo lo que dependa de la CSP se comprueba con `preview` o con los E2E, nunca
con `dev`. Las dos modalidades devuelven 404 para rutas que no existen (`appType: "mpa"`
en [`vite.config.ts`](../vite.config.ts): sin fallback de SPA).

### Probar el visor PDF con documentos reales

`npm run build && npm run preview` y abre cualquier PDF local (botón, `Ctrl/Cmd+O` o
arrastrar). En `dev` también funciona, pero **sin CSP**: lo que dependa de ella (el worker,
los cmaps de fuentes CJK) solo se comprueba en `preview` (CLAUDE.md §13). Nada sale del
navegador. El laboratorio de la Fase 4 (`/spike.html`) ya no existe; sus resultados están
en [PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md).

Para depurar, cada marco de página lleva sus medidas en el DOM: `data-estado`
(`vacia`, `pintando`, `lista`, `error`), `data-ms-render`, `data-ms-oscuro` y
`data-ms-oscuro-principal` (lo que la transformación ocupó el hilo principal). El visor
(`data-testid="visor-pdf"`) dice cuántos lienzos viven (`data-lienzos`), cuánto ocupan
(`data-bytes-lienzos`) y dónde corre el modo oscuro (`data-transformador`: `worker` o
`hilo-principal`).

Los fixtures se regeneran con `node tests/fixtures/pdf/modo-oscuro/generar.mjs`
(`--grande` añade uno de 300 páginas, sin versionar) y
`node tests/fixtures/pdf/visor/generar.mjs` (enlaces, acentos, apaisada, girada,
protegido, sin texto y CJK).

## Scripts

| Script | Qué hace |
|---|---|
| `dev` | Vite en modo desarrollo (antes, `predev` copia los recursos de pdf.js) |
| `build` | Build estática en `dist/` (antes, `prebuild` copia los recursos de pdf.js) |
| `build:tamano` | Peso gzip de lo que se descarga al arrancar; falla por encima de 150 KB. Requiere `build` |
| `preview` | Sirve `dist/` con la CSP y las cabeceras de seguridad |
| `lint` · `lint:fix` · `format` | Biome |
| `typecheck` | `tsc --noEmit` |
| `test` · `test:run` · `test:coverage` | Vitest (unitarios, componentes, a11y) |
| `test:e2e` · `test:e2e:ui` | Playwright contra la build de producción (`vite preview`, puerto 3100) |
| `bench:pdf` | Benchmark del visor PDF: render y modo oscuro por página con y sin worker, a DPR 1 y 2 y a varios zooms, y un documento de 300 páginas (apertura, recorrido, lienzos, memoria). Imprime tablas; no es un test y no corre en CI |
| `bench:markdown` | Benchmark del visor Markdown: tiempo hasta ver documentos generados (1 KB, 100 KB, 1 MB, muchos encabezados, muchos bloques de código, muchas listas) un Markdown con 50 imágenes de 6 Mpx (URL creadas, decodificación, heap) y fórmulas y diagramas (pocos, muchos, documento grande, hostiles: tiempos hasta texto, fórmulas y diagramas, descargas y heap). Imprime tablas; no es un test y no corre en CI |
| `docs:validar` | Valida `public_docs/` contra el contrato y la identidad contra `project.ts` |
| `docs:enlaces` | Enlaces rotos en `docs/`, `README.md` y `CLAUDE.md` |
| `deps:overrides` | ¿Siguen haciendo falta los `overrides`? (hoy no hay ninguno) |

## Tests

```bash
npm run test:run      # todo Vitest
npm run test:e2e      # build de producción + Playwright (Chromium)
```

- Unitarios en `tests/unit/`, componentes y accesibilidad en `tests/components/`
  (pragma `// @vitest-environment jsdom`). Los proyectos ficticios para probar
  validadores están en `tests/_fixtures/`.
- **Documentos de prueba** en `tests/fixtures/`, cada uno con su procedencia en su
  `README.md`; los casos que no merecen un fichero en disco (PDF falso, vacío, UTF-16,
  nombres con `<`, comillas o emoji) se construyen en el propio test. El PDF mínimo se
  regenera con `node tests/fixtures/pdf/generar.mjs`; los del modo oscuro con
  `node tests/fixtures/pdf/modo-oscuro/generar.mjs`, y los del visor con
  `node tests/fixtures/pdf/visor/generar.mjs`. Un test comprueba que los versionados son
  exactamente lo que producen los generadores.
- **pdf.js en los tests de Node** (`tests/helpers/pdfjs.ts`: carga, apertura, texto,
  enlaces) usa la build `legacy`, la misma que el navegador (D18). El render, los píxeles,
  la capa de texto y la CSP, en Playwright.
- **Visor PDF**: los módulos puros (`tests/unit/pdf/`) sin DOM; los controladores con un
  documento de mentira que controla cuándo termina cada página; la interfaz
  (`tests/components/Visor.test.tsx`) con un controlador de mentira; y el visor real en
  `e2e/specs/visor-pdf.spec.ts`. El modo oscuro no compara capturas enteras: muestrea
  píxeles en el interior de superficies lisas de posición conocida (la geometría la exporta
  el generador del fixture).
- **Visor Markdown**: la política de URLs, los ids y el resaltado en `tests/unit/markdown/`
  (puros); la vista con jsdom y jest-axe en `tests/components/markdown/`, incluido el
  **corpus de XSS** (`xss.test.tsx`: un caso por fichero de `tests/fixtures/markdown/xss/`;
  un caso nuevo es un fichero nuevo, sin tocar el test); y el lector real, con la CSP y el
  portapapeles de Chromium, en `e2e/specs/markdown.spec.ts`. El corpus lo genera el
  script que se cita en `tests/fixtures/README.md`, porque lleva tabuladores y controles.
- `tests/helpers/documentos.ts`: ficheros de prueba y una **plataforma en memoria** que
  sustituye el selector del sistema por una cola de respuestas y usa la validación real.
  Los componentes que abren documentos se prueban con ella (`<App platform={…} />`).
- **Probar a mano la apertura:** `npm run build && npm run preview` y abre, arrastra o
  pulsa `Ctrl/Cmd+O`. Un PDF se abre en el visor PDF y un Markdown en el lector de
  Markdown. Para probar el lector, los fixtures de `tests/fixtures/markdown/`
  (`basico.md`, `gfm.md`, `codigo.md`, `indice.md`, `seguridad.md` y el corpus `xss/`).
  Para las imágenes locales, «Abrir carpeta» → `tests/fixtures/markdown/recursos/` (o
  elegir `documento.md` junto con `imagen.png`); `recursos-varios/` tiene dos `.md`. Se
  regeneran con `node tests/fixtures/markdown/recursos/generar.mjs`. Fórmulas y
  diagramas: `matematicas.md`, `diagramas.md`, `katex-hostil.md` y `mermaid-hostil.md`.
- **Mermaid solo se prueba de verdad en el navegador**: necesita medir texto en un
  documento vivo. En jsdom, el marco se simula (`formulas-diagramas.test.tsx`) y se prueban
  su protocolo y su ciclo de vida (`mermaid.test.ts`); el dibujo, el aislamiento y la CSP,
  en `e2e/specs/formulas-diagramas.spec.ts`. En `npm run dev` no hay CSP: lo que dependa
  de ella (marco, fuentes de KaTeX) se comprueba con `npm run preview`.
- Hay guardarraíles que no prueban una función sino una regla: contraste de los tokens
  (`tokens.test.ts`), invariantes de la CSP y prohibición de `innerHTML`
  (`seguridad.test.ts`), y textos centralizados (`textos.test.ts`).
- Los E2E vigilan en cada carga los errores de consola, las violaciones de CSP y
  cualquier petición fuera del propio origen (`e2e/vigilancia.ts`), con un test de
  control que comprueba que esa vigilancia funciona; también la consola de los workers.
  **No ve** una violación de CSP dentro de un worker (el navegador no la notifica al
  documento): lo que un worker necesita de la CSP se prueba por su efecto. Única tolerancia: el 404 de
  `/favicon.ico`, que pide Google Chrome (no el Chromium de CI) mientras no haya favicon
  (Fase 11).
- El selector de archivos se prueba con el evento `filechooser` de Playwright (el
  `<input type="file">` se crea al vuelo, fuera del DOM), y arrastrar y soltar con eventos
  sintéticos y un `DataTransfer` real del navegador.
- Playwright necesita Chromium: `npx playwright install chromium` la primera vez. Si ya
  hay un servidor en el puerto 3100, en local lo reutiliza; en CI siempre construye.
- **macOS 13 (o un sistema que Playwright ya no admita):** `playwright install` falla
  («does not support chromium on mac13»). Se puede usar el Google Chrome instalado con
  una configuración **local, sin versionar**, que herede la del repo y solo cambie el
  canal:

  ```ts
  // p. ej. fuera del repo: pw-chrome.config.ts
  import base from "<ruta al repo>/playwright.config.ts";
  const [chromium] = base.projects ?? [];
  export default {
    ...base,
    testDir: "<ruta al repo>/e2e/specs",
    projects: [{ ...chromium, use: { ...chromium?.use, channel: "chrome" } }],
    webServer: { ...base.webServer, cwd: "<ruta al repo>" },
  };
  ```

  y `npx playwright test -c <ruta>/pw-chrome.config.ts`. CI sigue usando el Chromium de
  Playwright.

## Ramas y CI

- **Ramas largas de desarrollo**: CI y E2E corren en `main`, en todo PR y en las ramas
  listadas en `on.push.branches` de [`ci.yml`](../.github/workflows/ci.yml) y
  [`e2e.yml`](../.github/workflows/e2e.yml). Por defecto, `develop` y `long/**`. Motivo:
  [ARCHITECTURE.md §8](ARCHITECTURE.md).
- `ci.yml`: lint → typecheck → tests → docs → build → tamaño del arranque.
- `security.yml`: `npm audit` (rompe con HIGH o superior) en cada PR, cada push a `main`
  y cada lunes.
- Commits: Conventional Commits en inglés técnico ([`CLAUDE.md`](../CLAUDE.md) §2).

## Problemas frecuentes

- **`engines` rechaza Node** o aparecen errores raros de sintaxis — no estás en Node 24:
  `nvm use` (en WSL, ver «Requisitos»).
- **Algo funciona en `dev` y falla en la build o en los E2E** — casi siempre es la CSP:
  mira la consola del navegador en `npm run preview`.
- **La build avisa de `MODULE_LEVEL_DIRECTIVE` ("use client")** en `lucide-react` — es
  inocuo: esa directiva solo significa algo con React Server Components, que una SPA no
  usa ([STACK.md](STACK.md)).
- **npm avisa de «install scripts not covered by allowScripts»** — procedimiento en
  [STACK.md](STACK.md) → `allowScripts`.
- **`docs:validar` dice que la identidad no coincide** — un fichero que repite datos de
  `src/config/project.ts` se quedó sin actualizar; el mensaje dice cuál.
