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

### Laboratorio del modo oscuro de PDF (temporal, Fase 4)

`/spike.html` (en `dev` o `preview`) abre cualquier PDF local y lo pinta con cada
estrategia: original, inversión completa, solo heurística y recoloreado selectivo. Permite
cambiar de página y de escala, marcar las regiones de imagen detectadas y medir. Sirve para
probar el modo oscuro con **tus** documentos reales; nada sale del navegador. Se borra en
la Fase 5 ([PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md)).

Los fixtures del spike se regeneran con `node tests/fixtures/pdf/modo-oscuro/generar.mjs`
(`--grande` añade uno de 300 páginas, sin versionar).

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
| `bench:pdf` | Benchmark del modo oscuro de PDF (render, transformación, memoria a escalas 1, 2 y 4). Imprime una tabla; no es un test y no corre en CI |
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
  regenera con `node tests/fixtures/pdf/generar.mjs`, y el del modo oscuro con
  `node tests/fixtures/pdf/modo-oscuro/generar.mjs`.
- **pdf.js en los tests de Node** (`tests/unit/pdf/engine.test.ts`) usa la build `legacy`:
  la moderna exige APIs que Node 24 no trae. El render y los píxeles, en Playwright.
- **E2E del modo oscuro** (`pdf-spike.spec.ts`): no compara capturas enteras; muestrea
  píxeles en el interior de superficies lisas de posición conocida (la geometría la exporta
  el generador del fixture).
- `tests/helpers/documentos.ts`: ficheros de prueba y una **plataforma en memoria** que
  sustituye el selector del sistema por una cola de respuestas y usa la validación real.
  Los componentes que abren documentos se prueban con ella (`<App platform={…} />`).
- **Probar a mano la apertura:** `npm run build && npm run preview` y abre, arrastra o
  pulsa `Ctrl/Cmd+O`. Lo que se ve hoy es la vista provisional (nombre, tipo y tamaño).
- Hay guardarraíles que no prueban una función sino una regla: contraste de los tokens
  (`tokens.test.ts`), invariantes de la CSP y prohibición de `innerHTML`
  (`seguridad.test.ts`), y textos centralizados (`textos.test.ts`).
- Los E2E vigilan en cada carga los errores de consola, las violaciones de CSP y
  cualquier petición fuera del propio origen (`e2e/vigilancia.ts`), con un test de
  control que comprueba que esa vigilancia funciona. Única tolerancia: el 404 de
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
