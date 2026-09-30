# BPDF — Seguridad y privacidad (diseño)

> **Estado: diseño objetivo** (Fase 0, *2026-09-29*); implementados los controles de las
> Fases 2 (CSP, cabeceras, DOM), 3 (apertura de ficheros, §2.6), 4 (motor de PDF), 5
> (visor PDF, §4), 7 (Markdown, §3), 7 bis (recursos locales de Markdown, §2.6 y §3) y 8
> (fórmulas y diagramas, §2.1 y §3; *2026-09-30*). Cada control indica la
> fase que lo implementa ([FASES.md](FASES.md)). Cuando un control exista, esa fase lo marca aquí como
> implementado y enlaza su test. Las auditorías realizadas van a
> [auditoria.md](auditoria.md).

La seguridad es un requisito de arquitectura: cada fase implementa los controles de lo
que construye. La Fase 12 no «añade seguridad», verifica y endurece lo que ya existe.

**Principio:** no conceder a ningún componente (renderer, motor de documento, página) un
privilegio que no necesite.

---

## 1. Modelo de amenazas

**Qué se protege**

1. Los **ficheros del usuario** en disco (sobre todo en Electron).
2. La **privacidad de la lectura**: qué documentos abre, cuándo y desde dónde. Una sola
   petición de red provocada por un documento ya lo revela.
3. La **integridad de la app**: que un documento no pueda ejecutar código en su origen.
4. Las **preferencias** locales (bajo valor, pero no deben poder romper el arranque).

**Quién ataca**

- **Un documento malicioso** (PDF o Markdown) que el usuario abre voluntariamente. Es el
  atacante principal: controla bytes arbitrarios que procesan pdf.js, el pipeline de
  Markdown, KaTeX, Mermaid y el resaltador.
- **Un enlace malicioso** dentro de un documento, que depende de que el usuario haga clic.
- **La cadena de suministro**: una dependencia comprometida o un paquete con scripts de
  instalación.
- **Otra web** que intente enmarcar BPDF (clickjacking) o comunicarse con ella.

**Fuera del modelo:** un atacante con acceso local al equipo o al perfil del navegador, y
un sistema operativo comprometido.

**Fronteras de confianza**

```text
documento (no confiable) ──► motor (worker pdf.js / pipeline MD) ──► DOM de la app
                                                                   │
                                   Electron: renderer (sin Node) ──► preload (mínimo) ──► main (privilegiado)
```

## 2. Aplicación web

### 2.1 Content-Security-Policy

La CSP es la red que para lo que se escape de los demás controles. **Deniega por defecto**
y solo abre lo que la app usa hoy. Vive en **un único fichero fuente**,
[`src/config/security-headers.ts`](../src/config/security-headers.ts), del que salen:

- la cabecera de `vite preview` (lo que prueban los E2E);
- un `<meta http-equiv>` en `dist/index.html`, para que la build lleve su política
  aunque el hosting no mande cabeceras (el hosting está pendiente de D5);
- las cabeceras de la web publicada: [`vercel.json`](../vercel.json), **generado** con
  `npm run cabeceras:vercel` (`reglasVercel`; un test comprueba que no se queda atrás) ✅
  (*2026-09-30*; [DEPLOYMENT.md](DEPLOYMENT.md));
- el protocolo `app://` de Electron (Fase 14).

En `vite dev` **no hay CSP**: Vite inyecta scripts y estilos en línea para desarrollar.
Nada se da por bueno por funcionar en `dev`.

**Vigente** ✅ (Fase 2; la Fase 4 añadió `worker-src` y `font-src`; la Fase 5, `connect-src`; la Fase 7 bis, `blob:` en `img-src`; la Fase 8, `frame-src`):

```text
default-src 'none';
script-src 'self';
style-src 'self';
img-src 'self' blob:;          ← Fase 7 bis: imágenes locales de un Markdown
worker-src 'self';            ← Fase 4: el worker de pdf.js, desde el propio origen
font-src 'self';              ← Fase 4: sustitutas de las fuentes estándar de PDF
connect-src 'self';           ← Fase 5: cmaps de pdf.js (fuentes CID), desde su worker
frame-src 'self';             ← Fase 8: el marco aislado de Mermaid (/mermaid.html)
object-src 'none';
base-uri 'none';
form-action 'none';
frame-ancestors 'none'        ← solo en la cabecera: en <meta> no existe
```

Sin `'unsafe-inline'`, `'unsafe-eval'` ni ningún origen externo. `style-src` ya **no**
lleva `'unsafe-inline'` (el diseño de la Fase 0 lo daba por necesario): Vite emite la CSS
como fichero y React fija estilos por CSSOM, que la CSP no bloquea. T-3 queda así: cada
fase que añada una librería comprueba que no lo necesita; si lo necesitara, se pide
aprobación antes de añadirlo.

