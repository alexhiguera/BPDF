# Stack tecnológico

Estado tras la Fase 13 (*2026-10-04*; la Fase 13 fijó `micromark` en 4.0.2 con un `override` y añadió `@axe-core/playwright` en desarrollo; la Fase 10 reinstaló `zod` para las preferencias guardadas; la Fase 9 añadió el editor, CodeMirror 6: `@codemirror/*` y `@lezer/highlight`; la Fase 8, `remark-math`, `katex` y `mermaid`): la Fase 4 añadió `pdfjs-dist` (el motor de PDF) y la
Fase 7 el pipeline de Markdown (`react-markdown`, `remark-gfm`) y el resaltado de código
(`lowlight`, `highlight.js`). El stack **objetivo** y el motivo de cada pieza están en
[PLAN.md](PLAN.md); cada fase añade aquí lo que instala. BPDF es solo web (D19,
*2026-10-03*): no hay ni habrá Electron.

## Capas

| Capa | Tecnología | Por qué |
|---|---|---|
| Build | **Vite 8** (Rolldown), SPA **estática** en `dist/` | D1 ([PLAN.md](PLAN.md) §3): sin servidor e `index.html` sin scripts en línea (CSP estricta). Sustituyó a Next.js 16 en la Fase 2. Desde la Fase 11, `define` fija la versión y la licencia de `package.json` en el código al compilar (`src/config/compilacion.ts`): nada se lee ni se evalúa en el navegador |
| UI | **React 19** + **Tailwind CSS 4** «CSS-first» (`@tailwindcss/vite`) + **lucide-react** | Tokens en `:root` como tripletes RGB: tema cambiable en runtime y modificadores de opacidad que siguen funcionando |
| Lenguaje | **TypeScript 7** estricto, con `noUncheckedIndexedAccess` | |
| Lint y formato | **Biome 2** | Un binario, sin ESLint ni Prettier |
| Tests | **Vitest 5** + Testing Library + **jest-axe** + jsdom | Unitarios, componentes y accesibilidad |
| E2E | **Playwright** (Chromium; Firefox y WebKit con `npm run test:e2e:compat` desde la Fase 13) | Contra el build de producción. Imprescindible para lo que depende del navegador real (canvas de PDF, CSP, portapapeles). Accesibilidad con `@axe-core/playwright` |
| CI | **GitHub Actions** | `ci.yml`, `e2e.yml`, `security.yml` |

Plataforma fijada con `engines` (`node >=24 <25`) y `.nvmrc` (`24`). Navegadores mínimos
en `build.target` de [`vite.config.ts`](../vite.config.ts) (Chrome/Edge 111, **Firefox 128**,
Safari 16.4): el **soporte oficial de Tailwind CSS 4**, que es la pieza más exigente y fija el
mínimo global (decisión del *2026-10-03*). pdf.js 6 por sí solo funcionaría desde Firefox 114
(abajo, `pdfjs-dist`), pero el mínimo de BPDF es el de todo el stack. Sin polyfills. El `browserslist` de la
plantilla se retiró en la Fase 2 porque ninguna herramienta del stack lo leía (Vite y
Tailwind 4 usan sus propios objetivos); una configuración que nadie lee acaba mintiendo.

### Decisiones de versión y de configuración

