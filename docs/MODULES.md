# Piezas del proyecto

Qué hay hoy en BPDF y en qué estado. Leyenda: ✅ completo · 🚧 provisional · ⬜ pendiente
(con la fase que lo construye, [FASES.md](FASES.md)).

| Pieza | Estado | Dónde |
|---|---|---|
| Identidad del producto | ✅ (dominio oficial de D5 desde la F15) | `src/config/project.ts` |
| Distribución web: dominio, `robots.txt`, `sitemap.xml`, `dist/` publicable, smoke de producción | ✅ F15 (verificada en producción) | `src/config/public-site.ts`, `scripts/verificar-dist.mjs`, `playwright.produccion.config.ts`, `e2e/produccion/` |
| SPA estática (Vite + React) y shell accesible | ✅ F2 | `index.html`, `vite.config.ts`, `src/main.tsx`, `src/app/` |
| Tokens de diseño y primitivos (Button, Field, Input) | ✅ F2 (revisados en F11; lista en PLAN §9.5) | `src/styles/globals.css`, `src/components/ui/` |
| Textos centralizados | ✅ F2 | `src/i18n/messages.ts` |
| CSP y cabeceras de seguridad | ✅ F2 (base; se amplía por fase) · ✅ F12 (CSP definitiva, `Permissions-Policy` ampliada; verificadas en producción) | `src/config/security-headers.ts` |
| Tests: unitarios, componentes, a11y, guardarraíles, E2E | ✅ | `tests/`, `e2e/` |
| CI: calidad, tamaño del arranque, E2E, seguridad de dependencias | ✅ | `.github/workflows/` |
| `public_docs/` con contrato y validador | ✅ (portada «próximamente»; registro de cambios para usuarios, `novedades.md`, desde la F15) | `public_docs/`, `scripts/validar-public-docs.mjs` |
| Documentación interna y plan | ✅ | `docs/` |
| Apertura de archivos (selector, `Ctrl/Cmd+O`, arrastre, validación) | ✅ F3 | `src/documents/`, `src/app/DropZone.tsx`, `src/app/DocumentErrorAlert.tsx` |
| Capa de plataforma (web) | ✅ F3 (la única: sin escritorio, D19) | `src/platform/` |
| Preferencias y posición de lectura (solo PDF) | ✅ F10 | `src/preferences/`, `src/app/App.tsx` (botón), `src/app/pdf/Visor.tsx`, `src/markdown/MarkdownView.tsx` |
| Visor PDF | ✅ F4–F6 (la F6: pantalla completa, atajos, búsqueda avanzada y contraseña) | `src/pdf/`, `src/app/pdf/` |
| Lector de Markdown | ✅ F7 | `src/markdown/`, `src/styles/markdown.css` |
| Fórmulas (KaTeX) y diagramas (Mermaid, en un marco aislado) | ✅ F8 | `src/markdown/matematicas.ts`, `mermaid*.ts`, `marco-mermaid.ts`, `svg-seguro.ts`, `mermaid.html` |
| Recursos locales de Markdown (varios ficheros, carpeta, imágenes) | ✅ F7 bis | `src/documents/recursos.ts`, `src/documents/seleccion.ts`, `src/markdown/imagenes.ts`, `src/platform/web.ts` |
| Editor de Markdown (CodeMirror 6, vista previa, dividido, guardar) | ✅ F9 (aprobada con una excepción de rendimiento: Dividido con 1 MB + KaTeX o 1 MB de encabezados; FASES, Fase 9) | `src/editor/`, `src/markdown/MarkdownView.tsx`, `src/platform/guardar-web.ts` |
| Interfaz final: atajos anunciados, «Acerca de», mención a R3ZON, favicon, pantalla estrecha (D12) | ✅ F11 | `src/app/`, `src/preferences/PreferencesDialog.tsx`, `src/config/version.ts`, `public/favicon.svg` |
| Accesibilidad, rendimiento y compatibilidad (barra con flechas, separador de 24 px, axe, Firefox y WebKit, memoria con CDP) | ✅ F13 (Firefox y WebKit también en CI) | `src/app/pdf/barra-teclado.ts`, `e2e/specs/a11y.spec.ts`, `playwright.compat.config.ts`, `e2e/bench/memoria.bench.ts` |
| Escritorio (Electron) | ❌ F14 cancelada (D19: BPDF es solo web) | |

## Módulos de la plantilla

La plantilla R3ZON trae un catálogo de módulos opcionales (`multi-tenancy`,
`billing-stripe`, `auth-advanced`, etc.). **Ninguno aplica a BPDF**, que no tiene base de
datos, usuarios ni backend, y el directorio `modules/` se retiró en la Fase 1 (D15). El
más cercano, `desktop-electron`, recomendaba cargar la URL remota; BPDF iba a hacer lo
contrario (bundle local) por privacidad ([ELECTRON.md](ELECTRON.md) §1). Hoy no aplica:
BPDF es solo web (D19).
