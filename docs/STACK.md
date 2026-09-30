# Stack tecnológico

Estado tras la Fase 7 (*2026-09-30*): la Fase 4 añadió `pdfjs-dist` (el motor de PDF) y la
Fase 7 el pipeline de Markdown (`react-markdown`, `remark-gfm`) y el resaltado de código
(`lowlight`, `highlight.js`). El stack **objetivo** (pipeline de Markdown, Electron) y el motivo
de cada pieza están en [PLAN.md](PLAN.md); cada fase añade aquí lo que instala.

## Capas

| Capa | Tecnología | Por qué |
|---|---|---|
| Build | **Vite 8** (Rolldown), SPA **estática** en `dist/` | D1 ([PLAN.md](PLAN.md) §3): sin servidor, `index.html` sin scripts en línea (CSP estricta) y encaje directo con Electron. Sustituyó a Next.js 16 en la Fase 2 |
| UI | **React 19** + **Tailwind CSS 4** «CSS-first» (`@tailwindcss/vite`) + **lucide-react** | Tokens en `:root` como tripletes RGB: tema cambiable en runtime y modificadores de opacidad que siguen funcionando |
| Lenguaje | **TypeScript 7** estricto, con `noUncheckedIndexedAccess` | |
| Lint y formato | **Biome 2** | Un binario, sin ESLint ni Prettier |
| Tests | **Vitest 5** + Testing Library + **jest-axe** + jsdom | Unitarios, componentes y accesibilidad |
| E2E | **Playwright** (Chromium) | Contra el build de producción. Imprescindible para lo que depende del navegador real (canvas de PDF, CSP, portapapeles) |
| CI | **GitHub Actions** | `ci.yml`, `e2e.yml`, `security.yml` |

Plataforma fijada con `engines` (`node >=24 <25`) y `.nvmrc` (`24`). Navegadores mínimos
en `build.target` de [`vite.config.ts`](../vite.config.ts) (Chrome/Edge 111, Firefox 111,
Safari 16.4): los que exige Tailwind 4 (`color-mix`, `@property`). El `browserslist` de la
plantilla se retiró en la Fase 2 porque ninguna herramienta del stack lo leía (Vite y
Tailwind 4 usan sus propios objetivos); una configuración que nadie lee acaba mintiendo.

### Decisiones de versión y de configuración

- **TypeScript 7** (el compilador nativo): Vite no lo usa para compilar (transforma con
  Oxc), solo `npm run typecheck`. Si una herramienta futura (Electron) necesita la API
  JavaScript clásica del compilador y falla, la salida es fijar TypeScript 6.
- **Sin `@vitejs/plugin-react` (T-2, resuelta en la Fase 2).** Vite transforma el JSX por
  su cuenta con el runtime automático (`"jsx": "react-jsx"`). El plugin solo aportaría
  Fast Refresh (conservar el estado al editar), a cambio de una dependencia y de un
  preámbulo en línea en desarrollo. Sin él, la página se recarga entera al guardar.
- **`appType: "mpa"`**: sin fallback de SPA, una ruta desconocida da 404 en `dev` y en
  `preview`, igual que en un hosting estático.
- **Aviso conocido en la build:** Rolldown avisa `MODULE_LEVEL_DIRECTIVE` por el
  `"use client"` de dos ficheros de `lucide-react`. Es inocuo (esa directiva solo tiene
  sentido con React Server Components) y **no se silencia**: si aparece otro aviso, se ve.
- **Un solo `tsconfig.json`.** El `tsconfig.typecheck.json` de la plantilla existía para
  excluir los tipos que genera Next en `.next/types`; sin Next, sobra.
  `allowImportingTsExtensions` permite importar `.ts` con extensión desde
  `vite.config.ts`, como exigirá el cargador nativo de configuración de Vite.

## Dependencias de la app

La lista la manda `dependencies` de `package.json`; aquí va el motivo de cada una.
`tests/unit/docs.test.ts` falla si aparece una dependencia de runtime que esta tabla no
explica, para que el documento no se quede atrás.