**Añadidas en la Fase 4, medidas** (el E2E de pdf.js da cero violaciones con ellas):

| Directiva | Motivo |
|---|---|
| `worker-src 'self'` | El worker de pdf.js (`/pdfjs/pdf.worker.min.mjs`), donde se parsea el PDF aislado del DOM. Sin `blob:` |
| `font-src 'self'` | pdf.js carga con `FontFace` las sustitutas de las 14 fuentes estándar (p. ej. `LiberationSans` para Helvetica) desde `/pdfjs/standard_fonts/` cuando el PDF no las incrusta. Sin ella, violación de CSP y texto con fuente de respaldo. Las fuentes **incrustadas** llegan como bytes y no pasan por la CSP |

**Previstas y que resultaron innecesarias** (Fase 4):

- `'wasm-unsafe-eval'`: BPDF carga pdf.js con `useWasm: false`, que usa decodificadores en
  JavaScript y un intérprete de PostScript sin `eval` (verificado en su código). Los
  `.wasm` ni se sirven ([PDF_DARK_MODE_SPIKE.md](PDF_DARK_MODE_SPIKE.md) §3).
- ~~`connect-src`~~: se creyó innecesario porque ningún PDF medido lo pedía. **Sí hacía
  falta** (Fase 5, abajo).

**Añadida en la Fase 5, medida:**

| Directiva | Motivo |
|---|---|
| `connect-src 'self'` | pdf.js pide al propio origen, con `fetch` **desde su worker**, los mapas de caracteres (`/pdfjs/cmaps/*.bcmap`) de las fuentes CID no incrustadas (japonés, chino, coreano). Sin ella, ese texto **desaparece en silencio**: la violación ocurre en el worker (que recibe la cabecera con su script), no llega al `securitypolicyviolation` del documento y Chromium no la pasa a la consola que ve Playwright. Por eso los E2E no la detectaron en la Fase 4. Se prueba por su efecto: `e2e/specs/visor-pdf.spec.ts` abre un PDF con texto japonés no incrustado y comprueba que se ve, se pide el cmap y se encuentra al buscar. Solo `'self'`: el documento entra como bytes y ningún PDF puede provocar una petición a otro origen |

**Añadida en la Fase 8, medida:**

| Directiva | Motivo |
|---|---|
| `frame-src 'self'` | El marco aislado de Mermaid (`/mermaid.html`, en un iframe con `sandbox="allow-scripts"`). Mermaid dibuja con `<style>` y atributos `style` en línea; con la CSP de la app eran 250 violaciones en cinco diagramas (medido). En vez de añadir `'unsafe-inline'` a la app, Mermaid corre en esa página, con **su propia política** (`CSP_MARCO_MERMAID`, abajo). `tests/unit/seguridad.test.ts`, `e2e/specs/formulas-diagramas.spec.ts` |

**La política del marco** (`/mermaid.html`, cabecera y `<meta>`; Fase 8):

```text
default-src 'none';
script-src 'self';
style-src 'self' 'unsafe-inline';   ← lo único que Mermaid necesita y la app no da
img-src 'none'; font-src 'none'; connect-src 'none'; worker-src 'none';   ← sin red
object-src 'none'; base-uri 'none'; form-action 'none';
frame-ancestors 'self'              ← solo en la cabecera; X-Frame-Options: SAMEORIGIN
```

`'unsafe-inline'` queda confinado a un documento de **origen opaco** (el iframe no tiene
`allow-same-origin`): no alcanza el DOM, el almacenamiento ni las cookies de BPDF (E2E), no
puede pedir nada a la red, y solo recibe el texto del diagrama. Como sus módulos se piden
desde un origen opaco (modo CORS), `/assets/` se sirve con `Access-Control-Allow-Origin: *`
(`cabecerasPara`; son ficheros públicos de la build).

**Encontrado en la Fase 8, sin cambiar la CSP:** Vite incrustaba como `data:` los
recursos de menos de 4 KB (fuentes de KaTeX) y `font-src 'self'` los bloqueaba.
`build.assetsInlineLimit: 0`: la build no incrusta nada.

**Añadida en la Fase 7 bis, medida:**

| Directiva | Motivo |
|---|---|
| `img-src blob:` | Las imágenes que el usuario entrega con un Markdown se pintan con URL `blob:` que crea BPDF desde esos `File` (`AlmacenUrls`). Sin ella, violación de CSP y ninguna imagen. Una URL `blob:` solo la puede crear código del propio origen y no sale a la red. Alternativa descartada: `data:` (copia la imagen entera en Base64 y abriría la puerta a cualquier `data:`). `tests/unit/seguridad.test.ts` exige que `blob:` esté **solo** en `img-src`; `e2e/specs/recursos.spec.ts` pinta PNG, JPEG, GIF, WebP y SVG con cero violaciones |

