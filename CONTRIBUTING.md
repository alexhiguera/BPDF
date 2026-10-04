# Cómo contribuir a BPDF

Gracias por tu interés. BPDF es pequeño a propósito: un visor de PDF y Markdown, web, local y
sin backend. Esta guía cuenta lo justo para que una contribución llegue a buen puerto.

## Antes de empezar

- **Abre un issue antes de un cambio grande** (una función nueva, una dependencia, un cambio de
  diseño). Para un arreglo pequeño, puedes ir directo al *pull request*.
- **Lo que no entra sin una decisión explícita** de quienes mantienen el proyecto: backend,
  cuentas, sincronización, telemetría o analítica (tampoco «anónima»), cualquier petición de red
  provocada por un documento, y relajar la CSP (`unsafe-inline`, `unsafe-eval`). Son la razón de
  ser de BPDF, no detalles.
- **Seguridad:** una vulnerabilidad no se cuenta en un issue público. Sigue
  [`SECURITY.md`](SECURITY.md).

## Entorno

- **Node 24** (está en `.nvmrc`; con nvm, `nvm use`) y npm 11. En Windows, trabaja en WSL.

```bash
npm ci
npx playwright install --with-deps   # navegadores para los E2E (una vez)
npm run dev                          # http://localhost:5173
```

`npm run dev` **no aplica la CSP**: todo lo que dependa de ella se comprueba con
`npm run preview` o con los E2E ([`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md)).

## Comprobaciones

Antes de abrir el *pull request*, en verde:

```bash
npm run lint              # Biome (npm run lint:fix corrige el formato)
npm run typecheck
npm run test:run          # Vitest: unitarios, componentes y accesibilidad
npm run build && npm run build:tamano && npm run build:verificar
npm run test:e2e          # Playwright contra la build de producción (Chromium)
```

Según lo que toques:

- **Algo que depende del navegador:** `npm run test:e2e:compat` (Firefox y WebKit).
- **Documentación:** `npm run docs:enlaces` (interna) y `npm run docs:validar`
  ([`public_docs/`](public_docs/), con su contrato en
  [`public_docs/README.md`](public_docs/README.md)).
- **Cabeceras o CSP:** se cambian solo en
  [`src/config/security-headers.ts`](src/config/security-headers.ts) y se regenera
  `vercel.json` con `npm run cabeceras:vercel`.

CI ejecuta todo esto en cada *pull request*, salvo los benchmarks.

## Convenciones

- **Pull requests pequeñas y con tests.** Lo nuevo lleva su test; un arreglo, primero el test
  que reproduce el fallo. Lo que depende del navegador real (canvas, CSP, portapapeles,
  descargas) se prueba con Playwright, no con mocks. No se borra ni se debilita un test para que
  pase.
- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/) en inglés:
  `feat(pdf): …`, `fix(markdown): …`, `docs: …`, `test: …`, `chore: …`, `ci: …`.
- **Textos visibles** en [`src/i18n/messages.ts`](src/i18n/messages.ts), y **colores** solo con
  los tokens de [`src/styles/globals.css`](src/styles/globals.css): hay tests que lo vigilan.
- **Nada de `innerHTML`**, `outerHTML`, `insertAdjacentHTML`, `dangerouslySetInnerHTML` ni
  `document.write`: el contenido de un documento es hostil.
- **Dependencias:** cada una de runtime se justifica en [`docs/STACK.md`](docs/STACK.md); los
  motores que procesan contenido no confiable van con versión exacta.
- **Documentación:** si el cambio afecta a lo que describe `docs/` o `public_docs/`, se
  actualiza en el mismo *pull request*. Un cambio que nota quien usa BPDF se anota en
  [`public_docs/novedades.md`](public_docs/novedades.md).

La documentación interna está en español; el índice es [`docs/README.md`](docs/README.md) y la
forma de trabajar del repositorio, en [`CLAUDE.md`](CLAUDE.md).

## Código de conducta

Este proyecto sigue el [código de conducta](CODE_OF_CONDUCT.md). Al participar, lo aceptas.

## Licencia

Al contribuir, aceptas que tu contribución se publique bajo la licencia del proyecto,
[Apache-2.0](LICENSE).
