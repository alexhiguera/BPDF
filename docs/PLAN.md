# BPDF — Diseño objetivo

> **Estado:** escrito en la Fase 0 (*2026-09-29*); D1–D4 y D15 confirmadas y Fase 1
> cerrada el mismo día. D16 confirmada y §4.2 y §5 implementados en la Fase 3
> (*2026-09-29*). Revisado el *2026-09-30* con las Fases 5, 7, 7 bis, 8 y 6 cerradas (D13
> confirmada e implementada en la 6), el *2026-10-01* con la 9 (D9: CodeMirror 6), y el
> *2026-10-03* con la 9 cerrada y aprobada (con una excepción de rendimiento) y D8
> confirmada para la Fase 10; también el *2026-10-03*, la Fase 10 cerrada y aprobada y
> **D19: BPDF es solo una aplicación web** (sin Electron: la Fase 14 se canceló y la 15 se
> reescribió). Este documento describe **cómo será** BPDF. Cómo es hoy:
> `ARCHITECTURE.md`, `STACK.md` y `STRUCTURE.md`.
>
> Documentos hermanos: [SEGURIDAD.md](SEGURIDAD.md) (modelo de amenazas y controles) y
> [FASES.md](FASES.md) (plan de implementación). El estado de cada fase está en
> [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md). [ELECTRON.md](ELECTRON.md) es
> **histórico**: el diseño de una versión de escritorio que se canceló (D19).

