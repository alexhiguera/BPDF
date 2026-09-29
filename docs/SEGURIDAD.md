# BPDF — Seguridad y privacidad (diseño)

> **Estado: diseño objetivo** (Fase 0, *2026-09-29*). Cada control indica la fase que lo
> implementa ([FASES.md](FASES.md)). Cuando un control exista, esa fase lo marca aquí como
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

**Vigente desde la Fase 2** ✅:

```text
default-src 'none';
script-src 'self';
style-src 'self';
img-src 'self';
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

**Lo que añadirá cada fase, y por qué** (nada de esto está hoy en la política):

| Directiva | Fase | Motivo |
|---|---|---|
| `script-src 'wasm-unsafe-eval'` | 4–5 | pdf.js 6.3 compila WebAssembly (decodificadores JPEG 2000/JBIG2 e ICC en `wasm/`). Solo permite compilar WASM, **no** `eval` de JavaScript. pdf.js 6.3 no usa `eval` ni `new Function` (verificado en su código: `isEvalSupported` ya no existe) |
| `worker-src 'self'` | 4–5 | El worker de pdf.js, servido desde el propio origen |
| `connect-src 'self'` | 4–5 | pdf.js pide `cmaps/`, `standard_fonts/` y `wasm/` al propio origen |
| `img-src blob:` | 7–8 | Imágenes locales de Markdown y diagramas Mermaid convertidos en `<img>` |
| `font-src 'self'` | 8 | Fuentes de KaTeX servidas desde el propio origen |
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
| PDF malformado o hostil al parser | pdf.js parsea **en su worker** (aislado del DOM de la app). Errores capturados y mostrados como «PDF dañado». Versión exacta y actualización inmediata ante avisos (precedente: CVE-2024-4367, ejecución de JS mediante fuentes, corregida en 4.2.67) | 5 |
| JavaScript embebido (acciones de documento, de página, de campos) | `enableScripting: false`; **no se distribuye** `pdf.sandbox.mjs` | 5 |
| Formularios XFA | `enableXfa: false` (por defecto) | 5 |
| Formularios AcroForm | `annotationMode: AnnotationMode.ENABLE` (se pintan, no son editables) (D14) | 5 |
| Enlaces externos | pdf.js ya limita a `http`, `https`, `ftp`, `mailto`, `tel`; BPDF restringe a `http`, `https`, `mailto` y los abre con `noopener noreferrer` (Electron: vía main) | 5 |
| Acciones `Launch`, `GoToR` (otro fichero), `ImportData`, `SubmitForm`, `file:` | No se ejecutan: sin scripting y con el filtro de enlaces. Test con fixture que las contiene | 5 |
| Ficheros adjuntos embebidos | No se exponen en v1 | 5 |
| Recursos remotos | pdf.js carga `cmaps/`, `standard_fonts/` y `wasm/` **desde el propio origen**; `connect-src 'self'`. El documento se pasa como `ArrayBuffer`, nunca como URL | 5 |
| Agotamiento de memoria (páginas gigantes, zoom) | `maxCanvasPixels`, límite de tamaño de fichero, virtualización | 5, 13 |
| PDFs cifrados | Contraseña solo en memoria, nunca persistida (D13) | 5 |
| Post-proceso del modo oscuro | Trabaja sobre píxeles del lienzo propio; no interpreta contenido | 4, 5 |

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
  es cargar la propia app (web) o ninguna (Electron).
- Persistencia mínima ([PLAN.md](PLAN.md) §8): preferencias y, si D8 lo confirma,
  posiciones por huella, sin nombres ni contenido. Borrables desde la interfaz.
- Sin cookies.
- En web, el hosting ve la carga de la app (IP, hora), como cualquier web estática, pero
  **nunca** los documentos. Se dirá en el README y en la página de privacidad.

## 7. Qué comprueba cada fase

La tabla de controles de cada sección indica la fase. La Fase 12 recorre este documento
entero, verifica cada control con su test y registra el resultado en
[auditoria.md](auditoria.md) con el formato existente (ID, severidad, estado).