**Lo que añadirán otras fases, y por qué** (nada de esto está hoy en la política):

| Directiva | Fase | Motivo |
|---|---|---|

**Nunca** `https:` ni otro origen en ningún `*-src`: ningún documento puede provocar una
petición a terceros. Es lo que materializa la privacidad (D7).

**Cómo se prueba** ✅: `tests/unit/seguridad.test.ts` (deniega por defecto, sin
`unsafe-*` ni orígenes externos, la versión `<meta>` es la misma política sin
`frame-ancestors`); `e2e/specs/app.spec.ts` (la cabecera servida es la de la fuente, el
HTML lleva el `<meta>`, **cero violaciones** y ninguna petición fuera del propio origen, y
un **control** que inyecta un script en línea y comprueba que se bloquea y se detecta).

### 2.2 Otras cabeceras

Vigentes desde la Fase 2 en `vite preview` ✅ (misma fuente): `X-Content-Type-Options:
nosniff`, `X-Frame-Options: DENY` (redundante con `frame-ancestors`, para navegadores
antiguos), `Referrer-Policy: no-referrer`, `Cross-Origin-Opener-Policy: same-origin`,
`Cross-Origin-Resource-Policy: same-origin`, HSTS sin `preload` (decisión del dominio) y
`Permissions-Policy` negando `camera`, `microphone`, `geolocation`, `payment`,
`usb` y `display-capture`. Solo se listan características que Chrome reconoce: una
desconocida produce un error en consola. `fullscreen` se declarará en la fase que lo use
(6). **`clipboard-write` (Fase 7, copiar código) no necesitó cambio**: su valor por defecto
ya es el propio origen, y la escritura solo ocurre tras un clic. No se niega
`clipboard-read` (BPDF nunca lee el portapapeles) para no tocar las cabeceras sin
necesidad; se revisa en la Fase 12.

### 2.3 DOM e inyección

- **Prohibido `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`,
  `insertAdjacentHTML` y `document.write`** en el código de la app. Excepción única,
  justificada y aislada si llegara a hacer falta: pasar por DOMPurify en un solo módulo.
  Se vigila con un test que busca esos usos en `src/` ✅ (`tests/unit/seguridad.test.ts`,
  Fase 2).
- Ningún fichero de `src/` lleva marcas bidireccionales invisibles («Trojan Source»: el
  código se lee distinto de como se ejecuta); donde hacen falta se escriben como escapes
  `\uXXXX`. Mismo test ✅ (Fase 3).
- Trusted Types (`require-trusted-types-for 'script'`) como defensa en Chromium y
  Electron, si pdf.js y Mermaid lo permiten (T-4, Fase 12).
- ids generados desde contenido (encabezados de Markdown) con prefijo `md-`: evita que un
  `id="location"` o `id="__proto__"` pise propiedades globales (DOM clobbering).

### 2.4 Navegación, iframes, workers

- Enlaces externos: solo `http:`, `https:` y `mailto:` ([`src/lib/url-externa.ts`](../src/lib/url-externa.ts),
  una sola política para PDF y Markdown, §3.2 y §4), abiertos **por la plataforma**
  (`Platform.openExternal`): en web, `window.open(url, "_blank", "noopener,noreferrer")`,
  que vuelve a aplicar la política; nunca navegan la ventana de la app ✅ (Fase 5).
- Un solo iframe propio (Fase 8): el marco de Mermaid, `sandbox="allow-scripts"` sin
  `allow-same-origin`, desde `/mermaid.html` (`frame-src 'self'`). Mermaid **no** usa su
  `securityLevel: "sandbox"` (necesita un iframe `data:`). El SVG vuelve por
  `postMessage` (solo se aceptan mensajes de ese iframe, con origen `null` y bien
  formados) y se muestra como `<img>`.
- Workers: el de pdf.js (`/pdfjs/pdf.worker.min.mjs`) y el del modo oscuro
  (`/assets/trabajador-*.js`, empaquetado por Vite), los dos servidos desde `'self'` y como
  módulos ES. Sin workers creados desde `blob:`. El del modo oscuro solo recibe píxeles
  (nunca el documento) ✅ (Fase 5).
- **Sin service worker en v1**: no hace falta (sin backend que cachear; offline lo da
  Electron) y añade superficie (caché envenenada, actualizaciones que no llegan). Se
  reevalúa si se quiere PWA.
- Sin permisos del navegador salvo portapapeles (escritura) y pantalla completa, siempre
  tras un gesto del usuario.

### 2.5 Cadena de suministro

- Dependencias mínimas y justificadas en `STACK.md` (un test ya lo exige).
- Versiones **exactas** para los motores que procesan contenido no confiable:
  `pdfjs-dist`, `katex`, `mermaid`, `highlight.js`/`lowlight`, `react-markdown` y su
  cadena `remark`/`rehype`.
