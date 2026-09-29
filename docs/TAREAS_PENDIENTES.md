# Tareas pendientes

Solo tareas **abiertas**. Al cerrar una, se borra la línea y se cuenta en
[CHANGELOG.md](CHANGELOG.md). Lo que no es una tarea (reglas, costumbres) va a
[`CLAUDE.md`](../CLAUDE.md). Convención completa: `CLAUDE.md` §7.

`[ ]` pendiente · `[~]` en curso · 🔴 alta · 🟠 media-alta · 🟡 media · 🟢 baja

**Qué se hace y cómo:** cada fase está especificada en [FASES.md](FASES.md) (alcance,
archivos, tests, criterios de aceptación). El diseño que construyen: [PLAN.md](PLAN.md),
[SEGURIDAD.md](SEGURIDAD.md) y [ELECTRON.md](ELECTRON.md). Aquí solo el estado.

## Estado hoy — *2026-09-29*

Medido con Node 24.21.0 y npm 11.19.0 en WSL, al cerrar la Fase 2, tras una instalación
limpia (`npm ci`).

| Comprobación | Resultado |
|---|---|
| Código | SPA estática de Vite 8 + React 19: shell accesible y estado vacío. Sin backend, datos ni variables de entorno. **Todavía no abre documentos** |
| `npm run lint` · `typecheck` | ✅ |
| `npm run test:run` | ✅ 66 tests en 9 ficheros |
| `npm run test:e2e` | ✅ 6 tests contra la build de producción (`vite preview`, Chromium) |
| `npm run build` · `build:tamano` | ✅ `dist/` estático · arranque 80 KB gzip (límite 150) · 2 avisos conocidos e inocuos (`"use client"` en dos ficheros de `lucide-react`, STACK.md) |
| CSP | ✅ `default-src 'none'`, sin `unsafe-*` ni orígenes externos; cero violaciones en E2E |
| `npm run docs:validar` · `docs:enlaces` | ✅ |
| `npm audit --audit-level=high` | ✅ 0 vulnerabilidades · 0 overrides · 0 paquetes con scripts de instalación |
| Dependencias de runtime | 5: `react`, `react-dom`, `lucide-react`, `clsx`, `tailwind-merge` |
| CI en GitHub | ⚪ Sin ejecuciones conocidas |
| Licencia | ✅ Apache-2.0 |

## Decisiones pendientes de confirmación

Detalle, opciones y recomendación de cada una en [PLAN.md §14](PLAN.md#14-decisiones). Una
fase no empieza con una decisión que necesita sin confirmar.

- [ ] 🟠 **D16** Un documento a la vez en v1 (recomendado) — bloquea F3
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

- [ ] 🔴 **F3** Apertura local de archivos (capa `platform/`, selector, arrastre, validación) — **siguiente**; necesita **D16**
- [ ] 🔴 **F4** Spike: modo oscuro de PDF (decide T-1) — puede ir en paralelo con F3
- [ ] 🔴 **F5** Visor PDF: núcleo
- [ ] 🟠 **F6** Visor PDF: miniaturas, búsqueda, atajos, pantalla completa
- [ ] 🔴 **F7** Markdown: lectura (GFM, código, TOC, imágenes locales, seguridad)
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
- [ ] 🟢 Añadir `*.pdf binary` a `.gitattributes` cuando entren los primeros fixtures PDF
  (F3/F4): con `text=auto eol=lf`, un PDF con pocos bytes binarios podría tratarse como
  texto y romperse al normalizar finales de línea.
- [ ] 🟢 Favicon e icono de BPDF → F11. Hoy no hay ninguno (no se inventa identidad
  visual): el navegador pide `/favicon.ico` y recibe 404.
