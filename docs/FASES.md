# BPDF — Plan de implementación por fases

> **Fuente de verdad del desarrollo** junto con [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md)
> (qué fase está abierta, en curso o cerrada). Escrito en la Fase 0 (*2026-09-29*). El
> diseño que estas fases construyen está en [PLAN.md](PLAN.md), [SEGURIDAD.md](SEGURIDAD.md)
> y [ELECTRON.md](ELECTRON.md).

## Cómo usar este documento (para cada sesión)

1. Lee [`CLAUDE.md`](../CLAUDE.md), después la fase que vas a ejecutar **entera** y las
   secciones de PLAN/SEGURIDAD/ELECTRON que cita.
2. Comprueba en [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) que sus dependencias están
   cerradas y que las decisiones **D-n** que necesita están confirmadas. Si una no lo
   está, **pregunta antes de empezar** (CLAUDE.md §1).
3. Marca la fase `[~]` en TAREAS al empezar.
4. Al terminar, se cumple la **definición de hecho común** (abajo) más los criterios de
   la fase. Se escribe la entrada de la bitácora, se actualiza TAREAS («Estado hoy»,
   borrar la fase, añadir lo que haya salido) y **se corrige este documento** si la fase
   descubrió algo que cambia fases posteriores.
5. Sin commit ni push sin autorización explícita (CLAUDE.md §2).

**Definición de hecho común a todas las fases** (CLAUDE.md §3, adaptado a BPDF sin base de
datos): `npm run lint`, `npm run typecheck`, `npm run test:run` y `npm run build` en
verde; test nuevo de lo nuevo; `npm run test:e2e` en verde si la fase toca UI o recorridos;
`npm run docs:enlaces` en verde; bitácora, TAREAS y documentos afectados al día; cambios
visibles para el usuario anunciados al entregar (CLAUDE.md §8).

## Orden y por qué difiere del propuesto

```text
F0 ─► F1 ─► F2 ─┬─► F3 ─┬─► F5 ─► F6 ──────────────┐
                │       │    ▲                     │
                └─► F4 ─┼────┘                     ├─► F10 ─► F11 ─► F12 ─► F13 ─► F14 ─► F15 ─► F16
                        └─► F7 ─► F8 ─► F9 ────────┘
```

| # | Fase | Cambio respecto al orden propuesto y motivo |
|---|---|---|
| 0 | Auditoría y planificación | — |
| 1 | Limpieza de la plantilla | Igual. Incluye el fichero `LICENSE` (D3): el repo no debe crecer sin licencia |
| 2 | Base de la app | Absorbe la **CSP base** y la estructura preparada para Electron. La capa `platform/` y la infraestructura de preferencias, previstas aquí, se aplazaron a su primer uso (F3 y F10) |
| 3 | Apertura local de archivos | Igual |
| 4 | **Spike: modo oscuro de PDF** | **Nueva.** Es el mayor riesgo técnico y decide la arquitectura del visor (T-1). Se hace antes de construir el visor, no después |
| 5 | Visor PDF: núcleo | El visor propuesto se divide en dos sesiones (5 y 6) por tamaño |
| 6 | Visor PDF: miniaturas, búsqueda, atajos, pantalla completa | |
| 7 | Markdown: lectura | Igual; incluye su parte de seguridad (sanitización, URLs) |
| 8 | Markdown: matemáticas y Mermaid | **Separada** de la 7: son las dos dependencias más pesadas y con más historial de vulnerabilidades |
| 9 | Editor Markdown + vista previa + dividido | Igual |
| 10 | Preferencias | Infraestructura, panel, memoria por documento y borrado. La infraestructura estaba prevista en la F2 y se aplazó aquí, a su primer uso real |
| 11 | UI/UX final | Igual |
| 12 | Seguridad: endurecimiento y auditoría | Ya no «añade» seguridad: cada fase implementa la suya. Aquí se verifica, se endurece (CSP final, Trusted Types) y se audita |
| 13 | Accesibilidad y rendimiento | Los tests viven en cada fase; esta fase **mide** con el corpus grande y corrige |
| 14 | Electron: aplicación | «Preparación» + «implementación» se funden: la preparación ya se hizo en F2 |
| 15 | Distribución: web y escritorio | Incluye la publicación web (antes no tenía fase) |
| 16 | Open source y documentación final | Igual; la licencia ya existe desde F1 |

Paralelizables (si hay dos sesiones a la vez): **F4** con **F3**; **F7–F9** con **F5–F6**.
Todas tocan `src/App.tsx` en un punto (montar el visor): conflicto pequeño y conocido.

---

## Fase 0 — Auditoría y planificación ✅

Cerrada el 2026-09-29. Resultado: [PLAN.md](PLAN.md), [SEGURIDAD.md](SEGURIDAD.md),
[ELECTRON.md](ELECTRON.md), este documento y TAREAS. Bitácora: iteración 2.

---

## Fase 1 — Limpieza de la plantilla ✅

Cerrada el 2026-09-29. Bitácora: iteración 3. Resultado: sin Supabase, Prisma, auth,
Sentry, Speed Insights, logger de servidor, `/api/health` ni variables de entorno;
identidad de BPDF; `LICENSE` Apache-2.0; `public_docs/` conservado (D4) con portada
«próximamente»; CI sin base de datos; documentación reescrita para el estado real.

**Desviaciones respecto a la especificación**, por si una fase posterior se apoya en ella:

- **`zod` se retiró** (la especificación lo daba por conservado): solo lo usaban la auth y
  `env.ts`. La Fase 2 lo reinstala.
- **`vercel.json` se borró**: solo fijaba la región de funciones de servidor. La
  configuración del hosting la crea la fase que la necesite, según D5.
- **`comprobarDerivacion` y sus tests se retiraron** con `supabase/config.toml`: vigilaban
  los puertos de Supabase y la auditoría de la plantilla, que ya no existen (D15).
  `r3zon-template.json` queda como registro de origen, sin `reservadoPorLaPlantilla`.
