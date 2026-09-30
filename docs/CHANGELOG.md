# Bitácora

Registro de iteraciones para quien mantiene el código: **qué** cambió, **por qué**, qué
se descartó y qué salió mal por el camino. Convención en [`CLAUDE.md`](../CLAUDE.md) §7.
Las entradas nuevas van arriba. Los números de iteración solo tienen que ser únicos:
nunca se renumeran.

La historia de la plantilla de la que nace BPDF está en la bitácora del repositorio de
R3ZON SaaS Template.

---

### Iteración 8 — *2026-09-30* — Fase 7: lector de Markdown

Primera versión que **lee** un Markdown: GFM con `react-markdown` + `remark-gfm`, resaltado
y copia de código, índice y una política de URLs propia. El encargo la llamó «Fase 6»; en
el plan es la 7 (la 6 es el resto del visor PDF) y se registra como tal. D6 (HTML) y D7
(imágenes remotas) se dan por confirmadas con el encargo, que pedía exactamente lo
recomendado. Diseño completo en [ARCHITECTURE.md](ARCHITECTURE.md) §4 quinquies; aquí, el
porqué y lo que salió mal.

**Qué se hizo y por qué**

- **Todo lo que toca la seguridad, en un sitio** (`src/markdown/pipeline.ts`): plugins,
  `urlTransform`, lista blanca de elementos y prefijo de ids. El corpus de XSS comprueba
  la configuración además del DOM, para que añadir `rehype-raw` o cambiar el
  `urlTransform` rompa un test y no pase en una revisión.
- **Dos capas para las URLs**: el `urlTransform` vacía lo bloqueado en el pipeline y
  `Enlace`/`Imagen` vuelven a clasificar. Solo dos tipos llegan a un `href` (externas
  validadas y `#md-…`), y los dos los construye BPDF. La clasificación trabaja sobre lo
  que el navegador entendería (sin tabuladores ni saltos, sin controles en los extremos)
  y **no vuelve a decodificar entidades**: micromark ya lo hizo una vez, y decodificar dos
  veces cambiaría el significado (`&amp;#x73;`).
- **Enlaces externos por `Platform.openExternal`**, igual que en el PDF (clic
  interceptado, central anulado). `target="_blank"` y `rel="noopener noreferrer"` quedan
  como red. En Electron no habrá que tocar el visor.
- **HTML crudo como texto** y no ignorado: el encargo aceptaba las dos, y verlo dice a
  quien lee que el documento traía algo. Los **comentarios sí se quitan**: al probar
  README reales, un `<!-- nota para quien mantiene -->` aparecía como primer párrafo.
  Pendiente de visto bueno (TAREAS).
- **Ninguna imagen se carga** (aplazadas las locales, lo permitía el encargo). En web un
  `File` suelto no da acceso a sus hermanos; resolverlo es abrir varios ficheros o una
  carpeta, que cambia la apertura, la plataforma y la CSP (`img-src blob:`). Mejor una
  tarea propia que media solución. Sin `<img>` en el DOM, ninguna imagen puede provocar
  una petición.
- **Resaltado con `lowlight` directamente**, sin `rehype-highlight`: el plugin importa
  el paquete `common` (~37 gramáticas) aunque se le pasen otras, y en un plugin de rehype
  el texto original del bloque se pierde (el botón de copiar tendría que reconstruirlo).
  `BloqueCodigo` lee el código del árbol, lo resalta con 9 gramáticas y convierte el
  resultado a React con lista blanca. `lowlight` declara `sideEffects: false`: el
  empaquetador descarta `common` (comprobado en el bundle).
- **Índice leído del DOM ya pintado**, no de un segundo parseo: con un plugin de remark
  que escribiera las entradas fuera, el orden de render decidiría si el índice se ve
  vacío; parsear dos veces duplica el coste. Leer los `h1`–`h6` con id `md-` en un
  `useLayoutEffect` enlaza exactamente lo que se ve.
- **Contexto para las acciones** (abrir fuera, ir a una sección): el mapa de componentes
  es un módulo fijo y `Contenido` es `memo` sobre el texto. Si los componentes recibieran
  callbacks por props, cada repintado del visor volvería a parsear el documento.
- **Tokens nuevos** `--rgb-link` (el acento da 4,4:1 sobre la hoja: no llega) y
  `--rgb-code-*`, con su contraste en `tokens.test.ts`.
- **Retirada `DocumentSummary`** (la vista provisional de la Fase 3) y sus textos.
- **Sin cambios en la CSP ni en las cabeceras.** `clipboard-write` ya vale `self` por
  defecto; negar `clipboard-read` endurecería, pero se deja para la F12 en vez de tocar
  cabeceras sin necesidad.

**Rendimiento (medido, no supuesto)**

`npm run bench:markdown` (nuevo) y un perfil de CPU de Chromium con la build sin
minificar. En el mismo Ryzen 7 5800X: 1 KB en 0,33 s, 100 KB en 0,5–0,9 s, **1 MB en
3,3–7,3 s**. El criterio de la fase (< 1 s con 1 MB) **no se cumple**, y no por un error
arreglable: en Node el pipeline es lineal (~2 s/MB) y el perfil reparte el tiempo entre
micromark, el paso a árbol, React creando ~72 000 elementos y la primera maquetación.
Bajar de 1 s pide parsear en un worker o pintar por partes, un cambio de arquitectura que
no se hace sin preguntar: queda para la F13. Lo necesario sí se hizo: por encima de
100 KB se pinta primero la barra y «Preparando el documento…» (sin eso, la pantalla
anterior se quedaba congelada sin señal). No se virtualiza: no hacía falta para
5000 encabezados (0,6–1,0 s) ni para 2000 bloques de código (0,8–1,1 s).

**Encontrado al medir: las listas son cuadráticas.** El primer E2E de 1 MB no terminaba en
30 s. Midiendo construcción a construcción, solo las listas crecían de forma cuadrática, y
no en micromark (lineal) sino en `mdast-util-from-markdown` 2.0.3, la última publicada:
`prepareList` inserta cada elemento con `Array#splice` en el array de eventos del
documento entero. No se parchea la dependencia; queda en TAREAS con opciones, porque un
documento hecho a propósito bajo el límite de 20 MiB bloquea la pestaña.

**Errores propios por el camino**

- `Encabezado` descartaba todo id sin prefijo `md-`, también `footnote-label`, el que
  remark-rehype pone al título de las notas y que citan las llamadas en
  `aria-describedby`. Lo destapó un test de GFM; ahora ese id fijo pasa.
