# Despliegue

**BPDF se publica en Vercel, en `https://bpdf.r3zon.com`** (D5, [PLAN.md](PLAN.md) §14,
confirmada el *2026-10-03*). Es la única distribución: BPDF es solo web (D19), sin
instaladores ni versión de escritorio. Este documento se reescribió en la Fase 15,
cerrada el *2026-10-04* tras verificar la producción, y la Fase 16 le añadió la documentación
pública, la GitHub Wiki y la publicación final de v1.0.0 ([FASES.md](FASES.md)).

## Cómo se publica

- **Vercel despliega desde git** lo que el usuario sube a `main`. La configuración del
  proyecto en Vercel (repositorio, dominio) no vive en este repositorio. El build es el
  mismo en local, en CI y en Vercel: sin variables de entorno ni secretos.
- **Build:** `npm run build` produce en `dist/` un sitio **estático** (HTML, JS, CSS, fuentes,
  `favicon.svg`, `robots.txt`, `sitemap.xml`) con tres páginas: la app (`index.html`), la 404
  ligera (`404.html`) y el marco aislado de Mermaid (`mermaid.html`, Fase 8). Sin funciones
  de servidor. Vercel sirve la página propia con estado **404** para rutas inexistentes, sin
  reescribirlas a `index.html`; `vite preview` reproduce ese comportamiento para los E2E.
- **`npm run build:verificar`** (Fase 15, también en CI) comprueba que `dist/` es publicable:
  `robots.txt` y `sitemap.xml` iguales a los de `public-site.ts`, ningún `app.example.com`,
  ninguna URL de desarrollo, ningún recurso fuera del propio sitio en el HTML ni en el CSS y
  ningún resto de escritorio ([`scripts/lib/dist.mjs`](../scripts/lib/dist.mjs)).

## Dominio, `robots.txt` y `sitemap.xml`

- **Una sola fuente:** `domain` de [`src/config/project.ts`](../src/config/project.ts)
  (`bpdf.r3zon.com` desde la Fase 15; antes, `app.example.com` a propósito). De ahí salen:
  - `siteUrl()`, la URL pública;
  - `robots.txt` y `sitemap.xml`, que genera la build
    ([`src/config/public-site.ts`](../src/config/public-site.ts), emitidos por
    `vite.config.ts`);
  - `public_docs/_meta/entidad.json` y `rutas-app.json`, que no pueden importar TypeScript y
    repiten el dominio: `npm run docs:validar` comprueba que coinciden.
- **`robots.txt`:** permite todo y enlaza `https://bpdf.r3zon.com/sitemap.xml`.
- **`sitemap.xml`:** solo `https://bpdf.r3zon.com/`. BPDF es una herramienta de una sola
  vista: no tiene más páginas que indexar, y `mermaid.html` es un marco interno. La fecha
  (`lastmod`) es literal y se cambia a mano cuando cambia lo que se ve en `/` (CLAUDE.md §9).
- **Canonical oficial:** el HTML lleva título, descripción, `application-name` y
  `rel="canonical"` a `https://bpdf.r3zon.com/`. La 404 lleva `noindex`; el marco de Mermaid
  no es una página pública. SEO avanzado: fuera de v1.
- Un test (`tests/unit/project.test.ts`) falla si el dominio deja de ser el oficial o si
  `example.com` vuelve a `project.ts`, `public-site.ts`, `index.html`, `vercel.json` o
  `public_docs/`.

## Cabeceras HTTP

