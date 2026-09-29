# Bitácora

Registro de iteraciones para quien mantiene el código: **qué** cambió, **por qué**, qué
se descartó y qué salió mal por el camino. Convención en [`CLAUDE.md`](../CLAUDE.md) §7.
Las entradas nuevas van arriba. Los números de iteración solo tienen que ser únicos:
nunca se renumeran.

La historia de la plantilla de la que nace BPDF está en la bitácora del repositorio de
R3ZON SaaS Template.

---

### Iteración 4 — *2026-09-29* — Fase 2: base de la app en Vite + React

La portada de Next.js heredada se sustituye por una SPA **estática** de Vite 8 + React 19
(D1): `npm run build` produce ficheros en `dist/` y nada más. Sin servidor, SSR, API,
middleware ni funciones serverless. La fase deja los cimientos que usarán las siguientes
(CSP estricta, tokens, textos centralizados, E2E contra producción) sin implementar
ninguna función de usuario. Línea base al empezar: la Fase 1 estaba en `ea206ac`, con el
árbol limpio y todo en verde (33 tests).

**Migración de Next a Vite**

- Fuera `next`, `@tailwindcss/postcss`, `next.config.ts`, `postcss.config.mjs`,
  `tsconfig.typecheck.json` (existía para excluir `.next/types`), `src/app/` de Next
  (`layout`, `page`, `error`, `global-error`, `not-found`, `robots.ts`, `sitemap.ts`) y el
  `browserslist` de `package.json`, que ninguna herramienta leía. Los navegadores
  mínimos pasan a `build.target`.
- Entran `vite` y `@tailwindcss/vite`, ambos de desarrollo. Las dependencias de runtime
  bajan a 5.
- `index.html` sin scripts en línea. El nombre, la descripción, el idioma y el
  `<noscript>` los pone un plugin mínimo de `vite.config.ts` desde `project.ts` y
  `messages.ts`, para no duplicarlos. `robots.txt` y `sitemap.xml` se generan en la build
  desde `src/config/public-site.ts`, que conserva la fecha literal.
- `appType: "mpa"`: sin fallback de SPA, una ruta desconocida da 404 en `dev` y en
  `preview`, como en un hosting estático. El fallback haría que `/login` devolviera la
  app con un 200.
- **T-2 resuelta: sin `@vitejs/plugin-react`.** Vite transforma el JSX solo; el precio es
  no tener Fast Refresh en desarrollo, y a cambio hay una dependencia y un preámbulo en
  línea menos.
- El validador de `public_docs/` buscaba `page.tsx` en `src/app/`. Ahora una ruta existe
  si la sirve un HTML de la build (`/` → `index.html`, `/x` → `x.html` o `x/index.html`),
  y el proyecto ficticio de sus tests declara sus rutas con esas dos formas.

**Seguridad**

- CSP en una fuente única (`src/config/security-headers.ts`) que **deniega por defecto**:
  `default-src 'none'`, solo `'self'` para scripts, estilos e imágenes, y `'none'` para
  `object-src`, `base-uri`, `form-action` y `frame-ancestors`. Sin `'unsafe-inline'` ni
  `'unsafe-eval'`, y sin `'wasm-unsafe-eval'` porque pdf.js aún no está.
- La política llega como cabecera en `vite preview` y como `<meta>` en `dist/index.html`,
  para que la build lleve su CSP aunque el hosting (D5) no mande cabeceras. En desarrollo
  no hay CSP: Vite inyecta código en línea.
- `style-src` no necesitó `'unsafe-inline'`, que el diseño de la Fase 0 daba por
  necesario: Vite emite la CSS como fichero y React fija estilos por CSSOM.
- La `Permissions-Policy` solo lista características que Chrome reconoce: una desconocida
  produce un error en consola.

**Base de interfaz**

- Tokens de PLAN §9.2 por función (planos, texto, borde, interacción, estado, foco,
  selección), con utilidades `bg-app`, `text-fg`, `outline-accent`… Los primitivos
  `Button`, `Field` e `Input` usan los tokens nuevos.