- **`NEXT_PUBLIC_SITE_URL` desaparece**: `siteUrl()` usa `project.domain`.
- **`modules/` se borró** sin conservar una copia: `docs/MODULES.md` explica por qué no
  aplica ningún módulo.
- El dominio sigue siendo `app.example.com` (D5 pendiente), en `project.ts` y `_meta/`.

---

## Fase 2 — Base de la app ✅

Cerrada el 2026-09-29. Bitácora: iteración 4. Resultado: SPA **estática** de Vite 8 +
React 19 (sin Next, servidor, SSR, API ni variables de entorno); shell accesible (enlace
de salto, `header`, `main`, estado vacío, `ErrorBoundary`); tokens de diseño de PLAN
§9.2 con test de contraste; textos en `src/i18n/messages.ts` con test que detecta texto
suelto; CSP estricta y cabeceras desde `src/config/security-headers.ts` (cabecera en
`vite preview` y `<meta>` en la build); `robots.txt` y `sitemap.xml` generados desde
`project.ts`; validador de `public_docs/` adaptado a Vite; Playwright contra `vite
preview` con vigilancia de consola, CSP y red; `npm run build:tamano` en CI (arranque:
80 KB gzip).

**Desviaciones respecto a la especificación**, por si una fase posterior se apoya en ella:

- **No se creó `src/platform/`** (pasa a la **Fase 3**): su única función real hoy sería
  `openExternal`, sin ningún uso, y la sesión pidió no crear abstracciones para
  funciones que no existen. La Fase 3 la crea con su primer uso real (`pickFiles`).
- **No se creó la infraestructura de preferencias ni se reinstaló `zod`** (pasan a la
  **Fase 10**): la sesión excluyó la persistencia de preferencias. Hasta entonces, los
  ajustes de las fases 5–9 (modo de página, atajos de una tecla…) viven en memoria con
  su valor por defecto.
- **Sin botón «Abrir» deshabilitado** en la barra: un botón que no hace nada es interfaz
  falsa. Lo añade la Fase 3 funcionando.
- **Shell en `src/app/`** (no `src/components/app/`): `src/app/` es la aplicación y
  `src/components/` los primitivos reutilizables.
- **`style-src` sin `'unsafe-inline'`**, que el diseño daba por necesario: no hizo falta
  (T-3 avanza; ver SEGURIDAD §2.1).
- **Sin favicon**: no hay icono de BPDF definido (llega en la Fase 11) y no se inventa.
  El navegador pide `/favicon.ico` y recibe 404, sin efecto visible.
- **`browserslist` retirado** (nadie lo leía) en favor de `build.target` en
  `vite.config.ts`; **un solo `tsconfig.json`**; **`appType: "mpa"`** para que las
  rutas desconocidas den 404.
- **T-2 resuelta: sin `@vitejs/plugin-react`** (sin Fast Refresh).
- Queda un aviso conocido en la build (`"use client"` de `lucide-react`), inocuo y **no
  silenciado** (STACK.md).

---

## Fase 3 — Apertura local de archivos

**Objetivo.** Abrir PDF y Markdown por selector y por arrastre, validar, y dejar el
documento en el estado de la app listo para que un visor lo muestre.

**Dependencias.** F2. **D16** (un documento a la vez).

**Alcance**

- `src/documents/types.ts` (`OpenedDocument`, PLAN §4.2), `detect.ts` (extensión +
  `%PDF-` en los primeros 1024 bytes; UTF-8 estricto para Markdown), `limits.ts`
  (512 MB / 20 MB), `errors.ts` (errores tipados: no soportado, demasiado grande, vacío,
  no UTF-8, ilegible).
- **`src/platform/`** (aplazada desde la Fase 2): `types.ts` (interfaz `Platform` de
  ELECTRON §3, solo con lo que esta fase usa: `pickFiles`, `fromDroppedFiles`),
  `memory.ts` (implementación falsa para tests), `index.ts` (elige por `window.bpdf`) y un
  contexto React `PlatformProvider`. El resto de métodos (`saveText`, `openExternal`,
  `onExternalOpen`) los añade la fase que los usa.
- `src/platform/web.ts`: `pickFiles` con `<input type="file" multiple>` creado al vuelo
  (`accept=".pdf,.md,.markdown"`), `fromDroppedFiles`; las imágenes que acompañan a un
  `.md` pasan a `resources` (mapa ruta relativa normalizada → `File`), incluida la entrada
  de carpetas por `webkitGetAsEntry`.
- `src/documents/DocumentProvider.tsx` + `useDocument()`: estado del documento abierto,
  abrir (sustituye, con confirmación si hay cambios sin guardar: el indicador llega en F9,
  aquí la API), cerrar (libera recursos).
- Zona de soltar a pantalla completa con indicación visual accesible; botón «Abrir» y
  `Ctrl/Cmd+O` activos.
- Mensajes de error (PLAN §9.3) con los textos de `messages.ts`.
- Visor provisional: nombre, tipo y tamaño del documento abierto (se sustituye en F5/F7).

**Fuera de alcance.** Renderizar documentos; guardar; Electron; abrir desde URL (no se
hará: rompería el principio de privacidad).

**Archivos esperados.** `src/documents/*`, `src/app/App.tsx`, `src/app/EmptyState.tsx`,
`src/app/DropZone.tsx`, `src/app/DocumentError.tsx`, `src/platform/*`,
`src/i18n/messages.ts`, `tests/unit/documents/*`, `tests/components/DropZone.test.tsx`,
`tests/fixtures/` (primeros fixtures + `README.md` de procedencia), `e2e/specs/abrir.spec.ts`.

**Seguridad.** Nunca confiar en `file.type`; validar por contenido. Nombres de fichero
mostrados como texto (React ya escapa). Normalizar rutas relativas de `resources` (sin
`..` que salga del conjunto, sin rutas absolutas). Nada de rutas de disco en el estado.

**Tests**