- **[`vercel.json`](../vercel.json)** se **genera** desde la fuente única,
  [`src/config/security-headers.ts`](../src/config/security-headers.ts) (`reglasVercel`, a
  partir de `cabecerasPara`), con `npm run cabeceras:vercel`. No se edita a mano:
  `tests/unit/vercel.test.ts` falla si se queda atrás. Solo define cabeceras, en tres reglas
  que no se solapan:

  | Ruta | Cabeceras |
  |---|---|
  | Todo salvo `/mermaid.html` y `/assets/…` | CSP de la app (con `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP, CORP y HSTS ([SEGURIDAD.md](SEGURIDAD.md) §2.1–2.2) |
  | `/mermaid.html` | Las mismas, con la CSP del marco (`frame-ancestors 'self'`) y `X-Frame-Options: SAMEORIGIN` |
  | `/assets/…` | Las de la app y `Access-Control-Allow-Origin: *`: el marco, con origen opaco, pide sus módulos en modo CORS |

- Son las mismas que manda `vite preview`, así que los E2E prueban lo que se publica. La CSP
  viaja además como `<meta>` en cada página (un hosting sin cabeceras no deja la app sin
  política, aunque `frame-ancestors` solo funciona como cabecera).
- La Fase 15 no cambia ninguna: son las de la Fase 12 (CSP definitiva, congelada en un test).

## Versión y registro de cambios para usuarios

- **Versión:** `version` de `package.json`, la única fuente. La build la fija con `define`
  (`src/config/compilacion.ts`) y la muestra «Acerca de», al final de Preferencias.
- **SemVer:** `MAJOR.MINOR.PATCH`. Un cambio que el usuario nota (función nueva,
  comportamiento distinto) sube MINOR; un arreglo sin cambio visible, PATCH; uno que rompe lo
  que el usuario espera (quitar una función, cambiar lo que se guarda sin migrarlo), MAJOR. Lo
  que no cambia nada para el usuario (docs, tests, CI) no sube la versión.
- **Historia:** 0.1.0 fue la primera versión publicada y se mantuvo en la Fase 15, que no cambió
  nada de lo que el usuario usa. **1.0.0** llega con la Fase 16 (y la 17, crear Markdown y exportar a PDF, que entra antes
  de publicarla): repositorio público, enlace a él
  en «Acerca de» y documentación oficial (`npm version 1.0.0 --no-git-tag-version`; la etiqueta
  `v1.0.0` y la GitHub Release las crea quien publica, tras el push).
- **Registro de cambios para usuarios:**
  [`public_docs/novedades.md`](../public_docs/novedades.md). Qué versión hay, qué hace BPDF y
  sus límites conocidos; cada versión nueva añade su apartado con lo que el usuario nota. No
  repite la bitácora técnica ([CHANGELOG.md](CHANGELOG.md)). Su apartado de cada versión es
  también el texto de la GitHub Release.

## Comprobar un despliegue

Tras cada despliegue que toque cabeceras, CSP, rutas, el dominio o la build (CLAUDE.md §10):

1. `npm run cabeceras:verificar -- https://bpdf.r3zon.com`: pide `/`, `/mermaid.html` y un
   módulo del marco y compara cada cabecera con la fuente. Sale con error si falta o difiere
   alguna.
2. `curl -I https://bpdf.r3zon.com/` y `curl -I https://bpdf.r3zon.com/mermaid.html`: CSP,
   HSTS y demás, a ojo.
3. `npm run test:humo`: la prueba de humo de la web publicada
   ([`e2e/produccion/humo.spec.ts`](../e2e/produccion/humo.spec.ts), en Chromium). Carga la
   portada (título, favicon, **Preferencias**, crédito de R3ZON), abre un Markdown con una
   fórmula y un PDF del repositorio, compara las cabeceras de `/`, `robots.txt` y
   `sitemap.xml` con la fuente y comprueba que `http://` redirige a `https://`. Cero errores
   de consola, cero violaciones de CSP y ninguna petición fuera del sitio. Sin reintentos.
   - **No corre en CI ni con `test:e2e`**: depende de un despliegue que el repositorio no
     controla.
   - **Ensayo en local:** `BPDF_URL=http://localhost:3101 npm run test:humo` levanta la build
     con `vite preview` en ese puerto. La redirección a `https://` se salta, con su motivo.
4. `robots.txt` y `sitemap.xml` en el navegador: el dominio es `bpdf.r3zon.com`.

## Historial de verificaciones en producción

- **Cierre de la Fase 15** (*2026-10-04*, `9fb5f6a`): la build servida es la del commit
  (`index.html`, `mermaid.html` y el módulo principal idénticos byte a byte a los de
  `npm run build`). `test:humo` 6 de 6, con cero errores, cero violaciones y ninguna petición
  externa; `cabeceras:verificar` en verde (las de la Fase 12, sin cambios); `http://`
  redirige con 308 a `https://`; `robots.txt` y `sitemap.xml` con `https://bpdf.r3zon.com`,
  sin `app.example.com`.
- **Cierre de la Fase 12** (*2026-10-03*, `96fcafb`): `cabeceras:verificar` en verde;
  `Permissions-Policy` con `camera`, `microphone`, `geolocation`, `payment`, `usb`,
  `display-capture`, `clipboard-read`, `serial`, `hid` y `midi` en `/` y `/mermaid.html`.
  Recorrido con un navegador (Markdown, «Copiar código», Mermaid, `mermaid-hostil.md`, KaTeX,
  PDF con cmaps, PDF con formulario, editor y pegar con Ctrl+V): cero errores, cero
  violaciones, ninguna petición externa, el marco de Mermaid solo pide sus módulos a
  `/assets/`, la app no puede leer el portapapeles y copiar y pegar funcionan.
  Almacenamiento: solo `bpdf:prefs` y `bpdf:positions` (esta, al cambiar de página en un
  PDF); sin cookies, `sessionStorage`, IndexedDB, cachés ni service workers.
- **Antes, el mismo día** (Fase 12; versión desplegada anterior a la Fase 11): las cabeceras
  llegan y coinciden con la fuente; `/mermaid.html` responde 200 con su CSP; un recorrido con
  un navegador da cero errores, cero violaciones de CSP y ninguna petición externa. Vercel
  añade de suyo `Access-Control-Allow-Origin: *` en todas las rutas (aceptado:
  [auditoria.md](auditoria.md) A1-6).
- **Antes de `vercel.json`** (comprobado el *2026-09-30*): Vercel no mandaba ninguna cabecera
  de seguridad (solo su HSTS por defecto) y la CSP llegaba solo por `<meta>`.

## Documentación pública

**Una sola fuente: [`public_docs/`](../public_docs/README.md).** Se publica en dos sitios, y
ninguno se edita a mano:

- **`https://docs.r3zon.com/bpdf`**: el Docusaurus de R3ZON (D4) clona `public_docs/` en su
  build. Este repositorio no empuja nada ni guarda credenciales del otro. Los datos del alta
  del producto (en la configuración de productos del repositorio de documentación de R3ZON):

  | Campo | Valor |
  |---|---|
  | `id` | `bpdf` (= `project.slug`; ruta `/bpdf`) |
  | `name` | `BPDF` |
  | `tagline` | `Visor de PDF y Markdown para leer en modo oscuro. Los documentos no salen del dispositivo.` |
  | `kind` | `tool` |
  | `appUrl` | `https://bpdf.r3zon.com` |
  | `status` | `stable` |
  | `source` | `repo: 'alexhiguera/BPDF'`, `branch: 'main'`, `path: 'public_docs'` (repo público: sin credencial de sincronización) |
  | Módulos, planes, permisos | Ninguno: sin `r3zon.modulo`, `plan_minimo` ni `r3zon.permiso` |
  | Icono | [`public/favicon.svg`](../public/favicon.svg); identidad en `public_docs/_meta/identidad-visual.md` |

- **GitHub Wiki** del repositorio: una copia **generada** con `npm run wiki:generar`
  ([`scripts/lib/wiki.mjs`](../scripts/lib/wiki.mjs)). Cada página pasa a `<id>.md` (la
  portada, a `Home.md`), sin frontmatter y con los enlaces internos reescritos al nombre de su
  página; además, `_Sidebar.md` (las secciones de `_category_.json`) y `_Footer.md` (la fuente).
  El pie de cada página sigue apuntando a `docs.r3zon.com`, la URL canónica. Cada página
  generada empieza con un comentario que avisa de que no se edita en la Wiki.

  Publicarla (a mano, con tus credenciales; la Wiki es un repositorio git aparte):

  1. En GitHub, activa **Wiki** (Settings → Features) y crea cualquier página desde la web:
     así existe el repositorio `BPDF.wiki.git`.
  2. `git clone git@github.com:alexhiguera/BPDF.wiki.git ../BPDF.wiki`
  3. `npm run wiki:generar -- ../BPDF.wiki` (borra los `.md` de esa carpeta, no su `.git`, y
     escribe los nuevos).
  4. En `../BPDF.wiki`: `git add -A`, `git commit -m "docs: sync from public_docs"` y
     `git push`.

  Se repite tras cada cambio de `public_docs/`. Si se quiere automatizar, un workflow en
  `push` a `main` podría hacer los pasos 2–4 con el `GITHUB_TOKEN`; no existe todavía, a
  propósito: la primera publicación la revisa una persona.

## Publicación final de v1.0.0 (Fase 18, cerrada)

La infraestructura de publicación quedó **CERRADA / APROBADA** el *2026-10-07*: repositorio,
metadata, Issues, etiquetas, reporte privado de vulnerabilidades, alertas de Dependabot,
Wiki, documentación y producción están públicos; CI, Security y
los E2E de los tres motores terminaron en verde. La primera ejecución de WebKit se canceló
instalando dependencias del runner y no llegó a ejecutar tests; el rerun real pasó. La etiqueta
y la release se hacen después del cierre técnico final, completado el *2026-10-07*. Estado:
**BPDF v1.0.0 — DESARROLLO FINALIZADO / LISTO PARA TAG Y RELEASE**. El procedimiento completo es:

1. **CI en verde** en `main` (CI, E2E con sus tres navegadores, Security).
2. **Producción:** `npm run test:humo`, `npm run cabeceras:verificar -- https://bpdf.r3zon.com`
   y «Acerca de» muestra **Versión 1.0.0** y el enlace al repositorio.
3. **Repositorio público:** Settings → General → Danger Zone → **Change visibility** → Public.
4. **Ajustes del repositorio:** descripción, web y temas (abajo); Features: **Issues** sí,
   **Wiki** sí (paso de la Wiki, arriba), **Discussions** no por ahora, Projects no.
5. **Seguridad:** Settings → Code security → **Private vulnerability reporting**: Enable
   (`SECURITY.md` lo usa). Dependabot alerts: Enable.
6. **Etiquetas** de las plantillas de issues: crea `fallo` y `mejora` (Issues → Labels).
7. **Wiki:** los pasos 1–4 de «GitHub Wiki».
8. **docs.r3zon.com:** el alta de `bpdf` en el Docusaurus con los datos de arriba.
9. **Etiqueta y release:** `git tag -a v1.0.0 -m "BPDF 1.0.0"`, `git push origin v1.0.0` y
   una GitHub Release desde esa etiqueta, con el apartado «Qué trae la versión 1.0.0» de
   `public_docs/novedades.md`.
10. **Community Standards** (Insights → Community Standards): todo en verde.

Datos del repositorio:

- **Descripción:** `Visor gratuito y open source de PDF y Markdown en modo oscuro. Tus documentos no salen del dispositivo. Creado por R3ZON.`
- **Website:** `https://bpdf.r3zon.com`
- **Topics:** `pdf-viewer`, `markdown`, `markdown-editor`, `dark-mode`, `pdfjs`, `katex`,
  `mermaid`, `privacy`, `local-first`, `react`, `vite`, `typescript`, `spanish`
- **Rama principal:** `main` (Vercel despliega desde ella).

## Qué se retiró en la Fase 1

La plantilla desplegaba en Vercel (región `fra1`, junto a Supabase) con Supabase Cloud y
Sentry. Nada de eso aplica a BPDF: el `vercel.json` de la plantilla se borró porque solo
fijaba la región de las funciones de servidor, que BPDF no tiene. El actual es otro: solo
cabeceras, generado.
