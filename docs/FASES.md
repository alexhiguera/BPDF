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
| 5 | Visor PDF funcional | El visor propuesto se divide en dos sesiones (5 y 6) por tamaño. Al ejecutarla, la F5 absorbió miniaturas, búsqueda y atajos con modificador |
| 6 | Visor PDF: pantalla completa, atajos de una tecla y búsqueda avanzada | Lo que queda del visor tras la F5 |
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

Paralelizables (si hay dos sesiones a la vez): **F7–F9** con **F5–F6**. Todas tocan
`src/app/App.tsx` en un punto (montar el visor en lugar de `DocumentSummary`): conflicto
pequeño y conocido.

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
  `r3zon-template.json` quedó como registro de origen, sin `reservadoPorLaPlantilla` (se retiró
  del repositorio antes de publicarlo; el origen queda en [TEMPLATE.md](TEMPLATE.md)).
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

## Fase 3 — Apertura local de archivos ✅

Cerrada el 2026-09-29. Bitácora: iteración 5. Resultado: abrir un PDF o un Markdown local
con el botón «Abrir archivo», `Ctrl/Cmd+O` o arrastrándolo a la ventana; validación por
extensión **y** contenido (firma `%PDF-`, UTF-8 estricto), límites de tamaño
justificados y siete errores tipados con su mensaje; **un documento a la vez** (D16):
abrir otro lo sustituye y un fichero rechazado no cierra el abierto; vista provisional
con nombre, tipo y tamaño. Capa `src/platform/` con la implementación web. Sin
dependencias nuevas, sin cambios de CSP y sin ninguna petición de red.

**Qué deja a las fases siguientes** (el contrato que usarán):

- `useDocument()` da `document: OpenedDocument | null`. PDF: `{ kind: "pdf", blob }`
  (sin leer; el visor hace `await blob.arrayBuffer()`); Markdown:
  `{ kind: "markdown", text }`. Los visores se montan con `key={document.id}` y liberan
  lo suyo al desmontarse ([PLAN.md](PLAN.md) §4.2, [ARCHITECTURE.md](ARCHITECTURE.md) §4 bis).
- `Platform` con `pickDocument()` y `openDroppedFile(file)`; cada fase añade el método
  que use ([ELECTRON.md](ELECTRON.md) §3).
- `readDocument(file, id?)` es la única validación, también para Electron.

**Desviaciones respecto a la especificación**, por si una fase posterior se apoya en ella:

- **Un fichero, no varios.** La especificación pedía `<input multiple>` y `resources`
  (imágenes hermanas de un `.md`, también por carpetas con `webkitGetAsEntry`). D16 y la
  sesión pidieron no construir nada para más de un documento, y `resources` solo lo usa
  la Fase 7: **pasa a la Fase 7**, junto con su normalización de rutas relativas y sus
  tests. Soltar varios ficheros hoy da el error `multiple`.
- **`OpenedDocument` como unión discriminada**, con el PDF como `Blob` (no
  `ArrayBuffer`) y el Markdown como texto; **id con contador** (no `randomUUID`, que no
  existe fuera de contexto seguro); sin `capabilities` (Fase 9). Motivos en PLAN §4.2.
- **`Platform` con dos métodos** (`pickDocument`, `openDroppedFile`) en lugar de
  `pickFiles`/`fromDroppedFiles` en plural, y sin `kind`: no hay nada que lo lea.
- **Sin `PlatformProvider` ni `platform/memory.ts`.** Solo `DocumentProvider` usa la
  plataforma, y la recibe por propiedad (`<App platform={…}>`); la falsa para tests vive
  en `tests/helpers/documentos.ts`, no en `src/`. El contexto de plataforma llega con el
  primer componente que la necesite (enlaces externos, Fases 5 y 7).
- **Sin API de «cambios sin guardar»**: solo el editor (Fase 9) puede tener cambios; la
  añade con su indicador.
- **Siete errores en lugar de cinco**: además de los cinco previstos, `not-pdf` (un
  `.pdf` sin firma, con su propio mensaje en lugar de «no soportado») y `multiple`.
- **`DocumentErrorAlert.tsx`** en lugar de `DocumentError.tsx`, para no chocar con la
  clase `DocumentError`. Nuevos también `DocumentSummary.tsx` (vista provisional) y
  `src/lib/format.ts` (tamaños con `Intl`).
- **Fixtures en `tests/fixtures/`** (PDF mínimo generado por script, dos Markdown, un
  `.txt`); los demás casos se construyen en el test. `*.pdf binary` en `.gitattributes`.
