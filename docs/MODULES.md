# Piezas del proyecto

Qué hay hoy en BPDF y en qué estado. Leyenda: ✅ completo · 🚧 provisional · ⬜ pendiente
(con la fase que lo construye, [FASES.md](FASES.md)).

| Pieza | Estado | Dónde |
|---|---|---|
| Identidad del producto | ✅ (dominio pendiente de D5) | `src/config/project.ts` |
| SPA estática (Vite + React) y shell accesible | ✅ F2 | `index.html`, `vite.config.ts`, `src/main.tsx`, `src/app/` |
| Tokens de diseño y primitivos (Button, Field, Input) | ✅ F2 (diseño definitivo en F11) | `src/styles/globals.css`, `src/components/ui/` |
| Textos centralizados | ✅ F2 | `src/i18n/messages.ts` |
| CSP y cabeceras de seguridad | ✅ F2 (base; se amplía por fase y se cierra en F12) | `src/config/security-headers.ts` |
| Tests: unitarios, componentes, a11y, guardarraíles, E2E | ✅ | `tests/`, `e2e/` |
| CI: calidad, tamaño del arranque, E2E, seguridad de dependencias | ✅ | `.github/workflows/` |
| `public_docs/` con contrato y validador | ✅ (portada «próximamente») | `public_docs/`, `scripts/validar-public-docs.mjs` |
| Documentación interna y plan | ✅ | `docs/` |
| Apertura de archivos (selector, `Ctrl/Cmd+O`, arrastre, validación) | ✅ F3 | `src/documents/`, `src/app/DropZone.tsx`, `src/app/DocumentErrorAlert.tsx` |
| Capa de plataforma (web) | ✅ F3 (Electron en F14) | `src/platform/` |
| Preferencias | ⬜ F10 | |
| Visor PDF | ✅ F4–F5 (pantalla completa y búsqueda avanzada en F6) | `src/pdf/`, `src/app/pdf/` |
| Lector de Markdown | ✅ F7 | `src/markdown/`, `src/styles/markdown.css` |
| Fórmulas (KaTeX) y diagramas (Mermaid, en un marco aislado) | ✅ F8 | `src/markdown/matematicas.ts`, `mermaid*.ts`, `marco-mermaid.ts`, `svg-seguro.ts`, `mermaid.html` |
| Recursos locales de Markdown (varios ficheros, carpeta, imágenes) | ✅ F7 bis | `src/documents/recursos.ts`, `src/documents/seleccion.ts`, `src/markdown/imagenes.ts`, `src/platform/web.ts` |
| Editor de Markdown | ⬜ F9 | |
| Escritorio (Electron) | ⬜ F14 | |

## Módulos de la plantilla

La plantilla R3ZON trae un catálogo de módulos opcionales (`multi-tenancy`,
`billing-stripe`, `auth-advanced`, etc.). **Ninguno aplica a BPDF**, que no tiene base de
datos, usuarios ni backend, y el directorio `modules/` se retiró en la Fase 1 (D15). El
más cercano, `desktop-electron`, recomendaba cargar la URL remota; BPDF hace lo contrario
(bundle local) por privacidad: [ELECTRON.md](ELECTRON.md) §1.