- Shell semántico: enlace de salto al contenido, `header`, `main` enfocable y estado
  vacío. `ErrorBoundary` propio en lugar de `error.tsx` y `global-error.tsx`: sin
  telemetría, con «Reintentar».
- Todos los textos visibles están en `src/i18n/messages.ts` (D2), con un tipo que obliga a
  que otro idioma tenga la misma forma sin repetir las mismas cadenas.

**Tests** (33 → 66 unitarios y de componentes; 3 → 6 E2E)

- Guardarraíles:
  - contraste WCAG de cada par de tokens, leído de `globals.css`;
  - invariantes de la CSP y prohibición de `innerHTML` y similares en `src/`;
  - texto suelto en componentes, con un caso que prueba la heurística.
- Componentes: estructura semántica y axe de `App`; el `ErrorBoundary` recupera tras
  reintentar.
- E2E contra `vite preview`:
  - cada carga vigila errores de consola, violaciones de CSP y peticiones fuera del
    propio origen;
  - un **test de control** inyecta un script en línea y comprueba que se bloquea y que la
    vigilancia lo detecta: sin él, «cero violaciones» también pasaría si la CSP no se
    aplicara;
  - cabeceras, `<meta>` CSP, teclado (el primer Tab llega al enlace de salto), `robots` y
    `sitemap`, y 404 en rutas inexistentes.
- `npm run build:tamano` en CI: el arranque pesa 80 KB gzip (límite 150).

**Desviaciones respecto a `FASES.md`** (detalle en su sección de la Fase 2)

- `src/platform/` pasa a la Fase 3, y la infraestructura de preferencias y `zod` a la 10.
  La sesión pidió no crear abstracciones sin uso ni persistencia de preferencias, y su
  primer uso real está en esas fases.
- No hay botón «Abrir» deshabilitado (sería interfaz falsa).
- El shell va en `src/app/` y no en `src/components/app/`.
- No hay favicon: no hay icono definido y no se inventa identidad visual.

**Descartado y por qué**

- Silenciar los avisos `MODULE_LEVEL_DIRECTIVE` de `lucide-react` en la build: son
  inocuos, pero un filtro de avisos acaba escondiendo el siguiente. Quedan documentados en
  `STACK.md`.
- `@testing-library/user-event` para probar el teclado: sería una dependencia nueva. El
  teclado se prueba en Playwright, con uno real.
- Un favicon `data:`: obligaría a abrir `img-src data:` solo por eso.
- `robots.txt` y `sitemap.xml` como ficheros estáticos en `public/`: repetirían el
  dominio provisional fuera de `project.ts`.

**Errores propios del camino**

- La primera pasada de Biome dio 3139 errores: revisaba `dist/`, que no estaba en
  `.gitignore` ni en `biome.json` (antes lo estaban `.next/` y `out/`).
- `<html lang="__BPDF_LANG__">` era un `lang` inválido en el fuente (lo cazó Biome). Ahora
  el fuente lleva `lang="es"` y el plugin lo reescribe.
- Vite avisó de que su futuro cargador nativo de configuración exigirá extensiones en los
  imports. Se añadieron (`.ts` y `allowImportingTsExtensions`) en lugar de silenciarlo.
- Al reescribir `SEGURIDAD.md` con un `node -e '…'`, las comillas simples de la política
  (`'self'`, `'none'`) se perdieron dentro del argumento de shell. Se detectó al releer la
  sección y se restauraron con un script en fichero.

### Iteración 3 — *2026-09-29* — Fase 1: limpieza de la plantilla

Se confirmaron D1 (Vite + React), D2 (español con textos centralizados), D3 (Apache-2.0),
D4 (documentación pública en el Docusaurus de R3ZON) y D15 (separación del core SaaS), y
se ejecutó la Fase 1: el repositorio deja de ser un SaaS y pasa a ser la base de BPDF,
todavía sobre Next.js (el cambio a Vite es la Fase 2).