- Unitarios: detección (PDF válido, PDF con bytes previos a `%PDF-` dentro de 1024 bytes,
  `.pdf` que es un PNG, `.md` en UTF-16 o binario, fichero vacío, justo en el límite y uno
  por encima), normalización de rutas de `resources` (`./img/a.png`, `img/../a.png`,
  `../a.png` rechazado, `/abs.png` rechazado, `C:\x.png` rechazado).
- Componentes + jest-axe: zona de soltar (estados), errores.
- E2E: abrir por selector (`setInputFiles`) un PDF y un `.md`; arrastrar (evento `drop`
  sintético con `DataTransfer`); rechazar un `.txt` y un PDF falso.

**Criterios de aceptación.** Definición de hecho común; los cinco errores tipados tienen
mensaje y test; abrir un segundo documento sustituye al primero.

**Documentación.** PLAN §5 y §4.2 (marcar implementado o corregir), STRUCTURE, bitácora,
TAREAS.

**Resultado esperado.** Se puede abrir cualquier PDF o Markdown local y la app sabe qué
es, sin mostrarlo aún.

---

## Fase 4 — Spike: modo oscuro de PDF

**Objetivo.** Decidir con evidencia la estrategia de lectura oscura (T-1) y, con ella, si
el visor usa `PDFViewer` de pdf.js o uno propio. Entregar el módulo de modo oscuro
probado, listo para integrar en F5.

**Dependencias.** F2 (no necesita F3: el spike carga fixtures directamente).

**Decisiones ya tomadas.** pdf.js (`pdfjs-dist` versión exacta, hoy 6.3.289); `pageColors`
descartado como modo principal (PLAN §6.3, verificado en el código: pasa todo a gris);
siempre existirá «página original».

**Decisiones abiertas (las cierra esta fase).** Estrategia B, A o híbrida; si B: CPU,
WebGL u `OffscreenCanvas` en worker; umbrales de saturación y de contraste.

**Alcance**

1. Instalar `pdfjs-dist` **exacta**; script `scripts/copiar-pdfjs.mjs` que copia worker,
   `cmaps/`, `standard_fonts/`, `wasm/` e `iccs/` a `public/pdfjs/` en `predev`/`prebuild`
   (no se versionan: `.gitignore`). **No** copia `pdf.sandbox*`.
2. **Corpus** en `tests/fixtures/pdf/modo-oscuro/`, cada fichero con licencia libre o
   generado por nosotros, descrito en su `README.md`: texto puro; texto + foto a color;
   gráfico vectorial de barras/líneas en color; diagrama con relleno gris claro; tabla con
   filas sombreadas; título en azul marino; subrayado con `multiply`; texto dentro de un
   grupo de transparencia; imagen con máscara suave; escaneado (imagen a página
   completa); página con fondo de color; formulario; PDF de LaTeX con fórmulas; un
   documento de más de 300 páginas.
3. Página de laboratorio **solo en desarrollo** (`src/pdf/dark/lab/`, excluida del build de
   producción) que muestra lado a lado original / estrategia B / estrategia A para cada
   fixture.
4. **Estrategia B** en `src/pdf/dark/`: `image-regions.ts` (recorre
   `page.getOperatorList()` con la pila `save`/`restore`/`transform` y devuelve los
   cuadriláteros de `paintImageXObject`, `paintInlineImageXObject` y
   `paintImageXObjectRepeat`; **no** los de `paintImageMask*`, que son «tinta» y deben
   remapearse), `remap.ts` (función pura píxel → píxel: poco saturado → luminosidad
   invertida entre `--rgb-page` y `--rgb-text` en OKLab; saturado → se conserva, aclarando
   solo si queda por debajo de 3:1 sobre la página), `apply.ts` (aplica sobre un
   `HTMLCanvasElement` excluyendo las regiones).
5. **Estrategia A** (prototipo mínimo, para comparar): envoltura del contexto 2D con los
   setters de color, sobre `page.render({ canvasContext })` de la API núcleo.
6. Medir por fixture: tiempo de post-proceso a escala 1, 2 y 4 (`performance.now()`),
   memoria aproximada, y calidad (inspección visual + muestreo de píxeles).
7. Escribir la decisión en PLAN §6.3 (estrategia, umbrales, limitaciones observadas) y
   ajustar F5 si cambia algo (p. ej. visor propio en lugar de `PDFViewer`).

**Fuera de alcance.** UI del visor, zoom, navegación, miniaturas; integrar en la app.

**Archivos esperados.** `package.json`, `scripts/copiar-pdfjs.mjs`, `.gitignore`,
`src/pdf/engine.ts` (carga diferida de pdf.js y `GlobalWorkerOptions.workerSrc`),
`src/pdf/dark/*`, `src/pdf/dark/lab/*`, `tests/fixtures/pdf/modo-oscuro/*`,
`tests/unit/pdf/remap.test.ts`, `tests/unit/pdf/image-regions.test.ts`,
`e2e/specs/pdf-modo-oscuro.spec.ts`.

**Seguridad.** `getDocument({ data, enableScripting: false, enableXfa: false, cMapUrl,
standardFontDataUrl, wasmUrl })` con URLs del propio origen. El post-proceso lee píxeles
propios (lienzo sin origen cruzado); nada remoto.

**Tests**

- Unitarios: `remap` (blanco → página, negro → texto, gris medio → gris medio, rojo puro se
  conserva, azul marino se aclara hasta ≥ 3:1); `image-regions` sobre un operator list
  sintético (traslación, escala, rotación 90°, `save`/`restore` anidados, imagen
  repetida).
- E2E (Playwright, Chromium real): para 3 fixtures con geometría conocida, muestrear
  píxeles: fondo ≈ `--rgb-page`, texto claro, centro de la foto ≈ color original ± 3.

**Criterios de aceptación**

- Estrategia elegida y escrita en PLAN §6.3 con las mediciones.
- Post-proceso de una página A4 a escala 2 en < 50 ms en la máquina de desarrollo (o
  justificación y plan si no se alcanza).
- En el corpus, fotos y gráficos a color conservan sus colores; el texto de cuerpo tiene
  contraste ≥ 7:1 sobre la página.
- Limitaciones observadas listadas (y cuáles se explican al usuario).

