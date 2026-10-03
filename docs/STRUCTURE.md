# Estructura del repositorio

Estado tras la Fase 8 (*2026-09-30*). Cada fase actualiza este árbol con lo que crea; lo
que está marcado «llega en Fx» todavía **no existe** (no se crean carpetas vacías).

```text
├── CLAUDE.md                 reglas de trabajo (personas y agentes)
├── README.md                 qué es BPDF y cómo arrancarlo
├── LICENSE                   Apache-2.0
├── index.html                entrada de Vite; sin scripts en línea
├── mermaid.html              segunda entrada: el marco aislado de Mermaid (F8), con su propia CSP
├── vite.config.ts            build estática, workers como módulos ES, cabeceras de `preview`, plugin de BPDF
├── vercel.json               cabeceras HTTP de la web publicada: GENERADO (`npm run cabeceras:vercel`)
├── playwright.bench.config.ts  benchmarks (`npm run bench:pdf` · `bench:markdown` · `bench:editor`, fuera de CI)
├── src/
│   ├── main.tsx              arranque: crea la plataforma y monta <App/> en el ErrorBoundary
│   ├── app/                  la aplicación: shell y vistas
│   │   ├── App.tsx           proveedor del documento, enlace de salto, cabecera, <main>, Ctrl/Cmd+O;
│   │   │                     monta el visor del documento abierto (PDF o Markdown, a demanda)
│   │   ├── DropZone.tsx      zona de soltar a pantalla completa (envuelve la app)
│   │   ├── EmptyState.tsx    vista sin documento: «Abrir archivo», «Abrir carpeta», atajo, privacidad
│   │   ├── ElegirMarkdown.tsx  carpeta con varios .md: el usuario elige el principal (F7 bis)
│   │   ├── ConfirmarDescarte.tsx  «Hay cambios sin guardar» antes de sustituir o cerrar (F9)
│   │   ├── pdf/              interfaz del visor PDF (F5, F6), cargada a demanda
│   │   │   ├── VisorPdf.tsx  carga del PDF, estados cargando/contraseña/error y ciclo de vida
│   │   │   ├── Visor.tsx     área de lectura: disposición, desplazamiento, teclado, búsqueda,
│   │   │   │                 pantalla completa
│   │   │   ├── BarraHerramientas.tsx · BarraBusqueda.tsx · PanelMiniaturas.tsx
│   │   │   ├── AyudaAtajos.tsx       ayuda `?` con el interruptor de los atajos de una tecla (F6)
│   │   │   ├── DialogoContrasena.tsx contraseña de apertura, <dialog> modal (F6, D13)
│   │   │   ├── estado.ts     estado de la vista (reductor puro)
│   │   │   ├── atajos.ts     resolución de atajos de teclado (pura) y su interruptor en memoria
│   │   │   └── colores.ts    colores del modo oscuro leídos de los tokens
│   │   ├── DocumentErrorAlert.tsx  aviso de fichero no válido (role="alert")
│   │   └── ErrorBoundary.tsx red ante errores de render (sin telemetría)
│   ├── components/ui/        primitivos accesibles: Button, Field, Input
│   ├── config/
│   │   ├── project.ts        ÚNICO punto con la identidad del producto
│   │   ├── security-headers.ts  ÚNICA fuente de la CSP y las cabeceras
│   │   └── public-site.ts    robots.txt y sitemap.xml (fechas literales)
│   ├── i18n/messages.ts      TODOS los textos visibles (D2)
│   ├── styles/globals.css    Tailwind 4 + tokens de diseño
│   ├── styles/visor-pdf.css  capa de texto de pdf.js (adaptada), enlaces y resaltado; con el visor
│   ├── styles/markdown.css   estilos del CONTENIDO de un Markdown (todo bajo .md-contenido); con el visor
│   ├── documents/            el documento abierto, sin UI ni plataforma
│   │   ├── types.ts          OpenedDocument (PDF: Blob · Markdown: texto)
│   │   ├── detect.ts         extensión, firma %PDF-, UTF-8 estricto, nombre saneado
│   │   ├── limits.ts         tamaños máximos, con su justificación
│   │   ├── errors.ts         DocumentError y sus códigos
│   │   ├── read.ts           readDocument(): valida y construye el documento
│   │   ├── seleccion.ts      abrirSeleccion(): varios ficheros o carpeta → documento o elección (F7 bis)
│   │   ├── recursos.ts       recursos de un Markdown: construcción y resolverRecurso() (F7 bis)
│   │   └── DocumentProvider.tsx  estado (un documento, D16), cambios sin guardar y su confirmación (F9)
│   ├── platform/             ÚNICA frontera web/Electron
│   │   ├── types.ts          interfaz Platform (pickDocument, pickFolder, openDropped, openExternal, saveText)
│   │   ├── web.ts            implementación con APIs estándar (selector múltiple, carpetas, entradas)
│   │   ├── guardar-web.ts    saveText en web: showSaveFilePicker (destino en memoria) o descarga (F9)
│   │   └── index.ts          createPlatform() (la rama de Electron llega en F14)
│   ├── lib/                  utils.ts (cn()) · format.ts (tamaños legibles) · url-externa.ts (política de URLs)
│   ├── vite-env.d.ts         tipos de Vite (imports de CSS)
│   │
│   ├── pdf/                  el motor y el visor de PDF, sin React
│   │   ├── engine.ts         carga de pdf.js (legacy) y del documento: bytes, cancelación, errores
│   │   ├── render.ts         render de una página + regiones de imagen; política de resolución
│   │   ├── dark/             modo oscuro: color.ts · recolor.ts · regiones.ts · aplicar.ts (franjas,
│   │   │                     transformadores) · trabajador.ts (worker) · transformador-worker.ts
│   │   └── visor/            disposicion.ts · busqueda.ts · enlaces.ts (puros) · documento.ts ·
│   │                         superficie.ts · capas.ts · controlador.ts (ARCHITECTURE §4 quater)
│   ├── markdown/             el lector de Markdown (F7), cargado a demanda (ARCHITECTURE §4 quinquies)
│   │   ├── MarkdownView.tsx  la vista: barra, índice, <article>, aviso de documento grande; modos,
│   │   │                     vista previa, cambios y guardar (F9)
│   │   ├── pipeline.ts       plugins, lista blanca de elementos, urlTransform (todo lo de seguridad)
│   │   ├── url-policy.ts     clasificación de enlaces e imágenes (pura)
│   │   ├── toc.ts            ids md-… de los encabezados y lectura del índice
│   │   ├── resaltado.ts      lowlight con 9 gramáticas → React con lista blanca
│   │   ├── imagenes.ts       AlmacenUrls: URL blob: de las imágenes locales, con revocación (F7 bis)
│   │   ├── matematicas.ts    KaTeX a demanda: opciones, nodos sin HTML ni estilos por atributo (F8)
│   │   ├── mermaid.ts        MarcoMermaid: el iframe aislado visto desde la app (F8)
│   │   ├── mermaid-config.ts configuración estricta, topes y protocolo de mensajes (F8)
│   │   ├── marco-mermaid.ts  lo que corre DENTRO del marco (entrada de mermaid.html) (F8)
│   │   ├── svg-seguro.ts     sanearSvg (marco, DOM) y verificarSvg (app, sin DOM) (F8)
│   │   └── components/       Enlace · Imagen · BloqueCodigo · Preformateado (código, fórmula o
│   │                         diagrama) · Formula · Diagrama · Indice · elementos (encabezados,
│   │                         tabla, casilla) · acciones.ts (contextos visor ↔ elementos)
│   ├── editor/               el editor de Markdown (F9, ARCHITECTURE §4 octies)
│   │   ├── EditorMarkdown.tsx  CodeMirror 6 en un Shadow DOM (CSP), a demanda
│   │   ├── ModeSwitch.tsx · SplitView.tsx  modos y paneles con separador accesible
│   │   ├── sincronia.ts      desplazamiento sincronizado por encabezados (puro + gancho)
│   │   └── tipos.ts          el contrato del editor, sin tipos de CodeMirror
│   └── preferences/          preferencias y posición de lectura (F10, ARCHITECTURE §4 nonies)
│       ├── schema.ts         bpdf:prefs y bpdf:positions con zod (jitless), campo a campo
│       ├── store.ts          localStorage con try/catch, versiones, copia en memoria y pestañas
│       ├── usePreferences.ts el gancho (useSyncExternalStore)
│       ├── positions.ts      página y zoom por huella de PDF, LRU de 50
│       └── PreferencesDialog.tsx  el diálogo, a demanda desde la cabecera
├── electron/                 llega en F14 (proceso main y preload; fuera de src/)
├── tests/
│   ├── unit/                 lógica pura y guardarraíles (tokens, CSP, textos, identidad)
│   ├── components/           Testing Library + jest-axe
│   ├── helpers/              utilidades de test (ficheros, plataforma en memoria, editor falso para jsdom)
│   ├── fixtures/             documentos de prueba con su procedencia (README.md)
│   ├── _fixtures/            proyecto ficticio autocontenido para probar validadores
│   └── public-docs.test.ts   el validador de public_docs
├── e2e/                      Playwright contra la build de producción
│   ├── specs/                app.spec.ts (base) · abrir.spec.ts (apertura) · visor-pdf.spec.ts (visor PDF) ·
│   │                         markdown.spec.ts (visor Markdown) · recursos.spec.ts (imágenes locales) ·
│   │                         formulas-diagramas.spec.ts (KaTeX y Mermaid) · editor.spec.ts (editor, F9) ·
│   │                         memoria.spec.ts (al cambiar de documento se libera el anterior; CDP, sin traza) ·
│   │                         preferencias.spec.ts (preferencias, posición y privacidad del almacenamiento, F10)
│   ├── bench/                benchmarks (no son tests; `npm run bench:pdf` · `bench:markdown` · `bench:editor`)
│   └── vigilancia.ts         consola, CSP y red vigiladas en cada carga
├── scripts/                  herramientas (.mjs, sin dependencias extra)
│   ├── validar-public-docs.mjs · verificar-enlaces-docs.mjs · verificar-overrides.mjs
│   ├── generar-vercel.mjs · verificar-cabeceras.mjs   vercel.json desde la fuente; cabeceras reales
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
