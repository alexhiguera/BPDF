# Stack tecnológico

Estado tras la Fase 3 (*2026-09-29*): la Fase 3 no añadió dependencias (la apertura de
ficheros solo usa APIs estándar del navegador). El stack **objetivo** (pdf.js, pipeline de
Markdown, Electron) y el motivo de cada pieza están en [PLAN.md](PLAN.md); cada fase añade
aquí lo que instala.

## Capas

| Capa | Tecnología | Por qué |
|---|---|---|
| Build | **Vite 8** (Rolldown), SPA **estática** en `dist/` | D1 ([PLAN.md](PLAN.md) §3): sin servidor, `index.html` sin scripts en línea (CSP estricta) y encaje directo con Electron. Sustituyó a Next.js 16 en la Fase 2 |
| UI | **React 19** + **Tailwind CSS 4** «CSS-first» (`@tailwindcss/vite`) + **lucide-react** | Tokens en `:root` como tripletes RGB: tema cambiable en runtime y modificadores de opacidad que siguen funcionando |
| Lenguaje | **TypeScript 7** estricto, con `noUncheckedIndexedAccess` | |
| Lint y formato | **Biome 2** | Un binario, sin ESLint ni Prettier |
| Tests | **Vitest 5** + Testing Library + **jest-axe** + jsdom | Unitarios, componentes y accesibilidad |
| E2E | **Playwright** (Chromium) | Contra el build de producción. Imprescindible para lo que depende del navegador real (canvas de PDF, CSP, portapapeles) |
| CI | **GitHub Actions** | `ci.yml`, `e2e.yml`, `security.yml` |

Plataforma fijada con `engines` (`node >=24 <25`) y `.nvmrc` (`24`). Navegadores mínimos
en `build.target` de [`vite.config.ts`](../vite.config.ts) (Chrome/Edge 111, Firefox 111,
Safari 16.4): los que exige Tailwind 4 (`color-mix`, `@property`). El `browserslist` de la
plantilla se retiró en la Fase 2 porque ninguna herramienta del stack lo leía (Vite y
Tailwind 4 usan sus propios objetivos); una configuración que nadie lee acaba mintiendo.

### Decisiones de versión y de configuración

- **TypeScript 7** (el compilador nativo): Vite no lo usa para compilar (transforma con
  Oxc), solo `npm run typecheck`. Si una herramienta futura (Electron) necesita la API
  JavaScript clásica del compilador y falla, la salida es fijar TypeScript 6.
- **Sin `@vitejs/plugin-react` (T-2, resuelta en la Fase 2).** Vite transforma el JSX por
  su cuenta con el runtime automático (`"jsx": "react-jsx"`). El plugin solo aportaría
  Fast Refresh (conservar el estado al editar), a cambio de una dependencia y de un
  preámbulo en línea en desarrollo. Sin él, la página se recarga entera al guardar.
- **`appType: "mpa"`**: sin fallback de SPA, una ruta desconocida da 404 en `dev` y en
  `preview`, igual que en un hosting estático.
- **Aviso conocido en la build:** Rolldown avisa `MODULE_LEVEL_DIRECTIVE` por el
  `"use client"` de dos ficheros de `lucide-react`. Es inocuo (esa directiva solo tiene
  sentido con React Server Components) y **no se silencia**: si aparece otro aviso, se ve.
- **Un solo `tsconfig.json`.** El `tsconfig.typecheck.json` de la plantilla existía para
  excluir los tipos que genera Next en `.next/types`; sin Next, sobra.
  `allowImportingTsExtensions` permite importar `.ts` con extensión desde
  `vite.config.ts`, como exigirá el cargador nativo de configuración de Vite.

## Dependencias de la app

La lista la manda `dependencies` de `package.json`; aquí va el motivo de cada una.
`tests/unit/docs.test.ts` falla si aparece una dependencia de runtime que esta tabla no
explica, para que el documento no se quede atrás.

| Dependencia | Para qué |
|---|---|
| `react`, `react-dom` | La interfaz |
| `lucide-react` | Iconos (hoy, el indicador de carga de `Button`) |
| `clsx`, `tailwind-merge` | La función `cn()` para combinar clases |

Todo lo demás es de desarrollo: `vite` y `@tailwindcss/vite` (build), `tailwindcss`,
Biome, TypeScript, Vitest y Testing Library, jest-axe, jsdom, Playwright, y `yaml` (lo usa
el validador de `public_docs/`).

**Retiradas en la Fase 1:** `@supabase/ssr`, `@supabase/supabase-js`, `@sentry/nextjs`,
`@vercel/speed-insights` y `zod` (runtime); `prisma`, `supabase`, `pg`, `@types/pg`
(desarrollo). `zod` se quedó sin uso al borrar la auth y las variables de entorno; vuelve
cuando haya algo que validar: las preferencias guardadas (Fase 10) y los argumentos IPC
de Electron (Fase 14).

**Retiradas en la Fase 2:** `next` (runtime) y `@tailwindcss/postcss` (desarrollo,
sustituido por `@tailwindcss/vite`).

**Política** ([`CLAUDE.md`](../CLAUDE.md) §11 bis): ninguna dependencia «para más
adelante»; versiones exactas para los motores que procesan contenido no confiable; toda
librería pesada se carga de forma diferida.

### `overrides`

Ninguno. Los dos que traía la plantilla (`mysql2`, `deepmerge-ts`) eran transitivas de
Prisma con avisos HIGH; al retirar Prisma, `npm run deps:overrides` confirmó que ya no
evitaban ningún aviso y dejaron de estar en el árbol.

Si hiciera falta uno: motivo escrito aquí, y `npm run deps:overrides` comprueba si sigue
haciendo falta (quitándolos en un temporal y repitiendo `npm audit`). CI lo ejecuta en
`security.yml` sin romper: un override de más es deuda, no un fallo.

### `allowScripts` (npm 11)

Hoy **ningún paquete** necesita scripts de instalación (`npm install-scripts ls` no lista
nada). Los tres aprobados en la plantilla (Prisma ×2, Sentry CLI) se fueron con sus
paquetes.

npm 11 **omite en silencio** los scripts de instalación de paquetes no aprobados en el
campo `allowScripts` de `package.json`, y cada aprobación va ligada a una **versión
exacta**. Electron (Fase 14) descarga su binario en `postinstall` y lo necesitará.

**Procedimiento al añadir o actualizar un paquete con scripts de instalación:**

```bash
npm install <paquete>@<versión>
npm install-scripts ls                 # lista lo que ha quedado sin aprobar
#   revisa el script del paquete (node_modules/<paquete>/package.json → scripts)
npm install-scripts approve <paquete>  # o `deny` si no hace falta
npm install-scripts prune              # quita aprobaciones de versiones que ya no están
```

`package.json` y `package-lock.json` se commitean juntos.

## Observabilidad

**Ninguna, a propósito.** BPDF no envía errores, métricas ni eventos a ningún servicio
([ARCHITECTURE.md](ARCHITECTURE.md) §1). Un fallo en el equipo de alguien solo se conoce si
esa persona lo reporta; el precio se acepta a cambio del principio de privacidad.