**Línea base antes de tocar nada** (Node 24.21 vía nvm, `npm ci` limpio): lint,
typecheck y build en verde; 78 tests en verde y 18 de base de datos saltados; `npm audit`
sin vulnerabilidades. Los 18 saltados eran del entorno (no había Supabase levantado), no
un fallo previo, y se eliminan en esta fase. El E2E de la plantilla no se ejecutó en la
línea base: su `pretest:e2e` resetea el Supabase local, que no estaba levantado, y el
spec se sustituyó.

**Qué se retiró y por qué**

- **Auth y usuarios:** login (página, formulario, Server Action), callback, logout, zona
  `(app)/inicio`, `proxy.ts`, `public-paths.ts`, `safe-redirect.ts`, `homePath`. BPDF no
  tiene cuentas.
- **Base de datos:** `supabase/` (configuración, migración de `profiles`, seed),
  `prisma/`, `prisma.config.ts`, `database.types.ts`, clientes de Supabase, scripts de
  tipos, drift, seeds y `dev:setup`, `tests/db/`.
- **Observabilidad y servidor:** Sentry (`instrumentation*.ts`, `observability/`),
  Speed Insights, logger JSON de servidor, `/api/health`. Son telemetría o servidor, y
  contradicen el principio rector aunque estuvieran apagados por defecto.
- **Variables de entorno:** `.env.example`, `src/lib/env.ts` y `NEXT_PUBLIC_SITE_URL`
  (`siteUrl()` usa el dominio de `project.ts`). BPDF no tiene ninguna.
- **Dependencias:** `@supabase/ssr`, `@supabase/supabase-js`, `@sentry/nextjs`,
  `@vercel/speed-insights`, `zod`, `prisma`, `supabase`, `pg`, `@types/pg` (291 paquetes
  menos en el árbol). Los `overrides` (`mysql2`, `deepmerge-ts`) y las tres entradas de
  `allowScripts` se fueron con Prisma y Sentry; `deps:overrides` confirmó que ya no
  evitaban nada.
- **Configuración SaaS:** pasos de Supabase, Prisma, drift y tipos en `ci.yml` y
  `e2e.yml`; `vercel.json` (región `fra1` de funciones de servidor); reglas de Prisma en
  `.claude/settings.json`; entradas de Supabase, Prisma y Sentry en `.gitignore` y
  `biome.json`; `modules/` (ningún módulo aplica); docs `DATABASE`, `AUTH`, `ROLES`,
  `RESTAURACION` y `auditoria-template-final`.
- **Tests de lo retirado** (63 de los 96): BD (18), `scripts-db` (7), `public-paths` (14),
  `safe-redirect` (11), `env` (2), `observability` (3), el caso de login de
  `a11y.test.tsx` (1) y 7 de `project.test.ts` (derivación de la plantilla, `homePath`,
  `site_url` de Supabase). No se debilitó ningún test de lo que sigue existiendo: el único
  cambio en uno conservado es el patrón del caso «slug» de `project.test.ts`, que esperaba
  el error de `project_id` de `supabase/config.toml`, fichero que el validador ya no lee.

**Qué se conservó y por qué:** Biome, TypeScript estricto, Vitest + Testing Library +
jest-axe (los primitivos `Button`, `Field`, `Input` siguen probados), Playwright (será
imprescindible para el canvas de PDF), CI de seguridad, validador de `public_docs/` e
identidad única (D4), Tailwind 4 con tokens RGB (la Fase 2 cambia la paleta, no el
mecanismo), `lucide-react`, `clsx` y `tailwind-merge`.