**Documentación.** PLAN §6.3, STACK (`pdfjs-dist` con su motivo y por qué versión
exacta), SEGURIDAD §4 (configuración de `getDocument`), bitácora con lo descartado.

**Resultado esperado.** `src/pdf/dark/` probado y una decisión cerrada sobre cómo se
construye el visor.

---

## Fase 5 — Visor PDF: núcleo

**Objetivo.** Leer un PDF completo con buena experiencia: render, modo oscuro, zoom,
navegación, modos continuo/página, rotación, selección y copia, enlaces, contraseña.

**Dependencias.** F3, F4. **D13** (contraseña) y **D14** (formularios) confirmadas.

**Decisiones ya tomadas** (salvo que F4 las cambie): `PDFViewer` + `EventBus` +
`PDFLinkService` de `pdfjs-dist/web/pdf_viewer.mjs`, y su CSS (`pdf_viewer.css`,
adaptado a los tokens); modo oscuro aplicado en `pagerendered`; `maxCanvasPixels` =
16 777 216.

**Alcance**

- `src/pdf/PdfViewer.tsx`: monta el contenedor que exige `PDFViewer` (posición absoluta),
  carga el documento con `engine.ts`, conecta `EventBus`, destruye todo al desmontar
  (`pdfDocument.destroy()`, `viewer.setDocument(null)`).
- Barra de PDF (`src/pdf/PdfToolbar.tsx`): página actual/total con campo editable (ir a
  página), anterior/siguiente, zoom −/+ y selector (50–400 %, ajustar a ancho, ajustar a
  página), rotar izquierda/derecha, continuo/página (`ScrollMode.VERTICAL`/`PAGE`),
  página oscura/original.
- Zoom con `Ctrl/Cmd +/−/0` y `Ctrl/Cmd`+rueda (listener `wheel` no pasivo solo en el
  contenedor); pellizco de trackpad (llega como `wheel` con `ctrlKey`).
- Capa de texto (selección y copia nativas) y capa de anotaciones con enlaces
  (`AnnotationMode.ENABLE`); `PDFLinkService` con `externalLinkTarget = BLANK`,
  `externalLinkRel = "noopener noreferrer nofollow"` y filtro propio de protocolos
  (`http`, `https`, `mailto`); en Electron, `platform.openExternal`.
- Modo oscuro de F4 tras cada `pagerendered`; al cambiar oscuro/original se re-renderizan
  las páginas visibles. Sin destello de página clara: ocultar el lienzo hasta aplicar el
  post-proceso (o pintar antes el fondo con `--rgb-page`).
- Contraseña: diálogo accesible (`<dialog>`), reintento, cancelar cierra el documento; la
  contraseña no se guarda.
- Errores: PDF dañado (`InvalidPDFException`), vacío, cancelado.

**Fuera de alcance.** Miniaturas, búsqueda, pantalla completa, atajos de una tecla (F6);
recordar página (F10).

**Archivos esperados.** `src/pdf/PdfViewer.tsx`, `src/pdf/PdfToolbar.tsx`,
`src/pdf/engine.ts`, `src/pdf/link-policy.ts`, `src/pdf/PasswordDialog.tsx`,
`src/pdf/pdf-viewer.css` (adaptación de `pdf_viewer.css`), `src/App.tsx`,
`src/i18n/messages.ts`, `tests/unit/pdf/*`, `tests/components/PdfToolbar.test.tsx`,
`tests/fixtures/pdf/*`, `e2e/specs/pdf.spec.ts`.

**Seguridad.** SEGURIDAD §4 completa: `enableScripting: false`, `enableXfa: false`, sin
`pdf.sandbox.mjs` en `public/pdfjs/`, filtro de protocolos, recursos del propio origen.
Fixtures hostiles: PDF con JavaScript de apertura (comprobar que no se ejecuta con un
`OpenAction` que intentaría cambiar algo observable), enlaces `javascript:`, `file:`,
`Launch`, `GoToR`.

**Tests**

- Unitarios: `link-policy` (protocolos permitidos y no), estado de zoom (límites, pasos).
- Componentes + jest-axe: `PdfToolbar` (etiquetas, `aria-live` de página),
  `PasswordDialog`.
- E2E: abrir PDF de 10 páginas → «1 de 10»; siguiente, ir a 7, `End`; zoom +/−/ajustar;
  rotar (dimensiones del lienzo intercambiadas); modo página frente a continuo;
  seleccionar texto y copiar (portapapeles con permisos de Playwright); clic en enlace
  interno navega; enlace externo abre pestaña nueva con `noopener`; enlace `javascript:`
  no hace nada; PDF cifrado pide contraseña; PDF truncado muestra error; **cero
  violaciones de CSP**.

**Criterios de aceptación.** Definición de hecho común; todas las funciones del alcance
con su E2E; un PDF de 300 páginas abre y navega sin bloquear la UI más de 100 ms
(medición con `performance`); memoria estable al recorrerlo entero.

**Documentación.** PLAN §6 (implementado), SEGURIDAD §4 (implementado, tests
enlazados), STACK, STRUCTURE, bitácora, TAREAS.

**Resultado esperado.** Un lector de PDF completo y oscuro, sin miniaturas ni búsqueda.

---

## Fase 6 — Visor PDF: miniaturas, búsqueda, atajos, pantalla completa

**Objetivo.** Completar el visor PDF.

**Dependencias.** F5.

**Alcance**

- **Miniaturas** (`src/pdf/Thumbnails.tsx`): panel lateral, lista virtualizada
  (`IntersectionObserver`), render con `page.render` a escala baja + modo oscuro de F4,
  caché LRU de ~100 miniaturas como `ImageBitmap`, página actual resaltada con
  `aria-current`, clic y teclado (flechas, `Enter`) navegan. Se cancelan los renders que
  salen de pantalla.
- **Búsqueda** (`src/pdf/FindBar.tsx`): `PDFFindController` + `EventBus`; opciones:
  distinguir mayúsculas y palabra completa; contador «n de m» en `aria-live`;
  `Enter`/`Shift+Enter`, `F3`/`Shift+F3`, `Escape` cierra. Colores `--rgb-find` y
  `--rgb-find-current` (visibles en modo oscuro y original).