- En los fixtures, `## __proto__` es «proto» en negrita, no el texto `__proto__`: el caso
  de DOM clobbering no probaba lo que decía. Ahora escapado.
- La «tabla ancha» de `gfm.md` no desbordaba: el texto largo llevaba guiones y el
  navegador corta ahí. El CSS era correcto (celdas sin partir palabras); el fixture no.
- El generador del corpus de XSS nació en una carpeta temporal; se movió al repo
  (`tests/fixtures/markdown/xss/generar.mjs`) con un test que compara, como los de PDF.

**Descartado**

- `rehype-highlight` y `shiki` (arriba y [STACK.md](STACK.md)); un resaltador propio
  (peor calidad y más código procesando contenido hostil); `github-slugger` (16 KB para 20
  líneas).
- Resaltar en el índice la sección visible: un `IntersectionObserver` por poco valor; el
  encargo pedía un índice sencillo.
- Parsear en un worker y virtualizar ya: cambios de arquitectura sin decidir (arriba).

**Verificación.** Desde `npm ci`: lint, typecheck, 546 tests (34 ficheros), build,
`build:tamano` (arranque 86,4 KB gzip; el lector, 70 KB a demanda), 54 E2E, `npm audit`
(0), `docs:validar` y `docs:enlaces` (203 enlaces), todo en verde. `curl -I` contra la
build servida: la CSP y las cabeceras llegan también al trozo del lector. Probado además
con 14 Markdown reales (los de `docs/` y README de paquetes): sin errores de consola,
violaciones de CSP, peticiones externas, `img` ni `href` fuera de la política. Capturas
revisadas a 1280 y 390 px de ancho.

**Para quien usa BPDF** (anuncio, CLAUDE.md §8): los Markdown ya se leen, con índice,
código resaltado que se puede copiar y enlaces que se abren en otra pestaña; el HTML que
traiga un Markdown se ve como texto y sus imágenes todavía no se muestran.

---

### Iteración 7 — *2026-09-30* — Fase 5: visor PDF funcional

Primera versión que **lee** un PDF: visor propio sobre las APIs núcleo de pdf.js (D17)
con la build `legacy` (D18), las dos confirmadas al empezar. Reutiliza sin cambios de
algoritmo el modo oscuro de la Fase 4, ahora en un Web Worker. El diseño completo está en
[ARCHITECTURE.md](ARCHITECTURE.md) §4 quater; aquí, el porqué de cada decisión y lo que
salió mal.

**Qué se hizo y por qué**

- **Tres capas** (módulos puros → controladores sin React → interfaz). Lo que más falla en
  un visor (qué páginas viven, qué se cancela, qué llega tarde de un documento anterior)
  queda fuera de React y se prueba sin montar nada; la interfaz solo dice qué marcos hay.
- **Render en un lienzo nuevo, oscurecido y después sustituido**: sin páginas a medio
  pintar ni destellos blancos en oscuro. Cada `pintar()` abre una generación y todo lo que
  llega de otra se descarta; como mucho 2 renders a la vez, contando **superficies** (un
  render sustituido no ocupa hueco: lo destapó un test, ver errores).
- **Virtualización propia** (búsqueda binaria sobre los bordes de las páginas; visibles
  ±1) y **presupuesto de 160 MiB** para las vecinas. El presupuesto nació de medir: a zoom
  500 % los cuatro lienzos vivos sumaban 256 MiB.
- **Resolución física separada del tamaño CSS**: DPR ≤ 2 y ≤ 16,7 Mpx por lienzo (a partir
  de ahí se baja la resolución, no se gasta más memoria).
- **Worker del modo oscuro, medido antes de decidir** (`npm run bench:pdf`, Chromium de
  Playwright, Ryzen 7 5800X). Hilo principal bloqueado, sin worker → con worker:

  | Lienzo | Sin worker | Con worker |
  |---|---|---|
  | 2,2 Mpx (A4 a lo ancho, DPR 1) | 18–28 ms | 9–13 ms |
  | 3,6 Mpx (200 %, DPR 1) | 28–34 ms | 15–18 ms |
  | 8,8 Mpx (A4 a lo ancho, DPR 2) | 70–88 ms | 30–39 ms |
  | 14,2 Mpx (400 % DPR 1 · 200 % DPR 2) | 98–120 ms | 50–54 ms |
  | 16,8 Mpx (tope) | 113–141 ms | 60–66 ms |

  Con worker, lo que queda en el hilo principal es leer y escribir las franjas
  (~3,5 ms/Mpx), en bloques de una franja; la latencia total de la primera página sube
  algo (el worker arranca) y la de las siguientes queda igual o mejor. Se eligió un worker
  y no WebGL: mismo código probado, sin GPU ni contexto que perder, sin dependencias. Si
  no hay worker o falla, el mismo código corre en el hilo principal.
- **Capa de texto con `TextLayer`** reconstruida en cada render (más simple que
  `update()` y barata frente al render) y con su tamaño en píxeles: pdf.js lo escribe con
  `round()` de CSS, que Chrome 111 no tiene.
- **Enlaces sin `AnnotationLayer`**: `getAnnotations()` + una política propia (solo
  `http:`, `https:`, `mailto:` y destinos internos) + `<a>` transparentes cuyo clic nunca
  navega la app. La política de URLs vive en `src/lib/url-externa.ts` para que la use
  también Markdown (Fase 7) y la plataforma la revalida.
- **`Platform.openExternal`** (web: `window.open(url, "_blank", "noopener,noreferrer")`),
  primer uso de la plataforma desde un visor.
- **Búsqueda propia** sobre `getTextContent` con NFKD, sin tildes, minúsculas y fin de línea
  como espacio; el índice guarda de qué trozo sale cada carácter para resaltar con `<mark>`
  en la capa de texto.
- **Miniaturas, búsqueda y atajos** se adelantaron de la Fase 6 (los pedía el alcance);
  la Fase 6 queda replanteada en FASES.md.
- **El visor se carga a demanda** (`React.lazy`): el arranque pasa de 84,2 a 85,5 KB gzip.
- **Ajustes con el tamaño típico** (mediana) en la vista continua: con el de la página
  actual, un documento con una página apaisada cambiaba de zoom al pasar por ella (se vio
  en un PDF real).
- **Laboratorio de la Fase 4 borrado** (`spike.html`, `src/pdf-spike/`, `messages.pdfSpike`,
  su E2E y su test de componentes, y los modos de referencia «invertido» y «heurística» de
  `aplicar.ts`). Sus aserciones de píxeles pasaron al E2E del visor; el benchmark mide
  ahora el visor. Nada del laboratorio tenía que pasar al visor salvo la lectura de los
  tokens de color (`src/app/pdf/colores.ts`).
