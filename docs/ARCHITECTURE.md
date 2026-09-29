# Arquitectura: principios y su origen

Principios de BPDF y el porqué de cada uno. Las reglas operativas derivadas (qué hacer al
escribir código) están en [`CLAUDE.md`](../CLAUDE.md). La arquitectura **objetivo** (capas,
motores, plataforma) está en [PLAN.md](PLAN.md) §4; este documento describe principios que
ya rigen hoy y se amplía cuando cada fase los materializa.

**Estado del código (2026-09-29, tras la Fase 4):** una SPA estática de Vite + React (D1)
que abre y valida un PDF o un Markdown local (selector, `Ctrl/Cmd+O` o arrastre) y muestra
su nombre, tipo y tamaño, todavía sin visor; sin backend, datos ni variables de entorno.
La CSP estricta, los tokens de diseño, los textos centralizados y la frontera de
plataforma ya rigen. El motor de PDF y el modo oscuro existen como módulos probados
(`src/pdf/`), usados de momento solo por el laboratorio temporal `spike.html`.

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

Solo `src/platform/` sabe si la app corre en web o en Electron. El resto del código
recibe documentos (`OpenedDocument`), no ficheros ni rutas.

**Cómo es hoy (Fase 3).** La interfaz `Platform` tiene dos métodos, los únicos que se
usan: `pickDocument()` y `openDroppedFile(file)`. La web los implementa con APIs
estándar (`<input type="file">` y `Blob.arrayBuffer()`); Electron (Fase 14) lo hará con
IPC. Las dos terminan en la misma función, `readDocument`, que valida y construye el
documento: la plataforma aporta el fichero y, si quiere, el id; la validación no se
duplica. Cada método nuevo llega con la fase que lo usa ([ELECTRON.md](ELECTRON.md) §3).

**Por qué no más.** Un contrato con métodos que nadie llama se diseña a ciegas y se
equivoca; el de la Fase 0 tenía cinco, y el primer uso real ya cambió dos (un documento
en vez de una lista, por D16).

### 4 bis. Un documento a la vez

`DocumentProvider` (`src/documents/`) guarda **un** documento (D16) y el último error de
apertura. Abrir otro lo sustituye; un fichero rechazado no cierra el que se leía; solo
aplica su resultado la última apertura. El estado no posee recursos que liberar a mano:
el PDF es un `Blob` y el Markdown una cadena, y el recolector los libera al dejar de
estar referenciados. Lo que sí habrá que liberar (documentos de pdf.js, URL de objeto de
imágenes) lo crearán los visores, montados con `key={document.id}` para que cambiar de
documento los desmonte y ejecute su limpieza.

**Por qué así.** Pestañas, recientes o varios documentos cambiarían el estado del
proveedor (una lista y un «activo»), no el modelo ni los visores: la puerta queda abierta
sin construir nada de eso ahora.

### 4 ter. El motor de PDF, en capas sin React (Fase 4)

`src/pdf/` separa tres cosas que el visor combinará:

- **Carga** ([`engine.ts`](../src/pdf/engine.ts)): importa pdf.js a demanda, con su worker
  y sus recursos en el propio origen, `useWasm: false` y el documento entregado como bytes.
- **Render** ([`render.ts`](../src/pdf/render.ts)): pinta una página con la API núcleo y
  obtiene de pdf.js dónde quedaron sus imágenes (`recordImages`).
- **Modo oscuro** ([`dark/`](../src/pdf/dark/)): funciones puras de color y de regiones, y
  su aplicación por franjas sobre el lienzo.

**Por qué.** El modo oscuro necesita controlar cómo se crea el lienzo y pedirle a pdf.js
las regiones de imagen; con el `PDFViewer` de pdf.js no se puede
([PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md) §9). Separado así, cada pieza se prueba
sola (la matemática de color con buffers de unos píxeles; la carga con pdf.js real en
Node; los píxeles finales en Playwright), y el visor de la Fase 5 las reutiliza sin
arrastrar el laboratorio, que se borra.

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
