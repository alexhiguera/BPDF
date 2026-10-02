# Arquitectura: principios y su origen

Principios de BPDF y el porqué de cada uno. Las reglas operativas derivadas (qué hacer al
escribir código) están en [`CLAUDE.md`](../CLAUDE.md). La arquitectura **objetivo** (capas,
motores, plataforma) está en [PLAN.md](PLAN.md) §4; este documento describe principios que
ya rigen hoy y se amplía cuando cada fase los materializa.

**Estado del código (2026-09-30, tras la Fase 8):** una SPA estática de Vite + React
(D1) que abre un PDF o un Markdown local (selector, `Ctrl/Cmd+O` o arrastre), y un
Markdown junto con sus imágenes (varios ficheros o una carpeta). Los PDF se leen en el
visor propio (§4 quater) y los Markdown en su lector (§4 quinquies), con sus imágenes
locales (§4 sexies), fórmulas y diagramas (§4 septies). Sin backend, datos ni variables de entorno. La CSP estricta, los tokens de diseño,
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
ilegible se dice con un aviso y se libera; uno protegido con contraseña
(`PasswordException`) la pide (Fase 6, «Contraseña», abajo).

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
normaliza con NFKD, sin diacríticos, colapsa los espacios y trata el fin de línea como un
espacio; cada carácter recuerda de qué trozo de `getTextContent` sale y, como la capa de
texto crea un elemento por trozo en ese orden, una coincidencia se resalta envolviendo sus
caracteres en `<mark>`. Recorre el documento cediendo el hilo, una búsqueda nueva anula la
anterior y, si ninguna página tiene texto, lo dice (probablemente un escaneo).

*Fase 6.* El índice (`IndicePagina`) guarda **dos textos de la misma longitud**: `texto`
(normalizado, conservando mayúsculas) y `minusculas`; las tablas `trozo` y `posicion`
valen para los dos, así que cualquier coincidencia se traduce igual a tramos del texto
mostrado y el resaltado no cambia. Si pasar un carácter a minúsculas cambiara su longitud
(casos raros de Unicode), `minusculas` lo guarda sin bajar: las cadenas nunca se
desalinean. Opciones de la barra, en memoria del visor:

- **Distinguir mayúsculas**: se busca en `texto` en vez de en `minusculas`. Los acentos se
  siguen ignorando.
- **Palabra completa**: una coincidencia vale si antes y después no hay letra ni número
  (`\p{L}`, `\p{N}`, también fuera del plano básico); un candidato que no vale no salta a
  los que se solapan con él.
- **Guion de fin de línea**: un guion (`-`, U+2010) al final de un trozo, precedido de
  letra, con la línea acabada ahí (`hasEOL` del trozo o de los vacíos que le siguen) y una
  letra después, no entra en el índice, ni el fin de línea: «pala-⏎bra» es «palabra» y se
  resalta en dos tramos. El guion blando (U+00AD) se ignora siempre. Comprobado también con
  un PDF generado por Chromium, que pone el guion en un trozo propio.

Coste medido (1000 páginas de ~3000 caracteres, Node, Ryzen 7 5800X): indexar ~0,52 ms
por página frente a ~0,40 de la F5, e índice ~18 % mayor; buscar, igual (decenas de ms
para las 1000 páginas).

**Miniaturas.** Panel lateral con un botón por página (la actual, con
`aria-current="page"`); `IntersectionObserver` decide cuáles se pintan. Se pintan aparte,
en su propio lienzo pequeño: nunca reutilizan el de la página grande. *Fase 6:* índice de
tabulación móvil (una sola miniatura tabulable) y `↑`/`↓` para mover el foco; el panel se
queda esas flechas (no llegan al visor ni desplazan el área de lectura).

**Pantalla completa (Fase 6).** Fullscreen API sobre el **área de lectura** (el contenedor
desplazable), con `F` o el botón de la barra; `Esc` es la salida nativa del navegador. El
estado se lee de `fullscreenchange` (también cuando sale el navegador) y se anuncia. En
pantalla completa no se ven las barras: se maneja con el teclado y se sale con `F` o `Esc`.
Sin `document.fullscreenEnabled`, no hay botón y `F` no hace nada. Las cabeceras no
cambiaron: el valor por defecto de `fullscreen` en `Permissions-Policy` ya es `self`
(SEGURIDAD §2.2; un E2E lo comprueba con las cabeceras reales).

**Contraseña (Fase 6, D13).** Si pdf.js lanza `PasswordException`, `VisorPdf` muestra un
`<dialog>` modal (`DialogoContrasena`). Cada «Abrir» es un intento nuevo: vuelve a abrir el
PDF con `getDocument({ password })` y una copia nueva de los bytes (la anterior se
transfirió al worker con la tarea fallida, que se destruye). En BPDF, la contraseña vive en
el campo hasta el envío, que lo vacía, y durante el intento en una referencia y en una
variable del efecto (`let clave`), que se sueltan al terminar el intento, bien, mal o
cancelado; la referencia se borra también al desmontar. La variable es `let` a propósito: la
función de limpieza del efecto comparte su ámbito y sigue viva mientras el documento está
abierto. **pdf.js la envía a su propio worker y puede conservarla allí mientras el documento
protegido esté abierto**; se libera al destruir el documento. `PdfProtegidoError` dice si
faltaba o era incorrecta, sin llevarla ni llevar el error de pdf.js. Reintentos sin límite; «Cancelar» o `Esc` cierran el documento;
abrir otro lo cancela (el visor se desmonta y la señal aborta). Se descartó `onPassword`:
deja la tarea de carga viva mientras el usuario escribe y complica la cancelación.

