# Tareas pendientes

Solo tareas **abiertas**. Al cerrar una, se borra la línea y se cuenta en
[CHANGELOG.md](CHANGELOG.md). Lo que no es una tarea (reglas, costumbres) va a
[`CLAUDE.md`](../CLAUDE.md). Convención completa: `CLAUDE.md` §7.

`[ ]` pendiente · `[~]` en curso · 🔴 alta · 🟠 media-alta · 🟡 media · 🟢 baja

**Qué se hace y cómo:** cada fase está especificada en [FASES.md](FASES.md) (alcance,
archivos, tests, criterios de aceptación). El diseño que construyen: [PLAN.md](PLAN.md),
[SEGURIDAD.md](SEGURIDAD.md) ([ELECTRON.md](ELECTRON.md) es histórico: D19). Aquí solo el
estado.

## Estado hoy — *2026-10-03*

Medido con Node 24.21.0 y npm 11.19.0 en **WSL2 (Ubuntu) sobre Windows**, al cerrar la
**Fase 10** (iteración 22). E2E con el Chromium de Playwright. Cerradas las Fases 0–10 (la 6
se hizo después de las 7, 7 bis y 8, por orden del usuario, y conserva su número). **La 9 se
aprobó con una excepción de rendimiento** (*2026-10-03*): teclear en Dividido con 1 MB +
KaTeX o con 1 MB de encabezados supera los objetivos de latencia ([FASES.md](FASES.md),
Fase 9). La 10 (preferencias) se cerró el mismo día. **BPDF es solo una aplicación web**
(D19, *2026-10-03*): la Fase 14 (Electron) se canceló y la 15 se reescribió sin escritorio.