- **`r3zon-template.json`**: estaba borrado (y commiteado) para no publicar la plantilla,
  pero CLAUDE.md §11 y TEMPLATE.md lo seguían enlazando (`docs:enlaces` en rojo). Se
  reescribieron esas referencias: el origen queda registrado en TEMPLATE.md.

**Hallazgo de seguridad/privacidad corregido: `connect-src 'self'`.** Con la CSP de
producción, el texto de fuentes CID no incrustadas (japonés, chino, coreano)
**desaparecía en silencio**: pdf.js pide sus cmaps con `fetch` desde su worker, el worker
recibe la CSP con su script (`connect-src` cae en `default-src 'none'`) y la violación no
llega al documento, así que la vigilancia de los E2E no la veía. La Fase 4 lo había dado
por innecesario porque ningún fixture tenía texto CJK. Se reprodujo con un fixture nuevo
(`cjk.pdf`: el E2E fallaba), se añadió `connect-src 'self'` con su motivo en
`security-headers.ts` (solo el propio origen; nada `unsafe-*` ni externo) y se comprobó con
`curl -I` que la cabecera llega también al worker. Se intentó que la vigilancia lo
detectara escuchando la consola de los workers: Chromium no pasa esas violaciones a esa
consola, así que la garantía es el E2E funcional (documentado en `vigilancia.ts`).

**PDF reales** (§28 del encargo; descargados o generados en el scratchpad, sin subir nada
a ningún servicio): el paper de TraceMonkey (gráficas vectoriales, 14 págs.), «Attention Is
All You Need» de arXiv (figuras raster, tablas, 15 págs., enlaces internos y externos), el
formulario W-4 del IRS (formulario denso), dos del corpus de pdf.js (transparencias de
TCPDF; un paper con logos), y cuatro generados con Chromium (documento de empresa con logo,
tabla, gráfico de barras y foto; manual de 41 páginas con índice enlazado; escaneo raster
sin texto; diapositivas oscuras 16:9). Todos abren en < 0,9 s, sin errores de consola, sin
violaciones de CSP y sin peticiones externas; texto, enlaces y búsqueda funcionan. Modo
oscuro: texto, formularios, tablas, gráficos vectoriales, fotos y transparencias bien; las
diapositivas oscuras no se tocan. Límites vistos (ARCHITECTURE §4 quater): un diagrama
raster con fondo blanco queda como recuadro blanco; una banda de color con texto blanco se
aclara y el texto pasa a oscuro; los pasteles se oscurecen y pierden diferencia; el escaneo
conserva un tono cálido. No se pudo probar uno de ofimática (no hay LibreOffice): TAREAS.

**300 páginas**: primera página en ~0,9 s; en el recorrido rápido nunca más de 4 lienzos
(≤ 34 MiB a DPR 1); heap JS ~58–61 MiB al terminar.

**Descartado**

- `PDFViewer`, `PDFLinkService`, `PDFFindController` y `AnnotationLayer` (D17 y la política
  de enlaces propia). Una librería de virtualización (son 60 líneas puras y probadas).
- WebGL para el modo oscuro (ver arriba).
- La CSS Custom Highlight API para el resaltado: no existe en Firefox < 140 ni Safari <
  17.2. Se envuelve el texto en `<mark>` y se restaura al quitarlo.
- El elemento `<search>` (Chrome 118+): `role="search"` en un `<div>`.
- `type="number"` en el campo de página: acepta «1e3» y cambia con la rueda.
- Pintar de antemano la página siguiente en «página a página»: otro lienzo vivo para un
  beneficio pequeño; queda como posible mejora.
- Pedir contraseña (D13 sigue pendiente): un PDF cifrado se detecta y se dice.

**Errores propios por el camino**

- Una regla `.pagina-pdf { position: relative }` fuera de las capas de Tailwind ganaba a la
  utilidad `absolute`: las páginas se apilaban mal y la segunda quedaba fuera de su sitio.
  Se vio en la primera prueba en navegador, no en los tests.
- El índice de búsqueda desalineaba posiciones con los caracteres fuera del plano básico
  (un emoji son dos unidades UTF-16); lo cazó su test.
- Un render sustituido seguía ocupando uno de los 2 huecos hasta resolverse; lo cazó el
  test del controlador con páginas que no terminan de cargar.
- Contar pasos de zoom de 100 % a 200 % (5, no 7): falló el E2E de copia y la primera
  tabla del benchmark medía 300 % y 500 % en lugar de 200 % y 400 %. Corregidos los dos.
- Referencias a «iteración 13» en los documentos (es la 7).

**Tests**

- Unitarios nuevos: disposición, zoom, ventana y presupuesto; búsqueda; política de
  enlaces con corpus de URLs hostiles; capas (resaltado, enlaces, texto hostil); documento
  con pdf.js real (tamaños, texto, CJK, enlaces, caché, destrucción); controlador (orden,
  concurrencia, cancelación, liberación, recorrido rápido de 300 páginas, búsqueda);
  transformación por franjas y worker (protocolo, transferencia, fallo, destrucción);
  estado de la vista; atajos; apertura protegida y cancelación en `engine.test.ts`.
- Componentes: `Visor.test.tsx` (navegación, campo validado, zoom, giro, modos, teclado sin
  interceptar campos, búsqueda, enlaces, miniaturas, jest-axe). `App.test.tsx` cambia su
  test de PDF: antes comprobaba el resumen provisional (nombre, tipo, tamaño); ahora un PDF
  monta el visor, y el test comprueba el visor, los avisos de PDF dañado y protegido y que
  abrir otro documento aborta la carga (pdf.js se sustituye en jsdom).
- E2E: `visor-pdf.spec.ts` (22 tests: los 21 flujos pedidos más CJK y el de ficheros no
  servidos). `abrir.spec.ts`: el test de PDF comprueba el visor; en el de nombres hostiles
  la aserción «ningún `svg` en `main`» ya no vale (la barra del visor tiene iconos SVG
  propios), y se sustituye por dos más precisas: el título no contiene ningún elemento y
  no hay `script` ni atributos `onload`/`onerror` en `main`.
- Cifras: 380 tests en 29 ficheros; 45 E2E.

### Iteración 6 — *2026-09-29* — Fase 4: spike del PDF en modo oscuro

