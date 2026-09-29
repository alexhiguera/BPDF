# Desarrollo en local

## Requisitos

- **Node 24** (`nvm use`, lee `.nvmrc`). `engines` rechaza otras versiones mayores.
- En **Windows**, trabaja dentro de WSL: el repo en el sistema de ficheros de Linux y
  `npm` ejecutado desde WSL. Instalar desde Windows sobre `\\wsl.localhost\…` es lento y
  deja binarios nativos de la plataforma equivocada.
- Ojo: en WSL, `nvm` se carga desde `~/.bashrc`, que un `bash -lc` no interactivo no lee.
  Si `node -v` dice otra cosa que 24, carga nvm (`. ~/.nvm/nvm.sh && nvm use`).
- Sin Docker, base de datos ni servicios externos: BPDF no los usa.

## Arranque

```bash
nvm use
npm ci
npm run dev           # http://localhost:5173
```

**Variables de entorno: ninguna.** BPDF es una build estática sin servicios que
configurar, idéntica en local, en CI y en producción. Si alguna fase llegara a necesitar
una, antes se decide si de verdad hace falta ([`CLAUDE.md`](../CLAUDE.md) §1).

### Desarrollo frente a build

| | `npm run dev` | `npm run build` + `npm run preview` |
|---|---|---|
| Qué sirve | Los fuentes, transformados al vuelo | `dist/`, la build de producción |
| CSP y cabeceras | **No** (Vite inyecta código en línea que una CSP estricta bloquearía) | **Sí**: cabeceras en `preview` y `<meta>` en `dist/index.html` |
| Recarga | Completa al guardar (sin `@vitejs/plugin-react`, no hay Fast Refresh) | — |
| `robots.txt`, `sitemap.xml` | No | Sí (generados desde `project.ts`) |

Por eso todo lo que dependa de la CSP se comprueba con `preview` o con los E2E, nunca
con `dev`. Las dos modalidades devuelven 404 para rutas que no existen (`appType: "mpa"`
en [`vite.config.ts`](../vite.config.ts): sin fallback de SPA).

## Scripts

| Script | Qué hace |
|---|---|
| `dev` | Vite en modo desarrollo |
| `build` | Build estática en `dist/` |
| `build:tamano` | Peso gzip de lo que se descarga al arrancar; falla por encima de 150 KB. Requiere `build` |
| `preview` | Sirve `dist/` con la CSP y las cabeceras de seguridad |
| `lint` · `lint:fix` · `format` | Biome |
| `typecheck` | `tsc --noEmit` |
| `test` · `test:run` · `test:coverage` | Vitest (unitarios, componentes, a11y) |
| `test:e2e` · `test:e2e:ui` | Playwright contra la build de producción (`vite preview`, puerto 3100) |
| `docs:validar` | Valida `public_docs/` contra el contrato y la identidad contra `project.ts` |
| `docs:enlaces` | Enlaces rotos en `docs/`, `README.md` y `CLAUDE.md` |
| `deps:overrides` | ¿Siguen haciendo falta los `overrides`? (hoy no hay ninguno) |

## Tests

```bash
npm run test:run      # todo Vitest
npm run test:e2e      # build de producción + Playwright (Chromium)
```

- Unitarios en `tests/unit/`, componentes y accesibilidad en `tests/components/`
  (pragma `// @vitest-environment jsdom`). Los proyectos ficticios para probar
  validadores están en `tests/_fixtures/`.
- Hay guardarraíles que no prueban una función sino una regla: contraste de los tokens
  (`tokens.test.ts`), invariantes de la CSP y prohibición de `innerHTML`
  (`seguridad.test.ts`), y textos centralizados (`textos.test.ts`).
- Los E2E vigilan en cada carga los errores de consola, las violaciones de CSP y
  cualquier petición fuera del propio origen, con un test de control que comprueba que
  esa vigilancia funciona.
- Playwright necesita Chromium: `npx playwright install chromium` la primera vez. Si ya
  hay un servidor en el puerto 3100, en local lo reutiliza; en CI siempre construye.

## Ramas y CI

- **Ramas largas de desarrollo**: CI y E2E corren en `main`, en todo PR y en las ramas
  listadas en `on.push.branches` de [`ci.yml`](../.github/workflows/ci.yml) y
  [`e2e.yml`](../.github/workflows/e2e.yml). Por defecto, `develop` y `long/**`. Motivo:
  [ARCHITECTURE.md §8](ARCHITECTURE.md).
- `ci.yml`: lint → typecheck → tests → docs → build → tamaño del arranque.
- `security.yml`: `npm audit` (rompe con HIGH o superior) en cada PR, cada push a `main`
  y cada lunes.
- Commits: Conventional Commits en inglés técnico ([`CLAUDE.md`](../CLAUDE.md) §2).

## Problemas frecuentes

- **`engines` rechaza Node** o aparecen errores raros de sintaxis — no estás en Node 24:
  `nvm use` (en WSL, ver «Requisitos»).
- **Algo funciona en `dev` y falla en la build o en los E2E** — casi siempre es la CSP:
  mira la consola del navegador en `npm run preview`.
- **La build avisa de `MODULE_LEVEL_DIRECTIVE` ("use client")** en `lucide-react` — es
  inocuo: esa directiva solo significa algo con React Server Components, que una SPA no
  usa ([STACK.md](STACK.md)).
- **npm avisa de «install scripts not covered by allowScripts»** — procedimiento en
  [STACK.md](STACK.md) → `allowScripts`.
- **`docs:validar` dice que la identidad no coincide** — un fichero que repite datos de
  `src/config/project.ts` se quedó sin actualizar; el mensaje dice cuál.