- **Pantalla completa:** `requestFullscreen` sobre el área de lectura; `F`; salir con
  `Escape`.
- **Atajos** (`src/pdf/shortcuts.ts` + `src/lib/shortcuts.ts` genérico): tabla de PLAN
  §9.4; los de una tecla se ignoran con foco en campos de texto y se pueden desactivar
  (en memoria hasta la Fase 10, que la persiste); ayuda `?` con la lista (`<dialog>`).

**Fuera de alcance.** Esquema/marcadores del PDF (outline), candidato posterior;
anotaciones.

**Archivos esperados.** `src/pdf/Thumbnails.tsx`, `src/pdf/FindBar.tsx`,
`src/pdf/shortcuts.ts`, `src/lib/shortcuts.ts`, `src/app/ShortcutsHelp.tsx`,
`src/pdf/PdfToolbar.tsx`, `src/i18n/messages.ts`, tests y E2E correspondientes.

**Seguridad.** Nada nuevo. El texto buscado no se guarda.

**Tests**

- Unitarios: resolución de atajos (combinaciones, foco en input, desactivados, Mac con
  `metaKey` frente a `ctrlKey`).
- Componentes + jest-axe: `Thumbnails` (roles, `aria-current`), `FindBar`,
  `ShortcutsHelp`.
- E2E: buscar una palabra con 3 apariciones → «1 de 3», siguiente → «2 de 3» y salta de
  página; miniatura 5 → página 5; `T` abre/cierra; `R` rota; `F` entra en pantalla
  completa (`document.fullscreenElement`); con los atajos de una tecla desactivados, `R`
  no rota.

**Criterios de aceptación.** Definición de hecho común; con un PDF de 300 páginas el panel
de miniaturas abre en < 300 ms y no renderiza más que las visibles más un margen.

**Documentación.** PLAN §6.2 y §9.4, bitácora, TAREAS.

**Resultado esperado.** Visor PDF con todas las funciones pedidas.

---

## Fase 7 — Markdown: lectura

**Objetivo.** Mostrar Markdown (GFM completo) de forma segura y agradable: tablas,
código con resaltado y copiar, enlaces, índice e imágenes locales.

**Dependencias.** F3. **D6** (HTML embebido) y **D7** (imágenes remotas) confirmadas.

**Decisiones ya tomadas.** `react-markdown` + `remark-gfm` + `rehype-highlight`
(subconjunto `common`), sin `rehype-raw`; componentes propios para `a`, `img`,
`code`/`pre` y encabezados; ids con prefijo `md-`; `url-policy.ts` propio; sin
`innerHTML` (PLAN §7, SEGURIDAD §3).

**Alcance**

- `src/markdown/pipeline.ts`: configuración de plugins; exporta la lista para que F8 la
  amplíe.
- `src/markdown/url-policy.ts`: `sanitizeHref(url)` y `resolveImage(url, resources)`
  (funciones puras; decodifican entidades, quitan espacios y controles, comparan
  protocolos en minúsculas).
- `src/markdown/MarkdownView.tsx` con componentes en `src/markdown/components/`:
  `Link` (externos con `noopener noreferrer` y `platform.openExternal`; anclas internas
  con desplazamiento; relativos a `.md` sin navegación y con aviso), `Image` (local →
  `blob:` desde `resources` con `URL.createObjectURL` y revocación al desmontar; remota →
  texto alternativo + enlace; SVG solo como `<img>`), `CodeBlock` (resaltado + botón
  copiar con confirmación en `aria-live`), `Heading` (id `md-…` y enlace ancla).
- `src/markdown/toc.ts` + `Toc.tsx`: índice desde los encabezados (h1–h3), panel lateral,
  resalta la sección visible.
- Estilos de lectura: hoja `--rgb-page`, ancho ~72ch, tamaño de letra de la preferencia,
  tablas con desplazamiento horizontal, tema de highlight.js hecho con tokens `--code-*`.

**Fuera de alcance.** Matemáticas y Mermaid (F8): sus bloques se muestran como código;
edición (F9).

**Archivos esperados.** `src/markdown/*`, `src/markdown/components/*`,
`src/styles/markdown.css`, `src/App.tsx`, `src/i18n/messages.ts`, `package.json`,
`tests/unit/markdown/*`, `tests/components/markdown/*`,
`tests/fixtures/markdown/` (incluido `xss/`), `e2e/specs/markdown.spec.ts`.

**Seguridad.** SEGURIDAD §3 entera (salvo KaTeX/Mermaid). El **corpus de XSS** de §3.3 es
obligatorio y debe fallar si alguien añade `rehype-raw` o cambia el `urlTransform`.

**Tests**

- Unitarios: `url-policy` (todos los casos de §3.3), `toc` (slugs, duplicados, prefijo),
  resolución de imágenes con `resources`.
- Componentes + jest-axe: `MarkdownView` con un documento de muestra que incluye todo
  GFM; **corpus de XSS** (cada fichero: sin nodos ni atributos prohibidos); `CodeBlock`
  copia (portapapeles simulado).
- E2E: abrir `.md` con imagen hermana (dos ficheros por `setInputFiles`) → la imagen se
  ve; el índice navega; copiar un bloque; enlace externo abre pestaña nueva; **cero
  violaciones de CSP** y **cero peticiones de red** tras cargar la app (Playwright
  `page.on("request")`).

**Criterios de aceptación.** Definición de hecho común; el corpus de XSS pasa; un `.md` de
1 MB se muestra en < 1 s (medido; si no, anotarlo para F13).

**Documentación.** PLAN §7, SEGURIDAD §3 (implementado), STACK (cada dependencia con su
motivo), bitácora, TAREAS.

**Resultado esperado.** Lector de Markdown GFM completo y seguro.

---

## Fase 8 — Markdown: matemáticas y Mermaid

**Objetivo.** Fórmulas LaTeX y diagramas Mermaid, cargados solo si el documento los usa y
aislados.