- **TypeScript 7** (el compilador nativo): Vite no lo usa para compilar (transforma con
  Oxc), solo `npm run typecheck`. Si una herramienta futura necesita la API JavaScript
  clásica del compilador y falla, la salida es fijar TypeScript 6.
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
| `remark-math` | Fase 8: la sintaxis de fórmulas (`$…$`, `$$…$$`) en el árbol de Markdown. **Versión exacta** (6.0.0). Solo sintaxis: no pinta nada ni importa KaTeX en el navegador (su dependencia `micromark-extension-math` trae un `katex` 0.16 para su salida HTML, que BPDF no usa ni empaqueta). Sin `rehype-katex`: parsea el HTML de KaTeX con `innerHTML` en el navegador |
| `katex` | Fase 8: pinta las fórmulas. **Versión exacta** (0.18.9; sin dependencias de runtime). Se carga a demanda con su hoja de estilos y sus fuentes, servidas desde el propio origen. BPDF pide su árbol (`__renderToDomTree`, API interna, estable dentro de la versión fijada) y crea los nodos con `toNode()`: nada de `innerHTML`. `trust: false`, `maxExpand`, `maxSize`, macros aisladas por fórmula ([ARCHITECTURE.md](ARCHITECTURE.md) §4 septies) |
| `mermaid` | Fase 8: los diagramas. **Versión exacta** (11.17.2, la última de la rama 11; la 12.0.0 era un major de tres semanas). **Nunca corre en la app**: solo en el marco aislado `mermaid.html` (iframe con `sandbox`), con `securityLevel: "strict"` y su propia CSP. Arrastra `d3`, `dagre-d3-es`, `cytoscape`, `elkjs`, `dompurify`, `marked`, `katex` 0.16 y más (122 paquetes nuevos con los anteriores; `npm audit` limpio). Se descarga por trozos, solo el tipo de diagrama que se dibuja |
| `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/language` | Fase 9 (D9): el editor de Markdown, CodeMirror 6. **Versiones exactas** (6.7.6, 6.43.13, 6.11.1, 6.12.4): trabaja con texto no confiable. Lo mínimo: estado y vista, historial y teclado (`commands`) y resaltado (`language`). **Sin** el paquete `codemirror` (su `basicSetup` trae autocompletado, lint y búsqueda). Se carga a demanda al entrar en «Edición» o «Dividido»; montado en un Shadow DOM por la CSP (abajo) |
| `@codemirror/lang-markdown` | Fase 9: la gramática de Markdown del editor (con GFM). **Versión exacta** (6.5.2). Se importan solo `markdownLanguage` y `markdownKeymap` (continuar listas y citas con Intro): así no entra en el trozo `lang-html` con CSS y JavaScript, que arrastra como dependencia para el HTML incrustado (comprobado en la build) |
| `@lezer/highlight` | Fase 9: las etiquetas de sintaxis (`tags`) del tema del editor. **Versión exacta** (1.2.5). Ya llegaba de rebote; es directa porque se importa |
| `zod` | Fase 10: valida lo que BPDF lee de `localStorage` (`bpdf:prefs`, `bpdf:positions`), que se trata como dato hostil: campo a campo, con su valor por defecto si no vale (`src/preferences/schema.ts`). **Versión exacta** (4.6.5; sin dependencias ni scripts de instalación). Con **`z.config({ jitless: true })`**: sin eso, zod prueba `new Function("")` y la CSP (sin `eval`) informa una violación aunque zod capture el error (medido en los E2E). Fuera del arranque: llega con el visor, el lector o el diálogo de preferencias (trozo a demanda, ~23 KB gzip). Su único consumidor es `src/preferences/schema.ts`, que fija `jitless` |
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
  navegador y tests de Node (Node 24 tampoco tiene esas APIs); el worker que
  copia `copiar-pdfjs.mjs` y el módulo que importa `engine.ts` son de la misma build.
  - **Compatibilidad real.** La `legacy` transpila el JavaScript, pero pdf.js 6 crea su
    worker como **módulo ES** (`type: "module"`): el visor necesita Chrome/Edge 80,
    Safari 15 y **Firefox 114**. Queda por debajo del mínimo global (Firefox 128, el de
    Tailwind 4; arriba), así que no lo condiciona. Hasta el *2026-10-03* `build.target`
    decía Firefox 111 y en 111–113 la app arrancaba pero un PDF no se abría.
  - **CSP.** Sus polyfills detectan `globalThis` con `Function("return this")`, pero esa
    rama no se ejecuta en ningún navegador objetivo (los E2E dan cero violaciones sin
    `'unsafe-eval'`).
  - **Peso.** `pdf-*.js` 488 KB (148 KB gzip) y el worker 1,3 MB, los dos cargados a
    demanda al abrir el primer PDF; no cuentan para `build:tamano`.