| Dependencia | Para qué |
|---|---|
| `react`, `react-dom` | La interfaz |
| `lucide-react` | Iconos (el indicador de carga de `Button` y los botones del visor PDF, siempre con nombre accesible) |
| `clsx`, `tailwind-merge` | La función `cn()` para combinar clases |
| `react-markdown` | El renderer de Markdown (Fase 7). **Versión exacta** (10.1.0). Produce elementos React, no HTML: sin `innerHTML`. Sin `rehype-raw` (D6): el HTML crudo no se interpreta. Trae la cadena `unified`/`remark-parse`/`micromark`/`remark-rehype` ([PLAN.md](PLAN.md) §7.1) |
| `remark-gfm` | GitHub Flavored Markdown: tablas, listas de tareas, tachado, autoenlaces y notas al pie. **Versión exacta** (4.0.1) |
| `lowlight` | Resaltado de sintaxis de los bloques de código: highlight.js con salida en árbol (hast) en lugar de una cadena HTML, que se convierte a React con lista blanca (`src/markdown/resaltado.ts`). **Versión exacta** (3.3.0). Se usa directamente, **sin `rehype-highlight`**: ese plugin importa el paquete `common` (~37 gramáticas) aunque se le pasen otras y dificulta copiar el texto original |
| `highlight.js` | Las gramáticas de los lenguajes que se resaltan (9: JavaScript/JSX, TypeScript/TSX, JSON, HTML/XML, CSS, Bash, Python, Markdown, SQL), importadas una a una. **Versión exacta** (11.11.1, no la 11.12: `lowlight` 3.3.0 pide `~11.11.0` y así hay una sola copia). Dependencia directa porque se importan sus gramáticas |
| `pdfjs-dist` | El motor de PDF (pdf.js de Mozilla). **Versión exacta** (6.3.289): procesa contenido no confiable. Build **`legacy`** (D18). Se carga a demanda, con `useWasm: false` y sus recursos servidos desde el propio origen ([PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md) §3). El visor usa solo sus APIs núcleo y `TextLayer` (D17, [ARCHITECTURE.md](ARCHITECTURE.md) §4 quater) |

### `pdfjs-dist`: qué trae y qué implica

- **Dependencia opcional `@napi-rs/canvas`** (binario nativo, 34 MiB, sin scripts de
  instalación). pdf.js la usa solo en Node para pintar; BPDF no pinta en Node, así que
  **no entra en el bundle**. Se instala en desarrollo porque npm instala las opcionales
  por defecto (y no se pueden omitir una a una sin omitir también los binarios de
  Rolldown). Pasa por `npm audit` como el resto.
- **Build `legacy` (D18, confirmada en la Fase 5).** La moderna exige APIs de
  JavaScript de 2025–2026 (`Map.prototype.getOrInsertComputed`, `Math.sumPrecise`,
  `Uint8Array.prototype.toHex`…) que **no están en los navegadores mínimos de
  `build.target`**. La `legacy` (`pdfjs-dist/legacy/build/pdf.mjs` y su worker
  `legacy/build/pdf.worker.min.mjs`) las trae con polyfills. Una sola build para todo:
  navegador, tests de Node (Node 24 tampoco tiene esas APIs) y Electron; el worker que
  copia `copiar-pdfjs.mjs` y el módulo que importa `engine.ts` son de la misma build.
  - **Compatibilidad real.** La `legacy` transpila el JavaScript, pero pdf.js 6 crea su
    worker como **módulo ES** (`type: "module"`): el visor necesita Chrome/Edge 80,
    Safari 15 y **Firefox 114**. Como `build.target` dice Firefox 111 (lo que exige
    Tailwind 4), en Firefox 111–113 la app arranca pero un PDF no se abre (aviso de PDF
    ilegible). Pendiente de decidir si se sube el mínimo (TAREAS).
  - **CSP.** Sus polyfills detectan `globalThis` con `Function("return this")`, pero esa
    rama no se ejecuta en ningún navegador objetivo (los E2E dan cero violaciones sin
    `'unsafe-eval'`).
  - **Peso.** `pdf-*.js` 488 KB (148 KB gzip) y el worker 1,3 MB, los dos cargados a
    demanda al abrir el primer PDF; no cuentan para `build:tamano`.
  - **Electron.** Su Chromium podría usar la moderna, pero se usa la misma build: sin
    bifurcación ([ELECTRON.md](ELECTRON.md) §3.1).
- **Recursos en tiempo de ejecución** (worker, fuentes estándar, cmaps y decodificadores
  en JavaScript): los copia `scripts/copiar-pdfjs.mjs` a `public/pdfjs/` en `predev` y
  `prebuild`, sin los `.wasm`, el motor de JavaScript de PDF (`quickjs-eval`) ni el sandbox.
  `public/pdfjs/` no se versiona.

### `react-markdown` y su cadena: qué trae y qué implica

- **CSP.** Ninguna directiva nueva: no usa `eval`, WASM, estilos en línea (la alineación
  de celdas va por CSSOM) ni recursos remotos. Los E2E dan cero violaciones.
- **Rendimiento (medido en la Fase 7, [ARCHITECTURE.md](ARCHITECTURE.md) §4 quinquies).**
  El parser es lineal salvo en un caso: **muchas listas cortas son cuadráticas** en
  `mdast-util-from-markdown` 2.0.3 (la última publicada): `prepareList` inserta cada
  elemento con `Array#splice` en el array de eventos del documento entero. 200 KB de listas
  cortas tardan ~2,5 s y el tiempo se multiplica por ~3 al duplicar el tamaño. Pendiente en
  TAREAS; no se parchea la dependencia.