**Teclado** (no se intercepta nada mientras se escribe en un campo, salvo `F3` en el de
búsqueda; nada con un diálogo modal abierto ni con `Alt`). Resolución pura en
[`atajos.ts`](../src/app/pdf/atajos.ts) (`atajoDe(tecla, contexto)`); un solo oyente en
`window` que lee el contexto (vista, búsqueda abierta, atajos de una tecla) de referencias:

| Tecla | Acción |
|---|---|
| Ctrl/⌘ + O | Abrir archivo (la app) |
| AvPág / RePág · Espacio / Mayús+Espacio | Página siguiente / anterior (Espacio: no sobre un botón, enlace o casilla) |
| → / ← | Página siguiente / anterior, solo en «página a página» |
| Inicio / Fin | Primera / última página |
| ↓ / ↑ | Desplazar; en «página a página», en el borde pasa de página |
| Ctrl/⌘ + «+» o «=» · Ctrl/⌘ + «−» · Ctrl/⌘ + 0 | Acercar · alejar · 100 % |
| Ctrl/⌘ + rueda | Acercar / alejar (no el zoom del navegador) |
| Ctrl/⌘ + F | Buscar en el documento (Intro / Mayús+Intro: siguiente / anterior; Esc: cerrar) |
| F3 / Mayús+F3 | Coincidencia siguiente / anterior, con la búsqueda abierta (cerrada: es del navegador) |
| Ctrl/⌘ + G | Al campo de página, con su contenido seleccionado |
| F · T · R · Mayús+R · ? | **Una tecla** (WCAG 2.1.4): pantalla completa · miniaturas · girar a la derecha · a la izquierda · ayuda |

Los de una tecla se desactivan con el interruptor de la ayuda (`?`, o el botón de la barra,
que sigue funcionando con ellos desactivados). El estado vive en memoria del módulo
(`atajosDeUnaTecla`): dura la sesión de la pestaña, también al abrir otro documento, y se
pierde al recargar; la Fase 10 lo llevará a preferencias. `Mayús+R` se distingue por
`shiftKey` (con Bloq Mayús, `R` sigue girando a la derecha) y `?` por el carácter, no por
la tecla física (sale con Mayús en casi todas las distribuciones).

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
- En un PDF sin texto la búsqueda no encuentra nada (sin OCR). Un compuesto de verdad
  partido en el fin de línea («franco-⏎alemán») se encuentra sin guion («francoaleman»),
  no con él; «Distinguir mayúsculas» no distingue acentos.
- Con la contraseña, el gestor de contraseñas del navegador podría ofrecer guardarla (el
  campo es `type="password"`, con `autocomplete="off"` y sin envío de formulario, pero la
  decisión final es del navegador). BPDF no la guarda en ningún sitio.
- Pantalla completa, atajos y contraseña probados en Chromium (Playwright); Firefox y Safari
  sin probar.
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
| Ruta relativa (`otro.md`) | Texto con subrayado punteado y el motivo (información emergente y texto para lectores de pantalla). No se sigue aunque el fichero se haya entregado con el documento (§4 sexies) |
| Todo lo demás (`javascript:`, `data:`, `file:`, `vbscript:`, `//host`, `/ruta`, `C:\…`, credenciales en la URL…) | Texto, igual que la anterior, con otro motivo |

Antes de clasificar se quita lo que el navegador ignora al leer una URL (tabuladores y
saltos en cualquier posición; controles y espacios en los extremos). Las entidades las
decodifica el parser una sola vez: `java&#x73;cript:` llega como `javascript:` y se
bloquea; una entidad que sobrevive es texto literal y la URL queda como ruta relativa, sin
`href`. Dos capas: `urlTransform` vacía lo bloqueado en el pipeline y `Enlace`/`Imagen`
vuelven a clasificar.

**Imágenes.** Una remota (D7) es un marcador con su texto alternativo y un enlace para
abrirla fuera; una local se pinta si el usuario la entregó con el `.md` (§4 sexies) y si
no, un marcador que dice por qué; el resto, bloqueada. Ninguna imagen del documento puede
provocar una petición de red.

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
No crea listeners globales, observers ni workers (un test lo comprueba). Lo temporal: los
avisos de «Copiado», en documentos grandes el paso diferido de abajo, y las URL `blob:`
de las imágenes locales (§4 sexies); todo se cancela o revoca al desmontar.

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

- Imágenes: solo las locales entregadas con el documento (§4 sexies).
- Un enlace a otro fichero del documento no se abre.
- Fórmulas y diagramas: §4 septies.
- Rendimiento con documentos grandes y con muchas listas (arriba).

### 4 sexies. Recursos locales de un Markdown (Fase 7 bis)