Había que saber, antes de construir el visor, si el requisito central es alcanzable:
página oscura y texto claro con las fotos y los gráficos con sus colores. **Lo es.** El
recoloreado selectivo deja las fotos intactas (±3 por canal), el texto a 12:1 y los
gráficos con su color, a ~10 ms por megapíxel. El detalle, con evidencia, benchmark y
limitaciones, está en `docs/PDF_DARK_MODE_SPIKE.md`. Medido en WSL2 (Ubuntu) con el
Chromium de Playwright.

**Cómo se llegó**

- **pdf.js 6.3.289**, versión exacta. Antes de instalar se leyó su código para decidir
  sin suponer:
  - `pageColors` pasa todo el lienzo a gris (descartado);
  - con `useWasm: false` usa decodificadores en JavaScript y un intérprete de PostScript
    sin `eval`, así que la CSP **no necesita `'wasm-unsafe-eval'`**;
  - `page.render({ recordImages: true })` es una API **pública** que registra dónde pinta
    cada imagen, ya recortada por el clip. Sustituyó al recorrido manual del
    `OperatorList` que planeaba FASES.
- **Fixtures generados por script**: 8 páginas A4 con una «foto» sintética de colores
  exactos, un test que exige que el fichero versionado sea lo que produce el script, y un
  documento de 300 páginas generado al vuelo.
- **Laboratorio `spike.html`** con cuatro estrategias (original, inversión, solo
  heurística, selectivo). Se evaluó con capturas de las 8 páginas × 4 estrategias y se
  verifica con muestreo de píxeles en E2E.

**Qué enseñó la evidencia y qué se cambió por ella**

- La **heurística de color sola no basta**: oscurece las nubes de una foto y aclara su
  sombra. Esto justifica las regiones de imagen.
- **Flecos de color en el texto**: pdf.js crea el lienzo opaco y Chromium suaviza con
  subpíxel LCD. El contexto se crea antes con `alpha: true`.
- **Filo blanco alrededor de las fotos** por dilatar la región: margen 0.
- **Un escaneo se quedaba blanco**: una imagen de ≥ 90 % de la página se recolorea.
- **Una diapositiva oscura se volvería clara**: una página mayoritariamente neutra y
  oscura no se toca.
- **Contraste de colores**: la luminosidad mínima aproximada dejaba el azul marino en
  2,97:1. Ahora se comprueba el contraste real, y por eso el rojo de gráfico (2,83:1) se
  aclara 4 niveles.
- **CSP**: pdf.js carga las sustitutas de las fuentes estándar con `FontFace` desde el
  propio origen → `font-src 'self'`. Con `worker-src 'self'` bastó; `connect-src` no hizo
  falta.

**Dos hallazgos que piden decisión** (D17 y D18 en PLAN §14.1, sin tomar):

- `PDFViewer` crea sus propios lienzos opacos y no pasa `recordImages`: el modo oscuro
  exige un **visor propio** sobre la API núcleo.
- La build moderna de pdf.js exige APIs de JavaScript de 2025–2026 (`toHex`,
  `getOrInsertComputed`…) que no están en los navegadores mínimos de BPDF. En Node falló;
  los tests usan la `legacy`.

**Descartado y por qué**

- Estrategia A (envolver el contexto 2D): innecesaria con `recordImages` y frágil. **No se
  midió**; se descarta por coste.
- Silenciar los avisos de pdf.js con un filtro en la vigilancia de los E2E: se configuró
  `verbosity: ERRORS` en pdf.js, que es lo correcto también para quien usa la app.
- Sacar la transformación del hilo principal en el spike: optimización prematura. Queda
  como condición para la F5, con el dato (74–100 ms a 8 Mpx).

**Errores propios del camino**

- Un `cat > /tmp/…` suelto en un comando se quedó esperando entrada; se paró sin efectos.
- El primer benchmark leía la tabla de la medición anterior (filas desplazadas una
  página). Se vio porque una página de una imagen marcaba dos regiones; la tabla ahora dice
  a qué página corresponde.
- Un selector de E2E, `getByLabel("Página")`, coincidía también con el lienzo («Página 1
  renderizada»).
- Creí haber encontrado un fallo en `build:tamano` que era mi propio `tail -4` cortando su
  salida.

**Pendiente, anotado en TAREAS:** D17 y D18; borrar el laboratorio en la F5; validar con PDF
reales. Aparte, `docs:enlaces` falla por el `r3zon-template.json` borrado sin commitear
(anterior a esta fase).

### Iteración 5 — *2026-09-29* — Fase 3: apertura local de documentos

BPDF ya abre un PDF o un Markdown del dispositivo: con «Abrir archivo», con `Ctrl/Cmd+O`
o arrastrándolo a la ventana. Lo valida por extensión **y** contenido, lo deja en el
estado de la app listo para los visores (Fases 5 y 7) y muestra su nombre, tipo y tamaño;
todavía no su contenido. Se confirma **D16: un documento a la vez**, sin pestañas,
historial ni recientes. Nace `src/platform/`, aplazada desde la Fase 2, ahora con su
primer uso real. Sin dependencias nuevas, sin cambios de CSP y sin ninguna petición de red.
Línea base: árbol limpio en `04c1291`, todo en verde (66 tests).

**Modelo y capa de documentos** (`src/documents/`)

- `OpenedDocument` es una unión discriminada: el PDF conserva su `Blob` **sin leerlo**
  (en web, el `File` apunta al disco y no ocupa memoria; el visor lo leerá para pdf.js)
  y el Markdown guarda solo su texto (los bytes se descartan al decodificar). El diseño de
  la Fase 0 tenía `data: ArrayBuffer | string`: leer el PDF entero al abrirlo era tener
  una copia en memoria que nadie usaba aún.
- `readDocument()` es la única validación, en este orden: extensión → vacío → tamaño →
  contenido, sin leer más de lo necesario (de un PDF, solo 1024 bytes). La usarán tal
  cual las dos plataformas; Electron pasará el id de su proceso main.
- Detección: firma `%PDF-` en los primeros 1024 bytes (lo que toleran Acrobat y
  pdf.js); Markdown en UTF-8 estricto **y sin NUL**, porque un UTF-16 sin BOM de texto
  ASCII es UTF-8 válido y solo lo delatan los NUL. `file.type` no se lee nunca.
- Límites con su porqué escrito en `limits.ts` (PDF 512 MiB, Markdown 20 MiB),
  comprobados antes de leer. Medido a mano: un PDF disperso de 513 MiB se rechaza en
  ~60 ms y un Markdown de casi 20 MiB se abre en ~170 ms (leer 48 ms, decodificar 19 ms).