- `npm ci` en CI; `allowScripts` de npm 11 revisado paquete a paquete (CLAUDE.md §11 bis).
- `npm audit --audit-level=high` en cada PR y cada lunes (`security.yml`, ya existe).
- Nada se carga de CDN: todo se sirve desde el propio origen (sin SRI que mantener).
- Actions de GitHub fijadas por SHA (propuesta ya existente en `mejoras.md`) antes de
  publicar releases (Fase 15).

### 2.6 Apertura de ficheros ✅ (Fase 3)

Primer punto en el que entra contenido del usuario. Todo fichero es hostil hasta que se
valida, y validar **no** es interpretar: la Fase 3 no parsea, no renderiza ni ejecuta nada
del documento.

| Riesgo | Control | Test |
|---|---|---|
| Un fichero que miente sobre su tipo (`.pdf` que es un PNG, `.md` binario) | Tipo por extensión **y** contenido: firma `%PDF-` en los primeros 1024 bytes; Markdown en UTF-8 estricto sin NUL. **Nunca** `file.type` (MIME), que el navegador saca de la extensión | `tests/unit/documents/detect.test.ts`, `read.test.ts` («no se fía del MIME») |
| Nombre de fichero con HTML o scripts (`<img onerror>`, `"><svg onload>`) | El nombre solo se pinta como texto de React (escapado); ninguna API que interprete HTML (§2.3) | `tests/components/App.test.tsx`, `DocumentErrorAlert.test.tsx`, `e2e/specs/abrir.spec.ts` (nombres hostiles: sin `img`/`svg`/`script` en el DOM, sin diálogos) |
| Nombre que finge otra extensión con marcas bidireccionales (`U+202E`) o lleva controles | `displayName` los quita y la extensión se valida sobre el nombre resultante, el mismo que se ve | `detect.test.ts`, `read.test.ts` |
| Rutas de disco en el estado | El documento guarda un nombre sin ruta, nunca una ruta ni un `FileSystemHandle` (en web el navegador no las da; en Electron, el mapa `id → ruta` vive solo en el main) | `detect.test.ts` («quita cualquier ruta») |
| Agotamiento de memoria | Límites por tipo con su justificación en `src/documents/limits.ts` (PDF 512 MiB, Markdown 20 MiB), comprobados **antes** de leer; un PDF solo se lee en sus primeros 1024 bytes; Markdown se queda solo con el texto | `read.test.ts` (justo en el límite y 1 byte por encima; «solo lee la cabecera»); prueba manual con un PDF disperso de 513 MiB (rechazo en ~60 ms sin leerlo) |
| Contenido que se ejecute al abrir | Nada se interpreta: un Markdown con `<script>`, `<img onerror>`, `<iframe>` remoto y enlaces `javascript:` es solo texto en memoria (desde la Fase 7 se renderiza, con los controles de §3) | `read.test.ts`, `App.test.tsx`, `markdown.spec.ts` (`seguridad.md`: nada se ejecuta ni se pide a la red) |
| Peticiones de red o URL que sobrevivan al documento | Lectura con `Blob.arrayBuffer()`; sin `fetch` ni subida. Abrir no crea URL de objeto: las crea el visor de Markdown al pintar una imagen local y las revoca al desmontarse (se monta con `key={document.id}`; §3.1) | `tests/unit/platform/web.test.ts`, `tests/components/DocumentProvider.test.tsx` (ni `fetch` ni `createObjectURL`); `abrir.spec.ts` (ninguna petición fuera del origen) |
| Acceso a ficheros no elegidos (Fase 7 bis) | Un Markdown solo usa lo que el usuario **entregó**: ficheros elegidos o soltados a la vez, o una carpeta elegida o soltada. `resolverRecurso` busca únicamente en ese mapa; ninguna operación toca otro fichero. Rutas relativas a la entrega, nunca de disco | `tests/unit/documents/recursos.test.ts`, `recursos.spec.ts` (`fuera-de-recursos.png` existe en disco al lado de la carpeta y no se ve) |
| Selecciones que no son un documento (Fase 7 bis) | Varios ficheros: exactamente un `.md` y el resto imágenes (`no-markdown`, `several-markdown`, `incompatible`); carpeta con varios `.md`: el usuario elige; una carpeta junto con otras cosas: `mixed-drop`. Nunca dos documentos (D16) | `tests/unit/documents/seleccion.test.ts`, `App.test.tsx`, `recursos.spec.ts` |
| Carpetas enormes o árboles cíclicos (Fase 7 bis) | Tope de 10 000 ficheros y de 32 niveles; no se entra en `.git` ni `node_modules`; solo se pide el `File` de Markdown e imágenes | `tests/unit/platform/web.test.ts` |
| Nombres de fichero en rutas (Fase 7 bis) | Las rutas candidatas de una carpeta se sanean segmento a segmento como los nombres (sin controles ni marcas bidireccionales) y solo se pintan como texto | `seleccion.test.ts` |
| Soltar un fichero fuera de la app lo abre el navegador en la pestaña | La zona de soltar cubre la ventana entera y cancela el comportamiento por defecto solo en arrastres de ficheros | `tests/components/DropZone.test.tsx` |
| Resultado tardío de una apertura anterior | Solo aplica su resultado la última apertura (turnos); cerrar descarta la que esté en curso | `DocumentProvider.test.tsx` |