**Principio: BPDF nunca busca ficheros en el equipo.** Un Markdown solo puede usar las
imágenes que el usuario entregó explícitamente junto con él. El navegador lo impone de
todos modos (un `File` suelto no da acceso a sus hermanos), y el diseño no intenta
esquivarlo: pide la entrega.

**Cómo se entregan.**

| Vía | API estándar | Qué recibe BPDF |
|---|---|---|
| «Abrir archivo» (ahora con selección múltiple) | `<input type="file" multiple>` | Ficheros sueltos, **solo sus nombres**: todos vienen de la misma carpeta. Uno solo se abre como siempre; varios deben ser un `.md` y sus imágenes |
| «Abrir carpeta» | `<input type="file" webkitdirectory>` (Chrome, Edge, Firefox, Safari) | Todos los ficheros con `webkitRelativePath` (`carpeta/img/a.png`); BPDF quita el primer segmento (el nombre de la carpeta) |
| Soltar ficheros | `DataTransfer.files` | Como «Abrir archivo» |
| Soltar una carpeta | `DataTransferItem.webkitGetAsEntry()` + `FileSystemDirectoryReader` (File and Directory Entries, en los cuatro) | Recorrido propio, iterativo, por lotes de `readEntries` |

Las entradas de lo soltado se capturan **dentro del evento `drop`** (`DropZone`): al
terminar, el navegador invalida `DataTransfer`. Si no hay entradas, se usan los ficheros
planos. Una carpeta soltada junto con otras cosas es un error (`mixed-drop`): no se sabría
cuál es la raíz.

**Qué se abre** (`abrirSeleccion`, [`src/documents/seleccion.ts`](../src/documents/seleccion.ts),
común a web y Electron):

- Ficheros: exactamente un `.md` y el resto imágenes admitidas. Ningún `.md`
  (`no-markdown`), varios (`several-markdown`) o un fichero de otro tipo, PDF incluido
  (`incompatible`, con su nombre), son errores claros: un documento cada vez (D16).
- Carpeta: se ignora lo que no es Markdown ni imagen, y no se entra en `.git` ni
  `node_modules`. Sin `.md`, `folder-no-markdown`; con uno, se abre; **con varios, el
  usuario elige** (panel `ElegirMarkdown` con las rutas relativas, saneadas, y
  «Cancelar»; primero los de la raíz). BPDF no adivina el principal.
- Topes: 10 000 ficheros por carpeta (`folder-too-large`) y 32 niveles de profundidad al
  recorrer lo soltado.
- Solo se **lee** el `.md` elegido. Las imágenes no se leen al abrir.

**Modelo** ([`src/documents/types.ts`](../src/documents/types.ts)): `OpenedMarkdown`
gana `resources: RecursosDocumento`:

```ts
type RecursosDocumento = {
  base: string;                              // directorio del .md en la entrega ("" o "docs")
  ficheros: ReadonlyMap<string, RecursoLocal>; // ruta relativa normalizada → recurso
  ambiguas: ReadonlySet<string>;             // rutas con más de un fichero (NFC/NFD)
};
type RecursoLocal = { ruta: string; tipo: "png" | "jpeg" | "gif" | "webp" | "svg"; size: number; blob: Blob };
```

Rutas **relativas a la entrega**, con `/`, normalizadas y en NFC: nunca una ruta de disco
(el navegador no las da, y en Electron el main no las mandará). `blob` es
`file.slice(0, size, mime)`: un trozo del propio `File`, con el tipo MIME de su extensión
(nunca el `file.type` del navegador) y **sin copiar bytes**. Un `.md` suelto lleva
`SIN_RECURSOS`. No es un sistema de ficheros: es un mapa de lo entregado.

**Resolución** (`resolverRecurso`, [`src/documents/recursos.ts`](../src/documents/recursos.ts)):
el único punto donde una referencia del documento se convierte en un fichero.

