# BPDF

Visor gratuito y open source de **PDF** y **Markdown**, pensado para leer en modo oscuro.
Tus documentos se abren en tu dispositivo y **no se suben a ningún servidor**: sin
cuentas, sin sincronización, sin telemetría.

> **Estado: en desarrollo.** Todavía no se puede usar: existe la base de la aplicación,
> pero aún no abre documentos.
> El plan completo está en [`docs/FASES.md`](docs/FASES.md) y el estado en
> [`docs/TAREAS_PENDIENTES.md`](docs/TAREAS_PENDIENTES.md).

Primero será una aplicación web; después, una app de escritorio con Electron.

## Desarrollo

Requisitos: Node 24 (`nvm use` lee `.nvmrc`). En Windows, trabaja dentro de WSL.

```bash
npm ci
npm run dev         # http://localhost:5173
```

BPDF es una aplicación **estática** (Vite + React): `npm run build` genera `dist/`, que
se sirve con cualquier hosting de ficheros. No hay servidor, base de datos ni variables
de entorno.

Comprobaciones:

```bash
npm run lint && npm run typecheck && npm run test:run
npm run build && npm run build:tamano
npm run test:e2e                              # Playwright contra la build de producción
npm run docs:validar && npm run docs:enlaces  # si tocas documentación o la identidad
```

Guía completa: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md). Cómo se trabaja en el repo
(personas y agentes): [`CLAUDE.md`](CLAUDE.md). Documentación interna:
[`docs/README.md`](docs/README.md).

## Licencia

[Apache-2.0](LICENSE).
