# Origen: la plantilla R3ZON

BPDF se creó el 2026-09-29 desde **R3ZON SaaS Template v1.0.0**. Este documento es el
registro de ese origen: el manifiesto que lo registraba (`r3zon-template.json`) se retiró
del repositorio antes de publicarlo, porque solo servía al procedimiento de actualización
de la plantilla, que aquí ya no aplica (D15).

## BPDF se separó del core (D15)

La plantilla es la base común de los productos **SaaS** de R3ZON: Supabase, auth,
Next.js con servidor, observabilidad. BPDF no es un SaaS: no tiene backend, datos ni
cuentas. En la Fase 1 se retiró todo eso y **BPDF no adopta versiones nuevas del core**:
el procedimiento de actualización de la plantilla (diff entre etiquetas aplicado con
`git apply --3way`) ya no aplica, porque casi todo lo que traería son piezas que aquí no
existen.


## Qué se conservó de la plantilla

La forma de trabajar y el tooling que sirve a cualquier producto:

- `CLAUDE.md` y el proceso de `docs/` (bitácora con el porqué, tareas solo abiertas,
  definición de hecho).
- Biome, TypeScript estricto, Vitest + Testing Library + jest-axe, Playwright.
- CI (`ci.yml`, `e2e.yml`, `security.yml`) y `scripts/verificar-overrides.mjs`.
- `public_docs/` con su contrato y su validador (D4), e identidad única en
  `src/config/project.ts`.
- Tailwind 4 con tokens RGB y los primitivos `Button`, `Field`, `Input`.

Detalle de qué se retiró y por qué: [PLAN.md](PLAN.md) §2 y la bitácora (iteración 3).

## Traer una mejora de la plantilla

Si la plantilla mejora algo de lo conservado (un validador, un workflow, una regla de
proceso), se trae **a mano y revisado**: se lee el cambio en el repositorio de la
plantilla, se adapta a BPDF y se anota en la bitácora de dónde viene. Nunca un diff
completo entre versiones.

Y al revés: si BPDF mejora algo de proceso que serviría a todos los productos de R3ZON,
se propone en el repositorio de la plantilla.