- Siete errores tipados, cada uno con su texto: los cinco previstos más `not-pdf` (un
  `.pdf` sin firma merece un mensaje más claro que «no soportado») y `multiple` (soltar
  varios ficheros, D16).
- `DocumentProvider`: un documento; abrir otro lo sustituye; **un fichero rechazado no
  cierra el que se leía**; turnos para que un Markdown lento no pise a uno soltado
  después; cerrar descarta la apertura en curso. No posee recursos que liberar a mano (ni
  URL de objeto ni documentos de pdf.js): los visores futuros se montan con
  `key={document.id}` y limpian al desmontarse.

**Plataforma** (`src/platform/`)

- `Platform` con dos métodos, los únicos que se usan: `pickDocument()` y
  `openDroppedFile(file)`. El contrato de la Fase 0 tenía cinco, en plural; el primer uso
  real ya cambió dos. Guardar, enlaces externos y «Abrir con…» llegan con sus fases.
- Web: `<input type="file">` creado al vuelo, fuera del DOM (el control accesible es el
  botón), con `accept` de solo extensiones. Cancelar resuelve `null` por el evento
  `cancel` o por un `change` sin ficheros; si un navegador no avisara, la promesa queda
  pendiente sin bloquear nada, porque la interfaz no espera por ella.
- `createPlatform()` devuelve la web; la rama de Electron llega en la Fase 14. No se
  simula `window.bpdf` antes.

**Interfaz**

- Estado vacío con «Abrir archivo», el atajo y la frase de privacidad; vista provisional
  (nombre, tipo, tamaño, «Cerrar documento») con el foco en su título al abrir; «Abrir
  archivo» en la cabecera cuando hay documento; aviso de error con `role="alert"` que se
  puede descartar.
- Zona de soltar a pantalla completa con manejadores de React sobre la raíz de la app:
  ningún listener en `window` para arrastrar (el único global es `Ctrl/Cmd+O`, que tiene
  que funcionar tenga el foco quien lo tenga). Cuenta entradas y salidas para no
  parpadear entre hijos, ignora arrastres de texto o enlaces y evita que el navegador
  abra el fichero en la pestaña.
- Nombres de fichero: sin ruta, sin controles ni marcas bidireccionales (`U+202E` haría
  que un `.md` se viera como `.pdf`), en NFC, y validados sobre ese mismo nombre.

**Tests** (181 Vitest en 16 ficheros, antes 66 en 9; 23 E2E, antes 6)

- Unitarios: detección (PDF con basura delante dentro y fuera de los 1024 bytes, PNG
  renombrado, UTF-16 con y sin BOM, Latin-1, binario, BOM de UTF-8), nombres,
  `readDocument` (límite exacto y un byte por encima sin reservar 512 MiB, solo lee la
  cabecera del PDF, no se fía del MIME, fallo de lectura → `unreadable`), plataforma web
  con un `<input>` real de jsdom (elegir, cancelar, `change` vacío; ni `fetch` ni
  `createObjectURL`).
- Componentes + jest-axe: `DocumentProvider` (sustitución, cancelar, error que conserva
  el documento, carreras, cerrar), `DropZone` (estados, hijos, texto arrastrado),
  `DocumentErrorAlert` (cada código con su mensaje), `App` (nombres hostiles como texto,
  `Ctrl/Cmd+O`, foco al abrir y al cerrar, axe con documento y error a la vez).
- E2E contra la build: estado inicial; selector (`filechooser`) con PDF y Markdown;
  sustituir; cancelar; `Ctrl+O`; arrastrar (eventos sintéticos con un `DataTransfer`
  real); rechazar `.txt`, PDF falso, vacío, UTF-16 y varios a la vez; nombres hostiles;
  un Markdown con `<script>`, `<img onerror>`, `<iframe>` remoto y `javascript:` que no
  ejecuta nada ni pide nada a la red. Todos con cero errores de consola, cero
  violaciones de CSP y ninguna petición externa.
- Fixtures en `tests/fixtures/` con su procedencia: un PDF mínimo **generado por
  script** (comprobado con pdf.js 6.3.289 instalado aparte: 1 página y el texto
  correcto), dos Markdown y un `.txt`. `*.pdf binary` en `.gitattributes`.

**Desviaciones respecto a `FASES.md`** (detalle en su sección de la Fase 3)

- Varios ficheros y `resources` (imágenes de un `.md`, carpetas) pasan a la **Fase 7**,
  su primer uso; hoy soltar varios da `multiple`.
- Sin `PlatformProvider` ni `platform/memory.ts`: la plataforma llega por propiedad a
  `App` y la falsa vive en `tests/helpers/`, no en `src/`.
- Sin API de «cambios sin guardar» (Fase 9) ni `capabilities` en el documento.
- Id con contador en lugar de `crypto.randomUUID()` (que no existe fuera de contexto
  seguro).

**Descartado y por qué**

- Aceptar MIME en `accept` (`application/pdf`, `text/markdown`): el MIME del navegador
  sale de la extensión, y con él algunos sistemas amplían el filtro a extensiones que
  después se rechazarían.
- Leer el PDF entero al abrirlo para «tenerlo listo»: una copia en memoria sin uso hasta
  la Fase 5.
- Un `<input type="file">` fijo en el DOM con su `<label>`: duplicaba en el árbol de
  accesibilidad lo que ya es el botón, y ataba la UI a la implementación web.
- Listeners de arrastre en `window`/`document`: la zona envuelve toda la app y basta
  con los de React.
- Un indicador de «abriendo…»: abrir un PDF lee 1 KB y un Markdown de casi 20 MiB tarda
  ~170 ms; llegará con el visor, cuando cargar sí tarde.

**Errores propios del camino**