1. Se quita `?consulta` y `#fragmento`.
2. `\` se rechaza (en una URL no es separador; en Windows sí: dos lecturas posibles).
3. Los escapes `%` se decodifican **una vez** (`foto%20grande.png`; `%2e%2e` → `..`);
   un escape roto es inválido y `%252e` queda como el nombre literal `%2e`.
4. Controles, rutas absolutas (`/x`) y esquemas (`file:`, `C:`, `data:`) se rechazan.
5. Se une al directorio del `.md` y se normaliza **segmento a segmento**: un `..` que sube
   por encima de la raíz de la entrega es `fuera`. Subir dentro de ella está permitido
   (el usuario entregó la carpeta entera).
6. Solo entonces se busca, **exactamente** (mayúsculas incluidas), en el mapa.

Resultados: `ok`, `no-encontrado`, `fuera`, `no-soportado`, `demasiado-grande` (> 50 MiB),
`ambiguo` e `invalido`, cada uno con su marcador y su explicación. Nada se busca fuera
del mapa: no hay ninguna operación que pueda tocar un fichero no entregado.

**Imágenes en pantalla** ([`components/Imagen.tsx`](../src/markdown/components/Imagen.tsx)):
un `<img src="blob:…" loading="lazy" decoding="async">` con el texto alternativo del
documento. Si el navegador no puede decodificarla, marcador «no se ha podido mostrar».
Colores intactos (sin `filter`): una imagen con fondo transparente y trazo negro se verá
poco sobre la hoja oscura.

**URL de objeto** ([`src/markdown/imagenes.ts`](../src/markdown/imagenes.ts),
`AlmacenUrls`, una por visor):

- Se crean **solo para lo que se pinta**, cuando la imagen se monta: un recurso entregado
  que el texto no usa no tiene URL (medido: 50 usadas de 100 entregadas, 50 URL).
- **Una por recurso**, con recuento de usos: diez referencias a `logo.png` comparten URL.
- Se revocan con el último uso y, al desmontar el visor (cerrar o abrir otro documento),
  **todas** (`revocarTodo`). Un E2E comprueba que las del documento anterior ya no cargan.
- `createObjectURL` no copia: apunta al `Blob`. Sin Base64 ni `data:`.

**SVG.** Solo como `<img>`, nunca en línea: en una imagen el navegador no ejecuta sus
scripts ni carga sus recursos. Queda un caso: alguien podría abrir la URL `blob:` como
página (menú contextual). Ese documento **hereda la CSP de BPDF**: medido en Chromium, su
`<script>` y su `onload` no se ejecutan y sus imágenes externas se intentan pero la CSP
las corta antes de la red (`failure: csp`). No se sanea el SVG ni se rasteriza: la CSP y
el contexto de imagen bastan, y rasterizar perdería la nitidez.

**CSP.** `img-src 'self' blob:` (antes `'self'`): sin `blob:` no se puede pintar un
`File` local. Solo el propio origen crea URL `blob:` y no salen a la red. Nada de
`data:` ni `https:`: las imágenes remotas siguen bloqueadas (D7).

**Enlaces a otros ficheros** (a `otro.md` o a una imagen): siguen siendo
texto inerte, aunque el fichero esté entre lo entregado. Abrir otro documento desde un
enlace cambiaría el documento abierto sin que el usuario lo elija; queda para Electron,
dentro de la raíz del documento (SEGURIDAD §3.2).

**Rendimiento (medido).** Resolver una ruta: ~1,5 µs (100 000 en 147 ms); construir el
conjunto: ~3,4 µs por fichero (5000 en 17 ms). Con 50 imágenes de 3000×2000 elegidas junto
con 50 que no se usan: texto visible en 0,64 s, primera imagen en 0,67 s, 50 URL, heap de
JavaScript 14 MiB (los píxeles decodificados viven fuera). `npm run bench:markdown`.

**Límites conocidos.**

- «Abrir archivo» no ve subcarpetas: `images/foto.jpg` solo se resuelve abriendo la
  carpeta (el marcador lo explica). No se busca por nombre en ningún otro sitio.
- Mayúsculas exactas: `Logo.PNG` no es `logo.png`, como en la web.
- Chrome pide confirmación al elegir una carpeta («¿subir N archivos?»): es su texto
  genérico; BPDF no sube nada. Una carpeta vacía elegida se trata como cancelar (el
  navegador no avisa).
- Soltar una carpeta no se puede probar en Playwright (no simula entradas de carpeta): lo
  cubren tests unitarios con entradas simuladas; elegir carpeta sí tiene E2E.

### 4 septies. Fórmulas y diagramas (Fase 8)

**Sintaxis admitida.**

| Markdown | Qué es | Lo pinta |
|---|---|---|
| `$…$` | Fórmula en línea | KaTeX |
| `$$…$$` (en su propio bloque) y ```` ```math ```` | Fórmula en bloque | KaTeX |
| ```` ```mermaid ```` | Diagrama (flowchart, secuencia, clases, estados, Gantt… lo que dibuje Mermaid 11) | Mermaid, en el marco aislado |
| `\$` | Un dólar literal (para precios: `\$5`) | — |

`remark-math` añade la sintaxis al pipeline (con `$…$` como en GitHub: un texto con dos
dólares sin escapar, como «$5 y $10», se lee como fórmula). No añade elementos: produce
`<code>` y `<pre>` con clases propias, y `Preformateado` y `CodigoEnLinea`
([`components/Preformateado.tsx`](../src/markdown/components/Preformateado.tsx)) deciden
si un bloque es código, fórmula o diagrama.

**KaTeX** ([`matematicas.ts`](../src/markdown/matematicas.ts),
[`components/Formula.tsx`](../src/markdown/components/Formula.tsx)):

- **A demanda**: KaTeX y su CSS se importan con la primera fórmula; las fuentes woff2 las
  pide su CSS al propio origen, solo las que se usan.
- **Sin HTML**: ni `renderToString` ni `rehype-katex`. BPDF pide a KaTeX su árbol
  (`__renderToDomTree`) y lo convierte en nodos con el `toNode()` de KaTeX
  (`createElement`, `setAttribute`, estilos por CSSOM). KaTeX pinta en un nodo que React no
  gestiona; el texto de reserva es un hermano que sí gestiona.
- **Opciones**: `trust: false` (`\href`, `\url`, `\includegraphics`, `\htmlClass`,
  `\htmlId`, `\htmlStyle`, `\htmlData` se pintan como texto rojo, sin enlace ni atributo),
  `maxExpand: 1000` (una macro recursiva o exponencial se corta), `maxSize: 20` em,
  `macros` nuevo en cada fórmula (un `\gdef` no pasa a otra), `strict: "ignore"` (sin avisos
  en consola), `throwOnError: true`, salida HTML + MathML (la MathML, oculta, para lectores
  de pantalla), fórmulas de hasta 10 000 caracteres.
- **Estilos por atributo**: la flecha de `\vec`, los óvalos de `\oiint`/`\oiiint` y `\pmb`
  ponen `style` con `setAttribute`, que la CSP bloquea. Se quita del árbol antes de crear
  los nodos; `markdown.css` suple el ancho.
- **Si falla** (sintaxis, límites): se ve el código de la fórmula, subrayado, con el aviso
  «Fórmula no válida» (información emergente y texto para lectores de pantalla). El resto
  del documento sigue.

**Mermaid: un marco aislado.** Mermaid dibuja con `<style>` y atributos `style` en línea (y
mide el texto en un documento vivo): con la CSP de la app (`style-src 'self'`) eran 250
violaciones en cinco diagramas. En vez de relajar la CSP de la app, Mermaid corre en otra
página (decisión confirmada al empezar la fase):

```text
app ── postMessage(fuente, colores) ──► iframe sandbox="allow-scripts" (/mermaid.html)
 ▲                                        origen opaco · su propia CSP · Mermaid strict
 │                                        sanearSvg (DOM, lista blanca)
 └──── postMessage(svg) ◄─────────────────┘