- **Recursos en tiempo de ejecución** (worker, fuentes estándar, cmaps y decodificadores
  en JavaScript): los copia `scripts/copiar-pdfjs.mjs` a `public/pdfjs/` en `predev` y
  `prebuild`, sin los `.wasm`, el motor de JavaScript de PDF (`quickjs-eval`) ni el sandbox.
  `public/pdfjs/` no se versiona.

### CodeMirror 6: qué trae y qué implica (Fase 9)

- **CSP sin cambios, gracias a un Shadow DOM.** CodeMirror inyecta sus estilos con
  `style-mod`: si la raíz del editor es el `document` (que tiene `<head>`), con una etiqueta
  `<style>`, que `style-src 'self'` bloquea. En una raíz sin `<head>` (un `ShadowRoot`),
  con hojas construibles (`adoptedStyleSheets`), que no son estilos en línea y la CSP no
  bloquea. Los atributos `style` los pone por CSSOM (`style.cssText`), que tampoco. BPDF
  monta el editor en un Shadow DOM propio: ni `'unsafe-inline'` ni nonce (una CSP estática
  no puede generar nonces, y uno fijo equivaldría a `'unsafe-inline'`). Comprobado en
  Chromium (`e2e/specs/editor.spec.ts`: cabecera idéntica, cero violaciones, hojas
  construibles en el Shadow DOM y ninguna `<style>` en el documento).
- **Peso.** Un trozo propio, `EditorMarkdown-*.js`: **98 KB gzip** (312 KB sin comprimir),
  solo al entrar en «Edición» o «Dividido». El arranque no lo incluye.
- **Transitivas.** 21 paquetes nuevos (`@codemirror/*`, `@lezer/*`, `style-mod`, `crelt`,
  `w3c-keyname`, `@marijn/find-cluster-break`); `lang-markdown` instala también
  `lang-html`, `lang-css`, `lang-javascript` y `autocomplete`, que no llegan a la build.
  Todos MIT, sin scripts de instalación; `npm audit` limpio.

### `katex` y `mermaid`: qué traen y qué implican (Fase 8)

- **Vite y `data:`.** Vite incrusta como `data:` los recursos de menos de 4 KB; algunas
  fuentes de KaTeX lo son y la CSP (`font-src 'self'`) las bloqueaba. `build.assetsInlineLimit: 0`
  en `vite.config.ts`: nada se incrusta, todo es fichero del propio origen.
- **Dos páginas en la build**: `index.html` y `mermaid.html` (el marco). Esta última lleva
  su propia CSP (`CSP_MARCO_MERMAID`) y sus módulos se piden desde un origen opaco, en
  modo CORS: `/assets/` se sirve con `Access-Control-Allow-Origin: *` (ficheros públicos
  de la build, sin credenciales). El hosting actual (Vercel) ya lo manda.
- **Estilos de KaTeX por atributo**: dos construcciones (`\vec`, `\oiint`, y `\pmb` en
  MathML) ponen `style` con `setAttribute`, que la CSP bloquea; BPDF lo quita del árbol
  antes de crear los nodos y lo suple con CSS.
- **Versiones**: revisar avisos de seguridad de las dos (y de `dompurify`, que usa Mermaid)
  como con pdf.js; una subida de Mermaid se prueba con `mermaid-hostil.md` y
  `e2e/specs/formulas-diagramas.spec.ts` antes de aceptarla.

### `react-markdown` y su cadena: qué trae y qué implica

- **CSP.** Ninguna directiva nueva: no usa `eval`, WASM, estilos en línea (la alineación
  de celdas va por CSSOM) ni recursos remotos. Los E2E dan cero violaciones.
- **Rendimiento ([ARCHITECTURE.md](ARCHITECTURE.md) §4 quinquies y §4 undecies).** El
  parser es lineal. En la Fase 7 se midió que **muchas listas cortas eran cuadráticas** y se
  atribuyó a `mdast-util-from-markdown`; la Fase 13 lo perfiló: era una **regresión de
  micromark 4.0.3** (abajo, `overrides`).
- **Versiones exactas** en las cuatro directas; las transitivas las fija el lockfile y las
  vigila `npm audit`.

