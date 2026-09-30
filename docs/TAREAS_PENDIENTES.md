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
Fase 5, tras una instalación limpia (`npm ci`). E2E con el Chromium de Playwright.

| Comprobación | Resultado |
|---|---|
| Código | SPA estática de Vite 8 + React 19. Abre un PDF o un Markdown local, uno a la vez (D16). **Los PDF se leen** en un visor propio sobre pdf.js (D17, build `legacy`: D18) con modo oscuro selectivo en un worker, vistas continua y página a página, zoom, giro, capa de texto, enlaces, búsqueda y miniaturas ([ARCHITECTURE.md](ARCHITECTURE.md) §4 quater). El Markdown aún solo se valida |
| `npm run lint` · `typecheck` | ✅ |
| `npm run test:run` | ✅ 380 tests en 29 ficheros (incluye pdf.js real en Node, build `legacy`) |
| `npm run test:e2e` | ✅ 45 tests contra la build de producción (`vite preview`), 22 del visor PDF (con muestreo de píxeles del modo oscuro) |
| `npm run build` · `build:tamano` | ✅ arranque 85,5 KB gzip (límite 150). A demanda: visor 15,4 KB + 0,8 KB CSS, pdf.js 148 KB, worker del modo oscuro 3 KB, worker de pdf.js 1,3 MB · 2 avisos conocidos e inocuos (`"use client"` de `lucide-react`) |
| CSP | ✅ `default-src 'none'`; la Fase 4 añadió `worker-src 'self'` y `font-src 'self'`, la Fase 5 `connect-src 'self'` (cmaps de pdf.js). Sin `unsafe-*`, sin `'wasm-unsafe-eval'`, sin orígenes externos; cero violaciones y ninguna petición externa en los E2E; comprobada con `curl -I` |
| `npm run docs:validar` · `docs:enlaces` | ✅ · ✅ (189 enlaces en 18 ficheros) |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilidades · 0 overrides · 0 scripts de instalación sin aprobar |
| Dependencias de runtime | 6 (ninguna nueva en la Fase 5): `react`, `react-dom`, `lucide-react`, `clsx`, `tailwind-merge`, `pdfjs-dist` (6.3.289 exacta) |
| Benchmark (`npm run bench:pdf`, Ryzen 7 5800X) | Modo oscuro en el hilo principal: sin worker 18–28 ms a 2,2 Mpx y 113–141 ms a 16,8 Mpx; con worker 9–13 ms y 60–66 ms. 300 páginas: primera página ~0,9 s, máx. 4 lienzos (≤ 34 MiB a DPR 1), heap ~60 MiB |
| PDF reales | 9 probados (papers, formulario, corpus de pdf.js, generados con Chromium): sin errores ni peticiones externas; límites del modo oscuro en ARCHITECTURE §4 quater |
| CI en GitHub | ✅ en verde en su primera ejecución (commit `04c1291`); la Fase 5 aún no se ha subido |
| Licencia | ✅ Apache-2.0 |

## Decisiones pendientes de confirmación

Detalle, opciones y recomendación de cada una en [PLAN.md §14](PLAN.md#14-decisiones). Una
fase no empieza con una decisión que necesita sin confirmar.

- [ ] 🟠 **D6** HTML embebido en Markdown: no se interpreta (recomendado) — bloquea F7
- [ ] 🟠 **D7** Imágenes remotas en Markdown: bloqueadas (recomendado) — bloquea F7
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
- [ ] 🔴 **F7** Markdown: lectura (GFM, código, TOC, imágenes locales, seguridad). Incluye
  lo aplazado de la F3: abrir un `.md` con sus imágenes (varios ficheros o carpeta) y
  normalizar sus rutas ([FASES.md](FASES.md), Fase 7). Debe usar la política de URLs de
  `src/lib/url-externa.ts` y `Platform.openExternal`
- [ ] 🟠 **F8** Markdown: matemáticas (KaTeX) y Mermaid
- [ ] 🟠 **F9** Editor Markdown, vista previa y modo dividido
- [ ] 🟡 **F10** Preferencias (infraestructura con `zod`, panel, posición por documento, borrado)
- [ ] 🟡 **F11** UI/UX final
- [ ] 🔴 **F12** Seguridad: endurecimiento y auditoría
- [ ] 🟠 **F13** Accesibilidad y rendimiento (medición)
- [ ] 🟠 **F14** Electron: aplicación
- [ ] 🟡 **F15** Distribución: web y escritorio
- [ ] 🟡 **F16** Open source y documentación final

## Otras

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
