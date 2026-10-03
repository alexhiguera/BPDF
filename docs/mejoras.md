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
- `persist-credentials: false` en `actions/checkout`: hoy el token queda en `.git/config`
  mientras corren `npm ci`, la build y los tests (código de dependencias). El token es de
  solo lectura (`permissions: contents: read` en los tres workflows), así que el riesgo es
  bajo.

**Situación (Fase 12, *2026-10-03*):** las Actions van por etiqueta (`@v4`), no por SHA.
Sigue siendo una mejora, no un requisito de v1: sin releases firmadas (D19) y con
permisos mínimos. Hallazgo A1-9 de [auditoria.md](auditoria.md).
- Notificación a Discord también en `e2e.yml` y `security.yml` (hoy solo en `ci.yml`).

**Desbloqueo:** la primera ejecución real de los workflows en GitHub.

### Fuera de v1 (decisiones del usuario, *2026-10-03*)

Ideas que se conservan pero que v1 no hará. **Desbloqueo:** que el usuario las pida.

- **Mermaid 12** (la v1 se queda en 11.17.2): evaluarla con `mermaid-hostil.md` y
  `formulas-diagramas.spec.ts` antes de aceptarla.
- **Buscar dentro del editor** (`@codemirror/search`): `Ctrl+F` del navegador no encuentra el
  texto que CodeMirror no tiene pintado.
- **Fondo claro opcional para imágenes transparentes** en la hoja oscura de Markdown.
- **«Oscurecer también las imágenes»** del PDF (diagramas raster con fondo blanco).
- **Markdown enorme más rápido**: analizar en un worker o pintar por partes (estudiado en la
  Fase 13: ninguna es proporcionada para v1; ARCHITECTURE §4 undecies).
- **Tema claro** (D10: no en v1).

### Abrir `engines` a Node 26

`engines` admite solo Node 24. Abrirlo cuando Node 26 sea LTS, junto con `.nvmrc` y CI.

**Desbloqueo:** Node 26 LTS.