La CSP no cambia en esta fase: leer ficheros locales no necesita ninguna directiva nueva
(cero violaciones en los E2E de apertura).

## 3. Markdown

### 3.1 Controles

| Vector | Control | Fase |
|---|---|---|
| `<script>`, `<iframe>`, `<img onerror>`, `<svg onload>`, `<style>`, `<form>`, cualquier HTML crudo | `react-markdown` **no interpreta HTML** (sin `rehype-raw`, D6): cada nodo HTML se pinta como su **texto literal**; los comentarios `<!-- -->` se quitan. Además, **lista blanca de elementos** (`ELEMENTOS_PERMITIDOS` en `pipeline.ts`): lo que no produce Markdown + GFM se descarta | ✅ 7 (corpus §3.3; `xss.test.tsx` también exige que no haya `rehypePlugins` y que `urlTransform` sea el propio) |
| Atributos de evento, `style` inyectado | No hay HTML crudo; los componentes propios solo emiten atributos conocidos. El único `style` es la alineación de celdas de GFM, por CSSOM | ✅ 7 (el corpus lo comprueba atributo a atributo) |
| `javascript:`, `vbscript:`, `data:`, `file:`, `blob:`, mayúsculas, entidades (`jav&#x61;script:`), tabuladores, saltos, controles, `//host`, rutas absolutas, credenciales | [`url-policy.ts`](../src/markdown/url-policy.ts) propio sobre la URL ya decodificada por el parser, tras quitar lo que el navegador ignora: solo `http:`, `https:` y `mailto:` absolutas (política común de `url-externa.ts`) y anclas `#…` llegan a un `href`; todo lo demás se pinta como texto. Dos capas: `urlTransform` en el pipeline y los componentes | ✅ 7 (`tests/unit/markdown/url-policy.test.ts`, corpus, E2E) |
| Imágenes remotas (píxeles espía, fuga de IP) | Bloqueadas (D7): **ningún `<img>` con URL remota**; marcador con el texto alternativo y un enlace para abrirla fuera si se quiere. La CSP (`img-src 'self' blob:`, sin `https:`) es la segunda red | ✅ 7 (E2E: el píxel nunca se pide) · 12 |
| Imágenes locales | Solo las entregadas con el `.md` (ARCHITECTURE §4 sexies). `resolverRecurso` decodifica una vez, rechaza `\`, rutas absolutas y esquemas, normaliza segmento a segmento y busca exactamente en el mapa. Formato por extensión (PNG, JPEG, GIF, WebP, SVG) y tipo MIME fijado por BPDF; máximo 50 MiB. URL `blob:` solo para lo que se pinta, una por recurso, revocadas al desmontar | ✅ 7 bis (`recursos.test.ts`, `imagenes.test.ts`, `imagenes.test.tsx`, `recursos.spec.ts`) |
| SVG con scripts o recursos externos | Solo como `<img>` (el navegador no ejecuta scripts ni carga recursos de un SVG en una imagen). Abierta como página, la URL `blob:` hereda la CSP de BPDF: medido en Chromium, ni el `<script>` ni el `onload` se ejecutan y sus imágenes externas las corta la CSP antes de la red | ✅ 7 bis (`malicioso.svg` en `recursos.spec.ts`, también abierto en otra pestaña) |
| Rutas relativas con `..` (también codificadas: `%2e%2e`, `..%2f`, `%5c`) | Normalización tras decodificar una vez; un `..` que sale de la entrega es `fuera` y no se busca. Enlaces a otros ficheros: inertes. En Electron, nunca fuera de la raíz del documento | ✅ 7 bis (`recursos.test.ts`, 25 variantes), 14 |
| DOM clobbering con ids | Prefijo `md-` en los encabezados y en las notas al pie (`clobberPrefix`); un ancla del documento solo busca ids con prefijo dentro del documento | ✅ 7 (`toc.test.ts`, corpus `encabezados-clobbering.md`) |
| KaTeX: `\href`, `\url`, `\includegraphics`, `\htmlClass`, `\htmlId`, `\htmlStyle`, `\htmlData`, macros, `\rule` gigante, colores inyectados | `trust: false` (se pintan como texto, sin enlace ni atributo), `maxExpand: 1000`, `maxSize: 20`, macros nuevas por fórmula (un `\gdef` no pasa a otra), `throwOnError` (lo inválido se ve como código). **Sin HTML**: nodos creados con el `toNode()` de KaTeX, nunca `innerHTML` ni `rehype-katex`; el atributo `style` que KaTeX pone por `setAttribute` se quita (la CSP lo bloquearía). Versión exacta | ✅ 8 (`matematicas.test.ts`, `formulas-diagramas.test.tsx`, E2E con `katex-hostil.md`) |
| Mermaid: etiquetas HTML, `click`/`callback`/`link` con `javascript:`, `%%{init}%%` que relaja la seguridad o inyecta `themeCSS`, `<foreignObject>`, imágenes en nodos, ids hostiles, diagramas enormes | Corre **fuera de la app**, en el marco aislado (iframe `sandbox` sin `allow-same-origin`, CSP sin red). `securityLevel: "strict"`, `htmlLabels: false`, `secure` con todas las claves de seguridad y aspecto, `maxTextSize`/`maxEdges`, nodos con imagen rechazados antes de dibujar. SVG saneado en el marco (`sanearSvg`, lista blanca) y **verificado en la app** sin DOM (`verificarSvg`, rechaza lo que no cumpla); se muestra como `<img src="blob:…">` | ✅ 8 (`svg-seguro.test.ts`, `mermaid.test.ts`, E2E con `mermaid-hostil.md`, aislamiento del marco comprobado desde dentro) |
| Resaltado de sintaxis | `lowlight` produce un árbol hast; `resaltado.ts` lo convierte a React con lista blanca (`span` con clases `hljs-*` y texto). Sin `innerHTML`, 9 gramáticas, sin detección automática | ✅ 7 (`resaltado.test.ts`) |
| Portapapeles | Solo escritura (`writeText`) tras un clic, del texto del documento; sin pedir permisos ni leer | ✅ 7 |
| Denegación de servicio (anidamiento extremo, tablas enormes, fórmulas recursivas) | Límite de tamaño de fichero (20 MiB); recorridos propios iterativos (sin recursión que dependa del contenido); `maxExpand` de KaTeX y `maxTextSize` de Mermaid (F8). **Conocido (Fase 7): muchas listas cortas son cuadráticas** en `mdast-util-from-markdown`: un documento hecho a propósito bajo el límite puede bloquear la pestaña mucho tiempo (solo esa pestaña; nada sale del equipo). Medido en [ARCHITECTURE.md](ARCHITECTURE.md) §4 quinquies; pendiente en TAREAS | 7 (medido), 8, 13 |

### 3.2 Enlaces ✅ (Fase 7)

- Externos: `target="_blank"` y `rel="noopener noreferrer"` como red, pero el clic se
  intercepta y lo abre `Platform.openExternal`, que revalida la URL (web: pestaña nueva
  sin `opener` ni `Referer`). El clic central se anula. En Electron: nunca navegan la
  ventana; el main los abre con `shell.openExternal` tras validar el protocolo
  ([ELECTRON.md](ELECTRON.md) §4). Tests: `MarkdownView.test.tsx`, `markdown.spec.ts`
  (con `window.open` interceptado).
- Anclas internas (`#seccion`): desplazamiento dentro de la hoja y foco en la sección,
  resolviendo al id con prefijo; la URL de la app no cambia.
