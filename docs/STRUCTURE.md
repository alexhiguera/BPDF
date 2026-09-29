# Estructura del repositorio

Estado tras la Fase 4 (*2026-09-29*). Cada fase actualiza este árbol con lo que crea; lo
que está marcado «llega en Fx» todavía **no existe** (no se crean carpetas vacías).

```text
├── CLAUDE.md                 reglas de trabajo (personas y agentes)
├── README.md                 qué es BPDF y cómo arrancarlo
├── LICENSE                   Apache-2.0
├── r3zon-template.json       registro de origen: de qué plantilla nace (no se actualiza)
├── index.html                entrada de Vite; sin scripts en línea
├── spike.html                TEMPORAL: laboratorio del modo oscuro de PDF (F4; se borra en F5)
├── vite.config.ts            build estática (entradas index y spike), cabeceras de `preview`, plugin de BPDF
├── playwright.bench.config.ts  benchmark del modo oscuro (`npm run bench:pdf`, fuera de CI)
├── src/
│   ├── main.tsx              arranque: crea la plataforma y monta <App/> en el ErrorBoundary
│   ├── app/                  la aplicación: shell y vistas
│   │   ├── App.tsx           proveedor del documento, enlace de salto, cabecera, <main>, Ctrl/Cmd+O
│   │   ├── DropZone.tsx      zona de soltar a pantalla completa (envuelve la app)
│   │   ├── EmptyState.tsx    vista sin documento: «Abrir archivo», atajo, privacidad
│   │   ├── DocumentSummary.tsx  vista PROVISIONAL del documento abierto (F5/F7 la sustituyen)
│   │   ├── DocumentErrorAlert.tsx  aviso de fichero no válido (role="alert")
│   │   └── ErrorBoundary.tsx red ante errores de render (sin telemetría)
│   ├── components/ui/        primitivos accesibles: Button, Field, Input
│   ├── config/
│   │   ├── project.ts        ÚNICO punto con la identidad del producto
│   │   ├── security-headers.ts  ÚNICA fuente de la CSP y las cabeceras
│   │   └── public-site.ts    robots.txt y sitemap.xml (fechas literales)
│   ├── i18n/messages.ts      TODOS los textos visibles (D2)
│   ├── styles/globals.css    Tailwind 4 + tokens de diseño
│   ├── documents/            el documento abierto, sin UI ni plataforma
│   │   ├── types.ts          OpenedDocument (PDF: Blob · Markdown: texto)
│   │   ├── detect.ts         extensión, firma %PDF-, UTF-8 estricto, nombre saneado
│   │   ├── limits.ts         tamaños máximos, con su justificación
│   │   ├── errors.ts         DocumentError y sus códigos
│   │   ├── read.ts           readDocument(): valida y construye el documento
│   │   └── DocumentProvider.tsx  estado (un documento, D16) y useDocument()
│   ├── platform/             ÚNICA frontera web/Electron
│   │   ├── types.ts          interfaz Platform (pickDocument, openDroppedFile)
│   │   ├── web.ts            implementación con APIs estándar del navegador
│   │   └── index.ts          createPlatform() (la rama de Electron llega en F14)
│   ├── lib/                  utils.ts (cn()) · format.ts (tamaños legibles)
│   ├── vite-env.d.ts         tipos de Vite (imports de CSS)
│   │
│   ├── pdf/                  el motor de PDF, sin React (F4; el visor llega en F5–F6)
│   │   ├── engine.ts         carga de pdf.js a demanda y del documento (bytes, useWasm: false)
│   │   ├── render.ts         render de una página con la API núcleo + regiones de imagen
│   │   └── dark/             modo oscuro: color.ts (OKLab, contraste) · recolor.ts · regiones.ts · aplicar.ts
│   ├── pdf-spike/            TEMPORAL: laboratorio y benchmark de la F4 (se borra en F5)
│   ├── markdown/  editor/    llegan en F7–F9
│   └── preferences/          llega en F10
├── electron/                 llega en F14 (proceso main y preload; fuera de src/)
├── tests/
│   ├── unit/                 lógica pura y guardarraíles (tokens, CSP, textos, identidad)
│   ├── components/           Testing Library + jest-axe
│   ├── helpers/              utilidades de test (ficheros, plataforma en memoria)
│   ├── fixtures/             documentos de prueba con su procedencia (README.md)
│   ├── _fixtures/            proyecto ficticio autocontenido para probar validadores
│   └── public-docs.test.ts   el validador de public_docs
├── e2e/                      Playwright contra la build de producción
│   ├── specs/                app.spec.ts (base) · abrir.spec.ts (apertura) · pdf-spike.spec.ts (modo oscuro, temporal)
│   ├── bench/                benchmark del modo oscuro (no es un test; `npm run bench:pdf`)
│   └── vigilancia.ts         consola, CSP y red vigiladas en cada carga
├── scripts/                  herramientas (.mjs, sin dependencias extra)
│   ├── validar-public-docs.mjs · verificar-enlaces-docs.mjs · verificar-overrides.mjs
│   ├── tamano-bundle.mjs     peso del arranque
│   ├── copiar-pdfjs.mjs      recursos de pdf.js a public/pdfjs/ (predev/prebuild)
│   └── lib/                  piezas puras, probadas en tests/
├── docs/                     documentación interna (plan, fases, bitácora, tareas)
├── public_docs/              documentación pública (la publica el Docusaurus de R3ZON)
├── .github/workflows/        ci.yml · e2e.yml · security.yml
└── .claude/settings.json     permisos de Claude Code para el repo
```

