# Arquitectura: principios y su origen

Principios de BPDF y el porqué de cada uno. Las reglas operativas derivadas (qué hacer al
escribir código) están en [`CLAUDE.md`](../CLAUDE.md). La arquitectura **objetivo** (capas,
motores, plataforma) está en [PLAN.md](PLAN.md) §4; este documento describe principios que
ya rigen hoy y se amplía cuando cada fase los materializa.

**Estado del código (2026-09-30, tras la Fase 7):** una SPA estática de Vite + React (D1)
que abre un PDF o un Markdown local (selector, `Ctrl/Cmd+O` o arrastre). Los PDF se leen
en el visor propio (§4 quater) y los Markdown en su lector (§4 quinquies), sin cargar
imágenes todavía. Sin backend, datos ni variables de entorno. La CSP estricta, los tokens de diseño,
los textos centralizados y la frontera de plataforma ya rigen.

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

**Cómo es hoy (Fases 3 y 5).** La interfaz `Platform` tiene tres métodos, los únicos que
se usan: `pickDocument()`, `openDroppedFile(file)` y, desde el visor PDF,
`openExternal(url)` (enlaces de un documento, que la plataforma revalida y abre fuera). La web los implementa con APIs
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
Node; los píxeles finales en Playwright), y el visor de la Fase 5 las reutiliza. El
laboratorio de la Fase 4 (`spike.html`, `src/pdf-spike/`) ya no existe; sus resultados
siguen en [PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md).

### 4 quater. El visor PDF (Fase 5)

Visor propio sobre las APIs núcleo de pdf.js (**D17**: sin `PDFViewer` ni
`pdfjs-dist/web/pdf_viewer`), con la build `legacy` de pdf.js 6.3.289 (**D18**). Tres capas,
de dentro afuera:

| Capa | Dónde | Qué hace | React |
|---|---|---|---|
| Módulos puros | [`src/pdf/visor/`](../src/pdf/visor/) `disposicion.ts` · `busqueda.ts` · `enlaces.ts` | Zoom y ajustes, disposición de páginas, ventana de virtualización, presupuesto de memoria, campo de página; normalización e índice de búsqueda; política de enlaces | No |
| Controladores | `documento.ts` · `superficie.ts` · `capas.ts` · `controlador.ts` y [`src/pdf/dark/`](../src/pdf/dark/) | El PDF abierto y sus cachés; una página en pantalla (lienzo, capa de texto, enlaces); la cola de render; la búsqueda; el modo oscuro en su worker | No |
| Interfaz | [`src/app/pdf/`](../src/app/pdf/) | Carga (`VisorPdf.tsx`), estado de la vista (`estado.ts`, reductor puro), barra, estado, miniaturas, búsqueda, teclado | Sí |

`VisorPdf` se carga a demanda (`React.lazy`) al abrir el primer PDF: ni él ni pdf.js
entran en el arranque. Los módulos puros se prueban con Vitest en Node; los
controladores, con dobles del documento y con pdf.js real en Node; el render, los píxeles,
la capa de texto y la CSP, en Playwright contra la build.

**Ciclo de vida.** La app monta el visor con `key={document.id}`: abrir otro documento lo
desmonta. Al desmontar se aborta la apertura si no había terminado (`AbortSignal` →
`loadingTask.destroy()`), se cancelan los renders, se termina el worker del modo oscuro y
se destruye el documento de pdf.js. Nada del documento anterior puede aparecer después:
sus marcos se van con él, cada `pintar()` abre una **generación** que descarta lo que
llegue de las anteriores, y el controlador destruido ignora cualquier petición. Un PDF
protegido con contraseña (`PasswordException`) o ilegible se dice con un aviso y se
libera.

**Modelo de página.** Cada página tiene un marco (un `<div>` vacío del tamaño CSS de la
página, que pone React) y, si está viva, una `SuperficiePagina`: número, viewport
(`viewportCss`: zoom × 96/72 y rotación), tamaño, estado (`vacia`, `pintando`, `lista`,
`error`) y su lienzo. Los tamaños de todas las páginas se piden en segundo plano, por
lotes de 50; hasta entonces se supone el de la primera.

**Estrategia de render.** pdf.js pinta en un lienzo **nuevo, fuera del DOM**; en modo
oscuro se recolorea ese lienzo; solo entonces sustituye al anterior (con su capa de texto
y sus enlaces ya construidos). Nunca se ve una página a medio pintar ni un destello blanco
en oscuro, y al cambiar el zoom se ve la página anterior estirada hasta que llega la
nueva. Un render obsoleto se cancela (`RenderTask.cancel()`); como mucho **2 renders a la
vez** (`RENDERS_A_LA_VEZ`): primero la página actual, luego las otras visibles, luego las
vecinas (la siguiente antes que la anterior) y, detrás, las miniaturas. La concurrencia
cuenta superficies, no llamadas: un render sustituido no ocupa hueco.