- Relativos a otros ficheros: texto con aviso, sin `href`. En Electron se podrán abrir en
  BPDF si están dentro de la raíz del documento (después de v1).

### 3.3 Corpus de XSS ✅ (Fase 7)

`tests/fixtures/markdown/xss/` con un caso por fichero (22) y el documento hostil
completo `seguridad.md`. `tests/components/markdown/xss.test.tsx` renderiza cada uno con
el pipeline real y comprueba el DOM: sin `script`, `iframe`, `object`, `embed`, `style`,
`link`, `meta`, `base`, `form`, `details`, `img` ni `svg` que no sea un icono de BPDF; sin
atributos `on*`, `src`, `srcdoc`, `action`…; `href` solo `http(s)`, `mailto:` o `#md-…`;
ids solo con prefijo; nada escribe en `window.__bpdfXss` ni llama a `alert`. Falla si la
carpeta se queda casi vacía. `e2e/specs/markdown.spec.ts` abre `seguridad.md` en Chromium
con la CSP real: nada se ejecuta, ningún diálogo, ninguna petición externa y pulsar cada
enlace bloqueado no hace nada. Casos:

- HTML crudo: `<script>`, `<img src=x onerror=…>`, `<svg onload=…>`, `<iframe>` (remoto
  y `srcdoc`), `<object>`, `<embed>`, `<a href="javascript:…">`, `<details open ontoggle=…>`,
  `<style>`, `<div style>`, `<link>`, `<base>`, `<meta http-equiv="refresh">`, `<form>`.