- **La vigilancia de los E2E pasa a `e2e/vigilancia.ts`** y tolera solo el 404 de
  `/favicon.ico` (Google Chrome lo pide; ver DEVELOPMENT.md). La heurística de textos
  sueltos (`tests/unit/textos.test.ts`) dejó de confundir `=> Promise<T>` con texto de
  JSX (falso positivo; su autotest cubre el caso).

---

## Fase 4 — Spike: modo oscuro de PDF ✅

Cerrada el 2026-09-29. Bitácora: iteración 6. **Resultado: viable.** El recoloreado
selectivo (heurística OKLab fuera de las regiones de imagen que registra pdf.js con
`recordImages`) deja fotos intactas (±3 por canal), texto claro a 12:1 y gráficos con su
color, a ~10 ms por megapíxel. Todo en [PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md):
alternativas, fixtures, resultados, benchmark, limitaciones y decisión.

Quedan como código definitivo `src/pdf/engine.ts`, `src/pdf/render.ts` y `src/pdf/dark/*`,
con sus tests. El laboratorio `spike.html` + `src/pdf-spike/` era temporal y se borró en la F5.

**Desviaciones respecto a la especificación**, por si una fase posterior se apoya en ella:

- **Regiones de imagen con `recordImages`** (API pública de pdf.js 6.3), no recorriendo el
  `OperatorList` a mano: pdf.js ya da las coordenadas recortadas por el clip. No hay
  `image-regions.ts`; está `regiones.ts`.
- **Estrategia A (envolver el contexto 2D) no implementada:** innecesaria con
  `recordImages` y frágil (internos de pdf.js). Descartada por coste, no medida.
- **`useWasm: false`**: no se copian `*.wasm` ni `iccs/` (sí los decodificadores en JS);
  la CSP no necesita `'wasm-unsafe-eval'`. Sí necesitó `worker-src 'self'` y
  `font-src 'self'` (y, se vio en la F5, `connect-src 'self'` para los cmaps).
- **Laboratorio en la build** (`spike.html`, `noindex`) y no «solo en desarrollo»: los
  E2E van contra la build de producción, que es donde existe la CSP. Se borró en la F5.
- **Corpus parcial:** 8 páginas generadas (texto, foto, gráficos, mixta, fondos de color,
  compleja, escaneo, diapositiva oscura) y un documento de 300 páginas. No se generaron
  `multiply`, grupos de transparencia, máscara suave, formulario ni LaTeX (difíciles de
  producir fielmente a mano): pasan a validarse en F5 con PDF reales.
- **Tres reglas nacidas de la evidencia**: lienzo `alpha: true` (sin flecos LCD), imagen a
  página completa = escaneo, y página ya oscura = no se toca.
- **Dos hallazgos que requieren decisión** (D17 y D18 en PLAN §14.1): visor propio en
  lugar de `PDFViewer`, y build `legacy` o moderna de pdf.js.

---

## Fase 5 — Visor PDF funcional ✅

Cerrada el 2026-09-30. Bitácora: iteración 7. Diseño completo (capas, render,
virtualización, memoria, worker, capa de texto, enlaces, búsqueda, teclado, límites):
[ARCHITECTURE.md](ARCHITECTURE.md) §4 quater.

**Hecho.** Visor propio sobre la API núcleo de pdf.js (D17) con la build `legacy` (D18):
carga por bytes con cancelación y generaciones; vistas continua y página a página con
virtualización propia (visibles ±1 y presupuesto de 160 MiB); zoom (botones, porcentaje,
100 %, Ctrl/⌘ ±/0, Ctrl/⌘+rueda, límites 25–500 %), ajustar al ancho y a la página;
resolución física separada del tamaño CSS (DPR ≤ 2, ≤ 16,7 Mpx por lienzo); modo oscuro
de la Fase 4 en un Web Worker con alternativa en el hilo principal, y modo original;
rotación de vista 90/180/270; capa de texto (`TextLayer`) con selección y copia; enlaces
internos y externos con su política; navegación con campo validado; miniaturas;
búsqueda con recuento, resaltado y salto; atajos de teclado; barra de estado y anuncios
accesibles. El laboratorio de la Fase 4 (`spike.html`, `src/pdf-spike/`, sus textos y su
E2E) está borrado; el benchmark mide ahora el visor (`npm run bench:pdf`).

**Desviaciones respecto a la especificación anterior** (que describía `PDFViewer`):

- **Visor propio (D17)**: sin `PDFViewer`, `EventBus`, `PDFLinkService` ni
  `PDFFindController`; virtualización, zoom, vistas y búsqueda son de BPDF. Tampoco
  `AnnotationLayer`: los enlaces son `<a>` propios con la política de `enlaces.ts` (solo
  enlaces, nada interactivo más), y las apariencias de anotaciones y formularios se pintan
  en el lienzo (D14: se ven, no se rellenan).
