# Tareas pendientes

Solo tareas **abiertas**. Al cerrar una, se borra la línea y se cuenta en
[CHANGELOG.md](CHANGELOG.md). Lo que no es una tarea (reglas, costumbres) va a
[`CLAUDE.md`](../CLAUDE.md). Convención completa: `CLAUDE.md` §7.

`[ ]` pendiente · `[~]` en curso · 🔴 alta · 🟠 media-alta · 🟡 media · 🟢 baja

**Qué se hace y cómo:** cada fase está especificada en [FASES.md](FASES.md) (alcance,
archivos, tests, criterios de aceptación). El diseño que construyen: [PLAN.md](PLAN.md),
[SEGURIDAD.md](SEGURIDAD.md) y [ELECTRON.md](ELECTRON.md). Aquí solo el estado.

## Estado hoy — *2026-09-29*

Medido con Node 24.21.0 y npm 11.19.0 en **WSL2 (Ubuntu) sobre Windows**, al cerrar la
Fase 4, tras una instalación limpia (`npm ci`). E2E con el Chromium de Playwright (en
esta máquina no hace falta el procedimiento de macOS 13 de DEVELOPMENT.md).

| Comprobación | Resultado |
|---|---|
| Código | SPA estática de Vite 8 + React 19. Abre y valida un PDF o un Markdown local, uno a la vez (D16), sin mostrar aún el contenido. **Modo oscuro de PDF validado** en un spike (`src/pdf/`, laboratorio temporal `/spike.html`): [PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md) |
| `npm run lint` · `typecheck` | ✅ |
| `npm run test:run` | ✅ 216 tests en 20 ficheros (incluye pdf.js real en Node, build `legacy`) |
| `npm run test:e2e` | ✅ 31 tests contra la build de producción (`vite preview`), 8 de ellos del modo oscuro con muestreo de píxeles |
| `npm run build` · `build:tamano` | ✅ arranque 84,2 KB gzip (límite 150; pdf.js, 431 KB, se carga a demanda) · 2 avisos conocidos e inocuos (`"use client"` de `lucide-react`) |
| CSP | ✅ `default-src 'none'`; la Fase 4 añadió `worker-src 'self'` y `font-src 'self'`. Sin `unsafe-*`, sin `'wasm-unsafe-eval'`, sin orígenes externos; cero violaciones y ninguna petición externa en los E2E |
| `npm run docs:validar` | ✅ |
| `npm run docs:enlaces` | ❌ **2 enlaces rotos ajenos a la Fase 4**: `CLAUDE.md` §11 y `docs/TEMPLATE.md` enlazan `r3zon-template.json`, que está borrado en el árbol de trabajo sin commitear (ver «Otras») |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilidades · 0 overrides · 0 scripts de instalación sin aprobar |
| Dependencias de runtime | 6: `react`, `react-dom`, `lucide-react`, `clsx`, `tailwind-merge`, `pdfjs-dist` (6.3.289 exacta) |
| Benchmark (`npm run bench:pdf`, Ryzen 7 5800X) | Transformación ~10 ms/Mpx: 18–28 ms a 2 Mpx, 74–100 ms a 8 Mpx; apertura de pdf.js 160–190 ms (también con 300 páginas) |
| CI en GitHub | ✅ `ci.yml`, `e2e.yml` y `security.yml` en verde en su primera ejecución (commit `04c1291`, 2026-09-29) |
| Licencia | ✅ Apache-2.0 |

## Decisiones pendientes de confirmación

Detalle, opciones y recomendación de cada una en [PLAN.md §14](PLAN.md#14-decisiones). Una
fase no empieza con una decisión que necesita sin confirmar.

- [ ] 🔴 **D17** Visor PDF propio sobre la API núcleo de pdf.js en lugar de `PDFViewer` (visor propio, recomendado; surge del spike) — bloquea F5
- [ ] 🔴 **D18** Build de pdf.js: `legacy` (recomendado) o moderna, que exige navegadores de 2025–2026 — bloquea F5
- [ ] 🟠 **D6** HTML embebido en Markdown: no se interpreta (recomendado) — bloquea F7
- [ ] 🟠 **D7** Imágenes remotas en Markdown: bloqueadas (recomendado) — bloquea F7
- [ ] 🟡 **D13** PDFs con contraseña: diálogo simple (recomendado) — bloquea F5
- [ ] 🟡 **D14** Formularios de PDF: solo se muestran (recomendado) — bloquea F5
- [ ] 🟡 **D9** Editor: CodeMirror 6 (recomendado) o textarea — bloquea F9
- [ ] 🟡 **D8** Recordar página y zoom por documento (activado con huella, recomendado) — bloquea F10
- [ ] 🟡 **D10** Tema claro de interfaz: no en v1 (recomendado) — bloquea F11
- [ ] 🟡 **D12** Móvil/tablet: adaptable básico (recomendado) — bloquea F11
- [ ] 🟡 **D5** Hosting web con cabeceras y dominio — bloquea F12 (configuración) y F15; mientras tanto el dominio es `app.example.com`
- [ ] 🟢 **D11** Escritorio: plataformas, firma y auto-actualización — bloquea F15

## Fases

- [ ] 🔴 **F5** Visor PDF: núcleo — **siguiente**; necesita **D13, D14, D17 y D18**. Parte del spike: reutiliza `src/pdf/`, borra el laboratorio, valida con PDF reales ([FASES.md](FASES.md), aviso al inicio de la Fase 5)
- [ ] 🟠 **F6** Visor PDF: miniaturas, búsqueda, atajos, pantalla completa
- [ ] 🔴 **F7** Markdown: lectura (GFM, código, TOC, imágenes locales, seguridad). Incluye
  lo aplazado de la F3: abrir un `.md` con sus imágenes (varios ficheros o carpeta) y
  normalizar sus rutas ([FASES.md](FASES.md), Fase 7)
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
- [ ] 🟠 **No publicar la web con el laboratorio**: `spike.html` va en la build (lo necesitan
  los E2E) y se borra en la F5. Si se publicara antes, hay que quitarlo de
  `vite.config.ts` → `rolldownOptions.input`.
- [ ] 🟠 **Enlaces a `r3zon-template.json`**: está borrado en el árbol de trabajo (cambio sin
  commitear, anterior a la F4) y `CLAUDE.md` §11 y `docs/TEMPLATE.md` lo siguen enlazando,
  así que `docs:enlaces` falla. Decidir: restaurarlo o reescribir esas dos referencias (va
  con la limpieza de menciones a la plantilla antes de hacer público el repositorio).
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
