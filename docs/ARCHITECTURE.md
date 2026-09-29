# Arquitectura: principios y su origen

Principios de BPDF y el porqué de cada uno. Las reglas operativas derivadas (qué hacer al
escribir código) están en [`CLAUDE.md`](../CLAUDE.md). La arquitectura **objetivo** (capas,
motores, plataforma) está en [PLAN.md](PLAN.md) §4; este documento describe principios que
ya rigen hoy y se amplía cuando cada fase los materializa.

**Estado del código (2026-09-29, tras la Fase 2):** una SPA estática de Vite + React (D1)
con el shell de la app y un estado vacío; sin backend, datos ni variables de entorno. La
CSP estricta, los tokens de diseño y los textos centralizados ya rigen.

Varios principios vienen de la plantilla SaaS de R3ZON, que a su vez los destiló de
**R3ZON ANTARES**. Se cita el origen para que quien venga después sepa qué evita cada regla
y pueda juzgar si sigue aplicando.

---

## Propios de BPDF

### 1. Los documentos no salen del dispositivo

Todo se procesa en el navegador (o en el proceso de Electron) del usuario. No hay
backend, API, base de datos, cuentas, sincronización ni telemetría, y ningún documento
puede provocar una petición de red.

**Por qué.** Es la razón de ser del producto. Una sola petición a un tercero (una imagen
remota en un Markdown, un informe de errores) revela qué se lee y cuándo. Por eso en la
Fase 1 se retiraron Sentry y Speed Insights de la plantilla aunque estuvieran apagados
por defecto: el principio no admite excepciones «anónimas».

### 2. El contenido de un documento es hostil

PDF y Markdown son entrada no confiable procesada por motores complejos. Nada de
`innerHTML`, protocolos de URL en lista blanca, motores con versión exacta y un corpus de
casos maliciosos por motor. Detalle: [SEGURIDAD.md](SEGURIDAD.md).

### 3. Ningún privilegio que no se necesite

El renderer no tiene Node, no ve rutas de disco y solo llama a funciones con propósito;
los motores corren aislados cuando pueden (pdf.js en su worker). Se diseña así desde la
web para que Electron no obligue a rehacer nada ([ELECTRON.md](ELECTRON.md)).

### 4. Una sola frontera de plataforma

Solo `src/platform/` (llega en la Fase 3) sabe si la app corre en web o en Electron. El resto del
código recibe documentos, no ficheros ni rutas.

### 5. La menor complejidad que cumpla los requisitos

Ante dos soluciones válidas: menos código, menos dependencias, menos superficie de ataque,
menos mantenimiento y mejor encaje con Electron. Sin router ni librería de estado mientras
haya una sola vista; cada dependencia de runtime justificada en [STACK.md](STACK.md).

## Heredados de la plantilla

### 6. Fechas públicas a mano

`last_update.date` de `public_docs/` y el `lastModified` de `src/config/public-site.ts`
(de donde sale `sitemap.xml`) son literales, actualizados a mano en el mismo commit que el
cambio. Nunca `new Date()` ni la fecha de git.

**Origen.** Una fecha que se mueve sola en cada despliegue (o en cada sincronización del
árbol) hace que el buscador ignore la señal. Y en ANTARES, 46 de 182 páginas decían dos
fechas distintas de sí mismas cuando la fecha estaba duplicada. Por eso aquí solo hay una:
la del frontmatter.

### 7. Las comprobaciones no pueden pasar en silencio

Un test que no puede ejecutarse falla o avisa de forma visible; nunca se salta callado.

**Origen.** En ANTARES, la suite que probaba la seguridad de la base de datos se saltaba
sola cuando no encontraba Postgres, y en CI nunca lo encontraba. Estuvo en verde meses sin
ejecutarse. En BPDF el mismo riesgo reaparece con los tests que necesitan un navegador real
(render de PDF, CSP): viven en Playwright, que corre en CI.

### 8. CI también en las ramas largas

**Origen.** Una rama de feature de ANTARES vivió semanas sin CI. Tres regresiones de una
función crítica, una de ellas bloqueante, convivieron dos días sin que nada las viera.

### 9. Documentar es parte de terminar

La bitácora, las tareas y los documentos se actualizan en la misma tarea que el código.

**Origen.** Seis commits sin documentar en ANTARES dejaron los documentos describiendo un
estado que ya no existía. Y un fichero de tareas que guardaba reglas acumuló «tareas» que
no se podían cerrar nunca: por eso las reglas van a `CLAUDE.md` y las tareas solo son
tareas.

### 10. Sin sobrearquitectura

Nada de sistema de plugins, monorepo, paquetes internos ni generadores hasta que haga
falta de verdad, y repetidas veces.

## Retirados en la Fase 1

Los principios de la plantilla sobre base de datos (esquema en migraciones, RLS como
verja, reglas en triggers, `EXECUTE` revocado, tenants, roles) y sobre rutas públicas con
sesión dejaron de aplicar al retirar Supabase y la auth. Se pueden consultar en el
repositorio de la plantilla.