Las decisiones marcadas **D-n** necesitan confirmación del usuario (CLAUDE.md §1) y están
reunidas en [§14](#14-decisiones). Las marcadas **T-n** son decisiones técnicas que resuelve
una fase concreta con evidencia (spike o medición).

---

## 1. Qué es BPDF

Visor gratuito y open source de **PDF** y **Markdown** para leer cómodamente en modo
oscuro. **Aplicación web**, sin versión de escritorio (D19).

**Principio rector: los documentos del usuario no salen del dispositivo.** No hay
backend, API, base de datos, cuentas, sincronización, telemetría ni subida de ficheros.
Todo se procesa en el navegador del usuario.

**Prioridades**, en este orden: legibilidad · simplicidad · consistencia · accesibilidad ·
rendimiento. Ante dos soluciones válidas: menos código, menos dependencias, menos
superficie de ataque y menos mantenimiento.

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
| `zod` | **Retirado en la Fase 1** | Al borrar la auth y `env.ts` se quedó sin uso, y no se guardan dependencias «para más adelante». Volvió en la Fase 10 con lo primero que valida: las preferencias guardadas |
| `vercel.json` | **Eliminar** (Fase 1) | Solo fijaba la región de las funciones de servidor; el hosting depende de D5 |
| Vitest + Testing Library + jest-axe + jsdom | **Conservar** | Base de tests de lógica y componentes |
| Playwright | **Conservar y adaptar** | Único sitio donde se prueba el render real (canvas) |
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
la CSP y Electron. **Confirmada** el 2026-09-29 y **aplicada en la Fase 2**. *(Las menciones
a Electron de esta sección son históricas: Electron se canceló el 2026-10-03, D19.)*

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
└──────────────────────────────────────────────────────────────────────┘
```

Reglas:

1. **Solo `src/platform/` sabe en qué plataforma corre.** El resto del código recibe un
   objeto `Platform` y nunca toca rutas de disco ni las APIs de ficheros del navegador.
2. **Los motores no conocen React.** `pdf/engine.ts` y `markdown/pipeline.ts` son módulos
   puros o casi (entrada: bytes/texto; salida: objetos), probables sin montar nada.
3. **La app nunca ve rutas de ficheros**: ve
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
// id: opaco, válido solo en esta sesión (un contador)
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
  ([ARCHITECTURE.md](ARCHITECTURE.md) §4 sexies). Sin `capabilities`: en la Fase 9 todo
  Markdown se puede editar y guardar (la plataforma decide cómo, `Platform.saveText`), así
  que no hizo falta ningún campo. No se diseñan campos sin uso.

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
  `unsupported`, `empty`, `too-large`, `not-pdf`, `not-utf8`, `unreadable` y, desde la
  Fase 7 bis (sustituyen al antiguo `multiple`), `no-markdown`, `several-markdown`,
  `incompatible`, `folder-no-markdown`, `folder-too-large` y `mixed-drop`; cada uno con su
  texto en `messages.ts` (§9.3).
- **Un documento a la vez en v1** (D16, confirmada). Abrir otro lo sustituye; si la
  apertura falla, el documento abierto se conserva. Con cambios sin guardar (✅ F9), toda
  sustitución y cerrar piden confirmación después de validar lo nuevo y antes de aplicarlo
  ([ARCHITECTURE.md](ARCHITECTURE.md) §4 octies). El estado vive en
  [`DocumentProvider`](../src/documents/DocumentProvider.tsx): pestañas o varios
  documentos cambiarían ese estado, no el modelo.

### 4.3 Estructura objetivo de `src/`

Lo marcado ✅ existe (el detalle, fichero a fichero, en [STRUCTURE.md](STRUCTURE.md)); el
resto son rutas **propuestas** que la fase que las crea concreta allí.

```text
src/
├── main.tsx                 ✅ arranque: monta <App/> dentro del ErrorBoundary
├── app/                     ✅ App.tsx (shell) · EmptyState.tsx · ErrorBoundary.tsx · DropZone.tsx ·
│                            ElegirMarkdown.tsx · pdf/ (interfaz del visor PDF: VisorPdf.tsx, Visor.tsx,
│                            barras, miniaturas, atajos.ts, estado.ts; F5, F6)
├── config/                  ✅ project.ts · security-headers.ts · public-site.ts
├── i18n/messages.ts         ✅ todos los textos visibles (D2)
├── styles/                  ✅ globals.css (tokens + Tailwind) · visor-pdf.css · markdown.css
├── components/ui/           ✅ primitivos accesibles (Button, Field, Input)
├── documents/               ✅ F3, F7 bis: tipos, detección, límites, errores, lectura, recursos, estado
├── platform/                ✅ F3: types.ts · web.ts · guardar-web.ts (F9) · index.ts
├── pdf/                     ✅ F4–F5, sin React: engine.ts · render.ts · dark/ (modo oscuro) ·
│                            visor/ (disposición, búsqueda, enlaces, controladores)
├── markdown/                ✅ F7–F8: pipeline.ts · MarkdownView.tsx · url-policy.ts · toc.ts ·
│                            matematicas.ts · mermaid*.ts · svg-seguro.ts · imagenes.ts ·
│                            components/ (BloqueCodigo, Enlace, Imagen, Formula, Diagrama, Indice…)
├── editor/                  ✅ F9: EditorMarkdown.tsx (CodeMirror 6, a demanda) · ModeSwitch.tsx ·
│                            SplitView.tsx · sincronia.ts · tipos.ts
└── preferences/             ✅ F10: esquema zod, almacén versionado, hook, posiciones, diálogo
```

## 5. Apertura de documentos

| Vía | Web |
|---|---|
| Selector | ✅ F3: `<input type="file">` creado al vuelo (fuera del DOM) por el botón «Abrir archivo»; `Ctrl/Cmd+O`. ✅ F7 bis: **selección múltiple** (un documento suelto, o un `.md` con sus imágenes; el filtro admite también PNG, JPEG, GIF, WebP y SVG) |
| Carpeta | ✅ F7 bis: botón «Abrir carpeta», `<input type="file" webkitdirectory>`; con varios `.md`, el usuario elige |
| Arrastrar y soltar | ✅ F3: zona a pantalla completa con manejadores de React sobre la raíz de la app (sin listeners en `window`). ✅ F7 bis: varios ficheros (un `.md` con sus imágenes) o una carpeta (`webkitGetAsEntry`, capturado dentro del evento) |
| Guardar (Markdown) | ✅ F9: `showSaveFilePicker` si existe (Chromium; el usuario elige destino la primera vez, el handle vive en memoria), si no descarga con `<a download>` y Blob. Nunca se sobrescribe en silencio el fichero abierto |

La interfaz `Platform` existe desde la Fase 3 con la
implementación web ([`src/platform/`](../src/platform/)). Hoy: `pickDocument()`,
`pickFolder()`, `openDropped(soltado)`, `openExternal(url)` y `saveText` (Fase 9). Todo termina
en la misma validación (`abrirSeleccion` → `readDocument`, [ARCHITECTURE.md](ARCHITECTURE.md)
§4 sexies). La web es la única implementación (D19: sin escritorio); la frontera se
conserva porque aísla las APIs de ficheros del navegador del resto de la app. **Abrir desde
una URL no se hará:** rompería el principio de privacidad.

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
| Imágenes locales | No | Componente `Imagen` que resuelve contra `resources` (`resolverRecurso`) → URL `blob:` (§7.2). Aplazadas en la Fase 7, **implementadas en la 7 bis** | Medio (SVG, rutas) | — | ✅ 7 bis |
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
§4 sexies). Resumen:

- **Locales en web:** un fichero suelto no da acceso a sus hermanos. Se resuelven si el
  usuario **suelta o elige varios ficheros** (el `.md` y sus imágenes) o una carpeta
  (`webkitdirectory` / `webkitGetAsEntry`). Rutas relativas normalizadas; nunca salen
  del conjunto entregado. Si no está, un marcador «imagen no disponible».
- **SVG:** solo como `<img>` (nunca en línea): en `<img>` un SVG no ejecuta scripts ni
  carga recursos externos.
- **Remotas (`https://…`): bloqueadas en v1** (D7). Cargar una imagen remota revela a un
  tercero la IP y el momento de lectura (píxeles espía) y obliga a abrir la CSP. Se
  muestra el texto alternativo y el enlace.

### 7.3 Edición (✅ Fase 9, aprobada con una excepción de rendimiento)

Modos: **lectura**, **edición**, **dividido** (editor + vista previa con desplazamiento
sincronizado por encabezados). Editor: **CodeMirror 6** (D9, confirmada; MIT, modular,
virtualiza documentos grandes, historial; cargado solo al entrar en edición, en un Shadow
DOM para no tocar la CSP). Vista previa: el mismo lector, refrescado 200 ms después de la
última tecla; en un documento caro de pintar (> 250 ms), en dividido se pausa y se
actualiza a mano (decisión de la F9: con 1 MB, cada refresco bloqueaba la escritura
segundos). Guardado explícito (`Ctrl/Cmd+S` o botón), confirmación antes de perder
cambios y `beforeunload`. Sin autoguardado ni borradores en v1. Diseño:
[ARCHITECTURE.md](ARCHITECTURE.md) §4 octies. **Excepción aceptada al aprobar la fase:**
en Dividido, teclear con 1 MB + KaTeX o con 1 MB de encabezados supera los objetivos de
latencia (cifras en [FASES.md](FASES.md), Fase 9).

## 8. Persistencia y privacidad

Todo en `localStorage` del origen de la app. Sin cookies: no hay servidor que las lea.

Implementación: **Fase 10**, cerrada y aprobada el *2026-10-03*. Especificación y esquemas exactos en [FASES.md](FASES.md), Fase 10; diseño en
[ARCHITECTURE.md](ARCHITECTURE.md) §4 nonies. Decisiones del *2026-10-03* reflejadas en la
tabla.

| Dato | ¿Se guarda? | Clave / forma | Motivo |
|---|---|---|---|
| Modo de página PDF (oscura/original) por defecto | Sí | `bpdf:prefs` | Preferencia visual |
| Zoom y vista (continua/página) por defecto del PDF | Sí | `bpdf:prefs` | Preferencia del visor |
| Panel de miniaturas abierto o cerrado | Sí (el último estado) | `bpdf:prefs` | Preferencia del visor |
| Tamaño de letra y ancho de columna de Markdown | Sí | `bpdf:prefs` | Lectura |
| Atajos de una sola tecla activados | Sí | `bpdf:prefs` | WCAG 2.1.4 |
| Recordar la posición de los PDF (activado o no) | Sí | `bpdf:prefs` | D8 |
| Última página y zoom **por PDF** | **Sí, activado por defecto (D8 ✅)**; se puede desactivar y olvidar | `bpdf:positions`: `{ v: 1, docs: { [huella]: { page, zoom, t } } }`, máx. 50 entradas LRU | Útil, pero es un historial de lectura: guarda una huella (no el nombre ni el contenido) |
| Posición en un Markdown | **No** (decisión del *2026-10-03*) | — | Un Markdown no tiene páginas, y su huella cambiaría al editarlo |
| Opciones de búsqueda del PDF (mayúsculas, palabra completa) | **No** (decisión del *2026-10-03*) | — | Estado de la sesión del visor |
| Estado del editor (modo Lectura/Edición/Dividido, separador) | **No** (decisión del *2026-10-03*) | — | Fuera de la Fase 10 |
| Nombres de ficheros, rutas, historial de abiertos | **No** | — | Privacidad |
| Contenido de documentos | **No** | — | Principio rector |
| Contraseñas de PDF | **No** | — | D13 |
| Borradores sin guardar del editor | **No en v1** | — | Se reevalúa si hay demanda (sería contenido) |

- **Huella de documento:** `pdfDocument.fingerprints[0]` en PDF (lo calcula pdf.js a
  partir del ID del fichero). Nunca el nombre. Los Markdown no tienen huella: no se guarda
  su posición, así que no se calcula ningún SHA-256 de su texto.
- **Esquema versionado** con `zod`: `{ v: 1, … }` en las dos claves, con una tabla de
  migraciones paso a paso (vacía en la v1, que es la primera). Un valor corrupto se
  descarta (campo a campo en `bpdf:prefs`) y se usan los valores por defecto; una versión
  futura se ignora en memoria sin reescribirla (nunca rompe el arranque). Todo acceso a
  `localStorage` va en `try/catch` (modo privado, cuota, bloqueo).
- **Borrar:** en el diálogo de preferencias (botón «Preferencias» de la cabecera, también
  sin documento), **«Olvidar posiciones guardadas»** (borra `bpdf:positions`) y
  **«Restablecer preferencias»** (borra `bpdf:prefs`). Desactivar «recordar» deja de leer y
  escribir posiciones sin borrarlas.

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
| Coincidencias de búsqueda (PDF) | `--rgb-accent` al 30 % / al 65 % con contorno | Coincidencia / coincidencia activa, en [`visor-pdf.css`](../src/styles/visor-pdf.css) (Fase 5). **Sin tokens propios**: los `--rgb-find` / `--rgb-find-current` que preveía este plan no se crearon, y la Fase 6 no los necesita (sus opciones de búsqueda no cambian el resaltado) |
| `--rgb-link` | `128 182 255` | Enlaces de un Markdown (Fase 7): 4,5:1 sobre `page` |
| `--rgb-code-*` | 8 colores de sintaxis | Cada uno ≥ 4,5:1 sobre el fondo de bloque de código (Fase 7) |

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
- **PDF** (✅ F5): barra (miniaturas, página n/N, zoom, ajustar, girar, vista, página
  oscura/original, buscar, cerrar); panel de miniaturas a la izquierda. ✅ F6: girar a la
  izquierda, pantalla completa (del área de lectura), ayuda de atajos, opciones de búsqueda
  (mayúsculas, palabra completa) y el diálogo de contraseña.
- **Markdown** (✅ F7–F9): barra (índice, modos lectura/edición/dividido, «Sin guardar»,
  guardar, cerrar); índice a la izquierda en lectura; hoja centrada con ancho de lectura
  (~72 caracteres); en dividido, editor y vista previa con un separador. Tamaño de letra y
  ancho de columna: preferencias (✅ F10).
- **Cabecera** (✅ F3, F10, F11): el nombre del producto; con un documento abierto, «Abrir
  carpeta» y «Abrir archivo»; siempre, «Preferencias» (solo el icono en pantalla estrecha).
  Su diálogo termina con **«Acerca de»** (✅ F11): versión, licencia y la frase de
  privacidad, sin enlace al repositorio hasta la Fase 16.
- **Título de la ventana** (✅ F11): siempre «BPDF», **nunca el nombre del documento**: el
  navegador guarda el título de cada visita en su historial (y lo sincroniza si se usa una
  cuenta), y eso sería guardar un nombre de fichero (CLAUDE.md §4).
- **Favicon** (✅ F11): `public/favicon.svg`, una hoja con la esquina doblada en los colores
  de los tokens, servida desde el propio origen.
- **Mención al pie** (✅ F11), solo en la pantalla vacía: «BPDF · Gratis y open source ·
  Creado por R3ZON con ❤️», con «R3ZON» enlazado a `https://r3zon.com` por
  `Platform.openExternal`. Con un documento abierto no aparece: no quita espacio al visor.
  BPDF se publica hoy en `https://bpdf.r3zon.com` (la URL en uso; formalizarla es D5, Fase 15).
- **Errores:** fichero no soportado, demasiado grande, PDF dañado, Markdown no UTF-8 y los
  de la apertura de varios ficheros o carpetas (F7 bis). Cada uno con texto claro y sin
  detalles técnicos crudos. Los de apertura (✅ F3) se muestran como aviso
  (`role="alert"`) que se puede descartar, sin cerrar el documento abierto; «PDF dañado»
  lo dice el visor (✅ F5). Un PDF con contraseña la pide en un diálogo (D13, ✅ F6).

La vista provisional de la Fase 3 (nombre, tipo y tamaño) se retiró en la Fase 7, cuando
los dos visores existían.

### 9.4 Atajos de teclado

| Acción | Atajo | Fase |
|---|---|---|
| Abrir | `Ctrl/Cmd+O` | ✅ F3 |
| Buscar / siguiente / anterior | `Ctrl/Cmd+F` · `Enter` / `Shift+Enter` en el campo | ✅ F5 |
| Siguiente / anterior coincidencia | `F3` / `Shift+F3` (con la barra de búsqueda abierta) | ✅ F6 |
| Zoom + / − / 100 % | `Ctrl/Cmd +` · `Ctrl/Cmd −` · `Ctrl/Cmd 0`; `Ctrl/Cmd`+rueda | ✅ F5 |
| Página siguiente / anterior | `PageDown` / `PageUp` | ✅ F5 |
| Página siguiente / anterior | `→` / `←` (solo en «página a página») · `Espacio` / `Shift+Espacio` | ✅ F6 |
| Primera / última página | `Home` / `End` | ✅ F5 |
| Desplazar (en «página a página», en el borde pasa de página) | `↓` / `↑` | ✅ F5 |
| Ir a página | `Ctrl/Cmd+G` (enfoca el campo de página) | ✅ F6 |
| Girar a la derecha / a la izquierda | `R` / `Shift+R` * | ✅ F6 |
| Mostrar u ocultar miniaturas (PDF) | `T` * | ✅ F6 |
| Pantalla completa (entrar o salir) | `F` * (salir también con `Esc`, del navegador) | ✅ F6 |
| Ayuda de atajos | `?` * | ✅ F6 |
| Guardar (Markdown) | `Ctrl/Cmd+S` | ✅ F9 |

\* Atajos de una tecla (WCAG 2.1.4): solo actúan con el foco fuera de campos de texto y
elementos editables, y se pueden **desactivar** con un interruptor en la ayuda (`?`, que
también se abre desde un botón de la barra); guardado en las preferencias desde la Fase 10. En web, `Ctrl/Cmd +/−` sustituyen al zoom del navegador **solo dentro del
visor**. Reglas completas y excepciones (`F3` en el campo de búsqueda, `Espacio` sobre un
botón): [FASES.md](FASES.md), Fase 6.

**Sin atajo por ahora** (se quitaron de esta tabla al especificar la Fase 6, que no los
incluye): `I` para página oscura/original, y `T` para el índice de un Markdown. Volverán
solo con una fase que los especifique.

**Estado (*2026-10-03*).** Implementados los marcados ✅ (tabla y motivo en
[ARCHITECTURE.md](ARCHITECTURE.md) §4 quater), los de las Fases 6 y 9 incluidos. No queda ninguno (`F11` era de la versión de escritorio,
cancelada: D19).

### 9.5 Lista de revisión de la interfaz (Fase 11)

La pasada de la Fase 11 recorre esta lista en cada pantalla (vacía, PDF con su búsqueda,
miniaturas y diálogos, Markdown en sus tres modos, cambios sin guardar, preferencias). Lo
que se puede medir tiene test; el resultado de la pasada está en la bitácora.

1. **Espaciado y tamaños.** Botones de barra de 32 px (`h-8`, `.md-boton`), separación
   `gap-1`/`gap-2`; diálogos con el mismo marco (`bg-elevated`, borde, `p-4`).
2. **Áreas de pulsación** ≥ 24 × 24 px en todo control de la interfaz (WCAG 2.5.8; D12).
   No cuenta el contenido del documento (enlaces del texto, anotaciones del PDF). E2E.
3. **Pantalla estrecha** (D12): sin desplazamiento horizontal a 375 px en ninguna pantalla;
   las barras se reparten en varias líneas; sin gestos propios. E2E.
4. **Estados:** carga anunciada (`role="status"`), errores (`role="alert"`), modos con
   `aria-pressed` y texto visible, deshabilitados atenuados.
5. **Iconografía:** solo `lucide-react`, `size-4`, `aria-hidden`; ningún icono sin nombre
   accesible en su botón.
6. **Atajos:** todo botón con atajo lo anuncia en `title` y `aria-keyshortcuts`; los de
   una tecla, solo si están activados (preferencia). El nombre accesible no cambia.
7. **Textos:** todos en `messages.ts`, el mismo tono y la misma forma de escribir las
   teclas (una sola tabla, `messages.keys`).
8. **Movimiento:** nada se anima salvo el indicador de carga, anulado con
   `prefers-reduced-motion`; ningún desplazamiento suave.
9. **Identidad y título:** favicon del propio origen; el título de la ventana no cambia.
10. **Color:** solo tokens (el favicon también, con su test); contraste con su test.

## 10. Accesibilidad

Objetivo **WCAG 2.2 AA**.

- Todo operable con teclado; orden de foco lógico; foco visible con `--rgb-accent`.
- Barra con `role="toolbar"` (la **navegación con flechas** entre sus botones **no existe**:
  cada botón es una parada de Tab; se evalúa en la Fase 13, decisión de la Fase 11); campo de
  página con etiqueta; región
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
- Virtualización de páginas **propia** (D17: sin `PDFViewer`; visibles ±1 y presupuesto
  de memoria) y tope de píxeles por lienzo (16,7 Mpx, DPR ≤ 2) para no agotar memoria con
  zoom alto. ✅ F5 ([ARCHITECTURE.md](ARCHITECTURE.md) §4 quater).
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
| Unitario | Vitest (`node`) | Detección de tipo y límites; política de URLs; slugs y TOC; esquema y migración de preferencias; huellas; mapeo de color del modo oscuro (función pura); cálculo de regiones de imagen a partir de un operator list sintético; contraste de tokens |
| Componentes | Vitest + jsdom + Testing Library + jest-axe | Barra de herramientas, estado vacío, errores, `MarkdownView` con el corpus de XSS, `CodeBlock` (copiar), TOC, preferencias |
| Seguridad | Vitest | **Corpus de XSS de Markdown** ([SEGURIDAD.md](SEGURIDAD.md) §3.3): el DOM resultante no contiene `<script>`, atributos `on*`, `href`/`src` con protocolos no permitidos, `<iframe>`, `<object>`, `<embed>`, `<svg>` en línea |
| Render real | Playwright (Chromium) | PDF: páginas, navegación, zoom, búsqueda, selección y copia, enlaces, rotación; **muestreo de píxeles** del modo oscuro (fondo oscuro, texto claro, región de imagen con sus colores originales) sobre fixtures conocidos |
| Casos límite | Vitest + Playwright | PDF vacío, truncado, no-PDF con extensión `.pdf`, cifrado, con JavaScript, con enlaces `javascript:`/`file:`/`launch`; Markdown no UTF-8, enorme, con anidamiento patológico |
| E2E | Playwright | Recorridos: abrir por selector y por arrastre; PDF → buscar → ir a página; Markdown → editar → guardar (descarga); CSP sin violaciones (escucha de `securitypolicyviolation`) |

**Fixtures** en `tests/fixtures/` (PDF y Markdown pequeños, generados o creados a mano,
con su procedencia y licencia en un `README.md` del directorio). Nunca documentos de
terceros sin licencia clara.

## 13. Build, distribución, open source y mantenimiento

- **Build web:** `vite build` → `dist/` estático + recursos de pdf.js copiados. Hosting
  estático con cabeceras (D5): la CSP y demás cabeceras se definen en un único fichero
  fuente (`src/config/security-headers.ts`) y se generan para el hosting (`vercel.json`,
  `npm run cabeceras:vercel`, desde la iteración 11).
- **Sin escritorio** (D19): ni empaquetado, ni instaladores, ni firma de binarios.
- **Open source** (Fase 16): `LICENSE` (D3), `README.md` del producto, `CONTRIBUTING.md`,
  `SECURITY.md` (reporte privado por GitHub Security Advisories), `CODE_OF_CONDUCT.md`
  (Contributor Covenant), plantillas de issue/PR, `docs/` como documentación de
  arquitectura, `CHANGELOG` de versiones para usuarios (distinto de la bitácora interna,
  CLAUDE.md §8), política de dependencias.
- **Política de dependencias:** cada dependencia de runtime justificada en `STACK.md` (el
  test `tests/unit/docs.test.ts` ya lo exige); versiones **exactas** para los motores que
  procesan contenido no confiable (`pdfjs-dist`, `katex`, `mermaid`, `highlight.js`);
  `npm ci` siempre; `allowScripts` de npm 11 (cada script de instalación se aprueba o se
  deniega a mano); `npm audit` semanal; actualizar pdf.js en cuanto publique una
  corrección de seguridad.
- **Mantenimiento:** revisar avisos de seguridad de pdf.js, KaTeX y Mermaid.

## 14. Decisiones

### 14.0 Confirmadas (*2026-09-29*; D16 al empezar la Fase 3; D17 y D18 al empezar la Fase 5; D6 y D7 con la Fase 7; D13 al especificar la Fase 6; D9 al empezar la Fase 9; D8 al especificar de nuevo la Fase 10; D19 el *2026-10-03*; D10 y D12 al empezar la Fase 11)

| ID | Decisión | Dónde se aplica |
|---|---|---|
| **D1** | **Vite + React** en lugar de Next.js ([§3](#3-framework-vite--react-en-lugar-de-nextjs-d1)) | Fase 2 |
| **D2** | Interfaz en **español** en v1, con todos los textos en **un único módulo de mensajes** para facilitar otros idiomas | Fase 2 en adelante |
| **D3** | Licencia **Apache-2.0** | Fase 1: `LICENSE` (texto canónico de apache.org) y `license` en `package.json` |
| **D4** | Documentación pública **en el Docusaurus de R3ZON** (`docs.r3zon.com/bpdf`), sin que BPDF dependa de ese repositorio para compilar ni probar | Fase 1: se conserva `public_docs/` y su validador |
| **D15** | BPDF **se separa del core SaaS** de la plantilla; conserva solo infraestructura, tooling y componentes útiles | Fase 1: registro de origen en `docs/TEMPLATE.md` (el manifiesto `r3zon-template.json` se retiró antes de publicar) |
| **D16** | **Un documento abierto a la vez**: sin pestañas, varios documentos, historial, recientes ni gestor de documentos. La arquitectura no lo impide más adelante | Fase 3: `DocumentProvider` guarda uno; abrir otro lo sustituye ([§4.2](#42-modelo-de-documento)) |
| **D17** | **Visor PDF propio** sobre la API núcleo de pdf.js, sin `PDFViewer` ni `pdfjs-dist/web/pdf_viewer` (confirmada al empezar la Fase 5) | Fase 5: `src/pdf/visor/`, `src/app/pdf/` ([ARCHITECTURE.md](ARCHITECTURE.md) §4 quater) |
| **D18** | Build **`legacy`** de pdf.js en web (confirmada al empezar la Fase 5) | Fase 5: `engine.ts` y el worker copiado ([STACK.md](STACK.md)) |
| **D6** | HTML embebido en Markdown **no se interpreta** en v1: se **muestra como texto** (los comentarios `<!-- -->` se quitan). Confirmada con el encargo de la Fase 7, y la forma («mostrarlo como texto», no «ignorarlo») con el de la Fase 7 bis | Fase 7: `src/markdown/pipeline.ts` |
| **D7** | Imágenes remotas en Markdown **bloqueadas** en v1: marcador y enlace para abrirla fuera (confirmada con el encargo de la Fase 7) | Fase 7: `components/Imagen.tsx`; CSP `img-src 'self'` |
| **D13** | PDFs con contraseña **soportados** con un diálogo accesible: reintento, cancelar cierra el documento, la contraseña no se guarda (confirmada al especificar la Fase 6, *2026-09-30*) | Fase 6: `engine.ts`, `VisorPdf.tsx` ([FASES.md](FASES.md)) |
| **D9** | Editor de Markdown: **CodeMirror 6** (frente a `<textarea>`; confirmada al empezar la Fase 9, *2026-10-01*) | Fase 9: `src/editor/` ([ARCHITECTURE.md](ARCHITECTURE.md) §4 octies) |
| **D8** | Recordar página y zoom **por PDF**: **activado por defecto**, con la huella de pdf.js (no el nombre), máx. 50 entradas (LRU), botón «Olvidar posiciones guardadas»; sin nombres ni contenido. Solo PDF: los Markdown no guardan posición (confirmada el *2026-10-03*) | Fase 10: `src/preferences/positions.ts` ([§8](#8-persistencia-y-privacidad), [FASES.md](FASES.md)) |
| **D10** | **Sin tema claro en v1**: solo el tema oscuro (en PDF sigue la «página original»). Sin infraestructura para un tema claro (confirmada al empezar la Fase 11, *2026-10-03*) | Fase 11 |
| **D12** | Móvil y tablet: **adaptación básica**, no una experiencia móvil propia: sin desplazamiento horizontal a 375 px, controles ≥ 24 px, barras que se reparten, sin gestos ni zoom con los dedos nuevos (confirmada al empezar la Fase 11) | Fase 11: E2E `interfaz.spec.ts` |
| **D19** | **BPDF es solo una aplicación web: sin versión de escritorio (Electron) ni sustituto.** Decisión de producto del usuario (*2026-10-03*). Sustituye toda la planificación anterior de Electron | La Fase 14 se cancela; la 15 se reescribe solo para la web; D11 y T-5 dejan de aplicar; [ELECTRON.md](ELECTRON.md) queda como histórico |

### 14.1 Pendientes de confirmación (usuario)

| ID | Decisión | Recomendación | Afecta a |
|---|---|---|---|
| **D5** | Hosting web y dominio | Hosting estático que permita cabeceras (Vercel o Cloudflare Pages). GitHub Pages **no** permite cabeceras (CSP solo por `<meta>`, sin `frame-ancestors`). *De hecho, la web ya está publicada en Vercel (`bpdf.r3zon.com`) con `vercel.json` generado ([DEPLOYMENT.md](DEPLOYMENT.md)); falta formalizarla y cambiar el dominio de `project.ts`* | Fases 12 y 15 |
| ~~**D11**~~ | ~~Escritorio: plataformas, firma de código, auto-actualización~~ | **Ya no aplica** (D19: sin escritorio) | — |
| **D14** | Formularios y anotaciones de PDF | Solo se muestran; no se rellenan ni se editan. *Aplicado así en la Fase 5 (apariencias pintadas en el lienzo, sin interacción), que excluía formularios: falta confirmarlo* | Fase 5 |

### 14.2 Técnicas, resueltas por una fase

| ID | Decisión | La resuelve |
|---|---|---|
| **T-1** | Estrategia de modo oscuro del PDF y, con ella, `PDFViewer` frente a visor propio. **Resuelta en la Fase 4:** recoloreado selectivo con las regiones de `recordImages`; exige visor propio sobre la API núcleo (D17, confirmada; [PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md) §11–12) | Fase 4 ✅ |
| **T-2** | `@vitejs/plugin-react` sí o no. **Resuelta en la Fase 2: no** (Vite transforma el JSX solo; se renuncia a Fast Refresh; [STACK.md](STACK.md)) | Fase 2 ✅ |
| **T-3** | `style-src` sin `'unsafe-inline'`. **Desde la Fase 2 la CSP ya no lo lleva.** pdf.js y KaTeX no lo necesitan (KaTeX, quitando el `style` que pone por atributo). **Mermaid sí**: resuelto en la Fase 8 sin tocar la CSP de la app, con un marco aislado que tiene su propia política (confirmado al empezar la fase; [SEGURIDAD.md](SEGURIDAD.md) §2.1) | Fases 4–8 ✅; cierre en la 12 |
| **T-4** | Trusted Types (`require-trusted-types-for 'script'`) viable con pdf.js y Mermaid | Fase 12 |
| ~~**T-5**~~ | ~~Electron Forge frente a electron-builder~~. **Ya no aplica** (D19: sin escritorio) | — |

## 15. Riesgos

### Técnicos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| El modo oscuro no alcanza calidad aceptable en PDFs reales | Media | Alto (es la razón de ser) | Spike con corpus variado antes de construir el visor; selector «original» siempre disponible; limitaciones documentadas |
| Coste del post-proceso por píxel en páginas grandes o zoom alto | Media | Medio | Medido (F4 y F5): recoloreado en un Web Worker con franjas transferidas; tope de 16,7 Mpx por lienzo y DPR ≤ 2 |
| Cambios de API de pdf.js entre mayores (6.x → 7.x) | Alta a medio plazo | Medio | Versión exacta; todo el acoplamiento en `src/pdf/`; tests de render en Playwright |
| Peso de Mermaid (varios MB) y KaTeX | Alta | Medio | Carga diferida; fase aparte; medir |
| TypeScript 7 con alguna herramienta nueva (Vite) | Baja | Bajo | Salida documentada en la plantilla: fijar TS 6 |
| Imágenes locales de Markdown en web (sin acceso a hermanos) | Cierta | Bajo | Soltar varios ficheros o carpeta (✅ Fase 7 bis) |

### De seguridad

Detalle en [SEGURIDAD.md](SEGURIDAD.md). Los principales: XSS vía Markdown (Mermaid y
KaTeX son los puntos débiles históricos), vulnerabilidades del parser de pdf.js
(precedente: CVE-2024-4367, ejecución de JS por fuentes, corregida en 4.2.67) y fuga de
privacidad por recursos remotos.
