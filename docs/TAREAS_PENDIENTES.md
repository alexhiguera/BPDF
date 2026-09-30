# Tareas pendientes

Solo tareas **abiertas**. Al cerrar una, se borra la línea y se cuenta en
[CHANGELOG.md](CHANGELOG.md). Lo que no es una tarea (reglas, costumbres) va a
[`CLAUDE.md`](../CLAUDE.md). Convención completa: `CLAUDE.md` §7.

`[ ]` pendiente · `[~]` en curso · 🔴 alta · 🟠 media-alta · 🟡 media · 🟢 baja

**Qué se hace y cómo:** cada fase está especificada en [FASES.md](FASES.md) (alcance,
archivos, tests, criterios de aceptación). El diseño que construyen: [PLAN.md](PLAN.md),
[SEGURIDAD.md](SEGURIDAD.md) y [ELECTRON.md](ELECTRON.md). Aquí solo el estado.

## Estado hoy — *2026-09-30*

Medido con Node 24.21.0 y npm 11.19.0 en **WSL2 (Ubuntu) sobre Windows**, al cerrar la
Fase 8, tras una instalación limpia (`npm ci`). E2E con el Chromium de Playwright.

| Comprobación | Resultado |
|---|---|
| Código | SPA estática de Vite 8 + React 19. Abre un PDF o un Markdown local, uno a la vez (D16). **Los PDF se leen** en un visor propio sobre pdf.js (D17, build `legacy`: D18) con modo oscuro selectivo en un worker, vistas continua y página a página, zoom, giro, capa de texto, enlaces, búsqueda y miniaturas ([ARCHITECTURE.md](ARCHITECTURE.md) §4 quater). **Los Markdown se leen** en un lector GFM: HTML como texto, política de URLs propia, código resaltado con copiar, índice (§4 quinquies), y **con sus imágenes locales** si se entregan con el `.md` (varios ficheros o una carpeta; §4 sexies) |
| `npm run lint` · `typecheck` | ✅ |
| `npm run test:run` | ✅ 752 tests en 42 ficheros (incluye pdf.js y KaTeX reales en Node, el corpus de XSS de Markdown, la resolución de recursos y el saneador y el verificador del SVG de Mermaid) |
| `npm run test:e2e` | ✅ 69 tests contra la build de producción (`vite preview`): 22 del visor PDF, 10 del lector de Markdown, 8 de recursos locales y 7 de fórmulas y diagramas (KaTeX y Mermaid hostiles, aislamiento del marco comprobado desde dentro, documento sin fórmulas ni diagramas sin descargas) |
| `npm run build` · `build:tamano` | ✅ arranque 89,6 KB gzip (límite 150; +0,4 KB en la F8). A demanda: visor PDF 15 KB + 0,8 KB CSS, pdf.js 148 KB, lector de Markdown 75 KB + 1,8 KB CSS, KaTeX 77 KB + 4 KB CSS y sus fuentes, Mermaid (en el marco) ~50 KB + ~870 KB en trozos por tipo de diagrama, worker del modo oscuro 3 KB, worker de pdf.js 1,3 MB · 2 avisos conocidos e inocuos (`"use client"` de `lucide-react`) |
| CSP | ✅ `default-src 'none'`; la Fase 4 añadió `worker-src 'self'` y `font-src 'self'`, la Fase 5 `connect-src 'self'` (cmaps de pdf.js); la Fase 7, nada; la Fase 7 bis, `blob:` solo en `img-src` (imágenes locales de Markdown); la Fase 8, `frame-src 'self'` (el marco aislado de Mermaid, `/mermaid.html`, con su propia política: `style-src 'unsafe-inline'` confinado a un origen opaco y sin red). Sin `data:` en la build (`assetsInlineLimit: 0`). Sin `unsafe-*`, sin `'wasm-unsafe-eval'`, sin orígenes externos; cero violaciones y ninguna petición externa en los E2E; comprobada con `curl -I` |
| `npm run docs:validar` · `docs:enlaces` | ✅ · ✅ (221 enlaces en 18 ficheros) |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilidades · 0 overrides · 0 scripts de instalación sin aprobar |
| Dependencias de runtime | 13: `react`, `react-dom`, `lucide-react`, `clsx`, `tailwind-merge`, `pdfjs-dist` (6.3.289), `react-markdown` (10.1.0), `remark-gfm` (4.0.1), `lowlight` (3.3.0), `highlight.js` (11.11.1) y, de la Fase 8, `remark-math` (6.0.0), `katex` (0.18.9) y `mermaid` (11.17.2); todas las de contenido no confiable con versión exacta |
| Benchmark (`npm run bench:pdf`, Ryzen 7 5800X) | Modo oscuro en el hilo principal: sin worker 18–28 ms a 2,2 Mpx y 113–141 ms a 16,8 Mpx; con worker 9–13 ms y 60–66 ms. 300 páginas: primera página ~0,9 s, máx. 4 lienzos (≤ 34 MiB a DPR 1), heap ~60 MiB |
| Benchmark (`npm run bench:markdown`, mismo equipo) | Hasta ver el primer encabezado: 1 KB 0,33 s · 100 KB 0,5–0,9 s · **1 MB 3,3–7,3 s** · 5000 encabezados 0,6–1,0 s · 2000 bloques de código 0,8–1,1 s · listas cortas 200 KB 2,3–2,8 s (cuadrático) · 50 imágenes de 6 Mpx entregadas con 50 sin usar: texto 0,64 s, primera imagen 0,67 s, 50 URL `blob:`, heap 14 MiB · Fase 8: 1500 fórmulas en 2,4 s, 30 diagramas en 2,2 s (~60 ms cada uno), sin cambios para un Markdown sin fórmulas ni diagramas |
| Markdown reales | 14 probados (los de `docs/` y README de paquetes con HTML, insignias remotas, tablas y código): sin errores, peticiones externas, `img` ni `href` fuera de la política |
| PDF reales | 9 probados (papers, formulario, corpus de pdf.js, generados con Chromium): sin errores ni peticiones externas; límites del modo oscuro en ARCHITECTURE §4 quater |
| CI en GitHub | ✅ en verde en su primera ejecución (commit `04c1291`); las Fases 7 bis y 8 aún no se han subido |
| Licencia | ✅ Apache-2.0 |

