# BPDF — Seguridad y privacidad (diseño)

> **Estado: diseño objetivo** (Fase 0, *2026-09-29*); implementados los controles de las
> Fases 2 (CSP, cabeceras, DOM) y 3 (apertura de ficheros, §2.6). Cada control indica la
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
- la configuración del hosting (Fase 12/15) y el protocolo `app://` de Electron (Fase 14).

En `vite dev` **no hay CSP**: Vite inyecta scripts y estilos en línea para desarrollar.
Nada se da por bueno por funcionar en `dev`.

**Vigente** ✅ (Fase 2; la Fase 4 añadió `worker-src` y `font-src`):

```text
default-src 'none';
script-src 'self';
style-src 'self';
img-src 'self';
worker-src 'self';            ← Fase 4: el worker de pdf.js, desde el propio origen
font-src 'self';              ← Fase 4: sustitutas de las fuentes estándar de PDF
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
- `connect-src`: con el documento entregado como bytes, pdf.js no hace `fetch` en los
  casos medidos. Si un PDF con fuentes CID (cmaps) lo necesitara, aparecería como
  violación en el E2E y se añadiría con su motivo.

**Lo que añadirán otras fases, y por qué** (nada de esto está hoy en la política):

| Directiva | Fase | Motivo |
|---|---|---|
| `img-src blob:` | 7–8 | Imágenes locales de Markdown y diagramas Mermaid convertidos en `<img>` |
| `img-src data:` | 8, solo si KaTeX lo exige | Se prueba antes de añadirlo |

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
desconocida produce un error en consola. `fullscreen` y `clipboard-write` se declaran
en las fases que los usen (6 y 7).

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

- Enlaces externos: `target="_blank"` + `rel="noopener noreferrer"`; solo `http:`,
  `https:` y `mailto:` (§3.2).
- Sin iframes propios (`frame-src 'none'`). Mermaid **no** usa `securityLevel: "sandbox"`
  (que necesita un iframe `data:`), sino SVG convertido a `<img>`.
- Workers: solo el de pdf.js, servido desde `'self'`. Sin workers creados desde `blob:`.
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
| Contenido que se ejecute al abrir | Nada se interpreta: un Markdown con `<script>`, `<img onerror>`, `<iframe>` remoto y enlaces `javascript:` es solo texto en memoria | `read.test.ts`, `App.test.tsx`, `abrir.spec.ts` (`html-y-script.md`: nada se ejecuta ni se pide a la red) |
| Peticiones de red o URL que sobrevivan al documento | Lectura con `Blob.arrayBuffer()`; sin `fetch`, subida ni URL de objeto (`blob:`), así que no hay nada que revocar. Los visores futuros que las creen (imágenes de Markdown, Fase 7) las revocan al desmontarse, y se montan con `key={document.id}` | `tests/unit/platform/web.test.ts`, `tests/components/DocumentProvider.test.tsx` (ni `fetch` ni `createObjectURL`); `abrir.spec.ts` (ninguna petición fuera del origen) |
| Soltar un fichero fuera de la app lo abre el navegador en la pestaña | La zona de soltar cubre la ventana entera y cancela el comportamiento por defecto solo en arrastres de ficheros | `tests/components/DropZone.test.tsx` |
| Resultado tardío de una apertura anterior | Solo aplica su resultado la última apertura (turnos); cerrar descarta la que esté en curso | `DocumentProvider.test.tsx` |

La CSP no cambia en esta fase: leer ficheros locales no necesita ninguna directiva nueva
(cero violaciones en los E2E de apertura).

## 3. Markdown

### 3.1 Controles

| Vector | Control | Fase |
|---|---|---|
| `<script>`, `<iframe>`, `<img onerror>`, `<svg onload>`, cualquier HTML crudo | `react-markdown` **no interpreta HTML** (sin `rehype-raw`, D6). El HTML se ignora | 7 |
| Atributos de evento, `style` inyectado | No hay HTML crudo; los componentes propios solo emiten atributos conocidos | 7 |
| `javascript:`, `vbscript:`, `data:text/html`, `file:`, variantes con mayúsculas, entidades (`jav&#x61;script:`), espacios y caracteres de control | `url-policy.ts` propio sobre la URL ya decodificada: enlaces solo `http:`, `https:`, `mailto:` y anclas `#…`; imágenes solo rutas relativas resueltas contra `resources` → `blob:`. Todo lo demás se renderiza como texto | 7 |
| Imágenes remotas (píxeles espía, fuga de IP) | Bloqueadas (D7) por `url-policy.ts` **y** por la CSP | 7, 12 |
| SVG con scripts | Solo como `<img>` (el navegador no ejecuta scripts ni carga recursos en SVG como imagen) | 7 |
| Rutas relativas con `..` | Normalización; nunca fuera del conjunto de ficheros entregado (web) ni de la raíz del documento (Electron) | 7, 14 |
| DOM clobbering con ids | Prefijo `md-` | 7 |
| KaTeX: `\href`, `\url`, `\includegraphics`, `\htmlClass`/`\htmlData` | `trust: false` (por defecto), `strict: "warn"`, `maxSize` y `maxExpand` acotados (KaTeX ha tenido avisos de seguridad en 2024 por protocolos y expansiones sin límite). Versión exacta | 8 |
| Mermaid: etiquetas HTML, `click` con `javascript:`, directivas `%%{init}%%` que cambian `securityLevel` | `securityLevel: "strict"`, `htmlLabels: false`, directivas de seguridad ignoradas (`secure`), y el SVG resultante **se muestra como `<img src="blob:…">`**: aunque Mermaid dejara pasar algo, en una imagen no se ejecuta | 8 |
| Resaltado de sintaxis | `rehype-highlight` produce nodos hast (clases), sin HTML | 7 |
| Denegación de servicio (anidamiento extremo, tablas enormes, fórmulas recursivas) | Límite de tamaño de fichero; `maxExpand` de KaTeX; `maxTextSize` de Mermaid; medir en Fase 13 | 7, 8, 13 |