**Dependencias.** F7.

**Alcance**

- **Matemáticas:** `remark-math` + `rehype-katex` + `katex` (versión exacta) con carga
  diferida (el pipeline detecta `$`/`$$`/bloques `math` antes de importarlos); opciones
  `trust: false`, `strict: "warn"`, `maxSize`, `maxExpand: 1000`, `throwOnError: false`
  (una fórmula inválida se muestra como código con aviso); CSS y fuentes de KaTeX servidas
  desde el propio origen; salida MathML para accesibilidad.
- **Mermaid:** `MermaidBlock` para bloques de código `mermaid`; `import("mermaid")` al
  primer diagrama visible; `initialize({ startOnLoad: false, securityLevel: "strict",
  htmlLabels: false, maxTextSize, theme: "base", themeVariables })` con colores de los
  tokens; `mermaid.render()` → cadena SVG → `Blob` `image/svg+xml` → `<img>` con
  `alt`/`aria-label`; error de sintaxis → código fuente con aviso. Render solo al entrar
  en pantalla.

**Fuera de alcance.** Otros diagramas (PlantUML, etc.), edición visual.

**Archivos esperados.** `src/markdown/pipeline.ts`,
`src/markdown/components/MermaidBlock.tsx`, `src/markdown/mermaid-theme.ts`,
`src/styles/markdown.css`, `package.json`, el script de copia de recursos si Vite no emite
solo las fuentes de KaTeX, tests y E2E.

**Seguridad.** SEGURIDAD §3.1, filas de KaTeX y Mermaid; casos de §3.3 de KaTeX y Mermaid
añadidos al corpus.

**Tests**

- Componentes: fórmula en línea y de bloque producen MathML; fórmula inválida no rompe;
  corpus de XSS de KaTeX y Mermaid.
- E2E: documento con 3 diagramas → 3 `<img>` con `src` `blob:`; ningún `<svg>` en línea
  en la hoja; un documento sin matemáticas ni Mermaid **no descarga** sus chunks
  (inspeccionar peticiones); cero violaciones de CSP.

**Criterios de aceptación.** Definición de hecho común; el bundle inicial no crece
(script de tamaño); corpus completo en verde.

**Documentación.** PLAN §7 y §11, SEGURIDAD §3, STACK, bitácora, TAREAS.

**Resultado esperado.** Markdown técnico completo (código, fórmulas, diagramas).

---

## Fase 9 — Editor Markdown, vista previa y modo dividido

**Objetivo.** Editar Markdown con vista previa en vivo y guardar localmente.

**Dependencias.** F7 (F8 recomendable para que la vista previa sea completa). **D9**
(editor) confirmada.

**Alcance**

- Modos lectura / edición / dividido en la barra de Markdown (`src/editor/ModeSwitch.tsx`).
- `src/editor/MarkdownEditor.tsx`: si D9 = CodeMirror 6, `codemirror` +
  `@codemirror/lang-markdown` (sin `@codemirror/language-data` salvo que se mida
  aceptable), tema con tokens, carga diferida al entrar en edición; si D9 = textarea,
  `<textarea>` monoespaciado y `Tab` que inserta espacios con salida por `Escape`
  (accesibilidad).
- `src/editor/SplitView.tsx`: dos paneles redimensionables (separador accesible con
  teclado, `role="separator"`), vista previa con *debounce* de 200 ms, desplazamiento
  sincronizado por encabezado.
- Estado «modificado» en `DocumentProvider` (indicador en el título y en la barra);
  confirmación al abrir otro documento; `beforeunload` en web.
- Guardar: `platform.saveText` en web con `showSaveFilePicker` si existe (reutilizando el
  handle en guardados siguientes) o descarga `<a download>`; `Ctrl/Cmd+S`.
- Crear un documento nuevo vacío: **fuera de alcance salvo que se pida** (anotarlo).

**Fuera de alcance.** Autoguardado, borradores en `localStorage` (PLAN §8), Electron
(F14), colaboración.

**Archivos esperados.** `src/editor/*`, `src/documents/DocumentProvider.tsx`,
`src/platform/web.ts`, `src/markdown/MarkdownView.tsx` (anclajes para sincronizar),
`src/i18n/messages.ts`, `package.json`, tests y E2E.

**Seguridad.** La vista previa usa el mismo pipeline (mismo corpus). El handle del File
System Access API solo vive en memoria. El texto no se persiste.

**Tests**

- Unitarios: estado modificado/guardado; sincronización de scroll (mapa de líneas a
  encabezados).
- Componentes + jest-axe: `ModeSwitch`, `SplitView` (separador con teclado),
  `MarkdownEditor` (etiqueta accesible).
- E2E: abrir `.md` → edición → escribir → la vista previa cambia; dividido; guardar
  produce una descarga con el texto nuevo (`page.waitForEvent("download")`); abrir otro
  documento con cambios pide confirmación.

**Criterios de aceptación.** Definición de hecho común; editar un `.md` de 1 MB sin
retraso perceptible al teclear (medir en F13 si hay duda).

**Documentación.** PLAN §7.3, STACK, bitácora, TAREAS.

**Resultado esperado.** Editor Markdown funcional en web.

---

## Fase 10 — Preferencias

**Objetivo.** Panel de preferencias, memoria por documento y borrado de datos locales.

**Dependencias.** F6, F9 (para conocer todas las preferencias). **D8** confirmada.

**Alcance**

- **Infraestructura** (aplazada desde la Fase 2): reinstalar **`zod`** (con su fila en
  `STACK.md`); `src/preferences/schema.ts` (`{ v: 1, … }` con los campos de PLAN §8 y sus
  valores por defecto), `store.ts` (leer/escribir `bpdf:prefs` con `try/catch`, descarte
  de valores inválidos, migración por versión) y `usePreferences.ts` (hook con
  suscripción al evento `storage` para varias pestañas). Los ajustes que las fases 5–9
  dejaron en memoria pasan a leerse de aquí.