**Vistas.** *Continua*: todas las páginas una debajo de otra (el contenedor tiene la
altura del documento entero), pero solo tienen marco las vivas. *Página a página*: un
solo marco, el de la página actual. Cambiar de vista conserva página, zoom, giro y modo,
y lleva la vista a la página. En la continua, la página actual es la que ocupa el primer
tercio del área visible; un cambio de zoom, giro o tamaños mantiene arriba la misma parte
del documento (un «ancla»: página y fracción).

**Virtualización (sin librería).** `disponer()` calcula el borde superior de cada página;
`ventana()` busca con búsqueda binaria qué páginas se ven con el desplazamiento actual y
declara vivas las visibles ±1. Solo esas tienen marco y lienzo; al salir, el lienzo se
deja a 0×0 (devuelve su memoria sin esperar al recolector), se quitan sus capas y pdf.js
libera la página (`page.cleanup()`). Un documento de 300 páginas tiene como mucho 4
lienzos.

**Política de memoria.**

- Lienzos: visibles ±1 y, para las vecinas, un **presupuesto de 160 MiB**
  (`PRESUPUESTO_LIENZOS`): las visibles se pintan siempre; una vecina, solo si cabe. Caben
  cuatro A4 a lo ancho en una pantalla de DPR 2 (~34 MiB cada una); a zoom muy alto las
  vecinas esperan a acercarse.
- Resolución (`render.ts`): el tamaño CSS y la resolución física van separados. El DPR se
  usa como mucho hasta **2** (`DPR_MAXIMO`) y un lienzo nunca pasa de **16,7 Mpx** (4096²,
  `PIXELES_MAXIMOS`, 64 MiB): por encima se baja la resolución, no se gasta más memoria.
- Transitoria del modo oscuro: una franja de 256 filas por franja en vuelo (dos como
  mucho). Durante un cambio de zoom conviven un momento dos lienzos de la misma página.
- Texto: el de la capa de texto, en una caché de 12 páginas; el índice de búsqueda, una
  vez por página y solo cadenas (lo único que crece con el documento: ~el tamaño de su
  texto).
- Miniaturas: solo las visibles en su panel (±200 px), a 112 px CSS de ancho y DPR ≤ 2
  (~0,5 MiB cada una); al cerrar el panel se liberan todas.

**Worker del modo oscuro.** Medido antes de decidir (`npm run bench:pdf`, Chromium, DPR 1
y 2; [CHANGELOG](CHANGELOG.md) iteración 7): recolorear en el hilo principal lo bloquea
~7–10 ms por Mpx (70–90 ms en una A4 a lo ancho con DPR 2; 100–140 ms a 14–17 Mpx). Con el
worker ([`trabajador.ts`](../src/pdf/dark/trabajador.ts)), el hilo principal solo lee y
escribe las franjas (~3,5 ms/Mpx: 30–39 ms y 50–66 ms), repartido en bloques de una franja,
y el cálculo corre en paralelo. Las franjas van y vuelven **transferidas** (sin copia). Se
eligió un Web Worker y no WebGL porque reutiliza tal cual el código probado del spike, no
depende de la GPU ni de un contexto que se puede perder, y no añade dependencias. Si el
navegador no puede crear el worker, o este falla, el visor usa el mismo código en el hilo
principal (y vuelve a pintar la página que se quedó a medias). El worker es un fichero del
propio origen (CSP `worker-src 'self'`, sin cambios en la CSP).

**Modo oscuro.** `oscuro` es el recoloreado selectivo de la Fase 4 (la heurística de color
solo fuera de las regiones de imagen que registra pdf.js con `recordImages`); `original`
es lo que pinta pdf.js. Nunca `filter: invert()`. Las regiones se registran en el primer
render de cada página, normalizadas: valen para cualquier zoom y, con otro giro, se rotan
en el espacio normalizado (`rotarNormalizadas`). El cambio es inmediato y reversible en
cualquier momento: nadie queda atrapado en la transformación.

