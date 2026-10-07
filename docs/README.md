# Documentación interna

Documentación para quien desarrolla y mantiene BPDF, en español. La documentación para
quien lo usa está en [`public_docs/`](../public_docs/README.md) (publicada en
`https://docs.r3zon.com/bpdf`).

## Si llegas de fuera

- Para contribuir, empieza por [`CONTRIBUTING.md`](../CONTRIBUTING.md) y
  [DEVELOPMENT.md](DEVELOPMENT.md); para entender el diseño, por
  [ARCHITECTURE.md](ARCHITECTURE.md) y [SEGURIDAD.md](SEGURIDAD.md).
- **La bitácora** ([CHANGELOG.md](CHANGELOG.md)) cuenta cada iteración de desarrollo con su
  porqué, lo descartado y los errores del camino. No es el registro de cambios para usuarios,
  que está en [`public_docs/novedades.md`](../public_docs/novedades.md).
- Las fases (F0–F18), las decisiones (D-n) y las tareas son la historia y el estado del
  proyecto: [FASES.md](FASES.md), [PLAN.md](PLAN.md) §14 y
  [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md).

## Índice

### Plan de BPDF
- [PLAN.md](PLAN.md) — diseño objetivo: arquitectura, PDF, Markdown, persistencia, UI/UX,
  accesibilidad, rendimiento, testing, distribución y decisiones (D-n, T-n).
- [FASES.md](FASES.md) — plan de implementación: cada fase con alcance, archivos, tests y
  criterios de aceptación.
- [SEGURIDAD.md](SEGURIDAD.md) — modelo de amenazas y controles de web, Markdown y PDF,
  con la fase que implementa cada uno.
- [ELECTRON.md](ELECTRON.md) — **histórico**: el diseño de una versión de escritorio que
  se canceló (D19: BPDF es solo web).
- [PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md) — resultado del spike de la Fase 4: cómo
  se consigue el PDF en modo oscuro, con qué evidencia, qué cuesta y qué limitaciones tiene.

### Estado actual
- [ARCHITECTURE.md](ARCHITECTURE.md) — principios y el porqué de cada uno.
- [STACK.md](STACK.md) — tecnologías, dependencias y su motivo.
- [STRUCTURE.md](STRUCTURE.md) — árbol del repositorio y qué va en cada sitio.
- [MODULES.md](MODULES.md) — qué piezas existen y en qué estado.
- [DEVELOPMENT.md](DEVELOPMENT.md) — entorno local, scripts, tests, ramas.
- [DEPLOYMENT.md](DEPLOYMENT.md) — publicación en Vercel, versión y registro de cambios,
  GitHub Wiki y comprobación de un despliegue.
- [TEMPLATE.md](TEMPLATE.md) — de qué plantilla nace BPDF y por qué se separó.

### Seguimiento
- [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md) — seguimientos post-v1 que siguen abiertos.
  **Fuente de verdad del estado pendiente.**
- [CHANGELOG.md](CHANGELOG.md) — bitácora de iteraciones, con el porqué.
- [auditoria.md](auditoria.md) — auditoría final de v1 y estado de los hallazgos de seguridad.
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
   secciones de PLAN y SEGURIDAD que cite.
4. Antes de tocar `public_docs/`: su [README](../public_docs/README.md).