- `src/preferences/PreferencesDialog.tsx`: modo de página PDF por defecto, zoom por
  defecto, modo continuo/página, tamaño de letra y ancho de Markdown, atajos de una tecla,
  recordar posición (D8), «Olvidar posiciones guardadas», «Restablecer preferencias».
- `src/preferences/positions.ts`: `bpdf:positions` (huella → `{ page, zoom, t }`), LRU de
  50, huella de PLAN §8; restaurar al abrir si está activado; guardar con *debounce*.
- Migración de esquema `v1 → v2` si esta fase añade campos (con test).

**Fuera de alcance.** Tema claro (D10); sincronización (nunca).

**Archivos esperados.** `src/preferences/*`, `src/pdf/PdfViewer.tsx`,
`src/markdown/MarkdownView.tsx`, `src/app/App.tsx`, `package.json`, tests y E2E.

**Seguridad y privacidad.** Nunca nombres de fichero ni contenido: un test abre un
documento con nombre conocido, recorre `localStorage` y no lo encuentra.

**Tests.** Unitarios: preferencias (valor válido, corrupto, versión futura,
`localStorage` que lanza), LRU, huella, migración. Componentes + jest-axe:
diálogo. E2E: abrir PDF → página 7 → recargar y reabrir → vuelve a 7; desactivar → no
vuelve; «olvidar» vacía `bpdf:positions`.

**Criterios de aceptación.** Definición de hecho común; el test de privacidad pasa.

**Documentación.** PLAN §8 (implementado), SEGURIDAD §6, página de privacidad si D4,
bitácora, TAREAS.

**Resultado esperado.** Preferencias completas y transparentes para el usuario.

---

## Fase 11 — UI/UX final

**Objetivo.** Pasada de diseño completa: consistencia, estados, detalles de lectura y
adaptación a pantallas pequeñas según D12.

**Dependencias.** F10. **D10** y **D12** confirmadas.

**Alcance.** Revisión de todas las pantallas contra PLAN §9 (espaciados, iconos
`lucide-react` coherentes, tooltips con su atajo, estados de carga, transiciones que
respetan `prefers-reduced-motion`); icono y favicon de BPDF (`public/`); título de ventana
con el nombre del documento; diseño adaptable (D12); pantalla «Acerca de» (versión,
licencia, frase de privacidad, enlace al repositorio); limpieza de textos en
`messages.ts`.

**Fuera de alcance.** Funciones nuevas; tema claro si D10 = no.

**Archivos esperados.** `src/components/**`, `src/styles/*`, `public/` (iconos),
`src/i18n/messages.ts`; capturas de referencia para E2E visuales solo si se decide usarlas
(`toHaveScreenshot`, solo Chromium y con tolerancia).

**Seguridad.** Nada nuevo.

**Tests.** jest-axe de todo componente tocado; E2E de humo por pantalla.

**Criterios de aceptación.** Definición de hecho común; lista de revisión de PLAN §9
recorrida y registrada en la bitácora.

**Documentación.** PLAN §9 con los valores finales, anuncio de cambios visibles, bitácora.

**Resultado esperado.** Producto web visualmente terminado.

---

## Fase 12 — Seguridad: endurecimiento y auditoría

**Objetivo.** Verificar cada control de [SEGURIDAD.md](SEGURIDAD.md), endurecer lo que
quede y registrar una auditoría.

**Dependencias.** F11.

**Alcance**

- CSP obligatoria (no report-only) en `preview` y en la configuración del hosting (D5);
  resolver **T-3** (`style-src` sin `'unsafe-inline'`) y **T-4** (Trusted Types): probar,
  medir qué rompe, decidir y documentar.
- Revisar si `data:` en `img-src` puede quitarse.
- Test que compara las cabeceras servidas con la fuente única.
- Recorrer SEGURIDAD §2–§6 control a control: cada uno tiene test o queda como hallazgo.
- `npm audit`, revisión de `allowScripts`, versiones exactas de los motores, avisos
  publicados de pdf.js/KaTeX/Mermaid/highlight.js desde la última actualización.
- Revisión manual del código buscando `innerHTML`, `eval`, `Function`, `postMessage`,
  `window.open` y `target="_blank"` sin `rel`.
- Registrar en [auditoria.md](auditoria.md) (formato existente: ID, severidad, estado).

**Fuera de alcance.** Electron (su auditoría va en F14).

**Archivos esperados.** `src/config/security-headers.mjs`, configuración del hosting,
`tests/unit/security-headers.test.ts`, `e2e/specs/seguridad.spec.ts`, `docs/auditoria.md`,
`docs/SEGURIDAD.md`.

**Tests.** E2E con todos los recorridos y cero violaciones de CSP; cabeceras; corpus de
XSS completo; ninguna petición de red tras cargar la app en ningún recorrido.

**Criterios de aceptación.** Definición de hecho común; ningún hallazgo 🔴/🟠 abierto;
T-3 y T-4 decididos y escritos.

**Documentación.** SEGURIDAD (todo marcado), auditoria.md, bitácora, TAREAS.

**Resultado esperado.** Web endurecida y auditada, lista para publicarse.

---

## Fase 13 — Accesibilidad y rendimiento

**Objetivo.** Medir con documentos reales y grandes y corregir lo que falle; auditoría de
accesibilidad de pantallas completas.

**Dependencias.** F12.

**Alcance**

- Corpus de rendimiento generado por script (para no versionar binarios grandes): PDF de
  1 000 páginas, PDF con imágenes de alta resolución, `.md` de 5 MB, `.md` con 200
  bloques de código, 50 fórmulas y 20 diagramas.
- Medir (Playwright + `performance`): tiempo a primera página, navegación, zoom,
  búsqueda completa, memoria tras recorrer, tiempo de render de Markdown, bloqueos del
  hilo principal (`PerformanceObserver` de `longtask`).
- Decidir con esas cifras las optimizaciones de PLAN §11 que «esperan a evidencia» y
  aplicar solo las necesarias.