**Capa de texto.** `TextLayer` de pdf.js (API pública) sobre cada página viva, construida
en un contenedor aparte y cambiada de una vez con el lienzo. Se reconstruye con cada
render (zoom, giro): es barata frente al render. Su tamaño se fija en píxeles (pdf.js lo
escribe con `round()` de CSS, que no tienen todos los navegadores objetivo) y el giro lo
aplica la CSS de pdf.js (`data-main-rotation`), adaptada en
[`visor-pdf.css`](../src/styles/visor-pdf.css) con los tokens de BPDF. Solo
`textContent`, `createElement` y atributos: nada de HTML en crudo.

**Enlaces.** No se usa la capa de anotaciones interactiva de pdf.js: las anotaciones
`Link` se leen con `getAnnotations()` y pasan por la política de
[`enlaces.ts`](../src/pdf/visor/enlaces.ts): externos, solo `http:`, `https:` y `mailto:`
(absolutos y sin credenciales), abiertos por `Platform.openExternal` (en web, una pestaña
nueva sin `opener` ni `Referer`); internos (destino explícito, destino con nombre o las
acciones página siguiente/anterior/primera/última), mueven el visor. Todo lo demás
(JavaScript, formularios, `GoToR`, adjuntos, `file:`…) no es un enlace. Cada enlace es un
`<a>` transparente con nombre accesible cuyo clic nunca navega la app. Las apariencias de
anotaciones y formularios se pintan en el lienzo (`AnnotationMode.ENABLE`), sin
interacción.

**Búsqueda.** Sobre el texto que trae el PDF (sin OCR). El índice de cada página
normaliza con NFKD, sin diacríticos y en minúsculas, colapsa los espacios y trata el fin
de línea como un espacio; cada carácter recuerda de qué trozo de `getTextContent` sale y,
como la capa de texto crea un elemento por trozo en ese orden, una coincidencia se resalta
envolviendo sus caracteres en `<mark>`. Recorre el documento cediendo el hilo, una
búsqueda nueva anula la anterior y, si ninguna página tiene texto, lo dice (probablemente
un escaneo).

**Miniaturas.** Panel lateral con un botón por página (la actual, con
`aria-current="page"`); `IntersectionObserver` decide cuáles se pintan. Se pintan aparte,
en su propio lienzo pequeño: nunca reutilizan el de la página grande.

**Teclado** (no se intercepta nada mientras se escribe en un campo):

| Tecla | Acción |
|---|---|
| Ctrl/⌘ + O | Abrir archivo (la app) |
| AvPág / RePág | Página siguiente / anterior |
| Inicio / Fin | Primera / última página |
| ↓ / ↑ | Desplazar; en «página a página», en el borde pasa de página |
| Ctrl/⌘ + «+» o «=» · Ctrl/⌘ + «−» · Ctrl/⌘ + 0 | Acercar · alejar · 100 % |
| Ctrl/⌘ + rueda | Acercar / alejar (no el zoom del navegador) |
| Ctrl/⌘ + F | Buscar en el documento (Intro / Mayús+Intro: siguiente / anterior; Esc: cerrar) |

**Accesibilidad.** Cada botón tiene nombre accesible (el icono nunca va solo), los modos
dicen su estado con `aria-pressed` y texto visible, la barra de estado es texto («Página
12/148 · Zoom 100 % · Oscuro · Continua») y los cambios que pide el usuario se anuncian en
una región `role="status"`. Cada página es un grupo con nombre («Página 3 de 148»); el
lienzo es `aria-hidden` y el texto accesible es el de la capa de texto.

**Límites conocidos.**

- El modo oscuro conserva las **imágenes**: un diagrama o una captura rasterizados con
  fondo blanco quedan como un recuadro blanco en la página oscura.
- Una banda de color intenso con texto blanco se aclara (el color se lleva a 3:1 sobre la
  página) y su texto pasa a oscuro: se lee, pero no es el diseño original.
- Los colores pastel se oscurecen conservando el tono; lo que se distingue solo por
  pasteles (mapas de calor claros) pierde diferencia.
- Un escaneo se oscurece con la heurística (≥ 90 % de la página es imagen): conserva el
  tono del papel y el ruido JPEG.
- La búsqueda no une palabras partidas con guion al final de línea, y en un PDF sin texto
  no encuentra nada (sin OCR).
- En la vista continua, el ajuste al ancho o a la página usa el tamaño **típico** del
  documento (la mediana), no el de la página actual: una página apaisada no cambia el zoom
  de todas.
- «Página a página» no pinta de antemano la página siguiente.
- pdf.js 6 carga su worker como módulo ES: el visor necesita Firefox 114 o posterior,
  aunque la app arranque en los navegadores mínimos de `build.target` (Firefox 111).

### 4 quinquies. El visor Markdown (Fase 7)