**Qué se añadió:** `LICENSE` con el texto canónico de Apache-2.0, descargado de
apache.org y comparado con el que distribuye `pdfjs-dist` (idéntico salvo el apéndice). El
apéndice conserva su marcador `[yyyy] [name of copyright owner]` sin rellenar: el proyecto
no define titular y no se inventa. E2E `portada.spec.ts`: la portada responde 200 con las
cabeceras de seguridad y el título de BPDF, y `/login`, `/inicio`, `/auth/callback` y
`/api/health` devuelven 404.

**Decisiones menores tomadas durante la fase**

- **`zod` fuera**, aunque el plan lo daba por conservado: se quedó sin ningún uso, y la
  regla es no guardar dependencias para el futuro. La Fase 2 lo reinstala.
- **`comprobarDerivacion` fuera** (con `supabase/config.toml` en el validador de
  identidad): vigilaba que un SaaS derivado no heredara los puertos ni la auditoría de la
  plantilla. Con D15 no protege nada. `r3zon-template.json` queda como registro de origen.
- **El fixture de los validadores conserva sus rutas `/login` e `/inicio`**: es un
  proyecto ficticio, y esas rutas prueban cómo resuelve el validador los grupos `(x)` de
  Next. Se revisará cuando la Fase 2 adapte el validador a Vite.
- **Portada de `public_docs/` con `estado: proximamente`**: no hay ninguna función que
  documentar, y CLAUDE.md §9 exige verificar cada dato contra el código.
- **El contrato `public_docs/README.md` no se tocó**, aunque su ejemplo use `/login`: es
  común a todos los productos de R3ZON y cambiarlo exige tocar los dos repositorios.
- **`organization: "R3ZON"`** se mantiene: ya estaba definido en el proyecto y BPDF se
  publica en el Docusaurus de R3ZON. Dominio provisional `app.example.com` hasta D5.
- `CLAUDE.md` reescrito para BPDF: las secciones de BD y auth pasan a «Privacidad» y a
  reglas de contenido hostil. `ARCHITECTURE`, `STACK`, `STRUCTURE`, `DEVELOPMENT`,
  `DEPLOYMENT`, `MODULES` y `TEMPLATE` describen ahora el estado real. `auditoria.md` y
  `mejoras.md` se vaciaron conservando el formato y solo las mejoras de CI que siguen
  aplicando.

**Errores propios del camino**

- En la sesión anterior, `node -v` en WSL daba Node 18: `bash -lc` no carga `~/.bashrc`,
  que es donde vive nvm. Node 24 estaba instalado. Se ejecutó todo con un script que carga
  nvm.
- Un `python3 - || node -e …` desde Git Bash se quedó colgado: el `python3` de Windows
  esperaba entrada (el mismo tropiezo que ya recogía la bitácora de la plantilla). Se
  paró y se hizo la edición a mano; el fichero no llegó a modificarse.

### Iteración 2 — *2026-09-29* — Fase 0: auditoría de la plantilla y plan de BPDF

Sesión solo de análisis y planificación: no se ha tocado código. BPDF será un visor de PDF
y Markdown, gratuito y open source, oscuro por defecto, que procesa los documentos en el
dispositivo (sin backend, cuentas, base de datos ni telemetría), primero web y después
Electron. La plantilla es un SaaS (Supabase, auth, Prisma, Sentry), así que el trabajo
consistió en decidir qué se conserva y diseñar lo demás antes de escribir una línea.

**Qué se hizo**

- Auditoría de los 118 ficheros de la plantilla: qué se conserva (Tailwind con tokens,
  Biome, Vitest, jest-axe, Playwright, CI de seguridad, proceso de docs), qué se adapta y
  qué se elimina (Supabase, Prisma, auth, Sentry, Speed Insights, logger de servidor,
  `/api/health`). Tabla en `docs/PLAN.md` §2.
- Documentos nuevos: `PLAN.md` (diseño objetivo), `SEGURIDAD.md` (modelo de amenazas y
  controles por fase), `ELECTRON.md` (escritorio) y `FASES.md` (16 fases especificadas
  para ejecutarse en sesiones independientes). `TAREAS_PENDIENTES.md` pasa a ser el
  estado de fases y decisiones.