`dist/` (la build) y `public/pdfjs/` (recursos de pdf.js copiados de `node_modules`) no se
versionan.

## Dónde va cada cosa

| Qué | Dónde | Por qué |
|---|---|---|
| Vista o pieza del shell | `src/app/` | Lo que compone la aplicación |
| Primitivo de UI reutilizable | `src/components/ui/` | Con su test de jest-axe |
| Texto visible | `src/i18n/messages.ts` | D2; un test lo vigila |
| Color | un token en `src/styles/globals.css` | Nunca un color en un componente; el contraste lo vigila un test |
| Directiva de CSP o cabecera | `src/config/security-headers.ts` | Fuente única para `preview`, build, hosting y Electron |
| Identidad (nombre, dominio, idioma) | `src/config/project.ts` | Los JSON que la repiten los valida `docs:validar` |
| Motor de un tipo de documento | `src/<motor>/` (`pdf/`, `markdown/`), sin React en su núcleo | [PLAN.md](PLAN.md) §4.1: se prueba sin montar nada |
| Modelo, validación y estado del documento abierto | `src/documents/` | Sin UI ni plataforma: lo usan las dos plataformas y los visores |
| Acceso a ficheros, diálogos, enlaces externos | `src/platform/` | Única frontera con la plataforma: el resto del código nunca ve rutas ni `window.bpdf` ([ELECTRON.md](ELECTRON.md) §3) |
| Documento de prueba | `tests/fixtures/<tipo>/`, con su fila en `tests/fixtures/README.md` | Procedencia y licencia conocidas (CLAUDE.md §6). Mejor generado por script (`tests/fixtures/pdf/modo-oscuro/generar.mjs`) |
| Recurso de un motor que se pide en tiempo de ejecución (worker, fuentes) | copiado por un script a `public/<motor>/`, sin versionar | Se sirve desde el propio origen (CSP) y sale de la versión exacta instalada |
| Lógica pura genérica | `src/lib/` | |
| Herramienta de operación | `scripts/*.mjs` (lógica testeable en `scripts/lib/`) | |

## Convención de nombres

- **Infraestructura técnica en inglés**: `security-headers.ts`, `ErrorBoundary`, `utils.ts`.
- **Scripts propios y documentación en español** (`validar-public-docs.mjs`,
  `tamano-bundle.mjs`).
- **Tests**: el nombre del `it()` describe el comportamiento en español, porque se lee como
  especificación.

Mezclar idiomas una vez es feo; ser inconsistente es feo cada día.