Lector de Markdown GFM sobre `react-markdown` + `remark-gfm`, con componentes propios
para lo que toca la seguridad o la accesibilidad. Todo en [`src/markdown/`](../src/markdown/),
cargado a demanda (`React.lazy`) al abrir el primer Markdown:

| Pieza | Dónde | Qué hace | React |
|---|---|---|---|
| Pipeline | `pipeline.ts` | Plugins (GFM, quitar comentarios HTML, ids de encabezados), opciones de remark-rehype (prefijo de ids, textos de las notas al pie), **lista blanca de elementos** y `urlTransform`. Un solo sitio para todo lo que afecta a la seguridad; la Fase 8 amplía `pluginsRemark` | No |
| Política de URLs | `url-policy.ts` | `clasificarEnlace` / `clasificarImagen` / `transformarUrl` (puras) | No |
| Índice e ids | `toc.ts` | Slugs deterministas con prefijo `md-`, plugin de remark que los asigna, lectura del índice desde el DOM pintado | No |
| Resaltado | `resaltado.ts` | lowlight con 9 gramáticas; su árbol a React con lista blanca (`span` + texto) | Solo `createElement` |
| Componentes | `components/` | `Enlace`, `Imagen`, `BloqueCodigo`, `Indice`, encabezados, tabla, casilla; `acciones.ts` (contexto) | Sí |
| Vista | `MarkdownView.tsx` | Barra (índice, nombre, cerrar), índice, `<article>` desplazable, avisos | Sí |
| Estilos | [`src/styles/markdown.css`](../src/styles/markdown.css) | Todo colgado de `.md-contenido` o de clases `md-*` | — |

**Datos.** Recibe `{ kind: "markdown", text }` de `DocumentProvider` (Fase 3) y no vuelve
a leer el fichero. `Contenido` es un componente `memo` sobre el texto: abrir el índice o
un aviso no vuelve a procesar el documento. Los componentes piden al visor lo que
necesitan (abrir fuera, ir a una sección) por un contexto, para que el mapa de componentes
sea fijo.

**HTML crudo (D6).** No se interpreta: sin `rehype-raw`, react-markdown convierte cada
nodo HTML en su texto literal. Un `<script>` se **ve** como texto (no se esconde: quien lee
sabe que el documento traía HTML). Los comentarios `<!-- … -->` sí se quitan: nunca son
para leerse y en los README abundan. Además, una lista blanca de elementos descarta
cualquier etiqueta que no produzca Markdown + GFM.

**URLs.** Solo llegan a un `href` dos casos, y los dos los construye BPDF:

| Destino | Qué pasa |
|---|---|
| `http:`, `https:`, `mailto:` absolutas (política común de `src/lib/url-externa.ts`) | `<a target="_blank" rel="noopener noreferrer">`; el clic se intercepta y lo abre `Platform.openExternal` (web: pestaña nueva sin `opener` ni `Referer`; Electron, Fase 14: el navegador del sistema desde el main). El clic central se anula |
| `#fragmento` | `href="#md-…"`; el clic desplaza dentro del documento y mueve el foco a la sección, sin cambiar la URL. Solo se buscan ids con prefijo y dentro del documento |
| Ruta relativa (`otro.md`) | Texto con subrayado punteado y el motivo (información emergente y texto para lectores de pantalla). Abrir otro fichero enlazado espera a tener acceso a los hermanos (Electron, o varios ficheros en web) |
| Todo lo demás (`javascript:`, `data:`, `file:`, `vbscript:`, `//host`, `/ruta`, `C:\…`, credenciales en la URL…) | Texto, igual que la anterior, con otro motivo |

Antes de clasificar se quita lo que el navegador ignora al leer una URL (tabuladores y
saltos en cualquier posición; controles y espacios en los extremos). Las entidades las
decodifica el parser una sola vez: `java&#x73;cript:` llega como `javascript:` y se
bloquea; una entidad que sobrevive es texto literal y la URL queda como ruta relativa, sin
`href`. Dos capas: `urlTransform` vacía lo bloqueado en el pipeline y `Enlace`/`Imagen`
vuelven a clasificar.

**Imágenes.** En esta fase **no se carga ninguna**: no hay `<img>` en el DOM. Una remota
(D7) es un marcador con su texto alternativo y un enlace para abrirla fuera; una local
(`./logo.png`), un marcador que explica que aún no se cargan; el resto, bloqueada. En web,
un `File` suelto no da acceso a sus hermanos: cargar imágenes locales exige abrir el `.md`
junto con ellas (varios ficheros o una carpeta), un cambio en la apertura que se aplazó
(TAREAS). La regla CSS de `img` ya existe (ancho máximo, sin filtros).