verificarSvg (texto, lista blanca) → Blob image/svg+xml → <img src="blob:…">
```

- **El marco** ([`marco-mermaid.ts`](../src/markdown/marco-mermaid.ts), `mermaid.html`):
  `sandbox="allow-scripts"` sin `allow-same-origin`, así que su origen es opaco: no puede
  leer el DOM, el almacenamiento ni las cookies de BPDF (E2E). Su CSP
  (`CSP_MARCO_MERMAID`) permite estilos en línea y **nada de red** (`connect-src`,
  `img-src`, `font-src` a `'none'`). Si su origen no es opaco (abierta directamente o
  enmarcada por otra web sin sandbox) no escucha nada. Solo atiende a su padre y solo
  peticiones bien formadas; dibuja de una en una.
- **La configuración**
  ([`mermaid-config.ts`](../src/markdown/mermaid-config.ts)): `securityLevel: "strict"`
  (HTML de las etiquetas escapado, `click` desactivado, DOMPurify), `htmlLabels: false`
  (texto SVG, sin `<foreignObject>`), `maxTextSize` 50 000 y `maxEdges` 500,
  `suppressErrorRendering`, ids deterministas, tema con los tokens de BPDF, y `secure` con
  todo lo que un `%%{init}%%` podría usar para relajar algo (`securityLevel`, `htmlLabels`,
  `flowchart`, `themeCSS`, `themeVariables`, `dompurifyConfig`, topes…).
- **Nodos con imagen** (`A@{ img: "…" }`): Mermaid carga la imagen para medirla. La CSP del
  marco lo impediría, pero BPDF no lo deja intentar: esos diagramas no se dibujan (aviso
  «usa imágenes»).
- **El SVG, dos veces**: en el marco, `sanearSvg` (DOM: solo elementos de dibujo de una
  lista blanca; fuera `script`, `foreignObject`, `image`, `iframe`, `animate`, `set`;
  enlaces desenvueltos; sin `on*`, `href` solo a `#id`, sin `javascript:`, `data:`,
  `@import` ni `url()` externas; tamaño fijado desde el `viewBox`). En la app,
  `verificarSvg` ([`svg-seguro.ts`](../src/markdown/svg-seguro.ts)), **sin DOM** (un
  `DOMParser` en la app heredaría su CSP y cada `style` sería una violación): recorre el XML
  y rechaza entero lo que se salga de la lista blanca, incluidos comentarios, CDATA y
  DOCTYPE. La app no se fía del marco.
- **La imagen**: `<img src="blob:…">` con texto alternativo («Diagrama Mermaid
  (flowchart)») y el código en un desplegable. En una imagen el SVG no ejecuta nada ni pide
  nada; abierta como página, la URL `blob:` hereda la CSP de la app.
- **A demanda y en pantalla**: el marco (y con él Mermaid) se crea con el primer diagrama,
  y cada diagrama se dibuja al acercarse a la vista (`IntersectionObserver` por bloque,
  400 px de margen, desconectado al primer cruce). Un documento sin diagramas no crea
  nada.
- **Ciclo de vida**: un marco por visor; al cerrar u abrir otro documento se quita el
  iframe y su listener y se rechaza lo pendiente. Cada imagen revoca su URL al desmontarse.
  Un diagrama que tarde más de 20 s se da por fallido.
- **Si falla**: se ve el código del diagrama con un aviso (sintaxis no válida, demasiado
  grande, usa imágenes). Los `click`/`callback` y los `link` de clases hacen que Mermaid
  rechace el diagrama en modo `strict`: se ve su código.

**CSP.** La app gana solo `frame-src 'self'`. `mermaid.html` tiene su política
(`style-src 'self' 'unsafe-inline'`, sin red, `frame-ancestors 'self'`) en cabecera y en
`<meta>`. `vite preview` manda las cabeceras por ruta (`cabecerasPara`); `/assets/` lleva
`Access-Control-Allow-Origin: *` porque el marco pide sus módulos desde un origen opaco.
Nada de `unsafe-eval`, `data:` ni orígenes externos en ninguna de las dos.