### 3.2 Enlaces

- Externos: nueva pestaña con `noopener noreferrer`. En Electron: nunca navegan la
  ventana; el main los abre con `shell.openExternal` tras validar el protocolo
  ([ELECTRON.md](ELECTRON.md) §4).
- Anclas internas (`#seccion`): desplazamiento dentro de la hoja, resolviendo al id con
  prefijo.
- Relativos a otros `.md`: en web se muestran como enlace no navegable con aviso; en
  Electron se podrán abrir en BPDF si están dentro de la raíz del documento (después de
  v1).

### 3.3 Corpus de XSS (test obligatorio, Fase 7)

`tests/fixtures/markdown/xss/` con un caso por fichero y un test que renderiza cada uno y
comprueba el DOM: sin `script`, `iframe`, `object`, `embed`, `svg` en línea, atributos
`on*`, ni `href`/`src` fuera de lo permitido. Casos mínimos:

- HTML crudo: `<script>`, `<img src=x onerror=…>`, `<svg onload=…>`, `<iframe>`,
  `<a href="javascript:…">`, `<details open ontoggle=…>`.
- Enlaces en línea cuyo destino es `javascript:alert(1)`, `JaVaScRiPt:…`,
  `jav&#x61;script:…`, `java\tscript:…`, `data:text/html;base64,…`, `vbscript:…` o
  `file:///etc/passwd`; autolink `<javascript:alert(1)>`; definición de referencia
  `[x]: javascript:…`.
- Imágenes cuyo destino es `javascript:…`, `https://tracker.example/p.gif` o
  `../../x.png`; SVG local con `<script>`.

(Los ficheros del corpus usan la sintaxis literal; aquí se describe sin ella porque
`npm run docs:enlaces` trataría cada ejemplo como un enlace roto.)
- KaTeX (Fase 8): `\href{javascript:alert(1)}{x}`, `\url{javascript:…}`, macro recursiva.
- Mermaid (Fase 8): `click A "javascript:alert(1)"`, etiqueta con `<img onerror>`,
  `%%{init: {"securityLevel": "loose"}}%%`.
- Encabezados: `# location`, `# __proto__` (ids con prefijo).

## 4. PDF

| Vector | Control | Fase |
|---|---|---|
| PDF malformado o hostil al parser | pdf.js parsea **en su worker** (aislado del DOM de la app). Errores capturados y mostrados como «PDF dañado» (`PdfNoLegibleError`). Versión exacta (6.3.289) y actualización inmediata ante avisos (precedente: CVE-2024-4367, ejecución de JS mediante fuentes, corregida en 4.2.67) | ✅ 4 (motor y test de PDF dañado) · 5 (visor) |
| JavaScript embebido (acciones de documento, de página, de campos) | **No se distribuyen** `pdf.sandbox*` ni `quickjs-eval.*` (el motor para ejecutarlo): un E2E comprueba que dan 404. `enableScripting` es una opción de la capa de anotaciones y se fija en `false` en la Fase 5 | ✅ 4 (ficheros) · 5 |
| Formularios XFA | `enableXfa: false` en `opcionesDocumento` (test) | ✅ 4 |
| Formularios AcroForm | `annotationMode: AnnotationMode.ENABLE` (se pintan, no son editables) (D14) | 5 |
| Enlaces externos | pdf.js ya limita a `http`, `https`, `ftp`, `mailto`, `tel`; BPDF restringe a `http`, `https`, `mailto` y los abre con `noopener noreferrer` (Electron: vía main) | 5 |
| Acciones `Launch`, `GoToR` (otro fichero), `ImportData`, `SubmitForm`, `file:` | No se ejecutan: sin scripting y con el filtro de enlaces. Test con fixture que las contiene | 5 |
| Ficheros adjuntos embebidos | No se exponen en v1 | 5 |
| Recursos remotos | Worker, `cmaps/`, `standard_fonts/` y los decodificadores en JavaScript se sirven **desde el propio origen** (`scripts/copiar-pdfjs.mjs`); `useWasm: false`. El documento se pasa como bytes (`data`), nunca como URL (test). E2E: ninguna petición fuera del propio origen | ✅ 4 |
| Agotamiento de memoria (páginas gigantes, zoom) | `maxCanvasPixels`, límite de tamaño de fichero, virtualización | 5, 13 |
| PDFs cifrados | Contraseña solo en memoria, nunca persistida (D13) | 5 |
| Post-proceso del modo oscuro | Trabaja sobre píxeles del lienzo propio (mismo origen, sin `crossOrigin`); no interpreta contenido. Por franjas, sin copiar la página entera | ✅ 4 |

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
