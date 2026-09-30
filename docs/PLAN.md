# BPDF — Diseño objetivo

> **Estado:** escrito en la Fase 0 (*2026-09-29*); D1–D4 y D15 confirmadas y Fase 1
> cerrada el mismo día. D16 confirmada y §4.2 y §5 implementados en la Fase 3
> (*2026-09-29*). Este documento describe **cómo será** BPDF. Cómo es hoy:
> `ARCHITECTURE.md`, `STACK.md` y `STRUCTURE.md`.
>
> Documentos hermanos: [SEGURIDAD.md](SEGURIDAD.md) (modelo de amenazas y controles),
> [ELECTRON.md](ELECTRON.md) (versión de escritorio) y [FASES.md](FASES.md) (plan de
> implementación). El estado de cada fase está en
> [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md).

Las decisiones marcadas **D-n** necesitan confirmación del usuario (CLAUDE.md §1) y están
reunidas en [§14](#14-decisiones). Las marcadas **T-n** son decisiones técnicas que resuelve
una fase concreta con evidencia (spike o medición).

---

## 1. Qué es BPDF

Visor gratuito y open source de **PDF** y **Markdown** para leer cómodamente en modo
oscuro. Web primero; después escritorio con Electron.

**Principio rector: los documentos del usuario no salen del dispositivo.** No hay
backend, API, base de datos, cuentas, sincronización, telemetría ni subida de ficheros.
Todo se procesa en el navegador (o en el proceso de Electron) del usuario.

**Prioridades**, en este orden: legibilidad · simplicidad · consistencia · accesibilidad ·
rendimiento. Ante dos soluciones válidas: menos código, menos dependencias, menos
superficie de ataque, menos mantenimiento y mejor encaje con Electron.

## 2. Auditoría de la plantilla

Repositorio auditado el 2026-09-29: un único commit (`Initial commit`), R3ZON SaaS
Template **v1.0.0** (lo registraba `r3zon-template.json`, retirado antes de publicar el
repositorio; ver [TEMPLATE.md](TEMPLATE.md)), 118 ficheros versionados, sin `LICENSE`.

### 2.1 Qué trae

| Área | Contenido | Ficheros |
|---|---|---|
| Framework | Next.js 16 App Router, `proxy.ts`, Server Actions, route handlers | `src/app/`, `src/proxy.ts`, `next.config.ts` |
| Identidad | Punto único de nombre, slug, dominio, idioma | `src/config/project.ts` |
| Auth | Login email+contraseña, callback, logout, gate de rutas | `src/app/(auth)/`, `src/app/auth/`, `src/app/(app)/`, `src/lib/supabase/`, `src/lib/public-paths.ts`, `src/lib/safe-redirect.ts` |
| Base de datos | Supabase local, 1 migración (`profiles`), Prisma solo CLI | `supabase/`, `prisma/`, `prisma.config.ts`, `src/lib/database.types.ts` |
| Observabilidad | Sentry (apagado sin DSN), Speed Insights, logger JSON, `/api/health` | `src/instrumentation*.ts`, `src/lib/observability/`, `src/lib/logger.ts`, `src/app/api/health/` |
| UI | Tailwind 4 CSS-first con tokens RGB en `:root`; `Button`, `Field`, `Input` accesibles; `cn()` | `src/app/globals.css`, `src/components/ui/`, `src/lib/utils.ts` |
| Tests | Vitest 5 (unit, componentes con jsdom, jest-axe, BD real), Playwright contra build de producción | `tests/`, `e2e/`, `vitest.config.ts`, `playwright.config.ts` |
| Calidad | Biome 2, TypeScript 7 estricto con `noUncheckedIndexedAccess`, `tsconfig.typecheck.json` | `biome.json`, `tsconfig*.json` |
| CI | `ci.yml` (lint → typecheck → Supabase → drift → tests → docs → build), `e2e.yml`, `security.yml` (`npm audit` + overrides) | `.github/workflows/` |
| Scripts | Supabase/Prisma/seeds; validador de `public_docs/`; enlaces de docs; vigencia de overrides | `scripts/` |
| Docs | `docs/` completo con proceso (bitácora, tareas), `public_docs/` para el Docusaurus de R3ZON, `modules/` (catálogo, ninguno implementado) | `docs/`, `public_docs/`, `modules/` |
| Agentes | `CLAUDE.md` con reglas; `.claude/settings.json` (confirmación de commit/push, bloqueo de `.env`) | |
| Despliegue | Vercel `fra1` | `vercel.json` |

Entorno de la máquina en la auditoría: sin `node_modules`, Node 18 por defecto dentro de
WSL (el proyecto exige Node 24 con `nvm use`). La línea base se tomó al empezar la Fase 1
con Node 24.21: lint, typecheck y build en verde; 78 tests en verde y 18 de base de datos
saltados (sin Supabase levantado); `npm audit` sin vulnerabilidades.

Esta sección y la siguiente describen **la plantilla de partida** y lo que se decidió
hacer con ella; la Fase 1 lo ejecutó (bitácora, iteración 3).

### 2.2 Qué se conserva, qué se adapta y qué se elimina

| Pieza | Decisión | Motivo |
|---|---|---|
| TypeScript 7 estricto | **Conservar** | Sin coste. `tsconfig.typecheck.json` se retiró en la Fase 2: solo existía para excluir `.next/types` |
| Biome 2 (`biome.json`) | **Conservar** | Lint y formato en un binario |
| Tailwind 4 + tokens RGB en `:root` | **Conservar y adaptar** | El patrón de tokens es justo lo que pide el diseño; se sustituye la paleta ([§9](#9-uiux-y-sistema-de-diseño)) |
| `Button`, `Field`, `Input`, `cn()` | **Conservar** | Accesibles y probados con jest-axe |
| `lucide-react`, `clsx`, `tailwind-merge` | **Conservar** | Iconos; `cn()` |
| `zod` | **Retirado en la Fase 1** | Al borrar la auth y `env.ts` se quedó sin uso, y no se guardan dependencias «para más adelante». Vuelve con lo primero que valide: preferencias guardadas (Fase 10) o argumentos IPC de Electron (Fase 14) |
| `vercel.json` | **Eliminar** (Fase 1) | Solo fijaba la región de las funciones de servidor; el hosting depende de D5 |
| Vitest + Testing Library + jest-axe + jsdom | **Conservar** | Base de tests de lógica y componentes |
| Playwright | **Conservar y adaptar** | Único sitio donde se prueba el render real (canvas) y, después, Electron (`_electron`) |
| `src/config/project.ts` | **Conservar y adaptar** | Identidad de BPDF; se retira `homePath` (no hay zona con sesión) |
| `security.yml` + `scripts/verificar-overrides.mjs` | **Conservar** | Auditoría de dependencias semanal |
| `ci.yml` / `e2e.yml` | **Adaptar** | Sin pasos de Supabase ni Prisma |
| `docs/` (proceso, bitácora, tareas), `CLAUDE.md` | **Conservar y reescribir** | El proceso vale; el contenido de BD/auth sobra |
| `scripts/verificar-enlaces-docs.mjs` | **Conservar** | Enlaces rotos en docs |
| `public_docs/` + validador + `scripts/lib/identidad.mjs` | **Depende de D4** | Solo tiene sentido si BPDF se publica en el Docusaurus de R3ZON |
| Supabase, `@supabase/*`, `supabase/`, migraciones, `tests/db/` | **Eliminar** | Sin base de datos ni auth |
| Prisma (`prisma/`, `prisma.config.ts`, scripts, overrides `mysql2`/`deepmerge-ts`, `allowScripts` de Prisma) | **Eliminar** | Idem |
| Login, callback, logout, `(app)/`, `proxy.ts`, `public-paths.ts`, `safe-redirect.ts`, `env.ts` | **Eliminar** | Sin sesión ni rutas protegidas ni redirecciones externas |
| Sentry, Speed Insights, logger JSON, `/api/health` | **Eliminar** | Son telemetría o servidor: contradicen el principio de privacidad y el «sin backend» |
| `robots.ts`, `sitemap.ts` | **Sustituidos** (Fase 2) | Se generan en la build desde `src/config/public-site.ts`, con el dominio de `project.ts` |
| `.env.example` | **Eliminar** | BPDF no necesita variables de entorno |
| `modules/` | **Eliminar** (o dejar una línea en MODULES.md) | Ningún módulo del catálogo aplica; `desktop-electron` recomendaba «URL remota», que BPDF descarta ([ELECTRON.md](ELECTRON.md)) |
| `r3zon-template.json` | **Conservar como registro de origen** (D15). *Retirado después, antes de publicar el repositorio: el origen queda escrito en [TEMPLATE.md](TEMPLATE.md)* | BPDF se separa del core SaaS; no adoptará versiones nuevas del core |
| `docs/auditoria-template-final.md` | **Eliminar** | Lo exige `tests/unit/project.test.ts` en un proyecto derivado |
| Next.js 16 | **Sustituido por Vite + React en la Fase 2** (D1) | Ver §3 |

## 3. Framework: Vite + React en lugar de Next.js (D1)

BPDF es una SPA 100 % cliente: no usa nada de lo que justifica Next (RSC con datos,
Server Actions, route handlers, `proxy.ts`, ISR, SEO por página). Las dos opciones reales:

| Criterio | **Vite + React (SPA)** — recomendado | Next.js 16 con `output: "export"` |
|---|---|---|
| CSP estricta | Trivial: un `index.html` sin scripts en línea → `script-src 'self'` | El App Router inyecta `<script>self.__next_f.push(…)</script>` en línea en cada HTML; en export estático no hay nonces, hay que calcular hashes tras el build y mantener ese script |
| Electron | Natural: `dist/` servido por un protocolo propio; ecosistema `electron-vite` si hiciera falta | Funciona sirviendo `out/`, con más piezas (ficheros `.txt` de RSC, rutas `.html`) |
| Dependencias | `vite`, `@tailwindcss/vite` (sin `@vitejs/plugin-react`: T-2) | `next` y su runtime (~100 KB en el bundle) sin usar sus funciones |
| Tests | Vitest ya es Vite: misma configuración de resolución | Sin cambio |
| Coste de cambio | Reescribir `src/app/` (hoy casi todo es auth que se borra de todos modos) | Menor ahora, mayor en CSP y Electron |
| Alineación con la plantilla R3ZON | Se pierde (ya se pierde al quitar Supabase/auth) | Se mantiene nominalmente |

**Recomendación: Vite + React.** El precio (salir del stack de la plantilla) ya se paga al
retirar Supabase, auth y observabilidad; lo que queda de Next no aporta nada y complica
la CSP y Electron. **Confirmada** el 2026-09-29 y **aplicada en la Fase 2**.

## 4. Arquitectura

### 4.1 Capas

```text
┌──────────────────────────── UI (React) ─────────────────────────────┐
│ shell (barra, paneles, estado vacío, errores) · visores · editor      │
├─────────────────────── lógica de aplicación ─────────────────────────┤
│ documento abierto (estado) · atajos · preferencias                    │
├───────────── motores de documento (sin UI, cargados a demanda) ──────┤
│ pdf/ (pdf.js + modo oscuro)       markdown/ (pipeline unified)        │
├──────────────────── plataforma (única frontera) ─────────────────────┤
│ web.ts: <input type=file> (F3) · descarga para guardar (F9)           │
│ electron.ts: window.bpdf (preload) → IPC validado → proceso main      │
└──────────────────────────────────────────────────────────────────────┘
```

Reglas:

1. **Solo `src/platform/` sabe en qué plataforma corre.** El resto del código recibe un
   objeto `Platform` y nunca toca `window.bpdf`, rutas de disco ni APIs de Electron.
2. **Los motores no conocen React.** `pdf/engine.ts` y `markdown/pipeline.ts` son módulos
   puros o casi (entrada: bytes/texto; salida: objetos), probables sin montar nada.
3. **El renderer nunca ve rutas de ficheros** ni en web ni en Electron: ve
   `OpenedDocument` (nombre visible + contenido + un identificador opaco).
4. **Sin librería de estado ni router.** Estado con React (`useState`/`useReducer` +
   un contexto para el documento abierto y otro para preferencias). Una sola vista;
   el tipo de documento decide qué visor se monta.

### 4.2 Modelo de documento

**Implementado en la Fase 3** ([`src/documents/types.ts`](../src/documents/types.ts)):

```ts
type DocumentKind = "pdf" | "markdown";

type OpenedDocument =
  | { id: string; name: string; size: number; kind: "pdf"; blob: Blob }
  | { id: string; name: string; size: number; kind: "markdown"; text: string };
// id: opaco, válido solo en esta sesión (contador en web; en Electron, el que asigne el main)
// name: nombre visible ya saneado, nunca una ruta · size: bytes
```

Cambios respecto al diseño de la Fase 0, y por qué:

- **Unión discriminada** en lugar de `data: ArrayBuffer | string`: el tipo dice qué
  contiene cada documento y el compilador obliga a comprobar `kind`.
- **PDF como `Blob`, no `ArrayBuffer`**: en web el `File` apunta al disco y no ocupa
  memoria hasta que se lee. Abrir solo lee los primeros 1024 bytes; el visor (Fase 5) hace
  `await blob.arrayBuffer()` y pdf.js transferirá esos bytes a su worker sin copiarlos.
  Leerlo entero al abrir sería tener una copia en memoria sin que nadie la use aún.
- **Markdown: solo el texto**; los bytes leídos se descartan tras decodificar.
- **Id con un contador**, no `crypto.randomUUID()`: solo tiene que ser único y no
  derivar del nombre, y `randomUUID` no existe fuera de un contexto seguro.
- **`resources` (Fase 7 bis)** en `OpenedMarkdown`: las imágenes entregadas con el `.md`
  (ruta relativa normalizada → `Blob` sin leer), el directorio del `.md` y las rutas
  ambiguas. Un `.md` suelto lleva `SIN_RECURSOS`. Nunca rutas de disco
  ([ARCHITECTURE.md](ARCHITECTURE.md) §4 sexies). `capabilities` (guardar) llega con la
  Fase 9. No se diseñan campos sin uso.

Reglas:

- **Detección de tipo** ([`src/documents/detect.ts`](../src/documents/detect.ts)):
  extensión (`.pdf`, `.md`, `.markdown`, sin distinguir mayúsculas) **y** contenido: un
  PDF debe llevar `%PDF-` dentro de los primeros 1024 bytes (lo mismo que toleran Acrobat y
  pdf.js); un Markdown debe decodificar como UTF-8 estricto (`TextDecoder` con
  `fatal: true`) y no contener NUL (así se rechaza también el UTF-16 sin BOM). **Nunca**
  por el MIME que da el navegador (sale de la extensión o del sistema operativo). El
  filtro `accept` del selector solo lista extensiones: con MIME, algunos sistemas amplían
  el filtro a extensiones que después se rechazarían.
- **Nombre para mostrar:** sin ruta, sin caracteres de control ni marcas de dirección
  de texto (un `U+202E` haría que `informe‹RLO›fdp.md` se viera como «informedm.pdf») y
  en NFC. La extensión se valida sobre ese mismo nombre: lo que se ve es lo que se ha
  comprobado. Siempre se muestra como texto.
- **Límites** ([`src/documents/limits.ts`](../src/documents/limits.ts), con su
  justificación técnica en el propio fichero): PDF ≤ 512 MiB (el visor lo cargará entero
  en memoria para pdf.js), Markdown ≤ 20 MiB (el texto se decodifica entero y el render
  construye varios árboles encima). Por encima: mensaje, sin leer nada. Se revisan con
  las mediciones de la Fase 13. Medido en la Fase 3 (Chrome 153, macOS): abrir un
  Markdown de casi 20 MiB tarda ~170 ms (leer 48 ms, decodificar 19 ms).
- **Errores tipados** ([`src/documents/errors.ts`](../src/documents/errors.ts)):
  `unsupported`, `multiple`, `empty`, `too-large`, `not-pdf`, `not-utf8`, `unreadable`,
  cada uno con su texto en `messages.ts` (§9.3).
- **Un documento a la vez en v1** (D16, confirmada). Abrir otro lo sustituye; si la
  apertura falla, el documento abierto se conserva. La confirmación de cambios sin guardar
  llega con el editor (Fase 9), que es quien puede tenerlos. El estado vive en
  [`DocumentProvider`](../src/documents/DocumentProvider.tsx): pestañas o varios
  documentos cambiarían ese estado, no el modelo.

### 4.3 Estructura objetivo de `src/`

Lo marcado ✅ existe desde la Fase 2; el resto son rutas **propuestas** que la fase que
las crea concreta en [STRUCTURE.md](STRUCTURE.md).

```text
src/
├── main.tsx                 ✅ arranque: monta <App/> dentro del ErrorBoundary
├── app/                     ✅ App.tsx (shell) · EmptyState.tsx · ErrorBoundary.tsx
├── config/                  ✅ project.ts · security-headers.ts · public-site.ts
├── i18n/messages.ts         ✅ todos los textos visibles (D2)
├── styles/globals.css       ✅ tokens de diseño + Tailwind
├── components/ui/           ✅ primitivos accesibles (Button, Field, Input)
├── documents/               ✅ F3: tipos, detección, límites, errores, lectura, estado del documento abierto
├── platform/                ✅ F3: types.ts · web.ts · index.ts (electron.ts en F14)
├── pdf/                     F4–F6: engine.ts (carga diferida de pdf.js) · PdfViewer.tsx ·
│                            dark/ (modo oscuro) · thumbnails · find · shortcuts
├── markdown/                F7–F8: pipeline.ts · MarkdownView.tsx · url-policy.ts · toc.ts ·
│                            components/ (CodeBlock, MathBlock, MermaidBlock, Image, Link)
├── editor/                  F9: MarkdownEditor.tsx · SplitView.tsx
└── preferences/             F10: esquema zod, almacén versionado, hook
electron/                    F14: main.ts · preload.ts · protocol.ts · ipc.ts
```

## 5. Apertura de documentos

| Vía | Web | Electron |
|---|---|---|
| Selector | ✅ F3: `<input type="file">` creado al vuelo (fuera del DOM) por el botón «Abrir archivo»; `Ctrl/Cmd+O`. ✅ F7 bis: **selección múltiple** (un documento suelto, o un `.md` con sus imágenes; el filtro admite también PNG, JPEG, GIF, WebP y SVG) | Diálogo nativo en el proceso main (`dialog.showOpenDialog`) vía IPC |
| Carpeta | ✅ F7 bis: botón «Abrir carpeta», `<input type="file" webkitdirectory>`; con varios `.md`, el usuario elige | Diálogo nativo de carpeta en el main; el main entrega rutas relativas |
| Arrastrar y soltar | ✅ F3: zona a pantalla completa con manejadores de React sobre la raíz de la app (sin listeners en `window`). ✅ F7 bis: varios ficheros (un `.md` con sus imágenes) o una carpeta (`webkitGetAsEntry`, capturado dentro del evento) | Igual (DOM); `webUtils.getPathForFile` en el preload solo si hace falta guardar o resolver relativos |
| Argumentos / «Abrir con…» | No aplica | `process.argv` (Windows/Linux), `open-file` (macOS), `second-instance` con bloqueo de instancia única; el main lee y valida, y envía el contenido |
| Guardar (Markdown) | `showSaveFilePicker` si existe (Chromium), si no descarga con `<a download>` y Blob | IPC `saveDocument(id, texto)`: el main solo escribe en ficheros que el usuario abrió o eligió con «Guardar como» |

La interfaz `Platform` ([ELECTRON.md](ELECTRON.md) §3) existe desde la Fase 3 con la
implementación web ([`src/platform/`](../src/platform/)). Hoy: `pickDocument()`,
`pickFolder()`, `openDropped(soltado)` y `openExternal(url)`. Las implementaciones terminan
en la misma validación (`abrirSeleccion` → `readDocument`, [ARCHITECTURE.md](ARCHITECTURE.md)
§4 sexies); la de Electron llega en la Fase 14 sin tocar el
resto de la app. Guardar, enlaces externos y «Abrir con…» se añaden en las fases que los
usan. **Abrir desde una URL no se hará:** rompería el principio de privacidad.

## 6. Visor PDF

### 6.1 Motor

**pdf.js (`pdfjs-dist`, Apache-2.0), versión exacta fijada** (6.3.289 a fecha de hoy).
No hay alternativa razonable en navegador: es el motor de Firefox, mantenido por Mozilla,
con worker, capa de texto, enlaces y búsqueda. Se carga con `import()` al abrir el primer
PDF, nunca en el bundle inicial.

**Visor propio sobre la API núcleo (D17, implementado en la Fase 5).** `PDFViewer` crea
sus propios lienzos opacos (el texto sale con flecos de color al recolorearlo) y no pasa
`recordImages`, del que depende el modo oscuro (PDF_DARK_MODE_SPIKE.md §9 y §12). BPDF
pinta cada página con `page.render` y construye él mismo la virtualización, el zoom, las
vistas continua y página a página, la búsqueda, las miniaturas y los enlaces; de pdf.js
reutiliza `TextLayer` (selección y copia). No usa `AnnotationLayer` ni `PDFLinkService`:
los enlaces pasan por su propia política. Build **`legacy`** de pdf.js (D18): la moderna
exige navegadores de 2025–2026. Diseño completo: [ARCHITECTURE.md](ARCHITECTURE.md)
§4 quater.

Recursos que pdf.js necesita y se **sirven desde el propio origen** (copiados de
`node_modules/pdfjs-dist` en `predev`/`prebuild` por `scripts/copiar-pdfjs.mjs`): el worker
(`legacy/build/pdf.worker.min.mjs`), `cmaps/`, `standard_fonts/` y los decodificadores
JPEG 2000/JBIG2 en JavaScript. Sin `*.wasm` ni `iccs/` (`useWasm: false`).

### 6.2 Funcionalidades

Zoom (botones, `Ctrl/Cmd +/-/0`, `Ctrl/Cmd`+rueda, pellizco), ajustar a ancho, ajustar a
página, página anterior/siguiente, ir a página, miniaturas, búsqueda con anterior/siguiente
y contador, selección y copia de texto, enlaces internos y externos, rotación, pantalla
completa, modo continuo y de página individual, atajos de teclado ([§9.4](#94-atajos-de-teclado)).
Configuración segura del motor: [SEGURIDAD.md](SEGURIDAD.md) §4.

### 6.3 Lectura oscura (el punto técnico difícil)

> **Resuelto en la Fase 4 (2026-09-29) e integrado en el visor en la Fase 5, en un Web
> Worker: recoloreado selectivo.** Heurística de color en
> OKLab (invierte la luminosidad de lo neutro y conserva lo que tiene color) aplicada solo
> **fuera** de las regiones de imagen que registra el propio pdf.js (`recordImages`), con
> reglas para escaneos y páginas ya oscuras. Fotos intactas (±3 por canal), texto claro a
> 12:1, gráficos con su color, ~10 ms por megapíxel. Evidencia, benchmark, limitaciones y
> condiciones para la Fase 5: [PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md). Lo que
> sigue es el análisis previo al spike, que se conserva como historial de la decisión.

Requisito: fondo de página oscuro, texto claro, **imágenes y gráficos con sus colores**, sin
destruir la legibilidad del contenido gráfico. `filter: invert()` sobre la página no vale:
invierte fotos y gráficos.

**Descartado tras leer el código de pdf.js 6.3.289:** la opción `pageColors` (modo de alto
contraste de Firefox). `CanvasGraphics.#drawFilter()` aplica, al terminar la página, un
filtro SVG a **todo el lienzo**: pasa a escala de grises y cuantiza la luminancia en 6
niveles entre dos colores. Las fotos quedan grises y posterizadas. Sirve, como mucho, de
modo «alto contraste» opcional.

**Estrategias candidatas** (las resuelve el spike de la Fase 4, **T-1**):

| | Estrategia | Cómo | A favor | En contra |
|---|---|---|---|---|
| **B** (probar primero) | Post-proceso del lienzo, respetando imágenes | Al recibir `pagerendered`, se recalculan los píxeles del lienzo **fuera de las regiones de imagen**: los píxeles poco saturados (texto, fondo, líneas grises) se remapean invirtiendo su luminosidad entre el color de página y el de texto; los saturados se conservan (o se aclaran lo justo para 3:1). Las regiones de imagen se obtienen de `page.getOperatorList()` (API pública) siguiendo la matriz de transformación en `paintImageXObject`/`paintInlineImageXObject`/`paintImageXObjectRepeat` | Mantiene `PDFViewer` entero (virtualización, búsqueda, modos); depende solo de API pública; vale igual para miniaturas | Coste por píxel (medir; alternativa WebGL); halos en bordes antialias de líneas de color; texto dentro de una región de imagen queda con sus colores originales |
| **A** | Remapeo de color en el contexto 2D | Envolver el `CanvasRenderingContext2D` (setters de `fillStyle`/`strokeStyle`, paradas de degradados) para transformar colores vectoriales; `drawImage`/`putImageData` intactos | Exacto a nivel vectorial, sin halos, coste casi nulo | `PDFPageView` pasa el `<canvas>` y no el contexto: obliga a un visor propio sobre la API núcleo (perder `PDFViewer`) o a parchear `getContext`. Depende de detalles internos de `CanvasGraphics` (grupos de transparencia, máscaras de luminosidad `SMask` que se invertirían, modos de fusión `multiply`) |
| **C** | `pageColors` nativo | Opción del motor | Cero código | Fotos en gris (descartado como modo principal) |

Siempre habrá un selector **«Página: oscura / original»** para el documento abierto:
ninguna estrategia acierta con todos los PDFs, y el usuario debe poder volver a los
colores originales con un clic.

**Limitaciones conocidas y que se documentarán al usuario** (sea cual sea la estrategia):

- **PDFs escaneados** (cada página es una foto): no hay texto vectorial que remapear; la
  página es una imagen y se conserva clara. Opción futura: «invertir también imágenes» por
  documento.
- **Texto rasterizado dentro de imágenes** (capturas, diagramas en PNG) conserva sus
  colores.
- **Degradados de malla** (sombreados tipo 4–7) se rasterizan en pdf.js y cuentan como
  imagen en B; en A conservan colores.
- **Colores de marca muy oscuros** (azul marino en títulos) se aclaran lo justo para ser
  legibles: se conserva el tono, no el valor exacto.
- **Modos de fusión** pensados para fondo blanco (`multiply` en subrayados) pueden verse
  distintos.

## 7. Markdown

### 7.1 Pipeline

`react-markdown` (MIT) es la opción mínima: ya integra `remark-parse` → `remark-rehype` →
`hast-util-to-jsx-runtime` y produce **elementos React, no HTML**, sin `innerHTML`.
Por defecto **no interpreta HTML crudo** y filtra URLs con `defaultUrlTransform`.

| Funcionalidad | ¿Dependencia? | Elección | Riesgo | Tamaño aprox. | Fase |
|---|---|---|---|---|---|
| CommonMark + render | Sí | `react-markdown` 10 | Bajo (sin HTML crudo) | pequeño | 7 |
| GFM: tablas, tachado, listas de tareas, autolinks, notas al pie | Sí | `remark-gfm` 4 | Bajo | pequeño | 7 |
| Bloques de código + copiar | No | Componente propio `CodeBlock` + `navigator.clipboard` | Nulo | — | 7 |
| Resaltado de sintaxis | Sí | `lowlight` 3 + `highlight.js` 11 con **9 gramáticas** registradas a mano, directamente en `BloqueCodigo` (sin `rehype-highlight`, que arrastra el subconjunto `common`) — produce hast, no HTML | Bajo | 70 KB gzip todo el visor, a demanda | ✅ 7 |
| Enlaces | No | Componente `Link` + `url-policy.ts` propios | Medio (protocolos) | — | 7 |
| Índice / TOC | No | Ids propios al estilo de GitHub con prefijo `md-` (plugin de remark); el índice (h1–h6) se lee de los encabezados ya pintados | Bajo (DOM clobbering: prefijo) | — | ✅ 7 |
| Imágenes locales | No | Componente `Imagen` que resolverá contra `resources` → `blob:`. **Aplazadas en la Fase 7** (§7.2): hoy, marcador | Medio (SVG, rutas) | — | pendiente |
| Matemáticas | Sí | `remark-math` 6 (sintaxis) + `katex` 0.18.9 a demanda; **sin `rehype-katex`** (parsea HTML con `innerHTML`): nodos con el `toNode()` de KaTeX | Medio (histórico de CVE; `trust: false`) | 77 KB gzip + CSS y fuentes, a demanda | ✅ 8 |
| Mermaid | Sí | `mermaid` 11.17.2 en un **iframe aislado** (`sandbox`, origen opaco, CSP propia sin red), `securityLevel: "strict"`, SVG saneado y verificado, salida como `<img src="blob:…">` | Alto (histórico de XSS) | ~0,9 MB gzip por trozos, a demanda | ✅ 8 |
| HTML embebido | — | **No se interpreta** en v1 (D6): se muestra como texto; los comentarios se quitan | — | — | ✅ 7 |

Descartados: `marked` + `DOMPurify` (genera HTML y obliga a `innerHTML`: más superficie),
`shiki` (mejor resaltado pero bastante más peso y un motor de regex en WASM/JS; se
reevalúa si el resaltado de `highlight.js` se queda corto; además exigiría `'wasm-unsafe-eval'`),
`rehype-raw` (solo si D6 cambia) y `rehype-highlight` (Fase 7: ver la fila del resaltado).
Diseño implementado: [ARCHITECTURE.md](ARCHITECTURE.md) §4 quinquies.

### 7.2 Imágenes

**Estado: implementado en la Fase 7 bis** para web ([ARCHITECTURE.md](ARCHITECTURE.md)
§4 sexies), salvo lo de Electron. Resumen:

- **Locales en web:** un fichero suelto no da acceso a sus hermanos. Se resuelven si el
  usuario **suelta o elige varios ficheros** (el `.md` y sus imágenes) o una carpeta
  (`webkitdirectory` / `webkitGetAsEntry`). Rutas relativas normalizadas; nunca salen
  del conjunto entregado. Si no está, un marcador «imagen no disponible».
- **Locales en Electron:** protocolo propio de solo lectura limitado al directorio del
  documento ([ELECTRON.md](ELECTRON.md) §5).
- **SVG:** solo como `<img>` (nunca en línea): en `<img>` un SVG no ejecuta scripts ni
  carga recursos externos.
- **Remotas (`https://…`): bloqueadas en v1** (D7). Cargar una imagen remota revela a un
  tercero la IP y el momento de lectura (píxeles espía) y obliga a abrir la CSP. Se
  muestra el texto alternativo y el enlace.

### 7.3 Edición (Fase 9)

Modos: **lectura**, **edición**, **dividido** (editor + vista previa con scroll
sincronizado por encabezados). Editor recomendado: **CodeMirror 6** (D9; MIT, modular,
virtualiza documentos grandes, historial, búsqueda; cargado solo al entrar en edición).
Vista previa con *debounce* de ~200 ms. Guardado explícito (`Ctrl/Cmd+S`), aviso de
cambios sin guardar (`beforeunload` en web; diálogo en Electron). Sin autoguardado en v1.

## 8. Persistencia y privacidad

Todo en `localStorage` del origen de la app (en Electron también: el protocolo propio es un
origen estándar y seguro, así que **no hace falta IPC para preferencias**). Sin cookies: no
hay servidor que las lea.

| Dato | ¿Se guarda? | Clave / forma | Motivo |
|---|---|---|---|
| Modo de página PDF (oscura/original) | Sí | `bpdf:prefs` | Preferencia visual |
| Zoom por defecto, modo continuo/página, panel de miniaturas abierto | Sí | `bpdf:prefs` | Preferencia del visor |
| Tamaño de letra y ancho de columna de Markdown | Sí | `bpdf:prefs` | Lectura |
| Atajos de una sola tecla activados | Sí | `bpdf:prefs` | WCAG 2.1.4 |
| Última página y zoom **por documento** | **Opcional (D8)** | `bpdf:positions`: `{ [huella]: { page, zoom, t } }`, máx. 50 entradas LRU | Útil, pero es un historial de lectura: guarda una huella (no el nombre ni el contenido) |
| Nombres de ficheros, rutas, historial de abiertos | **No** | — | Privacidad |
| Contenido de documentos | **No** | — | Principio rector |
| Borradores sin guardar del editor | **No en v1** | — | Se reevalúa si hay demanda (sería contenido) |

- **Huella de documento:** `pdfDocument.fingerprints[0]` en PDF (lo calcula pdf.js a
  partir del ID del fichero); SHA-256 del texto en Markdown (`crypto.subtle`). Nunca el
  nombre.
- **Esquema versionado** con `zod`: `{ v: 1, … }`. Un valor corrupto o de versión
  desconocida se descarta y se usan los valores por defecto (nunca rompe el arranque).
  Todo acceso a `localStorage` va en `try/catch` (modo privado, cuota, bloqueo).
- En preferencias: **«Olvidar posiciones guardadas»** y **«Restablecer preferencias»**.

## 9. UI/UX y sistema de diseño

### 9.1 Principios

Oscuro por defecto, minimalista, orientado a la lectura: la barra de herramientas es fina,
los paneles (miniaturas, índice, búsqueda) están cerrados por defecto, y nada compite con
el documento. Tipografía del sistema (sin fuentes web: privacidad y rendimiento):
`system-ui` para interfaz y Markdown, `ui-monospace` para código.

### 9.2 Tokens (paleta inspirada en ChatGPT Dark)

Implementados en la Fase 2 en `src/styles/globals.css` (utilidades `bg-app`, `text-fg`,
`outline-accent`…). Tres planos **distintos** y ninguno negro puro:

| Token | Valor | Uso |
|---|---|---|
| `--rgb-app` | `23 23 23` (`#171717`) | Cromo: barra superior, paneles laterales |
| `--rgb-reading` | `33 33 33` (`#212121`) | Área de lectura (detrás de las páginas) |
| `--rgb-page` | `43 43 43` (`#2b2b2b`) | Página PDF en modo oscuro, hoja de Markdown |
| `--rgb-elevated` | `48 48 48` (`#303030`) | Menús, popovers, campos |
| `--rgb-border` | `61 61 61` (`#3d3d3d`) | Bordes y separadores; contorno de página (con sombra) |
| `--rgb-fg` | `236 236 236` (`#ececec`) | Texto principal y texto de PDF remapeado |
| `--rgb-fg-muted` | `180 180 180` (`#b4b4b4`) | Texto secundario (válido sobre los cuatro fondos) |
| `--rgb-fg-subtle` | `142 142 142` (`#8e8e8e`) | Solo sobre `app` y `reading` (sobre `page` no llega a 4,5:1) |
| `--rgb-accent` | `16 163 127` (`#10a37f`) | Foco, estado activo, progreso. **No** como fondo de texto blanco (3,2:1) |
| `--rgb-primary` / `--rgb-primary-fg` | `236 236 236` / `13 13 13` | Botón principal (claro con texto oscuro) |
| `--rgb-danger` | `248 113 113` (`#f87171`) | Errores |
| Selección | `--rgb-accent` al 35 % | `::selection` |
| `--rgb-find` / `--rgb-find-current` | amarillo 35 % / acento 50 % | Coincidencias de búsqueda (**llega en la Fase 6**) |
| `--code-*` | 8 colores de sintaxis | Cada uno ≥ 4,5:1 sobre el fondo de bloque de código (**llega en la Fase 7**) |

Contrastes calculados (WCAG): `fg` sobre `page` ≈ 12:1; `fg-muted` sobre `page` ≈ 6,8:1;
`accent` sobre `reading` ≈ 5:1. **Un test unitario calcula el contraste de cada par
declarado** a partir de los tokens (`tests/unit/tokens.test.ts`, Fase 2), para que un cambio de paleta no rompa la
accesibilidad en silencio.

El modo oscuro del PDF lee `--rgb-page` y `--rgb-fg`: un solo sitio define cómo se ve la
página. Tema claro de interfaz: **no en v1** (D10); los tokens lo permiten más adelante
con un bloque `[data-theme="light"]`.

### 9.3 Pantallas

- **Vacía** (✅ F3): zona de soltar a pantalla completa, botón «Abrir archivo», atajo
  visible y la frase de privacidad («Tus documentos no salen de este dispositivo»).
- **Documento abierto, provisional** (F3, hasta que lleguen los visores de las Fases 5 y
  7): nombre, tipo y tamaño, «Cerrar documento» y «Abrir archivo» en la cabecera.
- **PDF:** barra (abrir, miniaturas, página n/N, zoom, ajustar, rotar, modo, página
  oscura/original, buscar, pantalla completa); panel de miniaturas a la izquierda.
- **Markdown:** barra (abrir, índice, lectura/edición/dividido, guardar, tamaño de letra);
  índice a la izquierda; hoja centrada con ancho de lectura (~72 caracteres).
- **Errores:** fichero no soportado, demasiado grande, PDF dañado, con contraseña (D13),
  Markdown no UTF-8. Cada uno con texto claro y sin detalles técnicos crudos. Los de
  apertura (✅ F3) se muestran como aviso (`role="alert"`) que se puede descartar, sin
  cerrar el documento abierto; «PDF dañado» y «PDF protegido» los dice el visor (Fase 5; abrir
  un PDF con contraseña espera a D13).

### 9.4 Atajos de teclado

| Acción | Atajo |
|---|---|
| Abrir | `Ctrl/Cmd+O` |
| Buscar / siguiente / anterior | `Ctrl/Cmd+F` · `Enter` / `F3` · `Shift+Enter` / `Shift+F3` |
| Zoom + / − / 100 % | `Ctrl/Cmd +` · `Ctrl/Cmd −` · `Ctrl/Cmd 0`; `Ctrl/Cmd`+rueda |
| Página siguiente / anterior | `PageDown`/`PageUp`, `→`/`←` en modo página, `Espacio`/`Shift+Espacio` |
| Primera / última página | `Home` / `End` |
| Ir a página | `Ctrl/Cmd+G` (enfoca el campo de página) |
| Rotar | `R` / `Shift+R` * |
| Miniaturas / índice | `T` * |
| Pantalla completa | `F` * y `F11` (Electron) |
| Página oscura / original | `I` * |
| Guardar (Markdown) | `Ctrl/Cmd+S` |
| Ayuda de atajos | `?` * |

\* Atajos de una tecla: solo actúan con el foco fuera de campos de texto y se pueden
desactivar en preferencias (WCAG 2.1.4). En web, `Ctrl/Cmd +/−` sustituyen al zoom del
navegador **solo dentro del visor**.

**Estado (Fase 5, 2026-09-30).** Implementados: `Ctrl/Cmd+O`; `Ctrl/Cmd+F` con `Enter` /
`Shift+Enter` en el campo; zoom con `Ctrl/Cmd +/−/0` y `Ctrl/Cmd`+rueda; `PageDown`/`PageUp`;
`Home`/`End`; y `↓`/`↑` para desplazar (en «página a página», al llegar al borde pasa de
página). Tabla y motivo en [ARCHITECTURE.md](ARCHITECTURE.md) §4 quater. Quedan para la
Fase 6: `F3`, `→`/`←`, `Espacio`, `Ctrl/Cmd+G` y los de una tecla con su ayuda.

## 10. Accesibilidad

Objetivo **WCAG 2.2 AA**.

- Todo operable con teclado; orden de foco lógico; foco visible con `--rgb-accent`.
- Barra con `role="toolbar"` y navegación con flechas; campo de página con etiqueta; región
  `aria-live="polite"` para «Página 3 de 120» y «4 de 17 coincidencias».
- La capa de texto de pdf.js deja el texto del PDF en el DOM: seleccionable y legible por
  lectores de pantalla. Los PDFs escaneados sin OCR no son accesibles (limitación que se
  documenta).
- Markdown: HTML semántico (encabezados, listas, tablas con cabecera), `alt` de imágenes,
  KaTeX con su salida MathML, Mermaid con `aria-label` = código fuente resumido.
- `prefers-reduced-motion` (ya en la plantilla); objetivos táctiles ≥ 24 px; nada depende
  solo del color.
- jest-axe en cada componente nuevo; axe en Playwright (`@axe-core/playwright`, dev) para
  las pantallas completas en la Fase 13.

## 11. Rendimiento

**Necesario desde el principio** (barato, y sin ello la app no funciona con documentos
reales):

- pdf.js, KaTeX, Mermaid, highlight.js y CodeMirror se cargan con `import()` solo cuando
  hacen falta. Bundle inicial objetivo: **≤ 150 KB gzip**, vigilado en CI por
  `npm run build:tamano` desde la Fase 2 (entonces: 80 KB, casi todo React).
- Parseo de PDF en el **worker** de pdf.js.
- Virtualización de páginas (la da `PDFViewer`) y tope `maxCanvasPixels` (p. ej. 16 Mpx)
  para no agotar memoria con zoom alto.
- Miniaturas bajo demanda, solo las visibles, a escala baja, con un tope de caché.
- `pdfDocument.destroy()` y `URL.revokeObjectURL` al cerrar un documento.
- Mermaid y KaTeX: solo si el documento contiene bloques de ese tipo; Mermaid se
  renderiza al entrar en pantalla.

**Esperan a tener evidencia** (se miden en la Fase 13 con el corpus de documentos
grandes):

- Mover el pipeline de Markdown a un Web Worker (si un `.md` de ~5 MB bloquea > 200 ms).
- Resaltado de código por bloque al entrar en pantalla.
- Post-proceso del modo oscuro en WebGL o en un worker con `OffscreenCanvas`.
- Virtualizar el render de Markdown muy largo.
- Precalcular el texto de todas las páginas para la búsqueda (hoy pdf.js lo hace bajo
  demanda con progreso).

## 12. Testing

| Nivel | Herramienta | Qué se prueba |
|---|---|---|
| Unitario | Vitest (`node`) | Detección de tipo y límites; política de URLs; slugs y TOC; esquema y migración de preferencias; huellas; mapeo de color del modo oscuro (función pura); cálculo de regiones de imagen a partir de un operator list sintético; contraste de tokens; validadores IPC (Fase 14) |
| Componentes | Vitest + jsdom + Testing Library + jest-axe | Barra de herramientas, estado vacío, errores, `MarkdownView` con el corpus de XSS, `CodeBlock` (copiar), TOC, preferencias |
| Seguridad | Vitest | **Corpus de XSS de Markdown** ([SEGURIDAD.md](SEGURIDAD.md) §3.3): el DOM resultante no contiene `<script>`, atributos `on*`, `href`/`src` con protocolos no permitidos, `<iframe>`, `<object>`, `<embed>`, `<svg>` en línea |
| Render real | Playwright (Chromium) | PDF: páginas, navegación, zoom, búsqueda, selección y copia, enlaces, rotación; **muestreo de píxeles** del modo oscuro (fondo oscuro, texto claro, región de imagen con sus colores originales) sobre fixtures conocidos |
| Casos límite | Vitest + Playwright | PDF vacío, truncado, no-PDF con extensión `.pdf`, cifrado, con JavaScript, con enlaces `javascript:`/`file:`/`launch`; Markdown no UTF-8, enorme, con anidamiento patológico |
| E2E | Playwright | Recorridos: abrir por selector y por arrastre; PDF → buscar → ir a página; Markdown → editar → guardar (descarga); CSP sin violaciones (escucha de `securitypolicyviolation`) |
| Electron | Playwright `_electron` + Vitest | `contextIsolation`, `sandbox`, sin `require` en el renderer, navegación bloqueada, `window.open` denegado, IPC rechaza argumentos inválidos, protocolo no sirve fuera de su raíz |

**Fixtures** en `tests/fixtures/` (PDF y Markdown pequeños, generados o creados a mano,
con su procedencia y licencia en un `README.md` del directorio). Nunca documentos de
terceros sin licencia clara.

## 13. Build, distribución, open source y mantenimiento

- **Build web:** `vite build` → `dist/` estático + recursos de pdf.js copiados. Hosting
  estático con cabeceras (D5): la CSP y demás cabeceras se definen en un único fichero
  fuente y se generan para el hosting y para Electron (Fase 12).
- **Escritorio:** [ELECTRON.md](ELECTRON.md) §8.
- **Open source** (Fase 16): `LICENSE` (D3), `README.md` del producto, `CONTRIBUTING.md`,
  `SECURITY.md` (reporte privado por GitHub Security Advisories), `CODE_OF_CONDUCT.md`
  (Contributor Covenant), plantillas de issue/PR, `docs/` como documentación de
  arquitectura, `CHANGELOG` de versiones para usuarios (distinto de la bitácora interna,
  CLAUDE.md §8), política de dependencias.
- **Política de dependencias:** cada dependencia de runtime justificada en `STACK.md` (el
  test `tests/unit/docs.test.ts` ya lo exige); versiones **exactas** para los motores que
  procesan contenido no confiable (`pdfjs-dist`, `katex`, `mermaid`, `highlight.js`);
  `npm ci` siempre; `allowScripts` de npm 11 (Electron descarga su binario en
  `postinstall`); `npm audit` semanal; actualizar pdf.js en cuanto publique una
  corrección de seguridad.
- **Mantenimiento:** revisar avisos de seguridad de pdf.js, KaTeX, Mermaid y Electron;
  Electron tiene soporte de ~8 semanas por versión mayor: hay que seguir las mayores.

## 14. Decisiones

### 14.0 Confirmadas (*2026-09-29*; D16 al empezar la Fase 3; D17 y D18 al empezar la Fase 5; D6 y D7 con la Fase 7)

| ID | Decisión | Dónde se aplica |
|---|---|---|
| **D1** | **Vite + React** en lugar de Next.js ([§3](#3-framework-vite--react-en-lugar-de-nextjs-d1)) | Fase 2 |
| **D2** | Interfaz en **español** en v1, con todos los textos en **un único módulo de mensajes** para facilitar otros idiomas | Fase 2 en adelante |
| **D3** | Licencia **Apache-2.0** | Fase 1: `LICENSE` (texto canónico de apache.org) y `license` en `package.json` |
| **D4** | Documentación pública **en el Docusaurus de R3ZON** (`docs.r3zon.com/bpdf`), sin que BPDF dependa de ese repositorio para compilar ni probar | Fase 1: se conserva `public_docs/` y su validador |
| **D15** | BPDF **se separa del core SaaS** de la plantilla; conserva solo infraestructura, tooling y componentes útiles | Fase 1: registro de origen en `docs/TEMPLATE.md` (el manifiesto `r3zon-template.json` se retiró antes de publicar) |
| **D16** | **Un documento abierto a la vez**: sin pestañas, varios documentos, historial, recientes ni gestor de documentos. La arquitectura no lo impide más adelante | Fase 3: `DocumentProvider` guarda uno; abrir otro lo sustituye ([§4.2](#42-modelo-de-documento)) |
| **D17** | **Visor PDF propio** sobre la API núcleo de pdf.js, sin `PDFViewer` ni `pdfjs-dist/web/pdf_viewer` (confirmada al empezar la Fase 5) | Fase 5: `src/pdf/visor/`, `src/app/pdf/` ([ARCHITECTURE.md](ARCHITECTURE.md) §4 quater) |
| **D18** | Build **`legacy`** de pdf.js en web (confirmada al empezar la Fase 5) | Fase 5: `engine.ts` y el worker copiado; revisable si solo se publica Electron ([STACK.md](STACK.md)) |
| **D6** | HTML embebido en Markdown **no se interpreta** en v1: se **muestra como texto** (los comentarios `<!-- -->` se quitan). Confirmada con el encargo de la Fase 7, y la forma («mostrarlo como texto», no «ignorarlo») con el de la Fase 7 bis | Fase 7: `src/markdown/pipeline.ts` |
| **D7** | Imágenes remotas en Markdown **bloqueadas** en v1: marcador y enlace para abrirla fuera (confirmada con el encargo de la Fase 7) | Fase 7: `components/Imagen.tsx`; CSP `img-src 'self'` |

### 14.1 Pendientes de confirmación (usuario)

| ID | Decisión | Recomendación | Afecta a |
|---|---|---|---|
| **D5** | Hosting web y dominio | Hosting estático que permita cabeceras (Vercel o Cloudflare Pages). GitHub Pages **no** permite cabeceras (CSP solo por `<meta>`, sin `frame-ancestors`) | Fases 12 y 15 |
| **D8** | Recordar página y zoom por documento | **Activado**, con huella (no nombre), máx. 50 y botón de olvidar | Fase 10 |
| **D9** | Editor de Markdown | **CodeMirror 6** (frente a `<textarea>`) | Fase 9 |
| **D10** | Tema claro de interfaz | **No en v1** (solo «página original» en PDF) | Fase 11 |
| **D11** | Escritorio: plataformas, firma de código, auto-actualización | Windows, macOS y Linux; **sin auto-actualización en v1**; firma según presupuesto (sin firma, SmartScreen y Gatekeeper avisan) | Fase 15 |
| **D12** | Móvil / tablet en web | Escritorio como objetivo; diseño adaptable básico sin optimizar gestos | Fase 11 |
| **D13** | PDFs con contraseña | Soportados con un diálogo simple (pdf.js lo gestiona con `onPassword`). *Hoy (Fase 5) un PDF cifrado se detecta y se dice que aún no se abre* | Fase 6 |
| **D14** | Formularios y anotaciones de PDF | Solo se muestran; no se rellenan ni se editan. *Aplicado así en la Fase 5 (apariencias pintadas en el lienzo, sin interacción), que excluía formularios: falta confirmarlo* | Fase 5 |

### 14.2 Técnicas, resueltas por una fase

| ID | Decisión | La resuelve |
|---|---|---|
| **T-1** | Estrategia de modo oscuro del PDF y, con ella, `PDFViewer` frente a visor propio. **Resuelta en la Fase 4:** recoloreado selectivo con las regiones de `recordImages`; exige visor propio sobre la API núcleo (D17, confirmada; [PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md) §11–12) | Fase 4 ✅ |
| **T-2** | `@vitejs/plugin-react` sí o no. **Resuelta en la Fase 2: no** (Vite transforma el JSX solo; se renuncia a Fast Refresh; [STACK.md](STACK.md)) | Fase 2 ✅ |
| **T-3** | `style-src` sin `'unsafe-inline'`. **Desde la Fase 2 la CSP ya no lo lleva.** pdf.js y KaTeX no lo necesitan (KaTeX, quitando el `style` que pone por atributo). **Mermaid sí**: resuelto en la Fase 8 sin tocar la CSP de la app, con un marco aislado que tiene su propia política (confirmado al empezar la fase; [SEGURIDAD.md](SEGURIDAD.md) §2.1) | Fases 4–8 ✅; cierre en la 12 |
| **T-4** | Trusted Types (`require-trusted-types-for 'script'`) viable con pdf.js y Mermaid | Fase 12 |
| **T-5** | Electron Forge frente a electron-builder | Fase 15 |

## 15. Riesgos

### Técnicos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| El modo oscuro no alcanza calidad aceptable en PDFs reales | Media | Alto (es la razón de ser) | Spike con corpus variado antes de construir el visor; selector «original» siempre disponible; limitaciones documentadas |
| Coste del post-proceso por píxel en páginas grandes o zoom alto | Media | Medio | Medido (F4 y F5): recoloreado en un Web Worker con franjas transferidas; tope de 16,7 Mpx por lienzo y DPR ≤ 2 |
| Cambios de API de pdf.js entre mayores (6.x → 7.x) | Alta a medio plazo | Medio | Versión exacta; todo el acoplamiento en `src/pdf/`; tests de render en Playwright |
| Peso de Mermaid (varios MB) y KaTeX | Alta | Medio | Carga diferida; fase aparte; medir |
| TypeScript 7 con alguna herramienta nueva (Vite, Electron) | Baja | Bajo | Salida documentada en la plantilla: fijar TS 6 |
| Imágenes locales de Markdown en web (sin acceso a hermanos) | Cierta | Bajo | Soltar varios ficheros o carpeta; Electron lo resuelve |

### De seguridad

Detalle en [SEGURIDAD.md](SEGURIDAD.md). Los principales: XSS vía Markdown (Mermaid y
KaTeX son los puntos débiles históricos), vulnerabilidades del parser de pdf.js
(precedente: CVE-2024-4367, ejecución de JS por fuentes, corregida en 4.2.67), fuga de
privacidad por recursos remotos, y en Electron un renderer comprometido que intente leer o
escribir ficheros arbitrarios mediante IPC.