**Rendimiento (medido, `npm run bench:markdown`).**

Chromium de Playwright, Ryzen 7 5800X. Tiempos desde elegir el fichero:

| Documento | Texto | Fórmulas pintadas | Diagramas pintados | Trozos KaTeX/Mermaid pedidos |
|---|---|---|---|---|
| Normal, sin fórmulas ni diagramas (`basico.md`) | 0,38 s | — | — | 0 |
| 10 × 3 fórmulas | 0,36 s | 0,42 s | — | 4 (KaTeX, su CSS, 2 fuentes) |
| 500 × 3 fórmulas | 1,75 s | 2,39 s | — | 4 |
| 3 diagramas | 0,82 s | — | 0,83 s | 15 (marco y Mermaid) |
| 30 diagramas | 0,35 s | — | 2,19 s | 15 |
| 1 MB mixto + 600 fórmulas + 10 diagramas | 3,83 s | 5,57 s | 25 s* | 19 |
| `katex-hostil.md` | 0,83 s | 0,83 s | — | 4 |
| `mermaid-hostil.md` | 0,34 s | — | 0,72 s | 17 |

\* Los diagramas del documento grande están al final de más de un millón de píxeles: el
benchmark salta a cada uno, y ese tiempo es sobre todo el recorrido. Dibujar cuesta
~60 ms por diagrama (30 en 1,9 s) y no bloquea el texto: los diagramas se dibujan de uno
en uno, al entrar en pantalla, en el marco. Un Markdown sin fórmulas ni diagramas tarda
lo mismo que antes de la Fase 8 (0,36–0,38 s el pequeño; 3,75 s 1 MB, dentro del rango de
3,3–7,3 s de la Fase 7). La memoria no se pudo medir con precisión: `performance.memory`
de Chrome está cuantizado y da siempre ~10 MiB de heap de JavaScript.

**Límites conocidos.**

- `$…$` con dos dólares en un párrafo es una fórmula: los precios se escriben `\$5`.
- Diagramas con nodos de imagen o con `click`/`link`: no se dibujan (se ve su código).
- Mermaid dentro de un iframe fuera de la vista: el primer diagrama tarda lo que tarda en
  cargarse el marco.
- Un segundo KaTeX (0.16, el de Mermaid) está en la build; solo se cargaría, en el marco,
  si una etiqueta de diagrama usa `$$…$$`.

### 4 octies. El editor de Markdown (Fase 9)

Editar un Markdown con vista previa y guardarlo en local. **D9: CodeMirror 6.** Tres modos
en la barra del lector (`ModeSwitch`): **Lectura** (el lector de siempre), **Edición** (solo
el editor) y **Dividido** (editor y vista previa, `SplitView`).

| Pieza | Dónde | Qué hace |
|---|---|---|
| Editor | [`src/editor/EditorMarkdown.tsx`](../src/editor/EditorMarkdown.tsx) | CodeMirror 6 con la gramática Markdown (GFM), historial, teclado e indentación. Trozo propio, a demanda |
| Contrato | [`src/editor/tipos.ts`](../src/editor/tipos.ts) | `ManejadorEditor` y `EstadoGuardado`, sin tipos de CodeMirror: quien los importa no arrastra el editor |
| Modos y paneles | `ModeSwitch.tsx`, `SplitView.tsx` | Botones con `aria-pressed`; separador «window splitter» (teclado, 20–80 %) |
| Sincronía | [`src/editor/sincronia.ts`](../src/editor/sincronia.ts) | Desplazamiento emparejado por encabezados (funciones puras + gancho) |
| Orquestación | [`src/markdown/MarkdownView.tsx`](../src/markdown/MarkdownView.tsx) | Modo, vista previa, cambios, guardar, pausa |
| Cambios y confirmación | [`DocumentProvider`](../src/documents/DocumentProvider.tsx), [`ConfirmarDescarte`](../src/app/ConfirmarDescarte.tsx) | `modified`, confirmar antes de sustituir o cerrar, `beforeunload` |
| Guardar | `Platform.saveText`, [`src/platform/guardar-web.ts`](../src/platform/guardar-web.ts) | `showSaveFilePicker` o descarga |

**Carga y montaje.** Leer no descarga el editor: `React.lazy` al entrar por primera vez en
Edición o Dividido. Desde entonces se queda montado (oculto en Lectura). Una sola
estructura para los tres modos (`SplitView` con `mostrar`): Lectura ↔ Dividido comparten
la vista previa sin volver a montarla (pintar 1 MB cuesta segundos). En **Edición la vista
previa no está montada**: oculta pero montada, con 1 MB + KaTeX teclear tenía picos de casi
1 s (medido; probablemente la recolección de basura sobre un árbol enorme); volver a
Lectura o Dividido la pinta otra vez. Editor y vista previa llevan `contain: strict`: lo
que pasa en uno no obliga a maquetar ni pintar el otro. **No evita el hit test** (medido,
iteración 15): tras cada tecla, Chrome repite el del ratón y recorre la vista previa
entera, esté el puntero donde esté. Por eso los bloques con fórmulas llevan además
`content-visibility: auto` (markdown.css; ver «Rendimiento»).