**Índice.** Ids deterministas al estilo de GitHub (minúsculas, sin puntuación, espacios a
guiones; repetidos con `-1`, `-2`…), siempre con prefijo `md-` (DOM clobbering: un
`# location` no pisa `window.location`). Los asigna un plugin de remark en el árbol, no
se escribe HTML con ellos. El índice (h1–h6) se **lee del DOM ya pintado** en un
`useLayoutEffect`: enlaza exactamente lo que se ve, sin volver a parsear. Con menos de
dos encabezados no hay índice. En pantalla ancha (≥ 64 rem) es una columna abierta; en
estrecha, un panel encima del texto que se cierra al elegir. Lista plana sangrada por
nivel: un documento puede saltar de `h1` a `h4`.

**Código.** lowlight (highlight.js en árbol) con 9 gramáticas y alias habituales (`js`,
`jsx`, `ts`, `tsx`, `html`, `svg`, `sh`, `shell`, `py`, `md`…). Sin detección automática:
sin lenguaje o con uno desconocido, texto tal cual. El botón copia el texto del árbol
(no lo pintado), con `navigator.clipboard.writeText` tras el clic, sin pedir permisos; dice
«Copiado» 2 s (temporizador cancelado al desmontar) o «No se ha podido copiar», también en
una región viva.

**Estilos y tema.** `markdown.css` solo alcanza al documento, y el documento no puede
traer estilos (ni `<style>` ni `style` ni clases: no hay HTML). Hoja en el plano `page`,
~72 caracteres de ancho, colores de los tokens (`--rgb-link` y `--rgb-code-*` son nuevos,
con su contraste en `tokens.test.ts`), sin `filter`. Tablas y bloques de código se
desplazan en horizontal dentro de su contenedor (enfocable), la hoja nunca.

**Ciclo de vida.** Se monta con `key={document.id}`: otro documento lo desmonta entero.
No crea listeners globales, observers, workers ni URL de objeto (un test lo comprueba).
Lo único temporal: los avisos de «Copiado» y, en documentos grandes, el paso diferido de
abajo; los dos se cancelan al desmontar.

**Rendimiento (medido, `npm run bench:markdown`, Chromium de Playwright, Ryzen 7 5800X).**
Tiempo desde elegir el fichero hasta ver su primer encabezado (incluye unos 0,3 s del
propio recorrido de Playwright); varía entre ejecuciones:

| Documento | Tiempo | Elementos |
|---|---|---|
| 1 KB (`basico.md`) | 0,33 s | 57 |
| 100 KB de texto mixto | 0,5–0,9 s | 7 300 |
| 1 MB de texto mixto (pocas listas) | 3,3–7,3 s | 72 000 |
| 5000 encabezados | 0,6–1,0 s | 5 000 |
| 2000 bloques de código resaltados | 0,8–1,1 s | 26 700 |
| Listas cortas: 50 / 100 / 200 KB | 0,5 / 1,0–1,3 / 2,3–2,8 s | hasta 19 800 |

En Node, el pipeline completo es lineal (~2 s/MB) salvo las listas. Un perfil de 1 MB
no muestra un punto caliente propio: el tiempo se reparte entre el tokenizador de
micromark, el paso a árbol, React creando ~72 000 elementos y la primera maquetación. Por
eso:

- **Por encima de 100 KB**, el visor pinta primero la barra y «Preparando el documento…»
  y el contenido un fotograma después (`requestAnimationFrame` + `setTimeout`): la pantalla
  no se queda congelada sin señal. Por debajo, el aviso solo sería un parpadeo.
- **No se virtualiza** ni se parsea en un worker: bajar de 1 s con 1 MB, como pedía la
  Fase 7, exige uno de los dos, y es un cambio de arquitectura (TAREAS, Fase 13).
- **Listas cortas y muchas: cuadrático** en `mdast-util-from-markdown` (STACK.md). Con el
  límite de apertura de 20 MiB, un documento hecho a propósito puede bloquear la pestaña
  mucho tiempo (TAREAS).

**Búsqueda (futura).** El contenido es texto normal dentro de un `<article>` propio: una
búsqueda podrá recorrer sus nodos de texto y resaltar sin tocar el pipeline.

**Límites conocidos.**

- Imágenes: ninguna se muestra (arriba).
- Un enlace a otro fichero del documento no se abre.
- Matemáticas y Mermaid se ven como bloques de código (Fase 8).
- Rendimiento con documentos grandes y con muchas listas (arriba).

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
