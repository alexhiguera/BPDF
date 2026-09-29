# Auditorías de seguridad

Registro de revisiones de seguridad de BPDF: qué se revisó, qué se encontró y en qué
estado está cada hallazgo. Las revisiones nuevas van **arriba**. El diseño que se audita
está en [SEGURIDAD.md](SEGURIDAD.md); la primera auditoría completa es la Fase 12
([FASES.md](FASES.md)).

Formato de un hallazgo: `ID` · severidad (🔴 crítica · 🟠 alta · 🟡 media · 🟢 baja) ·
estado (**abierto** / **cerrado** en la iteración N / **aceptado** con su motivo).

```markdown
## Auditoría N — *YYYY-MM-DD* — Título

**Alcance.** Qué se revisó.

**Qué se comprobó y cómo.** Tests, herramientas, revisión manual.

### Hallazgos

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| AN-1 | 🟡 | … | **Abierto**: … |

**Verificado y correcto.** Lo que se comprobó y está bien.
```

---

_Todavía no hay auditorías de BPDF._ Las de la plantilla (su core SaaS) están en su
repositorio; su único hallazgo abierto que afecta a BPDF, la falta de CSP, es la tarea de
las fases 2 y 12.