- `@axe-core/playwright` (dev) en cada pantalla y estado (vacío, PDF, Markdown, editor,
  diálogos); revisión manual con teclado y con un lector de pantalla (NVDA o VoiceOver),
  anotando el resultado.

**Fuera de alcance.** Funcionalidades nuevas.

**Archivos esperados.** `e2e/specs/rendimiento.spec.ts` (en un proyecto de Playwright
aparte si es lenta), `e2e/specs/a11y.spec.ts`, `scripts/` para generar los fixtures
grandes, los módulos que se optimicen.

**Criterios de aceptación.** Definición de hecho común; umbrales escritos en PLAN §11 y
cumplidos (propuesta: primera página de un PDF de 1 000 páginas < 1,5 s; ninguna tarea
larga > 200 ms al teclear o navegar; memoria estable); axe sin violaciones.

**Documentación.** PLAN §10 y §11 con cifras reales, bitácora, TAREAS.

**Resultado esperado.** Web accesible y con rendimiento medido.

---

## Fase 14 — Electron: aplicación

**Objetivo.** BPDF de escritorio funcional y seguro en desarrollo (sin empaquetar para
distribución).

**Dependencias.** F13 (o F12 como mínimo). Leer [ELECTRON.md](ELECTRON.md) entero.

**Alcance.** ELECTRON §2–§7: `electron/main.ts`, `preload.ts`, `protocol.ts` (`app://` y
`bpdf-res://`), `ipc.ts`, `validation.ts` (esquemas `zod` compartidos); instancia única,
argv y `open-file`; `src/platform/electron.ts` completo; imágenes locales de Markdown por
`bpdf-res://`; guardar en el mismo fichero; CSP de escritorio (fuente única +
`bpdf-res:`); scripts `electron:dev` y `electron:build` (sin instaladores); `allowScripts`
de `electron`.

**Fuera de alcance.** Instaladores, firma, fuses en el binario empaquetado,
auto-actualización (F15).

**Archivos esperados.** `electron/*`, `src/platform/electron.ts`, `src/platform/index.ts`,
`package.json`, `tsconfig.electron.json`, `vite.config.ts` (base relativa si hace falta),
`tests/unit/electron/*`, `e2e/electron/*.spec.ts`, `playwright.config.ts` (proyecto
Electron).

**Seguridad.** SEGURIDAD §5 y ELECTRON completos; revisión con la checklist oficial de
seguridad de Electron registrada en auditoria.md.

**Tests.** ELECTRON §9 entero.

**Criterios de aceptación.** Definición de hecho común; todos los tests de ELECTRON §9 en
verde; abrir por argumento, por diálogo y por arrastre; guardar un `.md` en su sitio.

**Documentación.** ELECTRON (implementado), SEGURIDAD §5, STACK, STRUCTURE, DEVELOPMENT
(cómo arrancar la versión de escritorio), auditoria.md, bitácora, TAREAS.

**Resultado esperado.** App de escritorio que se ejecuta desde el repo con la misma UI.

---

## Fase 15 — Distribución: web y escritorio

**Objetivo.** Publicar la web y producir instaladores de escritorio.

**Dependencias.** F14 (escritorio) y F12 (web; la publicación web puede adelantarse tras
F13 si se quiere). **D5** y **D11** confirmadas.

**Alcance**

- **Web:** despliegue en el hosting de D5 con las cabeceras de F12; comprobación con
  `curl -I` (CSP, HSTS, etc.) y E2E de humo contra la URL pública; `DEPLOYMENT.md`.
- **Escritorio:** resolver **T-5** (Forge o electron-builder); instaladores por plataforma
  (D11); fuses; asociación de tipos `.pdf`/`.md` opcional; firma y notarización si D11
  lo decide; workflow de release por etiqueta con matriz de SO, artefactos con SHA-256 y
  Actions fijadas por SHA.
- Versionado del producto (`package.json` → `version`, semver) y registro de cambios para
  usuarios (distinto de la bitácora `docs/CHANGELOG.md`; nombre y ubicación a decidir).

**Fuera de alcance.** Auto-actualización (salvo que D11 cambie), tiendas de aplicaciones.

**Archivos esperados.** Configuración del hosting, `.github/workflows/release.yml`,
configuración del empaquetador, `docs/DEPLOYMENT.md`, registro de cambios de usuario.

**Seguridad.** Integridad de artefactos (checksums, firma), fuses verificados en el
binario (`npx @electron/fuses read`), secretos de firma solo en el entorno de CI.

**Criterios de aceptación.** Web pública con cabeceras correctas; instaladores que
arrancan en cada SO objetivo en una máquina limpia (registrar cómo se probó).

**Documentación.** DEPLOYMENT (reescrito), ELECTRON §8, bitácora, TAREAS.

**Resultado esperado.** BPDF disponible para usuarios.

---

## Fase 16 — Open source y documentación final

**Objetivo.** Dejar el repositorio listo para contribuciones externas.

**Dependencias.** F15 (o antes si se decide publicar el repositorio antes; nunca antes de
F12).

**Alcance.** `README.md` de producto (qué es, capturas, privacidad, instalación,
desarrollo, build, licencia); `CONTRIBUTING.md` (entorno, comandos, convenciones de
commits de CLAUDE.md §2, definición de hecho, cómo se escriben los tests, política de
dependencias); `SECURITY.md` (versiones soportadas, reporte privado por GitHub Security
Advisories, plazos de respuesta); `CODE_OF_CONDUCT.md`; plantillas de issues y PR;
`docs/` revisado para lectores externos (índice, arquitectura, qué es la bitácora);
`public_docs/` completo si D4; revisar que no queda nada interno de R3ZON que no deba
publicarse (rutas o nombres de repositorios privados en la documentación).

**Fuera de alcance.** Funcionalidades.

**Criterios de aceptación.** Checklist de «Community Standards» de GitHub completa;
`docs:enlaces` en verde; un tercero puede clonar, instalar y ejecutar los tests siguiendo
solo el README (probado en un clon limpio).

**Documentación.** Todo lo anterior, bitácora, TAREAS.

**Resultado esperado.** Proyecto open source publicado y mantenible.