**CSP: el editor vive en un Shadow DOM.** CodeMirror inyecta sus estilos con `style-mod`:
con el `document` como raíz, en una etiqueta `<style>` que `style-src 'self'` bloquea; con un
`ShadowRoot`, en hojas construibles (`adoptedStyleSheets`), que no son estilos en línea. Sus
atributos `style` van por CSSOM. **Escribir encima de una selección** lo aplica el propio
CodeMirror (`beforeinput` interceptado): la edición nativa de Chrome, al sustituir texto
seleccionado, creaba `<span style="…">` y la CSP los bloqueaba (dos violaciones por
pulsación, medido); teclear normal, borrar, Intro, pegar y soltar ya los resolvía
CodeMirror sin tocar el navegador. Resultado: **la CSP no cambia** (E2E: cabecera idéntica,
cero violaciones, ninguna `<style>`, escribir y pegar sobre una selección). Los tokens de
color son propiedades personalizadas, que cruzan la frontera del Shadow DOM: el tema del
editor los usa.

**El texto.** Vive en el `EditorState` de CodeMirror (una cuerda: teclear no copia el
documento). Cada tecla hace O(1) fuera del editor: marca «modificado» la primera vez y
reprograma la vista previa. El texto se saca del editor (O(tamaño)) solo al refrescar la
vista previa, al guardar y al cambiar de modo. `documento` no cambia: sus `resources`
(`base`, `ficheros`, `ambiguas`) son los que se entregaron al abrir.

**Vista previa.** Es el mismo lector (`Contenido`: mismo pipeline, política de URL,
recursos, KaTeX, Mermaid, índice) con el texto editado. En Dividido se refresca **200 ms
después de la última tecla**, nunca en cada una. Pintar la vista previa bloquea el hilo
principal (el lector: segundos por MB, §4 quinquies), así que **si pintar la de ese
documento costó más de 250 ms** (medido en cada refresco, y al abrir en los documentos que
se pintan en diferido, > 100 KB: en uno pequeño, el primer pintado de la página incluye el
arranque en frío y daría una pausa falsa), en Dividido deja de refrescarse
sola: avisa («Vista previa en pausa…») y se actualiza con su botón o al cambiar de modo.
Decisión del usuario en la Fase 9, con estas cifras: con 1 MB, cada refresco bloqueaba
1,4–3,4 s y una tecla en ese momento esperaba hasta 2,4 s. Con documentos normales, 200 ms
como siempre.

- **Diagramas:** `MarcoMermaid` recuerda los SVG ya dibujados por fuente y colores (64, los
  más recientes; solo los que salieron bien): al refrescar, un diagrama sin cambios no
  vuelve al marco. Los que se añaden o cambian, sí, con las mismas garantías de la Fase 8.
- **Fórmulas:** las mismas de la Fase 8 (KaTeX a demanda, mismas opciones).
- **Recursos:** los entregados al abrir. Editar no da acceso a nada más: una ruta nueva que
  no se entregó es «imagen local no incluida», y `../fuera.png` sigue fuera
  (`resolverRecurso`, sin cambios).

**Sincronía del desplazamiento (Dividido).** Por encabezados: el i-ésimo del texto
(`encabezadosFuente`, ATX y setext, fuera de código con valla y de fórmulas `$$`) con el
i-ésimo de la vista previa (sin el título oculto de las notas al pie); entre dos, se
interpola. Si los dos lados no coinciden (un caso raro de CommonMark), se emparejan los que
hay y se descarta la pareja que no avance: la correspondencia es siempre creciente. **Sin
bucles:** manda el panel con el que el usuario interactúa (puntero encima, foco dentro,
rueda); el desplazamiento que BPDF provoca en el otro no se reenvía. Las posiciones de los
encabezados se miden solo cuando cambian el texto, el alto o el ancho (medirlas en cada
fotograma bloqueaba con 1 MB de encabezados).

**Cambios sin guardar.** El primer cambio marca `modified` en `DocumentProvider` («Sin
guardar» en la barra). Cualquier sustitución (selector, carpeta, soltar, elegir el Markdown
de una carpeta) y cerrar piden confirmación (`ConfirmarDescarte`, `<dialog>` modal, foco en
«Seguir editando», Esc = seguir) **después de leer y validar lo nuevo y antes de aplicarlo**:
cancelar el selector o elegir algo que no vale no pregunta ni toca el documento abierto.
Con cambios, `beforeunload` avisa al cerrar o recargar la pestaña (el texto es del
navegador). Nada se guarda por su cuenta: ni autoguardado ni borradores (PLAN §8).

**Guardar** (`Ctrl/⌘+S` o el botón; no con un diálogo modal abierto). `Platform.saveText`:

- Con `showSaveFilePicker` (Chromium): la primera vez el usuario elige el destino; las
  siguientes, mientras siga abierto ese documento, se escribe ahí. El `FileSystemFileHandle`
  vive en memoria (solo el del documento actual) y se olvida si escribir falla.