- **Miniaturas, búsqueda y atajos se adelantaron** de la Fase 6 a esta (lo pidió el
  alcance de la fase). La búsqueda no tiene aún «distinguir mayúsculas» ni «palabra
  completa».
- **Contraseña (D13) no implementada**: D13 sigue pendiente de confirmar. Un PDF cifrado
  se detecta (`PasswordException`) y se dice que BPDF aún no lo abre.
- **Rotación en un solo sentido** (90° a la derecha, cuatro pulsaciones dan la vuelta).
- **Firefox 114+** para el visor: pdf.js 6 carga su worker como módulo ES
  (ARCHITECTURE §4 quater, límites).
- **PDF reales** (§28 del encargo): probados nueve (paper con gráficas vectoriales, paper
  con figuras raster y tablas, formulario oficial, documento de empresa con logo, tablas,
  foto y gráfico generado con Chromium, documento largo con índice enlazado, escaneo sin
  texto, diapositivas oscuras, transparencias del corpus de pdf.js). No se pudo generar uno
  de ofimática (no hay LibreOffice en el equipo): queda en TAREAS. Resultados y límites en
  la bitácora.

**Pendiente de la fase**: nada bloqueante. Lo que sale (contraseña, opciones de búsqueda,
rotación a la izquierda, PDF de ofimática, Firefox) está en
[TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md).

---

## Fase 6 — Visor PDF: pantalla completa, atajos de una tecla y búsqueda avanzada

> **Replanteada al cerrar la Fase 5**, que ya hizo las miniaturas, la búsqueda básica y
> los atajos con modificador. Lo que sigue es lo que queda del visor.

**Objetivo.** Completar el visor PDF.

**Dependencias.** F5. **D13** (contraseña) si se incluye aquí.

**Alcance**

- **Pantalla completa:** `requestFullscreen` sobre el área de lectura; `F`; salir con
  `Escape`.
- **Atajos de una tecla** (`T` miniaturas, `R` rotar, `F` pantalla completa…, tabla de
  PLAN §9.4) sobre `src/app/pdf/atajos.ts`: se ignoran con foco en campos de texto y se
  pueden desactivar (en memoria hasta la Fase 10, que la persiste); ayuda `?` con la
  lista (`<dialog>`).
- **Búsqueda:** opciones «distinguir mayúsculas» y «palabra completa»; `F3`/`Shift+F3`;
  unir palabras cortadas con guion al final de línea.
- **Miniaturas:** navegación con flechas dentro del panel.
- **Rotar a la izquierda.**
- **Contraseña (D13)**, si se confirma: diálogo accesible (`<dialog>`), reintento,
  cancelar cierra el documento; la contraseña no se guarda.

**Fuera de alcance.** Esquema/marcadores del PDF (outline), candidato posterior;
anotaciones.

**Tests**

- Unitarios: resolución de atajos (una tecla, foco en input, desactivados).
- Componentes + jest-axe: ayuda de atajos, opciones de búsqueda, diálogo de contraseña.
- E2E: `T` abre/cierra miniaturas; `R` rota; `F` entra en pantalla completa
  (`document.fullscreenElement`); con los atajos de una tecla desactivados, `R` no rota;
  búsqueda con «palabra completa».

**Criterios de aceptación.** Definición de hecho común.

**Documentación.** PLAN §6.2 y §9.4, ARCHITECTURE §4 quater, bitácora, TAREAS.

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
- **Recursos locales** (aplazados desde la Fase 3): abrir un `.md` con sus imágenes
  hermanas eligiendo o soltando **varios ficheros** (y carpetas con
  `webkitGetAsEntry`), sin dejar de ser un documento (D16): el `.md` es el documento y
  el resto, su mapa `resources` (ruta relativa normalizada → `File`). Normalización con
  tests: `./img/a.png`, `img/../a.png`, `../a.png` rechazado, `/abs.png` rechazado,
  `C:\x.png` rechazado. Amplía `Platform` (`pickDocument`/`openDroppedFile` con varios
  ficheros) y sustituye el error `multiple` para ese caso.
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
`src/styles/markdown.css`, `src/app/App.tsx`, `src/documents/*` (`resources`),
`src/platform/*`, `src/i18n/messages.ts`, `package.json`,
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
  confirmación al abrir otro documento (antes de abrir el selector y antes de aplicar un
  fichero soltado: `DocumentProvider.load` es el punto único); `beforeunload` en web.
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
argv y `open-file`; `src/platform/electron.ts` completo (implementa `pickDocument` y
`openDroppedFile` terminando en `readDocument(file, id)` con el id del main, más
`onExternalOpen`; ELECTRON §3); imágenes locales de Markdown por
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
