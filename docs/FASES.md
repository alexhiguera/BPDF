# BPDF — Plan de implementación por fases

> **Fuente de verdad del desarrollo** junto con [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md)
> (qué fase está abierta, en curso o cerrada). Escrito en la Fase 0 (*2026-09-29*). El
> diseño que estas fases construyen está en [PLAN.md](PLAN.md) y [SEGURIDAD.md](SEGURIDAD.md).
> [ELECTRON.md](ELECTRON.md) es histórico: BPDF es solo web (D19, *2026-10-03*).

## Cómo usar este documento (para cada sesión)

1. Lee [`CLAUDE.md`](../CLAUDE.md), después la fase que vas a ejecutar **entera** y las
   secciones de PLAN/SEGURIDAD que cita.
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
                └─► F4 ─┼────┘                     ├─► F10 ─► F11 ─► F12 ─► F13 ─► F15 ─► F16
                        └─► F7 ─► F8 ─► F9 ────────┘
```

La Fase 14 (Electron) se **canceló** el *2026-10-03* (D19: BPDF es solo una aplicación
web); conserva su número, sin trabajo pendiente.

| # | Fase | Cambio respecto al orden propuesto y motivo |
|---|---|---|
| 0 | Auditoría y planificación | — |
| 1 | Limpieza de la plantilla | Igual. Incluye el fichero `LICENSE` (D3): el repo no debe crecer sin licencia |
| 2 | Base de la app | Absorbe la **CSP base** y la estructura preparada para Electron (cancelado después: D19). La capa `platform/` y la infraestructura de preferencias, previstas aquí, se aplazaron a su primer uso (F3 y F10) |
| 3 | Apertura local de archivos | Igual |
| 4 | **Spike: modo oscuro de PDF** | **Nueva.** Es el mayor riesgo técnico y decide la arquitectura del visor (T-1). Se hace antes de construir el visor, no después |
| 5 | Visor PDF funcional | El visor propuesto se divide en dos sesiones (5 y 6) por tamaño. Al ejecutarla, la F5 absorbió miniaturas, búsqueda y atajos con modificador |
| 6 | Visor PDF: pantalla completa, atajos de una tecla, búsqueda avanzada y contraseña | Lo que queda del visor tras la F5, más D13. Se ejecuta **después** de las 7, 7 bis y 8 (así lo pidió el usuario); conserva su número |
| 7 | Markdown: lectura | Igual; incluye su parte de seguridad (sanitización, URLs) |
| 8 | Markdown: matemáticas y Mermaid | **Separada** de la 7: son las dos dependencias más pesadas y con más historial de vulnerabilidades |
| 9 | Editor Markdown + vista previa + dividido | Igual (D9: CodeMirror 6). La vista previa de un documento grande se pausa en dividido (medido) |
| 10 | Preferencias | Infraestructura, panel, memoria por documento y borrado. La infraestructura estaba prevista en la F2 y se aplazó aquí, a su primer uso real |
| 11 | UI/UX final | Igual. Al especificarla: título fijo, «Acerca de» dentro de Preferencias, sin enlace al repositorio (F16) |
| 12 | Seguridad: endurecimiento y auditoría | Ya no «añade» seguridad: cada fase implementa la suya. Aquí se verifica, se endurece (CSP final, Trusted Types) y se audita |
| 13 | Accesibilidad y rendimiento | Los tests viven en cada fase; esta fase **mide** con el corpus grande y corrige |
| 14 | ~~Electron: aplicación~~ | **Cancelada** el *2026-10-03*: BPDF es solo una aplicación web (D19) |
| 15 | Distribución web | Incluye la publicación web (antes no tenía fase). **Reescrita** el *2026-10-03* sin la parte de escritorio (D19) |
| 16 | Open source y documentación final | Igual; la licencia ya existe desde F1 |

Paralelizables (si hay dos sesiones a la vez): **F7–F9** con **F5–F6**. Todas tocan
`src/app/App.tsx` en un punto (montar el visor en lugar de `DocumentSummary`, ya hecho en F5 y F7): conflicto
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
- **Contraseña (D13) no implementada**: D13 estaba pendiente de confirmar (se confirmó al
  especificar la F6, que la implementa). Un PDF cifrado se detecta (`PasswordException`) y
  se dice que BPDF aún no lo abre.
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

## Fase 6 — Visor PDF: pantalla completa, atajos de una tecla y búsqueda avanzada ✅

Cerrada el 2026-09-30. Bitácora: iteración 13. Diseño: [ARCHITECTURE.md](ARCHITECTURE.md)
§4 quater («Búsqueda», «Miniaturas», «Pantalla completa», «Contraseña», «Teclado»).

**Hecho, tal como se especificó abajo.** Atajos `F`, `T`, `R`, `Mayús+R` y `?` (de una
tecla, desactivables desde la ayuda, en memoria de la sesión), `Espacio`/`Mayús+Espacio`,
`→`/`←` en «página a página», `Ctrl/⌘+G` y `F3`/`Mayús+F3`; ayuda `<dialog>` con la tabla
y el interruptor, y botón en la barra; pantalla completa del área de lectura; girar a la
izquierda; «Distinguir mayúsculas», «Palabra completa» y unión de palabras partidas con
guion; `↑`/`↓` en las miniaturas; contraseña de apertura con diálogo modal, reintentos y
cancelar. Sin dependencias nuevas y **sin cambios de cabeceras ni de CSP**.

**Decisiones propias al implementar** (menores, anotadas aquí y en la bitácora):

- El botón de cerrar la ayuda se llama «Cerrar la ayuda» (no «Cerrar»): con «Cerrar» a
  secas, un lector de pantalla no lo distingue de «Cerrar documento».
- Los atajos no actúan con **cualquier** `<dialog>` abierto (no solo la ayuda); `Ctrl/⌘+O`
  (de la app) sí, y abrir otro documento durante la contraseña la cancela.
- El guion que no parte una palabra conserva su carácter en el índice (`-` o U+2010).

**Tests.** Unitarios: `atajos` (cada atajo, reglas de foco, modal, interruptor), `estado` (girar a la izquierda), `busqueda`
(mayúsculas con Unicode difícil, palabra completa, guiones, rendimiento), `documento`
(búsqueda con el texto real de pdf.js sobre `busqueda.pdf`), `engine` (contraseña que
falta, incorrecta, correcta, solo de permisos, cancelación, el error no la lleva),
`controlador` (opciones). Componentes con jest-axe: `Visor` (atajos, ayuda e interruptor,
pantalla completa, F3, opciones de búsqueda, miniaturas con flechas) y `App` (flujo de
contraseña). E2E (`visor-pdf.spec.ts`, 8 nuevos): contraseña (incorrecta, correcta, nada
guardado; cancelar y Esc; Ctrl+O durante el diálogo), pantalla completa con las cabeceras
reales, atajos de una tecla y su interruptor, navegación, búsqueda avanzada y miniaturas;
todos con cero errores de consola, cero violaciones de CSP y ninguna petición externa.

**Pendiente de la fase**: nada bloqueante. Lo que sale está en
[TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md).

La especificación aprobada, que sigue, se conserva como referencia.

> **Replanteada al cerrar la Fase 5**, que ya hizo las miniaturas, la búsqueda básica y
> los atajos con modificador. Lo que sigue es lo que queda del visor. **Especificada de
> nuevo el *2026-09-30*, después de las Fases 7, 7 bis y 8** (se hicieron antes por orden
> del usuario; la numeración histórica se conserva). D13 confirmada: la contraseña entra.

**Objetivo.** Completar el visor PDF.

**Dependencias.** F5 ✅. **D13** ✅ (confirmada al especificar la fase). No depende de nada
pendiente de las Fases 7 bis y 8 ni de la comprobación de cabeceras en producción: la fase
**no cambia las cabeceras** (ver «Pantalla completa»).

**Punto de partida (código de la F5).** `src/app/pdf/atajos.ts` resuelve las teclas
(`atajoDe`, sin nada con el foco en `input`, `textarea`, `select` o `contenteditable`) y
`Visor.tsx` las aplica desde un `keydown` en `window`; `estado.ts` es el reductor de la
vista (`girar` solo a la derecha); `src/pdf/visor/busqueda.ts` indexa cada página como
texto normalizado con dos tablas paralelas (`trozo`, `posicion`) para resaltar sobre la
capa de texto; `PanelMiniaturas.tsx` es una lista de botones; `engine.ts` convierte la
`PasswordException` de pdf.js en `PdfProtegidoError` y `VisorPdf.tsx` muestra un aviso.

**Alcance**

- **Atajos.** Lista cerrada: la de PLAN §9.4, marcada «F6». No se añade ningún otro.
  - *De una tecla* (WCAG 2.1.4): `F` pantalla completa · `T` mostrar u ocultar miniaturas ·
    `R` girar a la derecha · `Shift+R` girar a la izquierda · `?` ayuda de atajos. Se
    pueden **desactivar** con un interruptor **dentro del diálogo de ayuda**; el estado
    vive **solo en memoria** (dura la sesión de la pestaña, también al abrir otro
    documento; se pierde al recargar) hasta que la Fase 10 lo persista. Como `?` también
    se desactiva, la ayuda tiene además un botón en la barra.
  - *De navegación* (no son teclas de carácter; no se desactivan): `→` / `←` página
    siguiente / anterior **solo en «página a página»** (en la continua siguen siendo el
    desplazamiento horizontal del navegador) · `Espacio` / `Shift+Espacio` página
    siguiente / anterior, en las dos vistas, como `AvPág`/`RePág` · `F3` / `Shift+F3`
    coincidencia siguiente / anterior · `Ctrl/Cmd+G` lleva el foco al campo de página (y
    selecciona su contenido).
  - Reglas comunes: ningún atajo actúa con el foco en `input`, `textarea`, `select` o un
    elemento editable (`contenteditable`), ni con un diálogo modal abierto, ni con `Alt`,
    ni con `Ctrl`/`Cmd` salvo los que lo llevan. **Excepciones:** `F3`/`Shift+F3` también
    actúan con el foco en el campo de búsqueda (no escriben nada; hacen lo mismo que
    `Intro`/`Mayús+Intro` allí). `Espacio` tampoco actúa con el foco en un botón, enlace,
    casilla u otro control que lo use para activarse. `F3` solo actúa con la barra de
    búsqueda abierta; si está cerrada, no se intercepta.
  - Se conservan sin cambios los de la F5 (`AvPág`/`RePág`, `Inicio`/`Fin`, `↓`/`↑`,
    `Ctrl/Cmd +/−/0`, `Ctrl/Cmd`+rueda, `Ctrl/Cmd+F`, `Intro`/`Mayús+Intro`/`Esc` en la
    búsqueda) y `Ctrl/Cmd+O` de la app.
  - Ayuda `?`: `<dialog>` modal con la tabla de todos los atajos del visor y el
    interruptor «Atajos de una tecla» (casilla con etiqueta); se cierra con `Esc` o su
    botón y devuelve el foco a donde estaba.
- **Pantalla completa.** Fullscreen API (`requestFullscreen`) sobre el **área de lectura**
  (el contenedor desplazable de las páginas). `F` y un botón de la barra (con
  `aria-pressed`) entran o salen según el estado actual (`document.fullscreenElement`);
  `Escape` sigue siendo la salida nativa del navegador (BPDF no la intercepta). El estado
  se lee del evento `fullscreenchange` (también cuando sale el navegador) y se anuncia.
  Si `document.fullscreenEnabled` es falso, el botón no se muestra y `F` no hace nada.
  Un `requestFullscreen` rechazado no rompe nada. Al cerrar el documento, el navegador
  sale solo (el elemento desaparece). **Cabeceras: sin cambios.** El valor por defecto de
  `fullscreen` en `Permissions-Policy` ya es el propio origen (`self`), así que la política
  actual no lo necesita; un E2E lo comprueba con las cabeceras reales de `vite preview`
  (SEGURIDAD §2.2). En Electron (F14), además `F11`.
- **Rotar a la izquierda:** acción nueva del reductor (−90°) y botón en la barra junto al
  de la derecha.
- **Búsqueda** (se conserva todo lo de la F5: sin diacríticos, espacios colapsados, fin de
  línea como espacio, resaltado, recuento, salto, «sin texto»):
  - «Distinguir mayúsculas» y «Palabra completa»: dos botones conmutables
    (`aria-pressed`) en la barra de búsqueda, desactivados por defecto, en memoria del
    visor; cambiar uno relanza la búsqueda. **Distinguir mayúsculas no distingue
    acentos** (los diacríticos se siguen ignorando, como en la F5).
  - `F3` / `Shift+F3` (arriba).
  - Unir palabras partidas con guion al final de línea.
  - Estrategia de índice: [ARCHITECTURE.md](ARCHITECTURE.md) §4 quater se actualiza al
    implementar; resumen en «Diseño de la búsqueda», abajo.
- **Miniaturas:** navegación con `↑`/`↓` dentro del panel (índice de tabulación móvil:
  solo la miniatura de la página actual está en el orden de tabulación; las flechas mueven
  el foco a la anterior o la siguiente y la llevan a la vista; `Intro`/`Espacio` la
  activan, como ya hace el botón). Las flechas del panel no desplazan el área de lectura.
  Sin reescribir el panel: el pintado por `IntersectionObserver` sigue igual.
- **Contraseña (D13):**
  - Un PDF con contraseña de apertura (`PasswordException`, código `NEED_PASSWORD`) abre
    un `<dialog>` modal accesible (título, campo `type="password"` con etiqueta,
    «Abrir» y «Cancelar»; el foco va al campo) en lugar del aviso actual.
  - «Abrir» vuelve a abrir el PDF con `getDocument({ …, password })`, con una copia nueva
    de los bytes del `Blob` (la anterior se transfirió al worker de pdf.js y la tarea
    fallida se destruye). Mientras, el botón dice que está comprobando y no se puede
    pulsar dos veces.
  - Contraseña incorrecta (`INCORRECT_PASSWORD`): el diálogo sigue abierto, dice que no es
    correcta (`role="alert"`, asociado al campo), vacía el campo y le devuelve el foco. Se
    puede reintentar sin límite (todo es local).
  - «Cancelar» o `Esc` **cierran el documento** (vuelve el estado vacío).
  - La contraseña **no se guarda**: vive solo en el estado del campo y en la llamada a
    pdf.js; nada de `localStorage`, `sessionStorage`, registro ni mensajes; el campo no
    se autocompleta (`autocomplete="off"`) y el formulario nunca se envía
    (`preventDefault`; la CSP tiene `form-action 'none'`). Al abrir, se descarta.
  - Un PDF con solo contraseña de permisos (propietario) abre como hasta ahora, sin
    diálogo.
  - `engine.ts`: `abrirPdf` acepta la contraseña opcional y `PdfProtegidoError` dice si
    falta o es incorrecta. Se mantiene la cancelación (abrir otro documento durante el
    diálogo o la comprobación lo cancela).

**Diseño de la búsqueda** (texto original, normalizado e índices):

- El índice de cada página (`IndicePagina`) pasa a tener **dos textos de la misma
  longitud** y las mismas tablas paralelas: `texto` (NFKD, sin marcas diacríticas, espacios
  colapsados; **conserva mayúsculas**) y `minusculas` (lo mismo en minúsculas). Para cada
  carácter original se calcula su forma normalizada y su minúscula; si pasar a minúsculas
  cambiara la longitud (casos raros de Unicode), `minusculas` guarda la forma sin bajar,
  para que las dos cadenas sigan alineadas unidad a unidad. `trozo[k]` y `posicion[k]`
  (trozo de `getTextContent` y posición UTF-16 dentro de su `str`) valen para las dos.
- La consulta se normaliza igual; sin «mayúsculas» se busca en `minusculas`, con ella en
  `texto`. Las coincidencias salen como posiciones del texto normalizado y se traducen a
  tramos del texto **mostrado** (la capa de texto, un elemento por trozo) con las mismas
  tablas: el resaltado no cambia.
- «Palabra completa»: una coincidencia vale si el carácter anterior y el siguiente (en el
  texto normalizado) no son letra ni número (`\p{L}`, `\p{N}`), o son el principio o el
  final de la página. Si un candidato no vale, se sigue buscando desde el carácter
  siguiente (no se salta un candidato válido que se solape).
- Guion de fin de línea: si un trozo termina (sin contar espacios) en guion (`-`, U+2010)
  precedido de una letra, la línea acaba ahí (`hasEOL` del trozo o de los trozos vacíos
  que le siguen) y lo siguiente es una letra, ni el guion ni el espacio del fin de línea
  entran en el índice: «pala-⏎bra» se encuentra como «palabra», y su resaltado sale en
  dos tramos (uno por trozo, como ya ocurre con una frase partida). El guion blando
  (U+00AD) se ignora siempre. Límite que se documenta: un compuesto de verdad partido en
  el fin de línea («franco-⏎alemán») se encuentra sin guion, no con él.
- Coste: una cadena más por página indexada (el índice sigue siendo solo cadenas).

**Fuera de alcance.** Atajo `I` (página oscura/original) y cualquier otro atajo no
listado arriba; esquema/marcadores del PDF (outline), candidato posterior; anotaciones;
persistir el interruptor de atajos (Fase 10) o las opciones de búsqueda (decidido el
*2026-10-03*: no se guardan, ni en la Fase 10); índice de
Markdown con `T`; tokens de color nuevos para la búsqueda (el resaltado de la F5 ya usa el
acento: PLAN §9.2).

**Archivos esperados.** `src/app/pdf/atajos.ts`, `estado.ts`, `Visor.tsx`,
`BarraHerramientas.tsx`, `BarraBusqueda.tsx`, `PanelMiniaturas.tsx`, `VisorPdf.tsx`, un
componente nuevo para la ayuda y otro para la contraseña en `src/app/pdf/`;
`src/pdf/visor/busqueda.ts` y `controlador.ts`; `src/pdf/engine.ts`;
`src/i18n/messages.ts`; un fixture de búsqueda (mayúsculas y guion de fin de línea)
generado en `tests/fixtures/pdf/visor/generar.mjs`; tests y E2E. **No** cambian
`security-headers.ts` ni `vercel.json`.

**Tests**

- Unitarios:
  - `atajos`: cada atajo de la lista; `?` con y sin `Shift` (depende de la distribución
    del teclado); `R` frente a `Shift+R`; atajos de una tecla desactivados; foco en
    `input`, `textarea`, `select` y `contenteditable`; `F3` en el campo de búsqueda;
    `Espacio` sobre un botón; `→`/`←` solo en «página a página»; `Ctrl/Cmd+G`; con `Alt`
    no hay atajo.
  - `estado`: girar a la izquierda (0 → 270 → 180…).
  - `busqueda`: los tests de la F5 sin cambios; mayúsculas (con `İ`, `ß`, ligaduras,
    emoji: las dos cadenas del índice miden lo mismo); palabra completa (bordes, principio
    y final de página, candidatos solapados, frase entre trozos); guion (en el mismo
    trozo, con trozo vacío de fin de línea, guion blando, número con guion que no se une,
    guion a mitad de línea que no se une).
  - `engine`: `protegido.pdf` (contraseña «bpdf», fixture existente) sin contraseña
    («falta»), con una incorrecta («incorrecta»), con la correcta (abre); cancelación
    durante la comprobación.
  - `controlador`: la búsqueda recibe y aplica las opciones.
- Componentes + jest-axe: ayuda de atajos (tabla, interruptor, cierre y foco); barra de
  búsqueda (opciones con `aria-pressed`, relanzar); diálogo de contraseña (etiqueta, error
  asociado, campo vacío tras fallar, «Cancelar» cierra); miniaturas (flechas, un solo
  elemento tabulable, las flechas no llegan al lector); barra (girar a la izquierda,
  pantalla completa, ayuda).
- E2E (con la vigilancia de siempre: cero errores de consola, cero violaciones de CSP,
  ninguna petición externa): `T` abre y cierra miniaturas; `R` y `Shift+R` giran;
  `F` entra y sale de pantalla completa (`document.fullscreenElement`) con las cabeceras
  reales; `?` abre la ayuda, desactivar los atajos hace que `R` no gire y el botón de la
  barra la vuelve a abrir; búsqueda con «palabra completa», «mayúsculas», `F3`/`Shift+F3`
  y una palabra partida con guion; `→`/`←`, `Espacio` y `Ctrl/Cmd+G`; flechas en las
  miniaturas; contraseña: incorrecta, correcta (la página se pinta), cancelar (vuelve el
  estado vacío) y la contraseña no aparece en `localStorage` ni `sessionStorage`.

**Criterios de aceptación.** Definición de hecho común.

**Documentación.** PLAN §6.2, §9.3 y §9.4 (estado), ARCHITECTURE §4 quater (teclado,
búsqueda, pantalla completa, contraseña y límites), SEGURIDAD §4 (PDF cifrados),
bitácora, TAREAS.

**Resultado esperado.** Visor PDF con todas las funciones pedidas.

---

## Fase 7 — Markdown: lectura ✅

Cerrada el 2026-09-30. Bitácora: iteración 8. Diseño completo (pipeline, URLs, HTML,
imágenes, índice, código, estilos, ciclo de vida, rendimiento, límites):
[ARCHITECTURE.md](ARCHITECTURE.md) §4 quinquies. El encargo la llamó «Fase 6»; es esta.

**Hecho.** Lector de Markdown GFM en [`src/markdown/`](../src/markdown/), cargado a
demanda: `react-markdown` + `remark-gfm` (encabezados, párrafos, énfasis, tachado, listas
anidadas, citas, enlaces, código en línea y en bloque, tablas con alineación, listas de
tareas de solo lectura, autoenlaces, notas al pie, separadores); HTML crudo como texto
(D6); política de URLs propia con dos capas (`url-policy.ts`); enlaces externos por
`Platform.openExternal` y anclas con foco; imágenes como marcadores (remotas bloqueadas,
D7); resaltado con lowlight (9 gramáticas) y botón de copiar; índice h1–h6 con ids
`md-…` deterministas; estilos propios con los tokens; aviso «Preparando…» en documentos
grandes. `DocumentSummary` (la vista provisional de la Fase 3) está borrada.

**Desviaciones respecto a la especificación anterior:**

- **Imágenes locales aplazadas** (lo permitía el encargo). En web, un `File` suelto no
  da acceso a sus hermanos: abrir el `.md` con sus imágenes (varios ficheros o una
  carpeta, `resources`, normalización de rutas, `blob:`, `img-src blob:`) es un cambio en
  la apertura, la plataforma y la CSP. Hoy **no se carga ninguna imagen**: cada una es un
  marcador. Pasa a TAREAS como tarea propia, con el diseño de esta sección intacto
  (PLAN §7.2, SEGURIDAD §3.1).
- **Sin `rehype-highlight`**: `lowlight` directamente con 9 gramáticas. El plugin arrastra
  el subconjunto `common` (~37) y complica copiar el texto original.
- **Índice h1–h6 (no h1–h3), sin resaltar la sección visible**: el encargo pedía h1–h6 y
  un panel sencillo; resaltar exigiría un `IntersectionObserver` que no aporta lo bastante.
- **HTML crudo como texto, no «ignorado»** (D6 decía «se ignora»): el encargo aceptaba
  las dos y verlo es más honesto; los comentarios sí se quitan. Pendiente de visto bueno.
- **Tamaño de letra fijo** (17 px): la preferencia llega con la Fase 10.
- **1 MB no se muestra en < 1 s**: medido, 3,3–7,3 s (ARCHITECTURE §4 quinquies). Como
  preveía el criterio, queda anotado para la F13 (worker o render incremental). Además,
  **muchas listas cortas son cuadráticas** en el parser (`mdast-util-from-markdown`):
  pendiente en TAREAS.

**Tests.** Unitarios: `url-policy`, `toc`, `resaltado`. Componentes con jest-axe:
`MarkdownView` (Markdown básico, GFM, mal formado, HTML, enlaces, imágenes, índice,
código y copiar, ciclo de vida, documento grande) y el **corpus de XSS** (22 casos +
`seguridad.md`). E2E (`markdown.spec.ts`, 10): contenido, GFM, código y copiar con el
portapapeles real, índice, enlace externo, Markdown malicioso, PDF ↔ Markdown, ventana
estrecha, tema y 1 MB; todos con cero errores de consola, cero violaciones de CSP y
ninguna petición externa. Benchmark: `npm run bench:markdown`. Probado además con 14
Markdown reales (los de `docs/` y README de paquetes con HTML, insignias remotas y tablas).

**Pendiente de la fase**: nada bloqueante. Lo que sale (imágenes locales, rendimiento,
listas cuadráticas, visto bueno de D6 como texto) está en
[TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md).

---

## Fase 7 bis — Markdown: recursos locales ✅

Cerrada el 2026-09-30. Bitácora: iteración 9. El encargo la llamó «Fase 8»; en el plan
va entre la 7 y la 8 (KaTeX y Mermaid), como tarea aplazada de la 7, sin renumerar.
Diseño completo: [ARCHITECTURE.md](ARCHITECTURE.md) §4 sexies.

**Decisiones del encargo.** Imágenes locales antes de KaTeX/Mermaid; HTML crudo, como
texto (D6, visto bueno dado); el parser lento y el objetivo de < 1 s, fuera; un documento
a la vez (D16).

**Hecho.** «Abrir archivo» con selección múltiple (un documento, o un `.md` con sus
imágenes), «Abrir carpeta» (`webkitdirectory`) con elección del Markdown principal si hay
varios, y soltar varios ficheros o una carpeta (`webkitGetAsEntry`). `OpenedMarkdown`
gana `resources` (rutas relativas a la entrega → `Blob` sin leer). `resolverRecurso`,
único punto de resolución, con traversal (también codificado) bloqueado. Imágenes PNG,
JPEG, GIF, WebP y SVG (solo como `<img>`) con URL `blob:` creadas bajo demanda, una por
recurso y revocadas al desmontar. CSP: `img-src 'self' blob:`. Errores nuevos:
`no-markdown`, `several-markdown`, `incompatible`, `folder-no-markdown`,
`folder-too-large` y `mixed-drop` (sustituyen a `multiple`); por imagen, marcadores
`no-encontrado`, `fuera`, `no-soportado`, `demasiado-grande`, `ambiguo`, `invalido` y
`rota`.

**Desviaciones y decisiones propias:**

- **Una sola vía de ficheros, no un botón aparte** para «Markdown con recursos»: el
  selector de archivos admite varios. Un fichero suelto sigue igual; el texto del estado
  vacío explica cómo ver las imágenes. «Abrir carpeta» sí es un botón aparte (el
  navegador no permite elegir ficheros y carpetas en el mismo diálogo).
- **Resolución exacta**: ni búsqueda por nombre cuando la ruta lleva subcarpetas y se
  eligieron ficheros sueltos, ni mayúsculas indistintas. Adivinar sería resolver a un
  fichero que el documento no nombra.
- **SVG sin sanear ni rasterizar**: como `<img>` es inerte; abierto como página, la CSP
  heredada lo frena (medido).
- **Enlaces a otros ficheros**: siguen inertes aunque se hayan entregado.

**Tests.** Unitarios: `recursos` (resolución, traversal, estados, construcción),
`seleccion` (apertura de ficheros y carpetas), `imagenes` (`AlmacenUrls`), plataforma
web (selector de carpeta, carpeta soltada con entradas simuladas, topes). Componentes:
imágenes locales en el visor (URL creadas, compartidas, revocadas; marcadores; axe), App
(carpeta con varios `.md`, cancelar, varios `.md` a la vez). E2E (`recursos.spec.ts`,
8): Markdown suelto, con imagen, carpeta completa (8 formatos y nombres), SVG hostil
también abierto como página, varios Markdown, carpeta con elección, soltar, sustituir y
revocar, PDF y vuelta. Fixtures generados (`tests/fixtures/markdown/recursos/generar.mjs`).

**Pendiente de la fase**: nada bloqueante. Lo que sale está en
[TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md).

---

## Fase 8 — Markdown: matemáticas y Mermaid ✅

Cerrada el 2026-09-30. Bitácora: iteración 10. Diseño completo: [ARCHITECTURE.md](ARCHITECTURE.md)
§4 septies; seguridad: [SEGURIDAD.md](SEGURIDAD.md) §2.1 y §3.1.

**Hecho.** Fórmulas `$…$`, `$$…$$` y ```` ```math ```` con KaTeX, a demanda; diagramas
```` ```mermaid ```` con Mermaid en un **marco aislado** (iframe con `sandbox`, origen
opaco, CSP propia sin red), dibujados al entrar en pantalla y mostrados como
`<img src="blob:…">` con su código plegado. Fórmulas y diagramas inválidos, enormes o
hostiles se ven como código con aviso; el documento nunca se rompe. Un Markdown sin
fórmulas ni diagramas no descarga nada de esto.

**Desviaciones respecto a la especificación anterior, y por qué:**

- **Sin `rehype-katex`**: parsea el HTML de KaTeX con `innerHTML` en el navegador. BPDF
  construye los nodos con el `toNode()` de KaTeX desde su árbol, y quita el `style` que
  KaTeX pone por atributo en `\vec`, `\oiint` y `\pmb` (la CSP lo bloqueaba).
- **`strict: "ignore"`** en vez de `"warn"`: `"warn"` escribe en consola por LaTeX no
  estricto, y la consola limpia es un criterio de los E2E. `throwOnError: true` y el
  código como reserva, en vez de `false`.
- **Mermaid en un iframe aislado**, no en la página: con la CSP de la app, 250 violaciones
  en cinco diagramas (Mermaid necesita estilos en línea). Decisión confirmada al empezar.
  Añade `frame-src 'self'` a la app y una segunda página (`mermaid.html`) con su política.
- **Mermaid 11.17.2**, no 12: la 12.0.0 era un major de tres semanas.
- **Dos saneados del SVG**: en el marco con DOM, y en la app sin DOM (`DOMParser` hereda la
  CSP de la app: cada `style` sería una violación, medido).
- **Nodos con imagen** (`@{ img: … }`): no se dibujan (Mermaid intentaría cargar la imagen).
- **Vite dejó de incrustar recursos como `data:`** (`assetsInlineLimit: 0`): las fuentes
  pequeñas de KaTeX se incrustaban y la CSP las bloqueaba.

**Tests.** Unitarios: `svg-seguro` (saneador y verificador con SVG hostiles), `mermaid`
(configuración, protocolo, marco: aislamiento, mensajes ajenos o mal formados, tiempo
límite, destrucción), `matematicas` (opciones y entradas hostiles con KaTeX real),
`seguridad` (CSP de la app y del marco, cabeceras por ruta). Componentes:
`formulas-diagramas.test.tsx` (KaTeX real en jsdom, marco simulado, jest-axe). E2E
(`formulas-diagramas.spec.ts`, 7): fórmulas, diagramas, aislamiento del marco desde
dentro, KaTeX y Mermaid hostiles, documento sin fórmulas ni diagramas sin descargas,
`mermaid.html` abierta directamente. Benchmark: `npm run bench:markdown`.

**Pendiente de la fase**: nada bloqueante. Lo que sale está en
[TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md).

---

## Fase 9 — Editor Markdown, vista previa y modo dividido ✅

**CERRADA / APROBADA** el 2026-10-03 (iteración 20), **con una excepción de rendimiento**
(abajo). Historia: se dio por cerrada el 2026-10-01 (iteración 14), se reabrió el
2026-10-02 al revisar el benchmark (el criterio «editar un .md de 1 MB sin retraso
perceptible al teclear» fallaba en Dividido) y se investigó en las iteraciones 15–19.
Diseño: [ARCHITECTURE.md](ARCHITECTURE.md) §4 octies. D9 confirmada al empezar:
**CodeMirror 6**.

**Excepción de rendimiento aceptada** (decisión del usuario, *2026-10-03*). El criterio
«1 MB sin retraso perceptible» **no se cumple** en dos casos extremos, y se acepta así:

| Caso (Dividido) | Última medición oficial (`bench:editor`, iteración 18, Chromium, 3 ejecuciones) |
|---|---|
| 1 MB + KaTeX | P95 96 · P99 216 · máx. 256 ms; 5–11 eventos ≥ 100 ms por ejecución; tarea larga 97–203 ms. Firefox (iteración 17): P95 56–72, máx. 88 ms |
| 1 MB de encabezados (56 000 bloques) | P95 64 · P99 112 · máx. 120 ms (coste del parser de Lezer; Edición: máx. 48 ms) |

- Objetivos que no se alcanzan: los propuestos en la iteración 16 (P95 ≤ 50, P99 ≤ 100,
  máx. ≤ 200 ms, 0 pulsaciones ≥ 100 ms, tarea larga ≤ 100 ms).
- Causas, perfiladas: en KaTeX, al saltar de zona Chromium materializa los bloques con
  fórmulas que entran en la vista (PrePaint y composición), más el análisis en segundo
  plano de CodeMirror y los detectores de anuncios del navegador (iteración 19); en
  encabezados, Lezer reequilibra los bloques de primer nivel en cada tecla (iteración 18).
- **`content-visibility` se conserva.** Se probó quitarlo de los bloques con fórmulas:
  mejoraba el P99 y el máximo, pero empeoraba el P95, los eventos ≥ 50 ms, la memoria y el
  tiempo de entrar en Dividido (medición del usuario; sus cifras no están en el
  repositorio). Detalle: bitácora, iteraciones 19 y 20.
- Los documentos normales no tienen el problema: 2 KB–200 KB, y 1 MB sin KaTeX ni
  encabezados extremos, máx. ≤ 64 ms en Dividido (iteraciones 16–18).
- El resaltado con muchos encabezados se mantiene tal cual (decisión de la iteración 19).

El resto de esta sección es el registro de la investigación (iteraciones 14–17) y la
especificación original.

Benchmark de la iteración 14 (`npm run bench:editor`, *2026-10-01*; Chromium
headless, 1400×900, build de producción; Event Timing API: duración de cada evento de
teclado, de la tecla al pintado, solo los de 16 ms o más; 22 teclas a 50 ms, 5 teclas con
pausas de 400 ms, deshacer y rehacer, al principio, en medio y al final). «Lentos» = eventos
de 50 ms o más por zona:

| Caso | Edición: mediana · máx. · lentos | Dividido: mediana · máx. · lentos |
|---|---|---|
| 2 KB | 16 · 24 ms · 0 | 16 · 16–24 ms · 0 |
| 200 KB | 16 · 16–24 ms · 0 | 16 · 56–72 ms · 27–30 (vista previa en pausa) |
| 1 MB | 16 · 24 ms · 0 | **24 · 224–256 ms · 37–46** (en pausa) |
| 1 MB + KaTeX | 16–24 · 24–56 ms · 0–3 | **72–80 · 784–1104 ms · 468–708** (en pausa) |
| 1 MB + Mermaid | 16 · 24–32 ms · 0 | 24–32 · 240–328 ms · 18–68 (en pausa) |
| 1 MB de encabezados | 16–40 · 24–48 ms · 0 | 32–48 · 56–72 ms · 16–54 (en pausa) |

**Resultado: el criterio «1 MB sin retraso perceptible» se cumple en Edición y NO en
Dividido**, también con la vista previa en pausa (sin refrescos): el retraso no viene del
refresco. Por eso la Fase 9 se reabrió (*2026-10-02*).

**Diagnóstico con trazas de Chromium (*2026-10-02*, iteración 15).** La tabla anterior
mezcla dos cosas:

- **Un artefacto del benchmark.** Heredaba `trace: "retain-on-failure"` de
  `playwright.config.ts`, y la instantánea del DOM que Playwright hace en cada acción
  bloqueaba el hilo principal (~0,9 s con 1 MB, ~3,9 s con KaTeX). Las teclas que caían
  detrás medían esa espera. El bench va ahora sin traza (`playwright.bench.config.ts`).
- **Un coste real con KaTeX.** Tras cada tecla, Chrome repite el hit test del ratón
  (hover), y ese hit test recorría la vista previa entera: 282 000 nodos, 45 000
  posicionados por KaTeX, ~40 ms por tecla. Corrección: `content-visibility: auto` en
  los bloques con fórmulas (markdown.css). En todos los bloques no vale: con 56 000
  bloques, su IntersectionObserver interno costaba ~37 ms dos veces por fotograma.

Benchmark tras la corrección (mismo método, sin traza de Playwright, dos ejecuciones):

| Caso | Edición: mediana · máx. · lentos | Dividido: mediana · máx. · lentos |
|---|---|---|
| 2 KB | 16 · 16–24 ms · 0 | 16 · 16–24 ms · 0 |
| 200 KB | 16–24 · 16–24 ms · 0 | 16 · 24–32 ms · 0 (en pausa) |
| 1 MB | 16 · 16–32 ms · 0 | 16 · 24–72 ms · 0–28 (en pausa) |
| 1 MB + KaTeX | 16 · 16–104 ms · 0–1 | **48 · 104–344 ms · 10–75** (en pausa) |
| 1 MB + Mermaid | 16–32 · 16–32 ms · 0 | 16–24 · 24–72 ms · 0–20 (en pausa) |
| 1 MB de encabezados | 16–32 · 16–64 ms · 0–3 | 24–32 · 40–112 ms · 0–20 (en pausa) |

Sin la traza de Playwright y antes de la corrección (una ejecución), KaTeX en Dividido
daba mediana 48 · máx. 120–208 ms · 130–342 lentos.

**Pendiente para aprobar la fase (en la iteración 15; resuelto con la excepción de
arriba).** Que el criterio se cumpla en 1 MB + KaTeX en Dividido. Lo que quedaba, según la
traza: hit test de ~30 ms por tecla (los bloques sin
fórmulas siguen pintados); una vez por segundo, los detectores de anuncios de Chromium y
un Commit (~100 ms); y un primer fotograma de ~270 ms tras saltar al final (PrePaint). Que
1 MB en Dividido (máx. 24–72 ms) se dé por bueno lo decide quien aprueba la fase.

**Benchmark ampliado (*2026-10-02*, iteración 16).** Misma escritura de siempre (50 ms
entre teclas, tres zonas, deshacer y rehacer, se teclea nada más saltar a cada zona).
Ahora hay un solo observador de eventos por página: hasta la iteración 15 se creaba uno
por zona, y los recuentos de eventos ≥ 50 ms de las tablas anteriores salían
multiplicados ×1 a ×6 (los máximos no). Chromium, tres ejecuciones juntas (≈ 280
pulsaciones por fila).
- **Latencia por pulsación:** Event Timing agrupado por `interactionId` (como INP). «<16»
  = el navegador no la informó.
- **Eventos y tareas:** eventos ≥ 50 / ≥ 100 ms y tarea larga máxima, rango entre
  ejecuciones.

| Caso | Modo | P50 | P95 | P99 | Máx. | Ev. ≥ 50 | Ev. ≥ 100 | Tarea máx. |
|---|---|--:|--:|--:|--:|--:|--:|--:|
| 2 KB | Edición | <16 | 16 | 16 | 24 | 0 | 0 | 0 |
| 2 KB | Dividido | <16 | 16 | 16 | 24 | 0 | 0 | 0 |
| 100 KB | Edición | <16 | 16 | 16 | 24 | 0 | 0 | 0 |
| 100 KB | Dividido | <16 | 16 | 24 | 24 | 0 | 0 | 123–138 |
| 200 KB | Edición | <16 | 16 | 16 | 16 | 0 | 0 | 0 |
| 200 KB | Dividido | <16 | 24 | 24 | 32 | 0 | 0 | 0 |
| 1 MB | Edición | <16 | 24 | 32 | 32 | 0 | 0 | 0 |
| 1 MB | Dividido | 16 | 32 | 56 | 64 | 2–7 | 0 | 0 |
| 1 MB + KaTeX | Edición | <16 | 24 | 32 | 88 | 0–1 | 0 | 0 |
| **1 MB + KaTeX** | **Dividido** | **48** | **112** | **320** | **400** | **38–111** | **17–21** | **223–288** |
| 1 MB + Mermaid | Edición | <16 | 24 | 32 | 40 | 0 | 0 | 0 |
| 1 MB + Mermaid | Dividido | 16 | 32 | 56 | 64 | 2–4 | 0 | 0–54 |
| 1 MB de encabezados | Edición | 16 | 56 | 64 | 72 | 0–63 | 0 | 0–63 |
| 1 MB de encabezados | Dividido | 32 | 56 | 104 | 104 | 8–40 | 0–4 | 59–62 |

Vista previa (Dividido, Chromium; mediana de 3–5 refrescos):

| Caso | Desde | Espera | Procesamiento | Pintado | Total |
|---|---|--:|--:|--:|--:|
| 2 KB | última tecla | 202 | 5 | 1 | 208 |
| 100 KB | última tecla | 202 | 129 | 5 | 335 |
| 200 KB | última tecla | 203 | 213 | 9 | 425 |
| 1 MB | clic en «Actualizar» (en pausa) | — | 1268 | 68 | 1344 |
| 1 MB + KaTeX | clic en «Actualizar» (en pausa) | — | 1363 | 174 | 1537 |
| 1 MB + Mermaid | clic en «Actualizar» (en pausa) | — | 1107 | 82 | 1188 |

Las tablas de memoria, Mermaid, carga del editor y Firefox, y la propuesta de criterio, van
en la entrada de la iteración 16 de [CHANGELOG.md](CHANGELOG.md).

**Iteración 17 (*2026-10-03*).**
- **Retención corregida.** Al cambiar de documento desde Dividido, el preview anterior
  quedaba vivo: lo retenía el `Range` que CodeMirror guarda en una variable de módulo, a
  través del ShadowRoot del editor. Ahora el ShadowRoot cuelga de un nodo propio que se
  quita al desmontar (E2E `memoria.spec.ts`).
- **Firefox medido sin el ruido de Playwright.** Las cifras de minutos al cambiar de modo
  eran sus localizadores (perfil de Gecko). Teclear con 1 MB + KaTeX en Dividido: P95
  56–72, máx. 88 ms; con 1 MB, máx. 24–32 ms.
- **Pendiente para aprobar (en la iteración 17; resuelto con la excepción de arriba):** lo
  de Chromium de la iteración 16 (KaTeX en Dividido y 1 MB de encabezados) y KaTeX en
  Dividido en Firefox. WebKit sigue sin medir (tarea propia en TAREAS). Detalle en la
  bitácora.

**Implementado** (verificado; el criterio de 1 MB, con la excepción de arriba). Modos Lectura / Edición / Dividido (`ModeSwitch`); editor CodeMirror 6 a demanda
(98 KB gzip, trozo propio) con Markdown (GFM), historial, teclado e indentación; vista
previa con el mismo lector, 200 ms después de la última tecla; `SplitView` con separador
accesible (teclado, 20–80 %) que se apila en pantallas estrechas; desplazamiento
sincronizado por encabezados; «modificado» en `DocumentProvider`, confirmación antes de
sustituir o cerrar (`ConfirmarDescarte`) y `beforeunload`; `Platform.saveText` en web
(`showSaveFilePicker` o descarga) y `Ctrl/⌘+S`. **CSP sin cambios.**

**Desviaciones y decisiones, y por qué:**

- **Editor en un Shadow DOM** (no en la página): con el `document` como raíz, CodeMirror
  pone sus estilos en una `<style>` que la CSP bloquea; en un `ShadowRoot` usa hojas
  construibles. Así no hizo falta ni `'unsafe-inline'` ni nonces.
- **Escribir sobre una selección lo aplica CodeMirror, no el navegador**: la edición nativa
  de Chrome creaba `<span style>` (dos violaciones de CSP por pulsación, medido); un
  manejador de `beforeinput` lo evita.
- **Vista previa en pausa en documentos grandes** (decisión del usuario durante la fase): si
  pintarla costó > 250 ms, en Dividido no se refresca sola; avisa y se actualiza a mano o al
  cambiar de modo. Con 1 MB, cada refresco bloqueaba la escritura 1,4–3,4 s.
- **La confirmación de «cambios sin guardar» va DESPUÉS de elegir** el fichero (y de
  validarlo), no antes de abrir el selector como decía esta especificación: así cancelar el
  selector o elegir algo que no vale no pregunta nada, y todas las vías de apertura (también
  carpeta, soltar y la elección de Markdown, que la especificación no cubría por ser
  anterior a la Fase 7 bis) y cerrar pasan por el mismo punto.
- **En Edición la vista previa no está montada**; Lectura ↔ Dividido sí la comparten sin
  volver a montarla. Mantenerla montada y oculta daba picos de casi 1 s al teclear con
  1 MB + KaTeX (medido).
- **Diagramas recordados**: `MarcoMermaid` guarda los SVG por fuente y colores (64), y un
  diagrama sin cambios no vuelve al marco al refrescar.
- **Nombres de fichero**: `EditorMarkdown.tsx` (no `MarkdownEditor.tsx`); `tipos.ts` y
  `sincronia.ts` aparte; `src/platform/guardar-web.ts` para el guardado web.
- Sin `capabilities` en el modelo: todo Markdown se puede editar y guardar.

**Tests.** Unitarios: `sincronia` (encabezados del texto, anclas, interpolación),
`guardar-web` (selector, reutilización del destino, cancelar, errores, descarga), caché de
`MarcoMermaid`. Componentes con jest-axe: edición en `MarkdownView` (modos, espera de
200 ms, pausa, cambios, guardar y sus fallos, seguridad y recursos en la vista previa),
`ModeSwitch`, `SplitView`, `DocumentProvider` (confirmación por todas las vías,
`beforeunload`) y `App` (diálogo de descarte, `Ctrl+S`). E2E (`editor.spec.ts`, 16): CSP
real con CodeMirror, modos, espera de la vista previa (reloj controlado), recursos, KaTeX y
Mermaid hostiles, Markdown hostil, escribir y pegar sobre una selección, guardar (descarga
y `showSaveFilePicker`), confirmación, `beforeunload`, 1 MB, sincronía, separador y
pantalla estrecha. Benchmark: `npm run bench:editor`.

E2E añadidos durante la investigación: `memoria.spec.ts` (el documento anterior se libera),
el apilado de los paneles (`editor.spec.ts`), la sincronía con fórmulas y los bloques con
fórmulas fuera de la vista (`markdown.spec.ts`). Benchmark ampliado (P50/P95/P99, 100 KB,
desglose de la vista previa, memoria, Mermaid, carga del editor; iteración 16).

**Pendiente de la fase**: nada bloqueante. Lo que sale (Firefox y Safari, WebKit en el
benchmark, IME, búsqueda en el editor) está en [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md).

La especificación aprobada, que sigue, se conserva como referencia.

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
retraso perceptible al teclear (medir en F13 si hay duda). *Al cerrar: se cumple salvo en
1 MB + KaTeX y 1 MB de encabezados en Dividido, aceptados como excepción (arriba).*

**Documentación.** PLAN §7.3, STACK, bitácora, TAREAS.

**Resultado esperado.** Editor Markdown funcional en web.

---

## Fase 10 — Preferencias ✅

**CERRADA / APROBADA** el *2026-10-03* (implementada en la iteración 21; cerrada en la
22). Al cerrar: 973/973 tests unitarios y 108/108 E2E en verde; el usuario hizo las pruebas
manuales 1–10 en la build de producción (posición real de PDF, «recordar» desactivado, sin
documento, diálogo con teclado, cabecera de 375 px, tipografía, miniaturas y atajos,
olvidar, restablecer) y todas salieron bien; el botón solo con icono en pantalla estrecha
quedó aceptado; y una comparación A/B alternada con la Fase 9 no muestra regresión de
rendimiento atribuible (bitácora, iteración 21). Diseño:
[ARCHITECTURE.md](ARCHITECTURE.md) §4 nonies. Tipografía confirmada por el usuario al
empezar: 15, 16, 17, 18, 20 y 22 px; 60, 72 y 90 ch; por defecto 17 px y 72 ch.

**Desviaciones y decisiones al implementar** (detalle en la bitácora, iteración 21):

- **`zod` con `jitless: true`**: sin eso, su comprobación de `new Function` provoca una
  violación de CSP (lo vieron los E2E). La CSP no cambia.
- **Tipografía por `data-letra` y `data-ancho`**, no por `style` en línea con propiedades
  CSS: el corpus de XSS solo admite en el contenido el `style` de las celdas de tabla.
- **`MarkdownView` tiene un oyente global** (el `storage` de las preferencias, compartido
  y que se quita al desmontar): su test «no añade listeners globales» pasa a exigir
  exactamente ese y su retirada.
- **En pantalla estrecha, el botón «Preferencias» es solo un icono** (con nombre accesible y
  `title`): con el texto, la cabecera desbordaba en 375 px (E2E de ventana estrecha).
  **Aceptado por el usuario** al cerrar la fase.
- **El render solo lee la posición** (iteración 22): `recuperarPosicion` no escribe, y que
  abrir un PDF cuente como uso (`t`, para el LRU) lo hace `marcarUso` desde un efecto del
  visor. Mismo comportamiento observable.
- La posición solo se guarda si cambia: abrir un PDF y no moverse no escribe nada.
- **Hallazgo fuera de alcance:** cerrar un PDF mientras se pintan páginas deja a veces un
  rechazo `worker-destruido` en consola. Es **anterior** a la Fase 10 (6 de 24 ejecuciones
  con el código de antes, con carga) y queda en TAREAS.

> **Especificada de nuevo el *2026-10-03* (iteración 20), con la Fase 9 cerrada y las
> decisiones del usuario: **D8 confirmada**; posición **solo para PDF**; opciones de
> búsqueda y estado del editor **no se guardan**; panel de miniaturas **sí**; acceso desde
> la cabecera también sin documento; sin página pública de privacidad en esta fase.

**Objetivo.** Preferencias guardadas en local, un diálogo para cambiarlas, recordar la
posición de lectura de cada PDF y poder borrarlo todo desde la interfaz.

**Dependencias.** F6 ✅, F9 ✅ (cerrada el *2026-10-03*). **D8** ✅ (confirmada el
*2026-10-03*: activado por defecto, huella, 50 entradas, «Olvidar posiciones guardadas»,
sin nombres ni contenido).

**Punto de partida (código).** `atajosDeUnaTecla` (`src/app/pdf/atajos.ts`) guarda el
interruptor en una variable de módulo; `estadoInicial` (`src/app/pdf/estado.ts`) fija
página 1, zoom «ancho», vista continua, modo oscuro y miniaturas cerradas; el tamaño de
letra (`1.0625rem`, 1rem en pantallas estrechas) y el ancho (`72ch`) de Markdown son
fijos en `src/styles/markdown.css`; nada se guarda en `localStorage` y varios tests lo
comprueban (abajo). `DocumentoVisor` no expone la huella del PDF. La cabecera de `App`
solo muestra botones con un documento abierto.

**Alcance**

- **Infraestructura** (aplazada desde la Fase 2):
  - `zod` con **versión exacta** y su fila en `STACK.md` (revisar `allowScripts`).
  - `src/preferences/schema.ts`: esquema de `bpdf:prefs` (abajo) con sus valores por
    defecto. Cada campo se valida **por separado**: uno inválido vuelve a su valor por
    defecto sin arrastrar a los demás.
  - `src/preferences/store.ts`: leer y escribir con todo acceso a `localStorage` en
    `try/catch` (modo privado, cuota, bloqueo); JSON roto o sin `v` entero → valores por
    defecto; **mecanismo de versiones** (abajo).
  - `src/preferences/usePreferences.ts`: gancho sobre una fuente externa
    (`useSyncExternalStore`) que avisa de los cambios de la propia pestaña y de los de
    otras (evento `storage`, que no se dispara en la pestaña que escribe). Devuelve un
    objeto estable: si nada cambia, no hay render.
  - `zod` y el almacén **no entran en el arranque** (`build:tamano`): los cargan los
    trozos a demanda (visor PDF, lector de Markdown, diálogo).
- **Preferencias guardadas** (`bpdf:prefs`) y cuándo se aplican:
  - PDF, **valores al abrir** un documento (no cambian el que ya está abierto): modo de
    página (oscura / original), zoom (ajustar al ancho, a la página o un porcentaje fijo) y
    vista (continua / página a página). Cambiarlos en la barra del visor sigue siendo solo
    para ese documento, como hoy.
  - PDF, **panel de miniaturas abierto o cerrado**: es un estado que se recuerda. Se guarda
    al abrirlo o cerrarlo (`T` o el botón) y se aplica al abrir el siguiente PDF. No sale
    en el diálogo; «Restablecer preferencias» lo cierra.
  - Markdown: **tamaño de letra y ancho de columna**, aplicados al momento (también en la
    vista previa de Dividido) con propiedades CSS en `.md-contenido`; sin volver a
    renderizar el documento.
  - **Atajos de una tecla** activados o no, aplicados al momento. El interruptor de la
    ayuda (`?`) y el del diálogo escriben la misma preferencia.
  - **Recordar la posición de los PDF** (D8), activado por defecto.
- **Posición por documento, solo PDF** (`src/preferences/positions.ts`, `bpdf:positions`):
  - Huella: `pdfDocument.fingerprints[0]` de pdf.js (siempre definido; lo calcula del ID
    del fichero). Nunca el nombre. `DocumentoVisor` la expone.
  - Se guarda la página y el zoom (`{ page, zoom, t }`) con espera (1 s sin cambios) y al
    cerrar el documento, abrir otro o salir de la página (`pagehide`).
  - Al abrir un PDF, si la opción está activada y hay entrada: página (acotada al total) y
    zoom del documento, por encima de los valores por defecto. El acceso actualiza `t`.
  - LRU de 50 por `t`: al pasar de 50 se borra la más antigua.
  - Desactivar la opción deja de leer y de escribir posiciones, **sin borrar** las que hay
    (el diálogo lo dice junto al botón «Olvidar posiciones guardadas», que las borra).
  - Un PDF con contraseña también guarda su posición (la huella no es la contraseña).
- **Diálogo** (`src/preferences/PreferencesDialog.tsx`, cargado a demanda): `<dialog>`
  modal; modo de página, zoom y vista por defecto del PDF; tamaño de letra y ancho de
  Markdown; atajos de una tecla; recordar posición; «Olvidar posiciones guardadas» (borra
  `bpdf:positions`) y «Restablecer preferencias» (borra `bpdf:prefs`; no toca las
  posiciones). Cada acción se anuncia; el foco vuelve al botón que lo abrió.
- **Acceso:** botón «Preferencias» en la cabecera de `App`, **visible siempre**, también en
  el estado vacío. Sin atajo de teclado nuevo.

**Esquema de `bpdf:prefs` (v1).** Todos los campos tienen valor por defecto, que es el
comportamiento actual:

```ts
{
  v: 1,
  pdf: {
    modo: "oscuro" | "original",                       // "oscuro"
    zoom: { tipo: "ancho" } | { tipo: "pagina" }
        | { tipo: "fijo"; valor: number },             // { tipo: "ancho" }; valor 0,25–5
    vista: "continua" | "pagina",                      // "continua"
    miniaturas: boolean,                               // false
  },
  markdown: {
    tamanoLetra: 15 | 16 | 17 | 18 | 20 | 22,          // 17 (px; hoy 1.0625rem)
    ancho: "estrecho" | "normal" | "ancho",            // "normal" (60ch | 72ch | 90ch)
  },
  atajosUnaTecla: boolean,                             // true
  recordarPosicion: boolean,                           // true (D8)
}
```

Los valores de `tamanoLetra` y `ancho` son una **propuesta que se confirma al empezar la
fase** (son visibles para el usuario). En pantallas estrechas (≤ 40rem) se mantiene la
regla de hoy: un píxel menos que en escritorio.

**Esquema de `bpdf:positions` (v1).**

```ts
{
  v: 1,
  docs: {
    [huella: string]: { page: number /* entero ≥ 1 */, zoom: Zoom /* el de arriba */, t: number /* ms epoch */ }
  }                                                    // máx. 50 entradas (LRU por t)
}
```

Respecto a PLAN §8 (`{ [huella]: … }`), se envuelve en `{ v, docs }` para que tenga el mismo
mecanismo de versiones. Una entrada inválida se descarta sola; un fichero roto, entero.

**Mecanismo de versiones** (las dos claves). La v1 es la primera: **no hay ninguna
migración de usuario** que hacer en esta fase. Lo que se construye y se prueba:

- `VERSION = 1` y una tabla de migraciones paso a paso (`n → n + 1`), vacía en la v1.
- Leído con `v` menor que la actual → se aplican los pasos en orden y se valida el resultado.
- `v` mayor que la actual (una versión futura de BPDF en otra pestaña) → valores por
  defecto **en memoria**, sin reescribir la clave mientras el usuario no cambie nada.
- `v` ausente, no entera o datos que no validan tras migrar → valores por defecto.
- Tests con una **tabla sintética** inyectada (p. ej. v1 → v2 → v3 de prueba): orden de los
  pasos, paso que lanza, versión futura, versión sin paso.

**Fuera de alcance.** Posición de documentos Markdown (y cualquier SHA-256 de su texto);
opciones de búsqueda del PDF («Distinguir mayúsculas», «Palabra completa»: siguen en
memoria del visor); estado del editor (modo Lectura/Edición/Dividido, posición del
separador, cualquier otro); página pública de privacidad en `public_docs/`; tema claro
(D10); sincronización (nunca); atajos nuevos; cambios de rendimiento de la Fase 9.

**Archivos esperados.** `src/preferences/*`; `src/app/App.tsx` (botón); `src/app/pdf/`
(`atajos.ts`, `estado.ts`, `Visor.tsx`, `VisorPdf.tsx`); `src/pdf/visor/documento.ts`
(huella); `src/markdown/MarkdownView.tsx` y `src/styles/markdown.css` (propiedades CSS de
tipografía, sin tocar la regla de `content-visibility`); `src/i18n/messages.ts`;
`package.json` y lockfile; tests y E2E. **No** cambian `security-headers.ts` ni
`vercel.json`.

**Seguridad y privacidad.** Solo dos claves: `bpdf:prefs` y `bpdf:positions`. Nunca nombres
de fichero, rutas, contenido ni contraseñas. Lo leído de `localStorage` se trata como
hostil (otra pestaña, manipulación): se valida y nunca rompe el arranque (SEGURIDAD §1.4).

**Tests**

- Unitarios: esquema (válido, cada campo inválido por separado, tipos raros, `__proto__`);
  almacén (JSON roto, `localStorage` que lanza al leer y al escribir, versión futura que
  no se reescribe, tabla de migraciones sintética); gancho (cambio en la pestaña, evento
  `storage`, objeto estable); posiciones (LRU de 50, `t`, entrada inválida, desactivado,
  olvidar); `estado` con valores iniciales; huella expuesta por `DocumentoVisor`.
- Componentes + jest-axe: diálogo (etiquetas, valores, restablecer, olvidar, anuncio,
  foco de vuelta, Esc); botón de la cabecera con y sin documento; `Visor` que abre con los
  valores guardados y guarda las miniaturas; `MarkdownView` con la tipografía.
- **Tests existentes que comprueban almacenamiento vacío** (`atajos.test.ts`,
  `Visor.test.tsx`, `App.test.tsx`, `DocumentProvider.test.tsx`, `editor.spec.ts`,
  `visor-pdf.spec.ts`): se sustituyen por comprobaciones **igual de estrictas** donde el
  comportamiento cambie (solo las dos claves permitidas, sin nombre, contenido ni
  contraseña), y se dejan como están donde nada deba guardarse (abrir o guardar un
  Markdown, el diálogo de contraseña antes de abrir). El de la contraseña de
  `visor-pdf.spec.ts` busca la contraseña «bpdf» en todo el almacenamiento: con la clave
  `bpdf:prefs` fallaría por el nombre de la clave, así que debe buscarla en los valores y
  comprobar aparte que las claves son solo las permitidas.
- E2E (vigilancia de siempre: cero errores de consola, cero violaciones de CSP, ninguna
  petición externa), con `tests/fixtures/pdf/modo-oscuro/modo-oscuro.pdf` (**8 páginas**,
  versionado): ir a la página 7 → recargar → reabrir → vuelve a la 7 con su zoom;
  desactivar «recordar» → vuelve a la 1; «Olvidar» → `bpdf:positions` desaparece;
  preferencias que sobreviven a recargar (modo, zoom, vista, miniaturas, atajos, tipografía);
  `bpdf:prefs` corrupto o de versión futura → la app arranca con los valores por defecto;
  **privacidad**: abrir un PDF y un Markdown con nombres y contenido conocidos y
  distintivos, recorrer `localStorage` y `sessionStorage` (claves y valores) y no
  encontrarlos.
- Tras implementar: `npm run bench:editor` para comprobar que la Fase 9 no empeora (toca
  `MarkdownView` y `markdown.css`); solo se mide, no se optimiza.

**Criterios de aceptación.** Definición de hecho común; el test de privacidad pasa; las
preferencias corruptas no rompen el arranque; `build:tamano` sin `zod` en el arranque;
`bench:editor` sin empeorar respecto a la iteración 18.

**Documentación.** PLAN §8 (implementado), SEGURIDAD §6 (qué se guarda y cómo se borra),
ARCHITECTURE (sección nueva), STACK, STRUCTURE, MODULES, `tests/fixtures/README.md` si
cambia algún uso, CLAUDE.md §0, bitácora, TAREAS. Anuncio de cambios visibles al entregar
(CLAUDE §8). Sin página pública de privacidad.

**Resultado esperado.** Preferencias completas y transparentes para el usuario.

---

## Fase 11 — UI/UX final 🚧

**IMPLEMENTADA / PENDIENTE DE REVISIÓN** (*2026-10-03*, iteración 23). No se da por cerrada
hasta que el usuario la apruebe (y, si quiere, la compruebe a mano). Lista de revisión:
[PLAN.md](PLAN.md) §9.5.

**Decisiones del usuario al empezar** (*2026-10-03*): **D10** sin tema claro en v1; **D12**
adaptación básica (sin desplazamiento horizontal a 375 px, controles ≥ 24 px, barras que se
reparten, sin gestos nuevos); **título de la ventana siempre «BPDF»**, nunca el nombre del
documento (la especificación anterior pedía mostrarlo: el navegador lo guardaría en su
historial, contra CLAUDE.md §4); **«Acerca de» dentro de Preferencias**, sin botón propio;
**sin enlace al repositorio** hasta la Fase 16; favicon SVG sencillo con los tokens; **sin
navegación con flechas** en las barras (se evalúa en la F13; PLAN §10 corregido); **sin
capturas visuales** en los E2E.

**Hecho.**
- **Atajos anunciados:** los botones del visor PDF (página anterior y siguiente, zoom,
  buscar, miniaturas, girar, pantalla completa, ayuda), el campo de página, la barra de
  búsqueda y los dos «Abrir archivo» llevan el atajo en `title` y en `aria-keyshortcuts`
  (`anuncioDeAtajo`, `src/app/pdf/atajos.ts`). Los de una tecla, solo con
  `atajosUnaTecla` activado. El nombre accesible no cambia. Una sola tabla de teclas
  visibles (`messages.keys`) para la ayuda, los tooltips y el estado vacío.
- **Estados de carga:** los de `App` (`Suspense`) pasan a `Cargando`, con `role="status"`,
  como los demás.
- **D12:** las casillas de Preferencias y de la ayuda de atajos, de 16 a 24 px. El resto ya
  cumplía (medido).
- **Título:** sigue siendo «BPDF»; un E2E y un test de componente lo vigilan.
- **«Acerca de»** al final de Preferencias: versión y licencia de `package.json`, fijadas al
  compilar (`define` de Vite y Vitest, `src/config/compilacion.ts`, `src/config/version.ts`),
  y la frase de privacidad. Sin enlaces.
- **Favicon:** `public/favicon.svg` (hoja clara con la esquina doblada en el acento, sobre el
  fondo de la app), enlazado en `index.html`; sin la tolerancia al 404 en `vigilancia.ts`.

**Desviaciones y decisiones al implementar:**
- El texto del estado vacío pasa de «Atajo: Ctrl+O (⌘O en Mac)» a «Atajo: Ctrl/⌘ O», la
  forma de la ayuda y los tooltips (coherencia de textos).
- Los colores del favicon van escritos (un SVG de favicon no lee las propiedades CSS de la
  página); un test comprueba que son exactamente tokens.
- Solo SVG, sin variante PNG/ICO: generarla exigiría una herramienta o un rasterizador.
  Los navegadores que no usen favicons SVG mostrarán el icono genérico.
- Fuera, para la Fase 13: el separador de Dividido (6 px de ancho en escritorio) y la
  navegación con flechas de las barras.

**Objetivo.** Pasada de diseño: consistencia, estados, detalles y pantallas pequeñas (D12).

**Dependencias.** F10 ✅. **D10** y **D12** ✅ (confirmadas el *2026-10-03*).

**Alcance.** Recorrer todas las pantallas con la lista de PLAN §9.5 (espaciados, tamaños,
estados, iconos, áreas de pulsación, pantalla estrecha, textos); tooltips con su atajo;
estados de carga anunciados; transiciones que respeten `prefers-reduced-motion`; favicon
en `public/`; título de la ventana fijo; «Acerca de» en Preferencias (versión, licencia,
privacidad); textos coherentes en `messages.ts`.

**Fuera de alcance.** Funciones nuevas; tema claro (D10); experiencia móvil propia y gestos
(D12); enlace al repositorio (F16); navegación con flechas en las barras (F13); capturas
visuales; cualquier cambio de rendimiento o de `content-visibility`.

**Archivos esperados.** `src/app/` (`App.tsx`, `EmptyState.tsx`, `Cargando.tsx`, `pdf/`),
`src/preferences/PreferencesDialog.tsx`, `src/config/` (versión), `src/i18n/messages.ts`,
`public/favicon.svg`, `index.html`, `vite.config.ts` y `vitest.config.ts` (`define`),
`e2e/vigilancia.ts`, tests y E2E. Sin tocar `markdown.css`.

**Seguridad y privacidad.** El título no lleva nombres de documento. El favicon es del propio
origen y no pide nada (la CSP no cambia). La versión se sustituye al compilar: nada se lee
ni se evalúa en el navegador.

**Tests.** Unitarios: `anuncioDeAtajo` (con y sin atajos de una tecla, sintaxis de ARIA, una
sola tabla de teclas), favicon (colores = tokens, autónomo, enlazado). Componentes +
jest-axe: `Cargando`, «Acerca de», atajos en la barra del visor, «Abrir archivo» y título
en `App`. E2E (`interfaz.spec.ts`): pantalla estrecha a 375 px en las pantallas y diálogos
principales (sin desplazamiento horizontal y controles ≥ 24 px), título con documentos de
nombre conocido, «Acerca de» con la versión real, favicon servido con las cabeceras de la
app, atajos anunciados según la preferencia.

**Criterios de aceptación.** Definición de hecho común; lista de PLAN §9.5 recorrida y
registrada en la bitácora; aprobación del usuario.

**Documentación.** PLAN §9 (con §9.5) y §10, D10 y D12, anuncio de cambios visibles,
bitácora, TAREAS.

**Resultado esperado.** Producto web visualmente terminado.

---

## Fase 12 — Seguridad: endurecimiento y auditoría

**Objetivo.** Verificar cada control de [SEGURIDAD.md](SEGURIDAD.md), endurecer lo que
quede y registrar una auditoría.

**Dependencias.** F11.

**Alcance**

- CSP obligatoria (no report-only) en `preview` y en la configuración del hosting (D5;
  hoy `vercel.json`, generado desde la fuente única desde la iteración 11); cerrar **T-3**
  (`style-src` de la app ya sin `'unsafe-inline'`; Mermaid lo tiene solo en su marco
  aislado) y resolver **T-4** (Trusted Types): probar, medir qué rompe, decidir y
  documentar.
- ~~Revisar si `data:` en `img-src` puede quitarse~~: la CSP ya no lleva `data:` en
  ninguna directiva (Fase 8, `assetsInlineLimit: 0`).
- Cabeceras servidas frente a la fuente única: ya existen `tests/unit/vercel.test.ts` (el
  fichero generado) y `npm run cabeceras:verificar` (un despliegue real); la fase los
  revisa y los completa si falta algo.
- Recorrer SEGURIDAD §2–§4 y §6 control a control: cada uno tiene test o queda como
  hallazgo (§5, Electron, es histórico: D19).
- `npm audit`, revisión de `allowScripts`, versiones exactas de los motores, avisos
  publicados de pdf.js/KaTeX/Mermaid/highlight.js desde la última actualización.
- Revisión manual del código buscando `innerHTML`, `eval`, `Function`, `postMessage`,
  `window.open` y `target="_blank"` sin `rel`.
- Registrar en [auditoria.md](auditoria.md) (formato existente: ID, severidad, estado).

**Fuera de alcance.** Nada de escritorio: la auditoría de Electron que preveía la Fase 14
se canceló con ella (D19).

**Archivos esperados.** `src/config/security-headers.ts`, `vercel.json` (regenerado, nunca
a mano),
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
- Heredado de la Fase 11: **evaluar la navegación con flechas** entre los botones de las
  barras con `role="toolbar"` (hoy cada uno es una parada de Tab) y el **área de pulsación
  del separador** de Dividido (6 px de ancho en escritorio; WCAG 2.5.8).

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

## Fase 14 — Electron: aplicación ❌ CANCELADA

**Cancelada / no aplica** desde el *2026-10-03*: decisión de producto del usuario, **BPDF es
solo una aplicación web** (D19, [PLAN.md](PLAN.md) §14). No se implementó nada de ella y no
queda trabajo pendiente. Se conserva el número para no renumerar las fases.

Referencia histórica: preveía una app de escritorio con Electron (proceso main, preload,
protocolos `app://` y `bpdf-res://`, IPC validado, guardar en el mismo fichero), diseñada en
[ELECTRON.md](ELECTRON.md), que queda como documento histórico. Lo que la web ya usa y se
pensó también para Electron (la frontera `src/platform/`, la CSP en una fuente única) se
conserva porque tiene sentido por sí mismo.

---

## Fase 15 — Distribución web

> **Reescrita el *2026-10-03*** (D19: BPDF es solo web). Antes era «Distribución: web y
> escritorio». Se retiró todo lo que solo tenía sentido con una app de escritorio, sin
> sustituirlo: instaladores por plataforma, firma y notarización de binarios, fuses,
> asociación de tipos `.pdf`/`.md`, **T-5** (Forge o electron-builder), **D11**
> (plataformas, firma, auto-actualización) y el workflow de release por etiqueta con matriz
> de SO y artefactos con SHA-256. Fijar las Actions por SHA deja de ser requisito de esta
> fase (era para firmar releases de escritorio); sigue como mejora en [mejoras.md](mejoras.md).

**Objetivo.** Dejar la web publicada de forma formal y verificada, con versión de producto y
un registro de cambios para usuarios.

**Dependencias.** F12 (CSP y cabeceras finales; la publicación puede hacerse tras F13 si se
quiere). **D5** confirmada (hosting y dominio). Ya no depende de la Fase 14 (cancelada).

**Alcance**

- **Web:** despliegue en el hosting de D5 (hoy Vercel desde git, `bpdf.r3zon.com`) con las
  cabeceras de F12, generadas de la fuente única; el dominio real en
  `src/config/project.ts` (y con él `robots.txt`, `sitemap.xml` y `public_docs/_meta/`);
  comprobación con `npm run cabeceras:verificar -- <url>` y `curl -I` (CSP, HSTS, etc., de
  `/` y `/mermaid.html`); E2E de humo contra la URL pública; `DEPLOYMENT.md` reescrito.
- Versionado del producto (`package.json` → `version`, semver) y registro de cambios para
  usuarios (distinto de la bitácora `docs/CHANGELOG.md`; nombre y ubicación a decidir).

**Fuera de alcance.** Versión de escritorio o cualquier sustituto (D19); tiendas de
aplicaciones.

**Archivos esperados.** Configuración del hosting (`vercel.json`, generado, nunca a mano),
`src/config/project.ts`, `public_docs/_meta/`, `package.json` (versión),
`docs/DEPLOYMENT.md`, registro de cambios de usuario y el E2E de humo.

**Seguridad.** Las cabeceras servidas coinciden con la fuente única (comprobado contra el
despliegue real, no solo en local). Sin secretos: no hay binarios que firmar.

**Criterios de aceptación.** Web pública con las cabeceras correctas
(`cabeceras:verificar` en verde contra producción); E2E de humo en verde contra la URL
pública, con cero errores de consola, cero violaciones de CSP y ninguna petición externa;
el dominio de `project.ts` es el real; versión y registro de cambios publicados.

**Documentación.** DEPLOYMENT (reescrito), CLAUDE.md §0 (entornos), bitácora, TAREAS.

**Resultado esperado.** BPDF disponible para usuarios en la web.

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