- 16 decisiones de producto quedan **pendientes de confirmación** (D1–D16), cada una con
  recomendación; 5 técnicas (T-1–T-5) se asignan a la fase que las resolverá con
  evidencia.

**Decisiones del plan y su porqué**

- **Recomendar Vite + React en lugar de Next.js (D1).** Lo que justifica Next (RSC con
  datos, Server Actions, route handlers, proxy) desaparece con el backend. En export
  estático, el App Router inyecta scripts en línea en cada HTML, y eso obliga a mantener
  hashes para tener una CSP estricta; una SPA de Vite tiene un `index.html` sin scripts en
  línea y encaja directamente con Electron. No se decide sin confirmación (CLAUDE.md §1).
- **Electron con el bundle local, no con la URL remota** que recomendaba el catálogo de
  módulos de la plantilla: sin conexión, sin peticiones de red al abrir documentos y con
  una superficie remota nula.
- **Spike de modo oscuro del PDF (Fase 4) antes de construir el visor.** Es el mayor
  riesgo técnico y condiciona si se usa `PDFViewer` de pdf.js o un visor propio.
- **La seguridad va en cada fase**, no al final. La Fase 12 verifica, endurece y audita.
- **La capa `platform/`, las preferencias y la CSP base van en la Fase 2**: si se dejaran
  para la «preparación de Electron», habría que rehacer lo construido encima.
- **Markdown con `react-markdown`** (elementos React, sin `innerHTML`, sin HTML crudo) en
  lugar de `marked` + DOMPurify. **Mermaid como SVG dentro de `<img>`**: aunque se colara
  algo, en una imagen no se ejecuta, y así se evita el iframe de `securityLevel: sandbox`.

**Verificado en el código de las dependencias** (no de memoria)

- `pdfjs-dist` 6.3.289: `pageColors` aplica un filtro SVG a **todo el lienzo** al terminar
  la página (`CanvasGraphics.#drawFilter`: escala de grises y 6 niveles). Las fotos se
  destruyen, así que se descarta como modo oscuro principal.
- pdf.js 6.3 ya no usa `eval` ni `new Function` (la opción `isEvalSupported` no existe),
  pero compila WASM: la CSP necesita `'wasm-unsafe-eval'`, no `'unsafe-eval'`.
- `PDFPageView` le pasa a `page.render` el `<canvas>`, no el contexto. Por eso el remapeo
  de color en el contexto 2D (estrategia A) obligaría a un visor propio, y se prueba
  primero el post-proceso por píxel (estrategia B), que conserva `PDFViewer`.
- Los componentes de `pdf_viewer.mjs` incluyen visor, búsqueda y enlaces, pero **no las
  miniaturas**: se harán a mano.

**Descartado y por qué**

- `filter: invert()` y `pageColors` como modo oscuro: invierten o agrisan las imágenes.
- Mermaid con `securityLevel: "sandbox"`: exige `frame-src data:` en la CSP.
- Service worker/PWA en v1: no aporta nada sin backend y añade superficie.
- Shiki: mejor resaltado, pero pesa bastante más. Se reevalúa si highlight.js se queda
  corto.
- Una fase aparte de «preparación de Electron»: sus piezas van en la Fase 2.

**Errores propios del camino**

- `git` desde Git Bash sobre la ruta `\\wsl.localhost\…` falla por «dubious ownership»,
  y `wsl -- bash -lc '…$var…'` perdía las variables. Se leyó el repositorio por la ruta
  UNC y se consultó npm con el Node de Windows.
- No se pudo medir la línea base (lint/tests): sin `node_modules` y con Node 18 en WSL.
  Queda como primer paso de la Fase 1.

### Iteración 1 — *2026-09-29* — Proyecto creado desde R3ZON Template v1.0.0

Repositorio creado a partir de la plantilla (`r3zon-template.json`: 1.0.0), sin cambios
(commit `e5e063d`).