Todo lo demás es de desarrollo: `vite` y `@tailwindcss/vite` (build), `tailwindcss`,
Biome, TypeScript, Vitest y Testing Library, jest-axe, jsdom, Playwright, `@axe-core/playwright`
(Fase 13: axe en las pantallas completas, contra la build real; trae `axe-core`, sin scripts
de instalación) y `yaml` (lo usa el validador de `public_docs/`).

**Retiradas en la Fase 1:** `@supabase/ssr`, `@supabase/supabase-js`, `@sentry/nextjs`,
`@vercel/speed-insights` y `zod` (runtime); `prisma`, `supabase`, `pg`, `@types/pg`
(desarrollo). `zod` se quedó sin uso al borrar la auth y las variables de entorno; volvió
en la Fase 10, con lo primero que valida: las preferencias guardadas.

**Reinstalada en la Fase 10:** `zod` 4.6.5 (runtime, versión exacta; `npm audit` limpio, sin scripts de instalación que aprobar). La 4.6.5 llevaba tres semanas publicada.

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

**Añadidas en la Fase 8** (runtime, versiones exactas): `remark-math` 6.0.0, `katex` 0.18.9 y
`mermaid` 11.17.2. Sin scripts de instalación y con `npm audit` limpio. Todo a demanda: el
arranque no cambia de forma apreciable (89,2 → 89,6 KB gzip: textos y el `preload-helper`
que Vite separa ahora); el lector de Markdown crece 71 → 75 KB (`remark-math` y los
componentes); KaTeX son 77 KB de JavaScript y 4 KB de CSS, y cada fórmula nueva pide solo las
fuentes woff2 que usa; Mermaid, ~50 KB de entrada más ~870 KB en un centenar de trozos, de
los que se piden solo los del tipo de diagrama. Un Markdown sin fórmulas ni diagramas no
descarga nada de esto (E2E).

**Añadidas en la Fase 9** (runtime, versiones exactas): `@codemirror/state` 6.7.6,
`@codemirror/view` 6.43.13, `@codemirror/commands` 6.11.1, `@codemirror/language` 6.12.4,
`@codemirror/lang-markdown` 6.5.2 y `@lezer/highlight` 1.2.5 (D9: CodeMirror 6). Descartados:
el paquete `codemirror` (su configuración básica trae autocompletado, lint y búsqueda, que no
hacen falta), `@codemirror/language-data` (gramáticas de todos los lenguajes para los bloques
de código: peso sin uso en un editor de Markdown) y un `<textarea>` (con 1 MB no mantiene la
fluidez, no resalta ni tiene historial propio).

Evaluadas y descartadas:

- `rehype-katex`: convierte la cadena HTML de KaTeX en árbol con
  `hast-util-from-html-isomorphic`, que en el navegador usa `innerHTML` (en un
  `<template>`); además fija `katex ^0.16`.
- KaTeX solo en MathML (`output: "mathml"`): menos superficie y sin fuentes, pero la
  calidad depende de las fuentes matemáticas del sistema (en Linux, a menudo ninguna).
- Mermaid en la página (`securityLevel: "strict"` sin iframe): dibuja con `<style>` y
  atributos `style` en línea; con la CSP de BPDF, 250 violaciones en un documento de cinco
  diagramas (medido). Relajar `style-src` en toda la app no se contempla.
- `securityLevel: "sandbox"` de Mermaid: su iframe es `data:`, que la CSP no admite, y
  además pinta cada diagrama en un iframe dentro del documento.
- Un segundo KaTeX para deduplicar con el de Mermaid (0.16): el nuestro es más reciente y el
  de Mermaid solo se cargaría, dentro del marco, si una etiqueta usa `$$…$$`.

**Fase 7 bis: ninguna dependencia nueva.** Varios ficheros, carpetas y arrastre de
carpetas usan solo APIs estándar del navegador: `<input multiple>`, `<input webkitdirectory>`
y File and Directory Entries (`webkitGetAsEntry`, `FileSystemDirectoryReader`), presentes
en Chrome, Edge, Firefox y Safari desde antes de los mínimos de `build.target`. Las
imágenes, con `URL.createObjectURL`. Ninguna librería de exploración de ficheros ni de
saneado de SVG. Los fixtures JPEG y WebP los codifica el Chromium de Playwright (ya en
desarrollo).