- `displayName` cortaba también por `\`, que es un carácter válido en nombres de Linux
  (`a\b.md` se mostraba como `b.md`). Lo destapó un test con un nombre hostil; ahora
  solo corta por `/`, que ningún sistema admite en un nombre.
- La heurística de textos sueltos (`tests/unit/textos.test.ts`) tomó
  `=> Promise<OpenedDocument | null>` por texto de JSX. Era un falso positivo: se
  ajustó la expresión (un `>` precedido de `=` no abre texto) y su autotest cubre el
  caso; lo que tiene que detectar lo sigue detectando.
- Al escribir la expresión de caracteres invisibles, la herramienta de edición convirtió
  los escapes `\u202E` en los caracteres reales: el fuente llevaba marcas
  bidireccionales invisibles («Trojan Source»). Se detectó con `od` y se reescribió con
  escapes ASCII; los tests construyen esos caracteres con `String.fromCodePoint`. Para
  que no vuelva a pasar en silencio, `tests/unit/seguridad.test.ts` falla si algún
  fichero de `src/` los contiene.
- En esta máquina (macOS 13), Playwright 1.63 no instala su Chromium. Los E2E se
  ejecutaron con Google Chrome 153 mediante una configuración local sin versionar
  (DEVELOPMENT.md). Chrome pide `/favicon.ico` (el Chromium de CI no) y su 404 hacía
  fallar la vigilancia de consola en todos los E2E: se tolera solo ese 404 hasta que
  exista el favicon (Fase 11).
- Una primera medición dio 30 s para abrir el Markdown de 20 MiB: era la espera de mi
  script, no la app. Medido bien, ~170 ms.

### Iteración 4 — *2026-09-29* — Fase 2: base de la app en Vite + React

La portada de Next.js heredada se sustituye por una SPA **estática** de Vite 8 + React 19
(D1): `npm run build` produce ficheros en `dist/` y nada más. Sin servidor, SSR, API,
middleware ni funciones serverless. La fase deja los cimientos que usarán las siguientes
(CSP estricta, tokens, textos centralizados, E2E contra producción) sin implementar
ninguna función de usuario. Línea base al empezar: la Fase 1 estaba en `ea206ac`, con el
árbol limpio y todo en verde (33 tests).

**Migración de Next a Vite**

- Fuera `next`, `@tailwindcss/postcss`, `next.config.ts`, `postcss.config.mjs`,
  `tsconfig.typecheck.json` (existía para excluir `.next/types`), `src/app/` de Next
  (`layout`, `page`, `error`, `global-error`, `not-found`, `robots.ts`, `sitemap.ts`) y el
  `browserslist` de `package.json`, que ninguna herramienta leía. Los navegadores
  mínimos pasan a `build.target`.
- Entran `vite` y `@tailwindcss/vite`, ambos de desarrollo. Las dependencias de runtime
  bajan a 5.
- `index.html` sin scripts en línea. El nombre, la descripción, el idioma y el
  `<noscript>` los pone un plugin mínimo de `vite.config.ts` desde `project.ts` y
  `messages.ts`, para no duplicarlos. `robots.txt` y `sitemap.xml` se generan en la build
  desde `src/config/public-site.ts`, que conserva la fecha literal.
- `appType: "mpa"`: sin fallback de SPA, una ruta desconocida da 404 en `dev` y en
  `preview`, como en un hosting estático. El fallback haría que `/login` devolviera la
  app con un 200.
- **T-2 resuelta: sin `@vitejs/plugin-react`.** Vite transforma el JSX solo; el precio es
  no tener Fast Refresh en desarrollo, y a cambio hay una dependencia y un preámbulo en
  línea menos.
- El validador de `public_docs/` buscaba `page.tsx` en `src/app/`. Ahora una ruta existe
  si la sirve un HTML de la build (`/` → `index.html`, `/x` → `x.html` o `x/index.html`),
  y el proyecto ficticio de sus tests declara sus rutas con esas dos formas.

**Seguridad**

- CSP en una fuente única (`src/config/security-headers.ts`) que **deniega por defecto**:
  `default-src 'none'`, solo `'self'` para scripts, estilos e imágenes, y `'none'` para
  `object-src`, `base-uri`, `form-action` y `frame-ancestors`. Sin `'unsafe-inline'` ni
  `'unsafe-eval'`, y sin `'wasm-unsafe-eval'` porque pdf.js aún no está.
- La política llega como cabecera en `vite preview` y como `<meta>` en `dist/index.html`,
  para que la build lleve su CSP aunque el hosting (D5) no mande cabeceras. En desarrollo
  no hay CSP: Vite inyecta código en línea.
- `style-src` no necesitó `'unsafe-inline'`, que el diseño de la Fase 0 daba por
  necesario: Vite emite la CSS como fichero y React fija estilos por CSSOM.
- La `Permissions-Policy` solo lista características que Chrome reconoce: una desconocida
  produce un error en consola.

**Base de interfaz**

- Tokens de PLAN §9.2 por función (planos, texto, borde, interacción, estado, foco,
  selección), con utilidades `bg-app`, `text-fg`, `outline-accent`… Los primitivos
  `Button`, `Field` e `Input` usan los tokens nuevos.
- Shell semántico: enlace de salto al contenido, `header`, `main` enfocable y estado
  vacío. `ErrorBoundary` propio en lugar de `error.tsx` y `global-error.tsx`: sin
  telemetría, con «Reintentar».
- Todos los textos visibles están en `src/i18n/messages.ts` (D2), con un tipo que obliga a
  que otro idioma tenga la misma forma sin repetir las mismas cadenas.

**Tests** (33 → 66 unitarios y de componentes; 3 → 6 E2E)

- Guardarraíles:
  - contraste WCAG de cada par de tokens, leído de `globals.css`;
  - invariantes de la CSP y prohibición de `innerHTML` y similares en `src/`;
  - texto suelto en componentes, con un caso que prueba la heurística.
- Componentes: estructura semántica y axe de `App`; el `ErrorBoundary` recupera tras
  reintentar.
- E2E contra `vite preview`:
  - cada carga vigila errores de consola, violaciones de CSP y peticiones fuera del
    propio origen;
  - un **test de control** inyecta un script en línea y comprueba que se bloquea y que la
    vigilancia lo detecta: sin él, «cero violaciones» también pasaría si la CSP no se
    aplicara;
  - cabeceras, `<meta>` CSP, teclado (el primer Tab llega al enlace de salto), `robots` y
    `sitemap`, y 404 en rutas inexistentes.
- `npm run build:tamano` en CI: el arranque pesa 80 KB gzip (límite 150).

**Desviaciones respecto a `FASES.md`** (detalle en su sección de la Fase 2)

- `src/platform/` pasa a la Fase 3, y la infraestructura de preferencias y `zod` a la 10.
  La sesión pidió no crear abstracciones sin uso ni persistencia de preferencias, y su
  primer uso real está en esas fases.
- No hay botón «Abrir» deshabilitado (sería interfaz falsa).
- El shell va en `src/app/` y no en `src/components/app/`.
- No hay favicon: no hay icono definido y no se inventa identidad visual.

**Descartado y por qué**

- Silenciar los avisos `MODULE_LEVEL_DIRECTIVE` de `lucide-react` en la build: son
  inocuos, pero un filtro de avisos acaba escondiendo el siguiente. Quedan documentados en
  `STACK.md`.
- `@testing-library/user-event` para probar el teclado: sería una dependencia nueva. El
  teclado se prueba en Playwright, con uno real.
- Un favicon `data:`: obligaría a abrir `img-src data:` solo por eso.
- `robots.txt` y `sitemap.xml` como ficheros estáticos en `public/`: repetirían el
  dominio provisional fuera de `project.ts`.

**Errores propios del camino**

- La primera pasada de Biome dio 3139 errores: revisaba `dist/`, que no estaba en
  `.gitignore` ni en `biome.json` (antes lo estaban `.next/` y `out/`).
- `<html lang="__BPDF_LANG__">` era un `lang` inválido en el fuente (lo cazó Biome). Ahora
  el fuente lleva `lang="es"` y el plugin lo reescribe.
- Vite avisó de que su futuro cargador nativo de configuración exigirá extensiones en los
  imports. Se añadieron (`.ts` y `allowImportingTsExtensions`) en lugar de silenciarlo.
- Al reescribir `SEGURIDAD.md` con un `node -e '…'`, las comillas simples de la política
  (`'self'`, `'none'`) se perdieron dentro del argumento de shell. Se detectó al releer la
  sección y se restauraron con un script en fichero.

### Iteración 3 — *2026-09-29* — Fase 1: limpieza de la plantilla

Se confirmaron D1 (Vite + React), D2 (español con textos centralizados), D3 (Apache-2.0),
D4 (documentación pública en el Docusaurus de R3ZON) y D15 (separación del core SaaS), y
se ejecutó la Fase 1: el repositorio deja de ser un SaaS y pasa a ser la base de BPDF,
todavía sobre Next.js (el cambio a Vite es la Fase 2).

**Línea base antes de tocar nada** (Node 24.21 vía nvm, `npm ci` limpio): lint,
typecheck y build en verde; 78 tests en verde y 18 de base de datos saltados; `npm audit`
sin vulnerabilidades. Los 18 saltados eran del entorno (no había Supabase levantado), no
un fallo previo, y se eliminan en esta fase. El E2E de la plantilla no se ejecutó en la
línea base: su `pretest:e2e` resetea el Supabase local, que no estaba levantado, y el
spec se sustituyó.

**Qué se retiró y por qué**

- **Auth y usuarios:** login (página, formulario, Server Action), callback, logout, zona
  `(app)/inicio`, `proxy.ts`, `public-paths.ts`, `safe-redirect.ts`, `homePath`. BPDF no
  tiene cuentas.
- **Base de datos:** `supabase/` (configuración, migración de `profiles`, seed),
  `prisma/`, `prisma.config.ts`, `database.types.ts`, clientes de Supabase, scripts de
  tipos, drift, seeds y `dev:setup`, `tests/db/`.
- **Observabilidad y servidor:** Sentry (`instrumentation*.ts`, `observability/`),
  Speed Insights, logger JSON de servidor, `/api/health`. Son telemetría o servidor, y
  contradicen el principio rector aunque estuvieran apagados por defecto.
- **Variables de entorno:** `.env.example`, `src/lib/env.ts` y `NEXT_PUBLIC_SITE_URL`
  (`siteUrl()` usa el dominio de `project.ts`). BPDF no tiene ninguna.
- **Dependencias:** `@supabase/ssr`, `@supabase/supabase-js`, `@sentry/nextjs`,
  `@vercel/speed-insights`, `zod`, `prisma`, `supabase`, `pg`, `@types/pg` (291 paquetes
  menos en el árbol). Los `overrides` (`mysql2`, `deepmerge-ts`) y las tres entradas de
  `allowScripts` se fueron con Prisma y Sentry; `deps:overrides` confirmó que ya no
  evitaban nada.
- **Configuración SaaS:** pasos de Supabase, Prisma, drift y tipos en `ci.yml` y
  `e2e.yml`; `vercel.json` (región `fra1` de funciones de servidor); reglas de Prisma en
  `.claude/settings.json`; entradas de Supabase, Prisma y Sentry en `.gitignore` y
  `biome.json`; `modules/` (ningún módulo aplica); docs `DATABASE`, `AUTH`, `ROLES`,
  `RESTAURACION` y `auditoria-template-final`.
- **Tests de lo retirado** (63 de los 96): BD (18), `scripts-db` (7), `public-paths` (14),
  `safe-redirect` (11), `env` (2), `observability` (3), el caso de login de
  `a11y.test.tsx` (1) y 7 de `project.test.ts` (derivación de la plantilla, `homePath`,
  `site_url` de Supabase). No se debilitó ningún test de lo que sigue existiendo: el único
  cambio en uno conservado es el patrón del caso «slug» de `project.test.ts`, que esperaba
  el error de `project_id` de `supabase/config.toml`, fichero que el validador ya no lee.

**Qué se conservó y por qué:** Biome, TypeScript estricto, Vitest + Testing Library +
jest-axe (los primitivos `Button`, `Field`, `Input` siguen probados), Playwright (será
imprescindible para el canvas de PDF), CI de seguridad, validador de `public_docs/` e
identidad única (D4), Tailwind 4 con tokens RGB (la Fase 2 cambia la paleta, no el
mecanismo), `lucide-react`, `clsx` y `tailwind-merge`.

**Qué se añadió:** `LICENSE` con el texto canónico de Apache-2.0, descargado de
apache.org y comparado con el que distribuye `pdfjs-dist` (idéntico salvo el apéndice). El
apéndice conserva su marcador `[yyyy] [name of copyright owner]` sin rellenar: el proyecto
no define titular y no se inventa. E2E `portada.spec.ts`: la portada responde 200 con las
cabeceras de seguridad y el título de BPDF, y `/login`, `/inicio`, `/auth/callback` y
`/api/health` devuelven 404.

**Decisiones menores tomadas durante la fase**

- **`zod` fuera**, aunque el plan lo daba por conservado: se quedó sin ningún uso, y la
  regla es no guardar dependencias para el futuro. La Fase 2 lo reinstala.
- **`comprobarDerivacion` fuera** (con `supabase/config.toml` en el validador de
  identidad): vigilaba que un SaaS derivado no heredara los puertos ni la auditoría de la
  plantilla. Con D15 no protege nada. `r3zon-template.json` queda como registro de origen.
- **El fixture de los validadores conserva sus rutas `/login` e `/inicio`**: es un
  proyecto ficticio, y esas rutas prueban cómo resuelve el validador los grupos `(x)` de
  Next. Se revisará cuando la Fase 2 adapte el validador a Vite.
- **Portada de `public_docs/` con `estado: proximamente`**: no hay ninguna función que
  documentar, y CLAUDE.md §9 exige verificar cada dato contra el código.
- **El contrato `public_docs/README.md` no se tocó**, aunque su ejemplo use `/login`: es
  común a todos los productos de R3ZON y cambiarlo exige tocar los dos repositorios.
- **`organization: "R3ZON"`** se mantiene: ya estaba definido en el proyecto y BPDF se
  publica en el Docusaurus de R3ZON. Dominio provisional `app.example.com` hasta D5.
- `CLAUDE.md` reescrito para BPDF: las secciones de BD y auth pasan a «Privacidad» y a
  reglas de contenido hostil. `ARCHITECTURE`, `STACK`, `STRUCTURE`, `DEVELOPMENT`,
  `DEPLOYMENT`, `MODULES` y `TEMPLATE` describen ahora el estado real. `auditoria.md` y
  `mejoras.md` se vaciaron conservando el formato y solo las mejoras de CI que siguen
  aplicando.

**Errores propios del camino**

- En la sesión anterior, `node -v` en WSL daba Node 18: `bash -lc` no carga `~/.bashrc`,
  que es donde vive nvm. Node 24 estaba instalado. Se ejecutó todo con un script que carga
  nvm.
- Un `python3 - || node -e …` desde Git Bash se quedó colgado: el `python3` de Windows
  esperaba entrada (el mismo tropiezo que ya recogía la bitácora de la plantilla). Se
  paró y se hizo la edición a mano; el fichero no llegó a modificarse.

### Iteración 2 — *2026-09-29* — Fase 0: auditoría de la plantilla y plan de BPDF

Sesión solo de análisis y planificación: no se ha tocado código. BPDF será un visor de PDF
y Markdown, gratuito y open source, oscuro por defecto, que procesa los documentos en el
dispositivo (sin backend, cuentas, base de datos ni telemetría), primero web y después
Electron. La plantilla es un SaaS (Supabase, auth, Prisma, Sentry), así que el trabajo
consistió en decidir qué se conserva y diseñar lo demás antes de escribir una línea.

**Qué se hizo**

- Auditoría de los 118 ficheros de la plantilla: qué se conserva (Tailwind con tokens,
  Biome, Vitest, jest-axe, Playwright, CI de seguridad, proceso de docs), qué se adapta y
  qué se elimina (Supabase, Prisma, auth, Sentry, Speed Insights, logger de servidor,
  `/api/health`). Tabla en `docs/PLAN.md` §2.
- Documentos nuevos: `PLAN.md` (diseño objetivo), `SEGURIDAD.md` (modelo de amenazas y
  controles por fase), `ELECTRON.md` (escritorio) y `FASES.md` (16 fases especificadas
  para ejecutarse en sesiones independientes). `TAREAS_PENDIENTES.md` pasa a ser el
  estado de fases y decisiones.
- 16 decisiones de producto quedan **pendientes de confirmación** (D1–D16), cada una con
  recomendación; 5 técnicas (T-1–T-5) se asignan a la fase que las resolverá con
  evidencia.

**Decisiones del plan y su porqué**

- **Recomendar Vite + React en lugar de Next.js (D1).** Lo que justifica Next (RSC con
  datos, Server Actions, route handlers, proxy) desaparece con el backend. En export
  estático, el App Router inyecta scripts en línea en cada HTML, y eso obliga a mantener
  hashes para tener una CSP estricta; una SPA de Vite tiene un `index.html` sin scripts en
  línea y encaja directamente con Electron. No se decide sin confirmación (CLAUDE.md §1).
- **Electron con el bundle local, no con la URL remota** que recomendaba el catálogo de
  módulos de la plantilla: sin conexión, sin peticiones de red al abrir documentos y con
  una superficie remota nula.
- **Spike de modo oscuro del PDF (Fase 4) antes de construir el visor.** Es el mayor
  riesgo técnico y condiciona si se usa `PDFViewer` de pdf.js o un visor propio.
- **La seguridad va en cada fase**, no al final. La Fase 12 verifica, endurece y audita.
- **La capa `platform/`, las preferencias y la CSP base van en la Fase 2**: si se dejaran
  para la «preparación de Electron», habría que rehacer lo construido encima.
- **Markdown con `react-markdown`** (elementos React, sin `innerHTML`, sin HTML crudo) en
  lugar de `marked` + DOMPurify. **Mermaid como SVG dentro de `<img>`**: aunque se colara
  algo, en una imagen no se ejecuta, y así se evita el iframe de `securityLevel: sandbox`.

**Verificado en el código de las dependencias** (no de memoria)

- `pdfjs-dist` 6.3.289: `pageColors` aplica un filtro SVG a **todo el lienzo** al terminar
  la página (`CanvasGraphics.#drawFilter`: escala de grises y 6 niveles). Las fotos se
  destruyen, así que se descarta como modo oscuro principal.
