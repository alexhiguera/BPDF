# Tareas pendientes

Solo tareas **abiertas**. Al cerrar una, se borra la línea y se cuenta en
[CHANGELOG.md](CHANGELOG.md). Lo que no es una tarea (reglas, costumbres) va a
[`CLAUDE.md`](../CLAUDE.md). Convención completa: `CLAUDE.md` §7.

`[ ]` pendiente · `[~]` en curso · 🔴 alta · 🟠 media-alta · 🟡 media · 🟢 baja

**Qué se hace y cómo:** cada fase está especificada en [FASES.md](FASES.md) (alcance,
archivos, tests, criterios de aceptación). El diseño que construyen: [PLAN.md](PLAN.md),
[SEGURIDAD.md](SEGURIDAD.md) ([ELECTRON.md](ELECTRON.md) es histórico: D19). Aquí solo el
estado.

## Estado hoy — *2026-10-06*

Medido con Node 24.21.0 y npm 11.19.0 en **WSL2 (Ubuntu) sobre Windows**, tras **cerrar la Fase 17**
(iteraciones 36 a 39). E2E con Chromium, Firefox y WebKit
de Playwright. Cerradas las Fases 0–13, la 15 y la 17 (la 6 se hizo después de las 7, 7 bis y 8, por orden
del usuario, y conserva su número). **La 9 se aprobó con una excepción de rendimiento**
(*2026-10-03*): teclear en Dividido con 1 MB + KaTeX o con 1 MB de encabezados supera los
objetivos de latencia ([FASES.md](FASES.md), Fase 9). **BPDF es solo una aplicación web**
(D19): la Fase 14 (Electron) se canceló y la 15 se reescribió sin escritorio. La 12
(seguridad) se cerró verificada en producción ([auditoria.md](auditoria.md), Auditoría 1).
La 13 (accesibilidad, rendimiento y compatibilidad) se cerró el *2026-10-04*. La 15
(distribución web) se cerró el *2026-10-04*, verificada en producción. La 16 (open source y
documentación final) dejó preparada la publicación, que se absorbe en la 18. La 17 (crear
Markdown y exportar a PDF) se cerró el *2026-10-06*. Siguiente: **Fase 18**, publicación final
de v1.0.0.