- Enlaces cuyo destino es `javascript:alert(1)`, `JAVASCRIPT:…`, `JaVaScRiPt:…`,
  `jav&#x61;script:…`, `&#106;avascript:…`, `javascript&#58;…`, `%6Aavascript:…`,
  `java\tscript:…`, un control inicial, un espacio de no separación, `data:text/html…`,
  `vbscript:…`, `file:///etc/passwd`, `ftp:`, `blob:`, `intent:`, credenciales en la URL,
  `//host`, `/ruta`, una ruta UNC y `C:\…`; autolinks `<javascript:…>` y `<data:…>`;
  definiciones de referencia `[x]: javascript:…`.
- Imágenes cuyo destino es `javascript:…`, `data:image/svg+xml…`,
  `https://tracker.example/p.gif` (también dentro de un enlace), `../../x.png`,
  `/etc/x.png`, `C:\x.png` y un SVG local.

(Los ficheros del corpus usan la sintaxis literal; aquí se describe sin ella porque
`npm run docs:enlaces` trataría cada ejemplo como un enlace roto.)
- KaTeX (Fase 8, `tests/fixtures/markdown/katex-hostil.md` y `matematicas.test.ts`):
  `\href` y `\url` con `javascript:` y externos, `\htmlClass`, `\htmlId`, `\htmlStyle`,
  `\htmlData`, `\includegraphics`, HTML en `\text`, macros recursivas y exponenciales,
  `\gdef` entre fórmulas, `\rule` gigante, colores inyectados.
- Mermaid (Fase 8, `mermaid-hostil.md` y `svg-seguro.test.ts`): `click` con
  `javascript:`, `href` y `callback`; HTML, `<script>` e `<iframe>` en etiquetas (también
  Markdown en etiquetas); `%%{init}%%` con `securityLevel: "loose"`, `htmlLabels`,
  `themeCSS` con `@import` y `dompurifyConfig`; nodos con imagen externa y `data:`; `link`
  y `callback` en clases; ids `location`, `__proto__`, `constructor`. Y SVG hostiles
  directos contra el saneador y el verificador (script, `foreignObject`, `image`,
  `animate`, `on*`, entidades, CDATA, DOCTYPE…).
- Encabezados: `# location`, `# __proto__`, `# contenido`, `# titulo-documento` (ids
  con prefijo; ninguno coincide con un id de la app).

## 4. PDF

| Vector | Control | Fase |
|---|---|---|
| PDF malformado o hostil al parser | pdf.js parsea **en su worker** (aislado del DOM de la app). Errores capturados y mostrados como «PDF dañado» (`PdfNoLegibleError`). Versión exacta (6.3.289) y actualización inmediata ante avisos (precedente: CVE-2024-4367, ejecución de JS mediante fuentes, corregida en 4.2.67) | ✅ 4 (motor, test de PDF dañado) · ✅ 5 (visor: aviso y liberación, E2E) |
| JavaScript embebido (acciones de documento, de página, de campos) | **No se distribuyen** `pdf.sandbox*` ni `quickjs-eval.*` (el motor para ejecutarlo): un E2E comprueba que dan 404. El visor no usa la capa de anotaciones interactiva de pdf.js (donde vive `enableScripting`): no hay nada que pueda ejecutar un script del PDF. Las acciones JavaScript de los enlaces se descartan (`enlaces.ts`, test y fixture `visor.pdf`) | ✅ 4 · ✅ 5 |
| Formularios XFA | `enableXfa: false` en `opcionesDocumento` (test) | ✅ 4 |
| Formularios AcroForm y anotaciones | `AnnotationMode.ENABLE`: sus apariencias se **pintan en el lienzo**; no hay capa interactiva, así que no se pueden rellenar ni ejecutan nada (D14, pendiente de confirmar) | ✅ 5 |
| Enlaces externos | Política propia ([`enlaces.ts`](../src/pdf/visor/enlaces.ts) + [`url-externa.ts`](../src/lib/url-externa.ts)): solo `http:`, `https:` y `mailto:`, absolutos y sin credenciales, hasta 2048 caracteres; abiertos por `Platform.openExternal` (web: pestaña nueva sin `opener` ni `Referer`; Electron: `shell.openExternal` desde el main, Fase 14). El `<a>` nunca navega la app (el clic se intercepta; el central se anula). Corpus de URLs hostiles en `tests/unit/pdf/enlaces.test.ts`; E2E con `window.open` interceptado | ✅ 5 |
| Acciones `Launch`, `GoToR` (otro fichero), `ImportData`, `SubmitForm`, `file:`, adjuntos | No son enlaces para BPDF: solo se siguen destinos internos, cuatro acciones con nombre de navegación y URLs permitidas. Fixture `visor.pdf` con `javascript:`, `file:` y acción JavaScript: E2E comprueba que no hay `<a>` para ellas | ✅ 5 |
| Ficheros adjuntos embebidos | No se exponen en v1 | ✅ 5 (no hay interfaz) |
| Recursos remotos | Worker, `cmaps/`, `standard_fonts/` y los decodificadores en JavaScript se sirven **desde el propio origen** (`scripts/copiar-pdfjs.mjs`); `useWasm: false`. El documento se pasa como bytes (`data`), nunca como URL (test). E2E: ninguna petición fuera del propio origen en todos los recorridos del visor, también con PDF reales | ✅ 4 · ✅ 5 |
| Agotamiento de memoria (páginas gigantes, zoom) | Tope de 16,7 Mpx por lienzo y DPR ≤ 2; virtualización (visibles ±1); presupuesto de 160 MiB para las vecinas; lienzos liberados a 0×0; `page.cleanup()` al salir; límite de tamaño de fichero (Fase 3). E2E y benchmark con 300 páginas ([ARCHITECTURE.md](ARCHITECTURE.md) §4 quater) | ✅ 5 · 13 (medir con el corpus grande) |
| PDFs cifrados | Se detectan (`PasswordException` → `PdfProtegidoError`) y se dice que BPDF aún no los abre. Pedir la contraseña espera a D13: solo en memoria, nunca persistida | ✅ 5 (detección) · D13 |
| Texto del documento en la interfaz | Capa de texto de pdf.js y resaltado de la búsqueda solo con `textContent`/`createElement` (test con texto hostil en `tests/unit/pdf/capas.test.ts`); nada de HTML en crudo | ✅ 5 |
| Post-proceso del modo oscuro | Trabaja sobre píxeles del lienzo propio (mismo origen, sin `crossOrigin`); no interpreta contenido. Por franjas, sin copiar la página entera. En un worker que solo recibe bytes RGBA | ✅ 4 · ✅ 5 |