- Sin él: una descarga (`<a download>` con una URL `blob:` propia, revocada a los 30 s).
- **Nunca se sobrescribe en silencio el fichero abierto**: en web BPDF no tiene acceso a él.
- Guardado o descargado → limpio (salvo que se escribiera mientras se guardaba); cancelado →
  sigue igual; error → aviso (`role="alert"`) y sigue modificado.

**Accesibilidad.** El editor es un `textbox` con nombre («Texto Markdown. Esc y después Tab
para salir del editor»: Tab indenta). El modo se ve y se anuncia (`aria-pressed`, grupo con
nombre). El separador es enfocable, con valor y límites. El diálogo de descarte es modal y
devuelve el foco. jest-axe en todo lo nuevo.

**Rendimiento** (`npm run bench:editor`, *2026-10-02*, iteración 15; Ryzen 7 5800X,
Chromium headless, 1400×900, build de producción, sin la traza de Playwright; Event Timing
API: duración de cada evento de teclado, de la tecla al pintado, solo los de 16 ms o más;
22 teclas a 50 ms, 5 teclas con pausas de 400 ms, deshacer y rehacer, al principio, en medio
y al final; dos ejecuciones). «Lentos» = eventos de 50 ms o más por zona:

| Caso | Edición: mediana · máx. · lentos | Dividido: mediana · máx. · lentos |
|---|---|---|
| 2 KB | 16 · 16–24 ms · 0 | 16 · 16–24 ms · 0 |
| 200 KB | 16–24 · 16–24 ms · 0 | 16 · 24–32 ms · 0 (vista previa en pausa) |
| 1 MB | 16 · 16–32 ms · 0 | 16 · 24–72 ms · 0–28 (en pausa) |
| 1 MB + KaTeX | 16 · 16–104 ms · 0–1 | **48 · 104–344 ms · 10–75** (en pausa) |
| 1 MB + Mermaid | 16–32 · 16–32 ms · 0 | 16–24 · 24–72 ms · 0–20 (en pausa) |
| 1 MB de encabezados | 16–32 · 16–64 ms · 0–3 | 24–32 · 40–112 ms · 0–20 (en pausa) |

**Resultado: el criterio «1 MB sin retraso perceptible» se cumple en Edición y NO en
Dividido con KaTeX.** Por eso la Fase 9 sigue abierta y no aprobada. Las cifras de la
iteración 14 (1 MB en Dividido: máx. 224–256 ms; KaTeX: 784–1104 ms) estaban infladas por
la traza de Playwright: aunque solo se guarde si algo falla, se graba siempre, y su
instantánea del DOM en cada acción bloqueaba el hilo principal (~0,9 s con 1 MB, ~3,9 s
con KaTeX; trazas de Chromium). El bench va ahora sin ella (`playwright.bench.config.ts`).

**Bloques con fórmulas: `content-visibility: auto`** (markdown.css). En Dividido, con
1 MB + KaTeX, la traza mostraba que cada tecla pagaba un hit test de ~40 ms. Chrome lo
repite tras cada cambio de maquetación para actualizar el *hover*, y recorre la vista
previa: 282 000 nodos, 45 000 posicionados por KaTeX. Si los bloques con fórmulas fuera de
la vista se saltan, baja a ~30 ms. **No en todos los bloques:** con 1 MB de encabezados
(56 000 bloques), el IntersectionObserver interno de `content-visibility` costaba ~37 ms
dos veces por fotograma (medido; Dividido pasó a máx. 168–608 ms). Efectos:

- Un bloque con fórmulas aún no pintado mide 4rem hasta pintarse; los pintados recuerdan su
  altura. El índice, los enlaces internos y la sincronía llegan igual (E2E).
- Su contención de pintado recortaría lo que sale del bloque. `overflow-clip-margin` deja
  ver entero el contorno de foco desplazado 2px (E2E, comparando píxeles).
- Leer estilo o posición de algo DENTRO de un bloque saltado obliga a calcularlo. Medido
  con todos los bloques saltados: `getComputedStyle` de 90 000 nodos, 8 s en vez de 41 ms.
  Ningún encabezado de primer nivel queda dentro de uno, así que la sincronía no lo paga.

Lo que queda en KaTeX en Dividido, según la traza:

- Un hit test de ~30 ms por tecla: los bloques sin fórmulas siguen pintados.
- Una vez por segundo, los detectores de anuncios de Chromium y un Commit (~100 ms).
- Un primer fotograma de ~270 ms tras saltar al final del documento (PrePaint).

**Límites conocidos.**

- En Dividido, un documento grande tiene la vista previa en pausa (arriba): se ve al día al
  pulsar «Actualizar» o al volver a Lectura, que bloquea lo que cueste pintarlo una vez.
- La búsqueda del navegador (`Ctrl+F`) no encuentra el texto del editor que está fuera de la
  pantalla (CodeMirror solo pinta lo visible) y el editor no trae búsqueda propia (el paquete
  `@codemirror/search` no se incluyó).
- Guardar en web siempre pide destino la primera vez de cada documento (el navegador no da
  acceso al fichero abierto). Firefox y Safari no tienen `showSaveFilePicker`: descargan.
- Probado en Chromium. El Shadow DOM con hojas construibles funciona en Firefox y Safari
  16.4+, pero no se ha comprobado.

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