## Decisiones pendientes de confirmación

Detalle, opciones y recomendación de cada una en [PLAN.md §14](PLAN.md#14-decisiones). Una
fase no empieza con una decisión que necesita sin confirmar.

- [ ] 🟡 **D13** PDFs con contraseña: diálogo simple (recomendado). Hoy un PDF cifrado se detecta y se dice que no se abre — para F6
- [ ] 🟡 **D14** Formularios de PDF: solo se muestran (recomendado). **Aplicado así en la F5** (el encargo excluía formularios): falta confirmarlo
- [ ] 🟡 **Navegador mínimo del visor PDF**: pdf.js 6 carga su worker como módulo ES y necesita Firefox 114, pero `build.target` dice Firefox 111. Subir el mínimo a Firefox 114 (recomendado) o aceptar que en 111–113 un PDF no abra ([STACK.md](STACK.md), `pdfjs-dist`)
- [ ] 🟡 **D9** Editor: CodeMirror 6 (recomendado) o textarea — bloquea F9
- [ ] 🟡 **D8** Recordar página y zoom por documento (activado con huella, recomendado) — bloquea F10
- [ ] 🟡 **D10** Tema claro de interfaz: no en v1 (recomendado) — bloquea F11
- [ ] 🟡 **D12** Móvil/tablet: adaptable básico (recomendado) — bloquea F11
- [ ] 🟡 **D5** Hosting web con cabeceras y dominio — bloquea F12 (configuración) y F15; mientras tanto el dominio es `app.example.com`
- [ ] 🟢 **D11** Escritorio: plataformas, firma y auto-actualización — bloquea F15

## Fases

- [ ] 🟠 **F6** Visor PDF: pantalla completa, atajos de una tecla y búsqueda avanzada (replanteada al cerrar la F5: [FASES.md](FASES.md)); incluye la contraseña si se confirma D13
- [ ] 🟠 **F9** Editor Markdown, vista previa y modo dividido
- [ ] 🟡 **F10** Preferencias (infraestructura con `zod`, panel, posición por documento, borrado)
- [ ] 🟡 **F11** UI/UX final
- [ ] 🔴 **F12** Seguridad: endurecimiento y auditoría
- [ ] 🟠 **F13** Accesibilidad y rendimiento (medición)
- [ ] 🟠 **F14** Electron: aplicación
- [ ] 🟡 **F15** Distribución: web y escritorio
- [ ] 🟡 **F16** Open source y documentación final

## Otras

- [ ] 🟠 **Despliegue: la documentación no coincide con la realidad.** DEPLOYMENT.md dice
  que BPDF no está desplegado, pero está publicado en Vercel (`bpdf.r3zon.com`). Allí no
  hay cabeceras de seguridad propias: la CSP solo llega por `<meta>` (sin
  `frame-ancestors`, `X-Frame-Options` ni el resto de SEGURIDAD §2.2), aunque sí
  `Access-Control-Allow-Origin: *` en los estáticos, que el marco de Mermaid necesita.
  Falta la configuración del hosting (`vercel.json` generado desde `cabecerasPara`, con
  la política propia de `/mermaid.html`) → F12/F15 y D5
- [ ] 🟡 **Fórmulas con un solo dólar** (`$…$`, como en GitHub): dos precios en un párrafo
  («$5 y $10») se leen como fórmula; hay que escribir `\$`. Alternativa: solo `$$…$$`
  (`singleDollarTextMath: false`). Decisión de producto
- [ ] 🟡 **Mermaid 12**: la F8 usa 11.17.2 porque la 12.0.0 era un major reciente. Evaluarla
  (con `mermaid-hostil.md` y `formulas-diagramas.spec.ts`) cuando tenga parches
- [ ] 🟡 **Marco de Mermaid en Firefox y Safari**: el iframe con origen opaco pide sus
  módulos en modo CORS; probado solo en Chromium
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
- [ ] 🟡 **Markdown grande: 1 MB tarda 3–7 s** (criterio de la F7: < 1 s) → F13. No hay un
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
  directivas de su tabla en [SEGURIDAD.md](SEGURIDAD.md) §2.1. Las cabeceras aún no llegan
  a ningún hosting real (depende de D5).
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
