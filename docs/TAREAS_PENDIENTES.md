# Tareas pendientes

Solo seguimientos **post-v1** que siguen abiertos. Las decisiones cerradas, fases terminadas,
pruebas manuales realizadas y bugs corregidos están en [CHANGELOG.md](CHANGELOG.md), no aquí.
Las mejoras opcionales sin compromiso están en [mejoras.md](mejoras.md).

Estado: *2026-10-07*. **Bloqueantes de BPDF v1.0.0: ninguno.**

## Seguimiento de dependencias

- [ ] 🟡 **Retirar el riesgo aceptado de KaTeX transitivo** cuando Mermaid publique una
  versión compatible con KaTeX ≥ 0.18.2. Hoy BPDF usa `katex@0.18.9` directamente, pero
  `mermaid@11.17.2` arrastra `katex@0.16.47`, afectado por GHSA-238p-pmpm-9mq7 (gravedad
  baja). Forzar 0.18.x queda fuera del rango de Mermaid y se descartó para v1. En la
  actualización: revisar el rango declarado, `npm audit`, fórmulas dentro de diagramas,
  `mermaid-hostil.md` y los E2E de Mermaid. Riesgo y aislamiento: [auditoria.md](auditoria.md).

- [ ] 🟡 **Quitar el `override` de micromark 4.0.2** cuando exista una versión con el arreglo
  de micromark#246 validable localmente. La 4.0.3 introdujo una regresión cuadrática; no hay
  evidencia en el lockfile de una alternativa ya validada. Antes de retirarlo, comprobar con
  `listas: 200 KB` de `npm run bench:markdown` que el comportamiento sigue siendo lineal
  ([STACK.md](STACK.md)).

## Comprobación post-v1

- [ ] 🟢 **Medir en Safari real el caso extremo de Dividido con ~1 MB y muchas fórmulas.**
  Los recorridos funcionales pasan en Chromium, Firefox y WebKit. La lentitud observada
  corresponde al WebKit de Playwright en Linux, renderizado por software, DPR 2 y CPU
  limitada; no demuestra un fallo de Safari. Es una comprobación de entorno, no una tarea ni
  un bloqueo funcional de v1.