## 5. Electron

Resumen; el diseño completo está en [ELECTRON.md](ELECTRON.md).

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`,
  `webSecurity: true`, sin `webviewTag`, sin `allowRunningInsecureContent`, sin
  `experimentalFeatures`.
- Preload mínimo con `contextBridge`: expone **funciones con propósito**, no `ipcRenderer`
  ni canales genéricos.
- Todo argumento IPC se valida con `zod` en el main; el emisor se comprueba
  (`event.senderFrame` pertenece a la ventana y al origen propio).
- El renderer nunca envía rutas: el main mantiene un mapa `id → ruta` de ficheros que el
  **usuario** eligió (diálogo, argumentos del SO, arrastre).
- Protocolo propio `app://` para la app (sin `file://`) y `bpdf-res://` de solo lectura
  para imágenes de Markdown, limitado a la raíz del documento, con `realpath` y
  comprobación de prefijo.
- `will-navigate` y `setWindowOpenHandler` deniegan todo; enlaces externos por
  `shell.openExternal` tras validar protocolo.
- `setPermissionRequestHandler` y `setPermissionCheckHandler` deniegan todo salvo
  pantalla completa y portapapeles.
- Fuses de Electron: `RunAsNode` off, `EnableNodeOptionsEnvironmentVariable` off,
  `EnableNodeCliInspectArguments` off, `EnableEmbeddedAsarIntegrityValidation` on,
  `OnlyLoadAppFromAsar` on.
- CSP también en Electron (misma fuente que la web).

## 6. Privacidad

- **Sin telemetría, analítica ni informes de errores.** ✅ Implementado en la Fase 1: se
  retiraron Sentry y Speed Insights de la plantilla, y no queda ninguna dependencia que
  envíe datos (`docs/STACK.md` → Observabilidad).
- **Ninguna petición de red provocada por un documento** (CSP + `url-policy`). La única red
  es cargar la propia app (web) o ninguna (Electron). Desde la Fase 3 los E2E de apertura
  lo comprueban en cada recorrido (§2.6).
- **Abrir un documento no guarda nada**: ni nombre, ni contenido, ni ruta, ni historial.
  Solo vive en memoria mientras está abierto (D16: uno a la vez, sin recientes).
- Persistencia mínima ([PLAN.md](PLAN.md) §8): preferencias y, si D8 lo confirma,
  posiciones por huella, sin nombres ni contenido. Borrables desde la interfaz.
- Sin cookies.
- En web, el hosting ve la carga de la app (IP, hora), como cualquier web estática, pero
  **nunca** los documentos. Se dirá en el README y en la página de privacidad.

## 7. Qué comprueba cada fase

La tabla de controles de cada sección indica la fase. La Fase 12 recorre este documento
entero, verifica cada control con su test y registra el resultado en
[auditoria.md](auditoria.md) con el formato existente (ID, severidad, estado).