**Fase 5: ninguna dependencia nueva.** El visor (virtualización, zoom, búsqueda,
miniaturas, enlaces, worker del modo oscuro) es código propio sobre pdf.js y React: sin
librería de virtualización, de estado ni de atajos.

**Política** ([`CLAUDE.md`](../CLAUDE.md) §11 bis): ninguna dependencia «para más
adelante»; versiones exactas para los motores que procesan contenido no confiable; toda
librería pesada se carga de forma diferida.

### `overrides`

**Uno: `"micromark": "4.0.2"`** (Fase 13, *2026-10-04*). micromark 4.0.3 (publicada el
*2026-09-26*, entró en el lockfile con la Fase 7) añadió `micromark-util-edit-map`, cuyo
`EditMap.consume` reconstruye la lista entera de eventos en cada uso: una vez por elemento de
lista, cita o encabezado setext. Resultado: tiempo **cuadrático** con muchos de ellos (perfil:
el 63 % del tiempo ahí). Es el issue upstream **micromark#246** (abierto). Con 4.0.2, lineal:

| Caso (Node, cadena de BPDF) | micromark 4.0.3 | 4.0.2 |
|---|---|---|
| 400 KB de listas cortas | 25 s | 2,6 s |
| 181 KB del caso mínimo (`- n` + párrafo) | 52 s | 2,5 s |
| En el navegador, 200 KB de listas | (F7: 2,3–2,8 s, ×3 al duplicar) | 1,45 s, lineal |

4.0.3 no traía arreglos de seguridad: un arreglo menor de énfasis («attention flanking») y
esta optimización. Probado también: las últimas publicadas (`mdast-util-from-markdown` 2.1.0)
siguen siendo cuadráticas, y fijar `micromark-core-commonmark` 2.0.3 no cambia nada.
`micromark` queda anidado bajo `mdast-util-from-markdown` (su único consumidor). **Se quita**
cuando micromark publique el arreglo (TAREAS); `npm run deps:overrides` solo comprueba avisos
de seguridad, así que esto se revisa a mano.

Los dos que traía la plantilla (`mysql2`, `deepmerge-ts`) eran transitivas de Prisma con
avisos HIGH; al retirar Prisma, `npm run deps:overrides` confirmó que ya no evitaban ningún
aviso y dejaron de estar en el árbol.

Si hiciera falta uno: motivo escrito aquí, y `npm run deps:overrides` comprueba si sigue
haciendo falta (quitándolos en un temporal y repitiendo `npm audit`). CI lo ejecuta en
`security.yml` sin romper: un override de más es deuda, no un fallo.

### `allowScripts` (npm 11)

Hoy **ningún paquete** necesita scripts de instalación (`npm install-scripts ls` no lista
nada) y `package.json` no tiene campo `allowScripts`. Los tres aprobados en la plantilla
(Prisma ×2, Sentry CLI) se fueron con sus paquetes.

**El comando (comprobado con npm 11.19.0, Fase 12):** `npm install-scripts` es el completo
(`ls`, `approve`, `deny`, `prune`); `npm approve-scripts` también existe, pero solo
aprueba. Se usa el primero.

**`fsevents@2.3.3`** (dependencia opcional de Vite, solo macOS) **no necesita denegación**.
npm 11.17 lo listaba como pendiente por el `hasInstallScript` del lockfile, pero con npm
11.19 `npm ci` no avisa: npm ignora las opcionales que no aplican a la plataforma
(npm/cli#9562), y en macOS solo cuenta `preinstall`, `install`, `postinstall` o un
`binding.gyp` presente, y el paquete publicado no trae ninguno (solo `fsevents.js` y su
binario ya compilado; leído en el tarball y en el código de npm). Una entrada en
`allowScripts` no cambiaría nada y `npm install-scripts deny` ni se puede aplicar en
Linux (el paquete no se instala).

npm 11 **omite en silencio** los scripts de instalación de paquetes no aprobados en el
campo `allowScripts` de `package.json`, y cada aprobación va ligada a una **versión
exacta**.

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