| Comprobación | Resultado |
|---|---|
| Código | SPA estática de Vite 8 + React 19 que abre un PDF o un Markdown local, uno a la vez (D16): visor PDF propio sobre pdf.js con modo oscuro selectivo (ARCHITECTURE §4 quater), lector GFM con recursos locales, KaTeX y Mermaid aislado (§4 quinquies a septies), editor CodeMirror 6 (§4 octies), preferencias (§4 nonies), interfaz final (§4 decies) y, desde la Fase 13, barra del visor con flechas, separador de 24 px y foco en los diálogos (§4 undecies). **Web publicada** en Vercel (`bpdf.r3zon.com`), en `9fb5f6a` (Fase 15, verificada: [DEPLOYMENT.md](DEPLOYMENT.md)) |
| `npm run lint` · `typecheck` | ✅ |
| `npm run test:run` | ✅ 1104 tests en 58 ficheros (Fase 17: documento nuevo, espera de impresión, «Guardar como…», contraste del PDF claro; Fase 16: el enlace de «Acerca de», el validador de `public_docs/` ampliado y la Wiki; Fase 15: dominio oficial y `dist/` publicable; Fase 13: la barra con el teclado, el campo de página que no pierde lo escrito, los escuchadores del selector, el campo de contraseña sin nada que enviar; antes: CSP congelada, `Permissions-Policy`, D14 con pdf.js real, `worker-destruido`, interfaz, preferencias, XSS, recursos, Mermaid, `vercel.json`…) |
| `npm run test:e2e` (Chromium) | ✅ 139 tests en 13 ficheros contra la build de producción, entre ellos 9 de accesibilidad (Fase 13: axe en cada pantalla y estado, barra con flechas, diálogos y foco, separador) y el de IME sobre una selección (CDP). Smoke de producción (`test:humo`, Fase 15) contra `https://bpdf.r3zon.com`: 6 de 6 |
| `npm run test:e2e:compat` (Firefox y WebKit; en CI, job `compat` de `e2e.yml`) | ✅ En modo CI (cierre de la Fase 13): Firefox 125 pasan y WebKit 123, más 1 y 2 intermitentes que pasan al reintentar (carga de la máquina; uno, el de los 200 ms, ya conocido); ~1,5 y ~2,3 min de tests por navegador. 9 saltados con su motivo (solo Chromium: memoria con CDP, `Permissions-Policy`, bloques saltados observables, IME; WebKit: `beforeunload` con `runBeforeUnload`) |
| `npm run build` · `build:tamano` · `build:verificar` | ✅ · `dist/` publicable (Fase 15) · arranque **95,6 KB gzip** (límite 150; +0,4 KB en la F17 por «Crear Markdown»; +0,1 KB en la F16 por el enlace de «Acerca de»; +0,3 KB en la F13: la barra con flechas y el foco al cancelar). A demanda, sin cambios: visor PDF, pdf.js 148 KB, lector de Markdown, editor 98 KB, KaTeX, Mermaid en el marco, workers |
| CSP | ✅ Definitiva (Fase 12, congelada en un test; T-3 cerrada; T-4, Trusted Types, no adoptado en v1: riesgo aceptado, revisado tras la F13 sin cambios). Sin cambios en la F13 |
| `npm run docs:validar` · `docs:enlaces` | ✅ · ✅ (336 enlaces en 22 ficheros) |
| `npm audit` | ✅ 0 altas · 0 moderadas · 4 bajas, todas el mismo aviso de KaTeX transitivo en Mermaid, **aceptado para v1** (auditoría A1-13) · `source-map-js` 1.2.2 (iteración 37) · **1 override** (`micromark` 4.0.2: regresión cuadrática de la 4.0.3, micromark#246; STACK.md) · 0 scripts de instalación sin aprobar |
| Dependencias | 20 de runtime (las de contenido no confiable, con versión exacta). Desarrollo: + `@axe-core/playwright` (Fase 13) |
| Rendimiento (Ryzen 7 5800X; ARCHITECTURE §4 undecies, PLAN §11) | PDF de 1000 páginas: primera página 0,95 s, ninguna tarea larga > 200 ms al navegar (CPU ×4: 1,3 s; máx. 179 ms). Modo oscuro con worker: 8–60 ms de hilo principal por página (×4: hasta 226 ms a 400 % y DPR 2). Markdown 1 MB: 3,0 s; listas cortas 200 KB: 1,45 s, lineal. Editor (teclear): Chromium como en la F9; Firefox, Dividido 1 MB + KaTeX máx. 40 ms; WebKit (de Playwright, en Linux), Dividido 1 MB + KaTeX: P50 ~400 ms (**limitación conocida de v1**, sin confirmar en Safari real) |
| Memoria (CDP, `bench:memoria`) | Al cerrar, el montón vuelve a 6–9 MiB (de 44–63 MiB con 1 MB); workers y URL `blob:` a 0; escuchadores estables. ~10 nodos por apertura: el `<input>` del selector, retenido por las herramientas de medida |
| Accesibilidad | axe sin violaciones (WCAG 2.0–2.2 A y AA) en todas las pantallas y estados; teclado y foco con E2E; lector de pantalla: manual (abajo) |
| PDF y Markdown reales | 9 PDF y 14 Markdown probados en fases anteriores; la búsqueda con PDF reales la comprobó el usuario a mano |
| CI en GitHub | Con `9fb5f6a` (*2026-10-04*): CI (con `build:verificar`) y Security ✅; E2E: Chromium ✅ 4,5 min, Firefox ✅ 7 min y WebKit ✗ 11 min por **un solo test que agotó su límite de 30 s en el runner** (corregido en la iteración 33, con `test.slow()` solo en WebKit; **pendiente de confirmar en GitHub tras el push**) |
| Licencia | ✅ Apache-2.0 |

## Decisiones pendientes de confirmación

Detalle, opciones y recomendación de cada una en [PLAN.md §14](PLAN.md#14-decisiones). Una
fase no empieza con una decisión que necesita sin confirmar.

Ninguna (*2026-10-04*).

## Fases

- [ ] 🔴 **F18** (siguiente, no empezada) Publicación final de BPDF v1.0.0. Hereda lo pendiente de
  la F16, en este orden ([DEPLOYMENT.md](DEPLOYMENT.md), «Publicación final»; FASES, Fase 18):
  commit y push finales; CI completo en verde; verificación en producción (`test:humo`,
  `cabeceras:verificar`; «Acerca de» con la versión 1.0.0 y el enlace público al repositorio);
  repositorio público y su metadata; Issues y etiquetas `fallo` y `mejora`; Private
  Vulnerability Reporting; Wiki; `docs.r3zon.com/bpdf`; etiqueta `v1.0.0` y GitHub Release;
  comprobación final de documentación y enlaces

## Limitaciones aceptadas de v1

No son tareas: están decididas y documentadas. Se reabren solo si el usuario lo pide.

- **Markdown de ~1 MB: ~3 s hasta verlo** (con «Preparando el documento…» por encima de
  100 KB). Sin worker ni pintado por partes en v1 (ARCHITECTURE §4 undecies)
- **WebKit, Dividido con ~1 MB + KaTeX: muy lento** (~400 ms de mediana, hasta ~8 s por
  pulsación), medido con el WebKit de Playwright en Linux; los recorridos funcionales de WebKit
  pasan. Sin confirmar en Safari real (seguimiento abajo)
- **Trusted Types (T-4): no adoptado** (Fase 12, A1-5; revisado tras la F13 sin cambios)
- **Exportar a PDF depende del diálogo de impresión del navegador** (F17): el nombre sugerido
  (normalmente «BPDF»: el título de la página nunca lleva el del documento), el papel, los
  márgenes y si imprime fondos los decide ese diálogo. En Safari/WebKit, el margen superior de
  las páginas siguientes del PDF oscuro no se ha verificado en Safari real
- **KaTeX transitivo de Mermaid** (GHSA-238p-pmpm-9mq7, bajo): riesgo conocido aceptado para v1
  (auditoría A1-13; seguimiento abajo)

## Seguimiento futuro

- [ ] 🟡 **Retirar el riesgo aceptado de KaTeX transitivo** cuando Mermaid publique una versión
  compatible con KaTeX ≥ 0.18.2 (GHSA-238p-pmpm-9mq7; [auditoria.md](auditoria.md) A1-13,
  aceptado para v1 el *2026-10-06*). En cada actualización de Mermaid, comprobar: el rango de
  KaTeX que declara, `npm audit`, fórmulas (`$…$`) dentro de diagramas,
  `tests/fixtures/markdown/mermaid-hostil.md` y los E2E de Mermaid. No bloquea v1
- [ ] 🟢 **WebKit de Playwright en Linux + DPR 2 + CPU limitada pinta el PDF mucho más lento**
  (observado al diagnosticar el E2E «cerrar o sustituir el PDF», iteración 33): con 1 núcleo, la
  misma secuencia de abrir y cerrar tarda 31 s a DPR 2 y 10 s a DPR 1 en WebKit; Chromium y
  Firefox no cambian (~5 s); con 16 núcleos tampoco. Los fotogramas llegan a 240–350 ms mientras
  se pinta. **Confirmar si ocurre también en Safari real** (macOS, DPR 2); no se afirma que
  Safari lo tenga: el WebKit de Playwright en Linux renderiza por software
- [ ] 🟡 **Quitar el `override` de micromark** (4.0.2) cuando micromark publique el arreglo de
  micromark#246; comprobar antes con `listas: 200 KB` de `npm run bench:markdown` que sigue
  siendo lineal (STACK.md)
- [ ] 🟡 **Confirmar en Safari real** (macOS) el caso de Dividido con 1 MB + KaTeX
- [ ] 🟢 **Carrera residual en WebKit al saltar de página** justo después de un desplazamiento
  rápido (E2E «300 páginas»: 1 de cada 20 ejecuciones con la máquina cargada; antes del arreglo
  del campo de página, 2 de 8). Una sonda con los mismos pasos no la reproduce (30 de 30): falta
  encontrar la vía que queda. En CI sale como intermitente
- [ ] 🟢 **E2E intermitente del editor** (Fase 9): «dividido: la vista previa se refresca
  200 ms después de la última tecla, no antes» exige que la vista previa NO se haya refrescado
  aún, y con el equipo cargado los pasos del propio test pueden tardar más de 200 ms. No es un
  fallo de la app: hacer el test independiente del ritmo sin quitarle lo que comprueba
- [ ] 🟢 **Limpieza técnica:** el parámetro opcional `id` de `readDocument`
  (`src/documents/read.ts`) se pensó para Electron (cancelado, D19) y hoy solo lo usa un test
  (`read.test.ts`). Revisar si se retira (decisión del usuario: se conserva por ahora)
- [ ] 🟢 **Favicon PNG**, si sigue teniendo sentido: hoy solo SVG (Fase 11), y los navegadores
  que no usan favicons SVG muestran el icono genérico

## Pruebas manuales (del usuario)

Lo que no se puede automatizar de forma fiable. No bloquean ninguna fase.

- [ ] 🟡 **Lector de pantalla** (NVDA o VoiceOver): estado vacío, visor PDF (barra con flechas,
  página anunciada, búsqueda), Markdown (índice, fórmulas, diagramas), editor y Dividido
  (separador), Preferencias, carga y errores
- [ ] 🟡 **Safari real** (macOS e iOS): además del caso de arriba, pantalla completa (macOS e
  iPadOS; en iPhone no hay botón), guardar (descarga) y abrir una carpeta
- [ ] 🟢 **IME en Firefox y Safari**: escribir en japonés o chino encima de una selección en el
  editor (texto correcto, sin violaciones de CSP). En Chromium lo cubre un E2E
- [ ] 🟢 **Gestor de contraseñas** con la contraseña de un PDF en Chrome, Firefox y Safari (el
  campo no tiene `name` y el formulario no se envía: test); si alguno ofrece guardarla,
  valorar otro tipo de campo
- [ ] 🟢 **Atajos con otras distribuciones de teclado** (`?` y `Mayús+R`)
- [ ] 🟢 **Soltar una carpeta** en los tres navegadores (Playwright no simula entradas de
  carpeta; elegirla con el selector sí tiene E2E en los tres)
- [ ] 🟢 **Más PDF y formularios reales**, también de ofimática, en los tres navegadores

## Fuera de v1 / mejoras

No están en el camino de v1. Detalle y desbloqueo en [mejoras.md](mejoras.md): Mermaid 12,
búsqueda integrada de CodeMirror, fondo especial para imágenes transparentes, oscurecer las
imágenes del PDF, tema claro (D10) y Markdown enorme más rápido; y las mejoras de CI (Actions
por SHA, `persist-credentials: false`).