| Comprobación | Resultado |
|---|---|
| Código | SPA estática de Vite 8 + React 19. Abre un PDF o un Markdown local, uno a la vez (D16). **Los PDF se leen** en un visor propio sobre pdf.js (D17, build `legacy`: D18) con modo oscuro selectivo en un worker, vistas continua y página a página, zoom, giro a los dos lados, capa de texto, enlaces, búsqueda (con mayúsculas, palabra completa y palabras partidas con guion), miniaturas navegables con flechas, pantalla completa del área de lectura, atajos de una tecla desactivables con su ayuda y PDF con contraseña ([ARCHITECTURE.md](ARCHITECTURE.md) §4 quater). **Los Markdown se leen** en un lector GFM: HTML como texto, política de URLs propia, código resaltado con copiar, índice (§4 quinquies), **con sus imágenes locales** si se entregan con el `.md` (varios ficheros o una carpeta; §4 sexies), **fórmulas con KaTeX** y **diagramas con Mermaid** en un marco aislado (`mermaid.html`, iframe con `sandbox` y CSP propia; §4 septies), y **se editan** con CodeMirror 6 (Lectura, Edición y Dividido; vista previa con el mismo lector, desplazamiento sincronizado, confirmación antes de perder cambios y guardado local con `showSaveFilePicker` o descarga; §4 octies). **Preferencias** (Fase 10): diálogo desde la cabecera, valores por defecto del PDF, miniaturas, tipografía de Markdown, atajos de una tecla y posición por PDF (huella de pdf.js, 50 como mucho), en `bpdf:prefs` y `bpdf:positions` (§4 nonies). **Web publicada** en Vercel (`bpdf.r3zon.com`) con `vercel.json` generado; en `origin/main` hasta `f0f38b7` (primer commit de la Fase 9); `3eb39e9`, `4abd868`, `4210a78` y `57e82e8` (iteraciones 15–21) y el cierre de la Fase 10 con D19 (iteración 22), aún sin subir |
| `npm run lint` · `typecheck` | ✅ |
| `npm run test:run` | ✅ 973 tests en 50 ficheros (incluye las preferencias: esquema, almacén versionado, posiciones, diálogo, visor y `App`; pdf.js y KaTeX reales en Node, la edición de Markdown con un editor falso en jsdom, la búsqueda sobre el texto real de pdf.js, el corpus de XSS de Markdown, la resolución de recursos, el saneador y el verificador del SVG de Mermaid y la sincronía de `vercel.json` con la fuente) |
| `npm run test:e2e` | ✅ 108 tests en 9 ficheros contra la build de producción (`vite preview`): 11 de preferencias (Fase 10: posición con `modo-oscuro.pdf`, recordar desactivado, olvidar, sin documento, recargar, tipografía, miniaturas, corruptas y versión futura, varias pestañas, privacidad), 18 del editor (Fase 9: CodeMirror con la CSP real, modos, espera de la vista previa, recursos, KaTeX y Mermaid hostiles, Markdown hostil, escribir y pegar sobre una selección, guardar, confirmación, `beforeunload`, 1 MB, sincronía sin y con fórmulas, apilado de los paneles, separador, pantalla estrecha), 30 del visor PDF (8 de la Fase 6: contraseña, pantalla completa con las cabeceras reales, atajos, búsqueda avanzada, miniaturas), 11 del lector de Markdown (con los bloques con fórmulas que se saltan fuera de la vista), 1 de memoria (al cambiar de documento se libera el anterior, con CDP), 8 de recursos locales y 7 de fórmulas y diagramas (KaTeX y Mermaid hostiles, aislamiento del marco comprobado desde dentro, documento sin fórmulas ni diagramas sin descargas) |
| `npm run build` · `build:tamano` | ✅ arranque 93,3 KB gzip (límite 150; +0,8 KB en la F10: el botón «Preferencias» y su icono; +2 KB en la F9: textos, el diálogo de descarte y los cambios sin guardar en `DocumentProvider`; CodeMirror no entra). A demanda: preferencias con `zod` ~23 KB y su diálogo ~2 KB, visor PDF 15 KB + 0,8 KB CSS, pdf.js 148 KB, lector de Markdown 76,5 KB + 1,8 KB CSS, **editor (CodeMirror) 98 KB, solo al entrar en Edición o Dividido**, KaTeX 77 KB + 4 KB CSS y sus fuentes, Mermaid (en el marco) ~50 KB + ~870 KB en trozos por tipo de diagrama, worker del modo oscuro 3 KB, worker de pdf.js 1,3 MB · avisos conocidos e inocuos: 2 de `"use client"` (`lucide-react`) y el de un trozo de Mermaid de más de 500 kB (solo se carga en el marco, a demanda) |
| CSP | ✅ `default-src 'none'`; la Fase 4 añadió `worker-src 'self'` y `font-src 'self'`, la Fase 5 `connect-src 'self'` (cmaps de pdf.js); la Fase 7, nada; la Fase 7 bis, `blob:` solo en `img-src` (imágenes locales de Markdown); la Fase 8, `frame-src 'self'` (el marco aislado de Mermaid, `/mermaid.html`, con su propia política: `style-src 'unsafe-inline'` confinado a un origen opaco y sin red); la Fase 9, nada (CodeMirror en un Shadow DOM con hojas construibles, y escribir sobre una selección sin la edición nativa del navegador); la Fase 10, nada (`zod` con `jitless`, sin `new Function`). Sin `data:` en la build (`assetsInlineLimit: 0`). Sin `unsafe-*`, sin `'wasm-unsafe-eval'`, sin orígenes externos; cero violaciones y ninguna petición externa en los E2E; comprobada con `curl -I` |
| `npm run docs:validar` · `docs:enlaces` | ✅ · ✅ (260 enlaces en 18 ficheros) |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilidades · 0 overrides · 0 scripts de instalación sin aprobar |
| Dependencias de runtime | 20: `react`, `react-dom`, `lucide-react`, `clsx`, `tailwind-merge`, `pdfjs-dist` (6.3.289), `react-markdown` (10.1.0), `remark-gfm` (4.0.1), `lowlight` (3.3.0), `highlight.js` (11.11.1); de la Fase 8, `remark-math` (6.0.0), `katex` (0.18.9) y `mermaid` (11.17.2); de la Fase 9, `@codemirror/state` (6.7.6), `@codemirror/view` (6.43.13), `@codemirror/commands` (6.11.1), `@codemirror/language` (6.12.4), `@codemirror/lang-markdown` (6.5.2) y `@lezer/highlight` (1.2.5); de la Fase 10, `zod` (4.6.5); todas las de contenido no confiable con versión exacta |
| Benchmark (`npm run bench:pdf`, Ryzen 7 5800X) | Modo oscuro en el hilo principal: sin worker 18–28 ms a 2,2 Mpx y 113–141 ms a 16,8 Mpx; con worker 9–13 ms y 60–66 ms. 300 páginas: primera página ~0,9 s, máx. 4 lienzos (≤ 34 MiB a DPR 1), heap ~60 MiB |
| Benchmark (`npm run bench:markdown`, mismo equipo) | Hasta ver el primer encabezado: 1 KB 0,33 s · 100 KB 0,5–0,9 s · **1 MB 3,3–7,3 s** · 5000 encabezados 0,6–1,0 s · 2000 bloques de código 0,8–1,1 s · listas cortas 200 KB 2,3–2,8 s (cuadrático) · 50 imágenes de 6 Mpx entregadas con 50 sin usar: texto 0,64 s, primera imagen 0,67 s, 50 URL `blob:`, heap 14 MiB · Fase 8: 1500 fórmulas en 2,4 s, 30 diagramas en 2,2 s (~60 ms cada uno), sin cambios para un Markdown sin fórmulas ni diagramas |
| Benchmark (`npm run bench:editor`, mismo equipo) | Por pulsación (Event Timing por interacción; tres ejecuciones, ≈ 285 pulsaciones; *2026-10-03*, iteración 18, el código con el que se aprobó la Fase 9). **Edición** 1 MB: máx. 32 ms; 1 MB + KaTeX: máx. 32 ms; 1 MB de encabezados: P95 40, máx. 48 ms. **Dividido** 1 MB: P95 48, máx. 56 ms; 1 MB + Mermaid: P95 24, máx. 56 ms; **excepción aceptada: 1 MB + KaTeX P95 96, P99 216, máx. 256 ms, tarea larga 97–203 ms; 1 MB de encabezados P95 64, P99 112, máx. 120 ms**. Iteración 16 (antes del apilado): 1 MB + KaTeX en Dividido P95 112, P99 320, máx. 400 ms. **Tras la Fase 10** (*2026-10-03*): **sin regresión respecto a la Fase 9** (comparación A/B alternada, 1 MB + KaTeX en Dividido: Fase 9 P95 88–96, máx. 176–272 ms; Fase 10 P95 72–96, máx. 192–248 ms; bitácora, iteración 21). Vista previa: 208 ms (2 KB) a 335 ms (100 KB); 1 MB en pausa, 1,3–1,5 s al pulsar «Actualizar». Firefox (iteración 17, con los localizadores corregidos): 1 MB máx. 24–32 ms; 1 MB + KaTeX en Dividido P95 56–72, máx. 88 ms; entrar en un modo, 0,5–3 s. WebKit sin datos. Los recuentos de eventos ≥ 50 ms de las iteraciones 14 y 15 estaban multiplicados ×1 a ×6. Tablas en [FASES.md](FASES.md), Fase 9 |
| Markdown reales | 14 probados (los de `docs/` y README de paquetes con HTML, insignias remotas, tablas y código): sin errores, peticiones externas, `img` ni `href` fuera de la política |
| PDF reales | 9 probados (papers, formulario, corpus de pdf.js, generados con Chromium): sin errores ni peticiones externas; límites del modo oscuro en ARCHITECTURE §4 quater |
| CI en GitHub | ✅ en verde en su primera ejecución (commit `04c1291`); no se ha vuelto a comprobar con los commits subidos después |
| Licencia | ✅ Apache-2.0 |

