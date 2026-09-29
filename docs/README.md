# Documentación interna

Documentación para quien desarrolla y mantiene BPDF. La documentación para quien lo usa
está en [`public_docs/`](../public_docs/README.md).

## Índice

### Plan de BPDF
- [PLAN.md](PLAN.md) — diseño objetivo: arquitectura, PDF, Markdown, persistencia, UI/UX,
  accesibilidad, rendimiento, testing, distribución y decisiones (D-n, T-n).
- [FASES.md](FASES.md) — plan de implementación: cada fase con alcance, archivos, tests y
  criterios de aceptación.
- [SEGURIDAD.md](SEGURIDAD.md) — modelo de amenazas y controles de web, Markdown, PDF y
  Electron, con la fase que implementa cada uno.
- [ELECTRON.md](ELECTRON.md) — versión de escritorio: procesos, preload, IPC, protocolos.

### Estado actual
- [ARCHITECTURE.md](ARCHITECTURE.md) — principios y el porqué de cada uno.
- [STACK.md](STACK.md) — tecnologías, dependencias y su motivo.
- [STRUCTURE.md](STRUCTURE.md) — árbol del repositorio y qué va en cada sitio.
- [MODULES.md](MODULES.md) — qué piezas existen y en qué estado.
- [DEVELOPMENT.md](DEVELOPMENT.md) — entorno local, scripts, tests, ramas.
- [DEPLOYMENT.md](DEPLOYMENT.md) — despliegue (todavía no hay).
- [TEMPLATE.md](TEMPLATE.md) — de qué plantilla nace BPDF y por qué se separó.

### Seguimiento
- [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) — fases y decisiones abiertas. **Fuente de
  verdad del estado.**
- [CHANGELOG.md](CHANGELOG.md) — bitácora de iteraciones, con el porqué.
- [auditoria.md](auditoria.md) — auditorías de seguridad y estado de cada hallazgo.
- [mejoras.md](mejoras.md) — propuestas con lo que las desbloquea.

## Cómo contribuir a estos documentos

- Si un cambio de código afecta a lo que describe un documento, se actualiza **en la
  misma tarea**. Un documento que describe un estado que ya no existe es peor que no
  tenerlo.
- Se escribe el **porqué**, no solo el qué: el qué está en el código.
- Enlaces relativos entre documentos y hacia el código. `npm run docs:enlaces` comprueba
  que ninguno esté roto (menos en `CHANGELOG.md`, que es histórico). Ojo: también revisa
  lo que hay dentro de bloques de código, así que un ejemplo con la sintaxis de enlace de
  Markdown cuenta como enlace.
- Convenciones de la bitácora y de las tareas: [`CLAUDE.md`](../CLAUDE.md) §7.

## Para LLMs / agentes

1. Lee [`CLAUDE.md`](../CLAUDE.md) entero: son las reglas de trabajo.
2. El estado real está en [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) («Estado hoy») y en
   las últimas entradas de [CHANGELOG.md](CHANGELOG.md).
3. Si vas a ejecutar una fase: [FASES.md](FASES.md) → «Cómo usar este documento», y las
   secciones de PLAN, SEGURIDAD y ELECTRON que cite.
4. Antes de tocar `public_docs/`: su [README](../public_docs/README.md).