- pdf.js 6.3 ya no usa `eval` ni `new Function` (la opción `isEvalSupported` no existe),
  pero compila WASM: la CSP necesita `'wasm-unsafe-eval'`, no `'unsafe-eval'`.
- `PDFPageView` le pasa a `page.render` el `<canvas>`, no el contexto. Por eso el remapeo
  de color en el contexto 2D (estrategia A) obligaría a un visor propio, y se prueba
  primero el post-proceso por píxel (estrategia B), que conserva `PDFViewer`.
- Los componentes de `pdf_viewer.mjs` incluyen visor, búsqueda y enlaces, pero **no las
  miniaturas**: se harán a mano.

**Descartado y por qué**

- `filter: invert()` y `pageColors` como modo oscuro: invierten o agrisan las imágenes.
- Mermaid con `securityLevel: "sandbox"`: exige `frame-src data:` en la CSP.
- Service worker/PWA en v1: no aporta nada sin backend y añade superficie.
- Shiki: mejor resaltado, pero pesa bastante más. Se reevalúa si highlight.js se queda
  corto.
- Una fase aparte de «preparación de Electron»: sus piezas van en la Fase 2.

**Errores propios del camino**

- `git` desde Git Bash sobre la ruta `\\wsl.localhost\…` falla por «dubious ownership»,
  y `wsl -- bash -lc '…$var…'` perdía las variables. Se leyó el repositorio por la ruta
  UNC y se consultó npm con el Node de Windows.
- No se pudo medir la línea base (lint/tests): sin `node_modules` y con Node 18 en WSL.
  Queda como primer paso de la Fase 1.

### Iteración 1 — *2026-09-29* — Proyecto creado desde R3ZON Template v1.0.0

Repositorio creado a partir de la plantilla (`r3zon-template.json`: 1.0.0), sin cambios
(commit `e5e063d`).