## Decisiones pendientes de confirmación

Detalle, opciones y recomendación de cada una en [PLAN.md §14](PLAN.md#14-decisiones). Una
fase no empieza con una decisión que necesita sin confirmar.

- [ ] 🟡 **D14** Formularios de PDF: solo se muestran (recomendado). **Aplicado así en la F5** (el encargo excluía formularios): falta confirmarlo
- [ ] 🟡 **Navegador mínimo del visor PDF**: pdf.js 6 carga su worker como módulo ES y necesita Firefox 114, pero `build.target` dice Firefox 111. Subir el mínimo a Firefox 114 (recomendado) o aceptar que en 111–113 un PDF no abra ([STACK.md](STACK.md), `pdfjs-dist`)
- [ ] 🟡 **D10** Tema claro de interfaz: no en v1 (recomendado) — bloquea F11
- [ ] 🟡 **D12** Móvil/tablet: adaptable básico (recomendado) — bloquea F11
- [ ] 🟡 **D5** Hosting web con cabeceras y dominio — bloquea F12 (configuración) y F15; mientras tanto el dominio es `app.example.com`

## Fases

- [ ] 🟡 **F11** UI/UX final
- [ ] 🔴 **F12** Seguridad: endurecimiento y auditoría
- [ ] 🟠 **F13** Accesibilidad y rendimiento (medición)
- [ ] 🟡 **F15** Distribución web (reescrita el *2026-10-03* sin escritorio: D19; FASES, Fase 15)
- [ ] 🟡 **F16** Open source y documentación final

## Otras

- [ ] 🟡 **Cerrar un PDF mientras se pintan páginas deja a veces un rechazo
  `worker-destruido` en consola** (worker del modo oscuro, Fase 5: `destruir()` rechaza las
  franjas pendientes y nadie captura ese rechazo). Encontrado en la Fase 10; es **anterior**:
  con el código de antes de la Fase 10, 6 de 24 ejecuciones con 8 navegadores en paralelo
  (ir a la página 5, esperar a que se pinte y cerrar). Sin efecto visible; ensucia la consola
  y haría fallar cualquier E2E que cierre deprisa. Arreglarlo con su test en el visor PDF

- [ ] 🔴 **Comprobar las cabeceras en producción tras desplegar** `vercel.json`:
  `npm run cabeceras:verificar -- https://bpdf.r3zon.com` (y `curl -I` de `/` y
  `/mermaid.html`), más abrir un Markdown con diagramas en la web publicada y mirar
  consola, CSP y red. Antes del despliegue (*2026-09-30*): ninguna cabecera de seguridad y
  `/mermaid.html` en 404 (la Fase 8 aún no estaba publicada). No se pudo hacer sin
  commit y push
- [ ] 🟡 **Dominio en `project.ts`**: sigue siendo `app.example.com` aunque la web está
  en `bpdf.r3zon.com` (afecta a `robots.txt`, `sitemap.xml` y `public_docs/`; es
  trabajo de SEO/indexación, aparcado). Formalizar D5 al hacerlo
- [ ] 🟡 **Mermaid 12** como tarea propia (decidido: la F8 se queda en 11.17.2). Evaluarla
  con `mermaid-hostil.md` y `formulas-diagramas.spec.ts`
- [ ] 🟡 **Marco de Mermaid en Firefox y Safari**: el iframe con origen opaco pide sus
  módulos en modo CORS; probado solo en Chromium
- [ ] 🟡 **WebKit en el benchmark** (iteración 18: `sudo -n …` → `sudo: a password is required`): no arranca en el WSL de desarrollo; necesita
  `sudo npx playwright install-deps webkit` (lo ejecuta el usuario). Después,
  `npm run bench:editor:compat`
- [ ] 🟡 **Editor de la Fase 9 en Firefox y Safari**: el Shadow DOM con hojas construibles
  (`adoptedStyleSheets`: Firefox 101, Safari 16.4), el manejador de `beforeinput` al
  escribir sobre una selección y la descarga como guardado (no tienen
  `showSaveFilePicker`); probado solo en Chromium
- [ ] 🟢 **Escribir con IME (composición) encima de una selección en el editor**: no se ha
  probado; si la edición nativa crea `<span style>` también ahí, saldría una violación de
  CSP (bloqueada, sin efecto en el texto). El manejador actual solo cubre `insertText`
- [ ] 🟢 **Buscar dentro del editor**: `Ctrl+F` del navegador no encuentra el texto que
  CodeMirror no tiene pintado (fuera de la pantalla). Valorar `@codemirror/search`
  (pequeño) si se echa en falta
- [ ] 🟡 **Visor PDF de la Fase 6 en Firefox y Safari**: pantalla completa (Safari la
  permite en macOS y iPadOS, no en iPhone: allí no hay botón), atajos (`?` y `Mayús+R`
  con otras distribuciones de teclado) y el diálogo de contraseña; probado solo en Chromium
- [ ] 🟢 **Gestor de contraseñas del navegador y la contraseña de un PDF**: el campo es
  `type="password"` con `autocomplete="off"` y el formulario nunca se envía, pero algún
  navegador podría ofrecer guardarla (BPDF no la guarda). Probarlo a mano en Chrome, Firefox
  y Safari; si alguno la ofrece, valorar otro tipo de campo
- [ ] 🟢 **Probar la búsqueda de la Fase 6 con PDF reales con guiones de corte** (LaTeX,
  ofimática): comprobada con el fixture, con un PDF generado por Chromium y con el único PDF
  real del equipo (sin guiones); faltan documentos «de verdad» con palabras partidas
- [ ] 🟢 **Medir la memoria de verdad** (→ F13): `performance.memory` de Chrome está
  cuantizado y da siempre ~10 MiB; hace falta `--enable-precise-memory-info` o el
  protocolo de depuración

- [ ] 🟠 **Markdown: muchas listas cortas son cuadráticas** en `mdast-util-from-markdown`
  2.0.3 (la última): `prepareList` inserta con `Array#splice` en el array de eventos del
  documento entero. 200 KB de listas tardan ~2,5 s y cada vez que se duplica el tamaño el
  tiempo se triplica; bajo el límite de 20 MiB, un documento hecho a propósito bloquea la
  pestaña mucho tiempo. Opciones: avisar arriba (issue con el caso mínimo), parsear en un
  worker que se pueda cancelar, o un límite de tamaño para Markdown más bajo. Medido en
  [ARCHITECTURE.md](ARCHITECTURE.md) §4 quinquies
- [ ] 🟡 **Markdown grande: 1 MB tarda 3–7 s** (criterio de la F7: < 1 s) → F13. Desde la F9,
  en el modo Dividido la vista previa de un documento así se pausa (decisión del usuario):
  resolverlo de fondo (worker o pintado por partes) permitiría refrescarla sola. No hay un
  punto caliente propio (parser, árbol, React y maquetación, lineales): bajarlo exige
  parsear en un worker o pintar por partes. Mientras tanto, por encima de 100 KB se ve
  «Preparando el documento…» antes del bloqueo
- [ ] 🟡 **Recursos locales en Firefox y Safari**: «Abrir carpeta» y soltar una carpeta usan
  APIs estándar presentes en los dos, pero solo se han probado en Chromium (Playwright del
  proyecto). Soltar una carpeta tampoco tiene E2E en Chromium (Playwright no simula
  entradas de carpeta): probarlo a mano en los tres
- [ ] 🟢 **Imágenes con fondo transparente en la hoja oscura**: un logo o diagrama con trazo
  negro sobre transparente apenas se ve (las imágenes conservan sus colores, a propósito).
  Posible fondo claro opcional para imágenes, como la opción de «oscurecer imágenes» del
  PDF; necesita decisión de producto
- [ ] 🟢 **Texto del diálogo de carpeta de Chrome** («¿Subir N archivos a este sitio?»): es
  del navegador y no se puede cambiar; BPDF no sube nada. Decirlo en la guía pública
  (`public_docs/`) cuando la web se publique
- [ ] 🟢 **Negar `clipboard-read`** en `Permissions-Policy` → F12. BPDF nunca lee el
  portapapeles (copiar código solo escribe), pero la cabecera no se tocó en la F7

- [ ] 🟠 CSP definitiva → F12. La base estricta existe desde F2; cada fase añade solo las
  directivas de su tabla en [SEGURIDAD.md](SEGURIDAD.md) §2.1. Las cabeceras llegan a la
  web publicada con `vercel.json` (generado; pendiente de comprobar tras desplegar).
- [ ] 🟡 Revisar [mejoras.md](mejoras.md) → CI (versiones de las Actions, fijarlas por SHA):
  los workflows ya han corrido en verde en GitHub.
- [ ] 🟡 **Probar el visor con un PDF de ofimática** (LibreOffice o Word: estilos, tablas,
  imágenes, notas al pie). No se pudo en la F5: no hay LibreOffice en el equipo de
  desarrollo. Nada sale del equipo.
- [ ] 🟡 **Medir el visor en un equipo modesto** → F13. Las cifras de la F5 son de un Ryzen 7
  5800X; allí el hilo principal bloqueado por el modo oscuro (~3,5 ms/Mpx con worker) y los
  2 renders a la vez pueden necesitar ajuste.
- [ ] 🟡 **Modo oscuro: diagramas raster con fondo blanco** quedan como recuadros blancos
  (se conservan por ser imágenes). Posible opción «oscurecer también las imágenes» por
  documento, como ya preveía PLAN §6.3; necesita decisión de producto.
- [ ] 🟢 **Guía pública del visor PDF** en `public_docs/` cuando la web se publique (D5): hoy
  la portada dice, con razón, que BPDF aún no se puede usar.
- [ ] 🟢 Favicon e icono de BPDF → F11. Hoy no hay ninguno (no se inventa identidad
  visual): el navegador pide `/favicon.ico` y recibe 404. Google Chrome lo anota en
  consola, y `e2e/vigilancia.ts` tolera ese único 404: **quitar la tolerancia** al añadir
  el favicon.
- [ ] 🟢 `fsevents@2.3.3` (dependencia de Vite, solo en macOS) aparece en `npm ci` como
  paquete con scripts de instalación sin aprobar. Trae su binario ya compilado
  (`fsevents.node`) y su `package.json` no declara `install`, así que omitirlo no cambia
  nada; falta decidir si se deniega explícitamente en `allowScripts` (CLAUDE.md §11 bis).
  Ojo: npm 11.17 llama al comando `npm approve-scripts`, y STACK.md documenta
  `npm install-scripts` (npm 11.19): comprobar cuál vale y unificar.
