# Mejoras propuestas

Propuestas que **no son tareas todavía**: cada una dice qué la desbloquea. Cuando se
cumple el desbloqueo, pasa a [TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md). Lo planificado
por fases no va aquí, sino en [FASES.md](FASES.md).

---

### Mantenimiento de CI

Heredadas de la plantilla, siguen aplicando:

- Actions fijadas por SHA en vez de por etiqueta, y Dependabot configurado teniendo en
  cuenta `allowScripts` ([STACK.md](STACK.md)). (Era obligatorio antes de publicar releases
  de escritorio; sin escritorio, D19, queda como mejora de la cadena de suministro,
  [SEGURIDAD.md](SEGURIDAD.md) §2.5.)
- Comprobar si `actions/checkout`, `setup-node` y `upload-artifact` tienen una versión
  mayor más nueva que `v4`.
- Notificación a Discord también en `e2e.yml` y `security.yml` (hoy solo en `ci.yml`).

**Desbloqueo:** la primera ejecución real de los workflows en GitHub.

### Abrir `engines` a Node 26

`engines` admite solo Node 24. Abrirlo cuando Node 26 sea LTS, junto con `.nvmrc` y CI.

**Desbloqueo:** Node 26 LTS.