- **Versiones exactas** en las cuatro directas; las transitivas las fija el lockfile y las
  vigila `npm audit`.

Todo lo demás es de desarrollo: `vite` y `@tailwindcss/vite` (build), `tailwindcss`,
Biome, TypeScript, Vitest y Testing Library, jest-axe, jsdom, Playwright, y `yaml` (lo usa
el validador de `public_docs/`).

**Retiradas en la Fase 1:** `@supabase/ssr`, `@supabase/supabase-js`, `@sentry/nextjs`,
`@vercel/speed-insights` y `zod` (runtime); `prisma`, `supabase`, `pg`, `@types/pg`
(desarrollo). `zod` se quedó sin uso al borrar la auth y las variables de entorno; vuelve
cuando haya algo que validar: las preferencias guardadas (Fase 10) y los argumentos IPC
de Electron (Fase 14).

**Retiradas en la Fase 2:** `next` (runtime) y `@tailwindcss/postcss` (desarrollo,
sustituido por `@tailwindcss/vite`).

**Añadida en la Fase 4:** `pdfjs-dist` 6.3.289 (runtime). Ninguna librería de procesado de
imagen: la transformación del modo oscuro usa solo Canvas y funciones propias.

**Añadidas en la Fase 7** (runtime, versiones exactas): `react-markdown` 10.1.0,
`remark-gfm` 4.0.1, `lowlight` 3.3.0 y `highlight.js` 11.11.1; en desarrollo, `@types/hast`
y `@types/mdast` (el código importa esos tipos; antes llegaban de rebote). Traen 101
paquetes transitivos (la cadena `unified`/`micromark`), sin scripts de instalación y con
`npm audit` limpio. Todo va en el trozo del visor Markdown, que se carga al abrir el primer
Markdown: **70 KB gzip** (228 KB sin comprimir) y 1,5 KB de CSS; el arranque no cambia (86,4 KB
gzip, +0,9 KB de textos). Evaluadas y descartadas: `rehype-highlight` (arriba), `shiki`
(motor de expresiones regulares en WASM, exigiría `'wasm-unsafe-eval'` en la CSP, y mucho
más peso), un resaltador propio (peor calidad y más código que mantener para procesar
contenido hostil) y `github-slugger` (16 KB para 20 líneas: los ids de encabezado son
propios, `src/markdown/toc.ts`).

**Fase 5: ninguna dependencia nueva.** El visor (virtualización, zoom, búsqueda,
miniaturas, enlaces, worker del modo oscuro) es código propio sobre pdf.js y React: sin
librería de virtualización, de estado ni de atajos.

**Política** ([`CLAUDE.md`](../CLAUDE.md) §11 bis): ninguna dependencia «para más
adelante»; versiones exactas para los motores que procesan contenido no confiable; toda
librería pesada se carga de forma diferida.

### `overrides`

Ninguno. Los dos que traía la plantilla (`mysql2`, `deepmerge-ts`) eran transitivas de
Prisma con avisos HIGH; al retirar Prisma, `npm run deps:overrides` confirmó que ya no
evitaban ningún aviso y dejaron de estar en el árbol.

Si hiciera falta uno: motivo escrito aquí, y `npm run deps:overrides` comprueba si sigue
haciendo falta (quitándolos en un temporal y repitiendo `npm audit`). CI lo ejecuta en
`security.yml` sin romper: un override de más es deuda, no un fallo.

### `allowScripts` (npm 11)

Hoy **ningún paquete** necesita scripts de instalación (`npm install-scripts ls` no lista
nada). Los tres aprobados en la plantilla (Prisma ×2, Sentry CLI) se fueron con sus
paquetes.

npm 11 **omite en silencio** los scripts de instalación de paquetes no aprobados en el
campo `allowScripts` de `package.json`, y cada aprobación va ligada a una **versión
exacta**. Electron (Fase 14) descarga su binario en `postinstall` y lo necesitará.

**Procedimiento al añadir o actualizar un paquete con scripts de instalación:**

```bash
npm install <paquete>@<versión>
npm install-scripts ls                 # lista lo que ha quedado sin aprobar
#   revisa el script del paquete (node_modules/<paquete>/package.json → scripts)
npm install-scripts approve <paquete>  # o `deny` si no hace falta
npm install-scripts prune              # quita aprobaciones de versiones que ya no están
```

`package.json` y `package-lock.json` se commitean juntos.

## Observabilidad

**Ninguna, a propósito.** BPDF no envía errores, métricas ni eventos a ningún servicio
([ARCHITECTURE.md](ARCHITECTURE.md) §1). Un fallo en el equipo de alguien solo se conoce si
esa persona lo reporta; el precio se acepta a cambio del principio de privacidad.
