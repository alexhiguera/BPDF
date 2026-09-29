# Tareas pendientes

Solo tareas **abiertas**. Al cerrar una, se borra la línea y se cuenta en
[CHANGELOG.md](CHANGELOG.md). Lo que no es una tarea (reglas, costumbres) va a
[`CLAUDE.md`](../CLAUDE.md). Convención completa: `CLAUDE.md` §7.

`[ ]` pendiente · `[~]` en curso · 🔴 alta · 🟠 media-alta · 🟡 media · 🟢 baja

**Qué se hace y cómo:** cada fase está especificada en [FASES.md](FASES.md) (alcance,
archivos, tests, criterios de aceptación). El diseño que construyen: [PLAN.md](PLAN.md),
[SEGURIDAD.md](SEGURIDAD.md) y [ELECTRON.md](ELECTRON.md). Aquí solo el estado.

## Estado hoy — *2026-09-29*

Medido con Node 24.19.0 y npm 11.17.0 en macOS 13, al cerrar la Fase 3, tras una
instalación limpia (`npm ci`).

| Comprobación | Resultado |
|---|---|
| Código | SPA estática de Vite 8 + React 19. **Abre y valida** un PDF o un Markdown local (selector, `Ctrl/Cmd+O`, arrastre), uno a la vez (D16), y muestra nombre, tipo y tamaño. **Todavía no muestra el contenido** (visores: F5 y F7). Sin backend, datos ni variables de entorno |
| `npm run lint` · `typecheck` | ✅ |
| `npm run test:run` | ✅ 181 tests en 16 ficheros |
| `npm run test:e2e` | ✅ 23 tests contra la build de producción (`vite preview`), estables con `--repeat-each=3`. En esta máquina, con **Google Chrome 153** y una configuración local: Playwright 1.63 no instala Chromium en macOS 13 ([DEVELOPMENT.md](DEVELOPMENT.md)). CI usa su Chromium |
| `npm run build` · `build:tamano` | ✅ `dist/` estático · arranque 83,0 KB gzip (límite 150) · 2 avisos conocidos e inocuos (`"use client"` en dos ficheros de `lucide-react`, STACK.md) |
| CSP | ✅ Sin cambios en la Fase 3: `default-src 'none'`, sin `unsafe-*` ni orígenes externos; cero violaciones y ninguna petición externa en los E2E de apertura; cabeceras comprobadas con `curl -I` contra `vite preview` |
| `npm run docs:validar` · `docs:enlaces` | ✅ |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilidades · 0 overrides. En macOS, `npm ci` avisa de `fsevents` sin cubrir por `allowScripts` (ver «Otras») |
| Dependencias de runtime | 5: `react`, `react-dom`, `lucide-react`, `clsx`, `tailwind-merge` |
| CI en GitHub | ⚪ Sin ejecuciones conocidas |
| Licencia | ✅ Apache-2.0 |

## Decisiones pendientes de confirmación

Detalle, opciones y recomendación de cada una en [PLAN.md §14](PLAN.md#14-decisiones). Una
fase no empieza con una decisión que necesita sin confirmar.

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

- [ ] 🔴 **F4** Spike: modo oscuro de PDF (decide T-1) — **siguiente**
- [ ] 🔴 **F5** Visor PDF: núcleo
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
- [ ] 🟡 Comprobar que `ci.yml`, `e2e.yml` y `security.yml` corren en GitHub (nunca se han
  ejecutado en un runner), y revisar entonces [mejoras.md](mejoras.md) → CI.
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
