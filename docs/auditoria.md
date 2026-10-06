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

## Auditoría 1 — *2026-10-03* — Fase 12: superficie web antes de publicar

**Estado: CERRADA / APROBADA** el *2026-10-03* (revisada con el usuario y verificada en
producción con `96fcafb`).

**Alcance.** Toda la superficie web de BPDF: CSP de la app y del marco de Mermaid,
cabeceras de cada ruta (`vite preview` y `vercel.json`), `Permissions-Policy`, workers,
iframe y `postMessage`, apertura externa, almacenamiento del navegador, todo lo que puede
provocar tráfico, documentos hostiles (Markdown, KaTeX, Mermaid, PDF), dependencias y su
cadena de suministro, y los workflows de CI. Controles de [SEGURIDAD.md](SEGURIDAD.md)
§2–§4 y §6, uno a uno (§5, Electron, es histórico: D19). No se reabrió nada de fases
cerradas: no apareció ningún fallo de seguridad real que lo pidiera.

**Qué se comprobó y cómo.**

- **Código propio** (`src/`, búsqueda manual y el test de `seguridad.test.ts`): ni
  `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` ni
  `new Function` (zod va con `jitless`). `postMessage`: tres usos, revisados abajo.
  `window.open`: uno, en `Platform.openExternal`, con la URL revalidada y
  `noopener,noreferrer`. `target="_blank"`: cuatro (enlaces y marcador de imagen remota de
  Markdown, enlaces de PDF, crédito de R3ZON), todos con `rel="noopener noreferrer"` y el
  clic interceptado por `openExternal`.
- **Código de terceros en la build** (`dist/assets`, búsqueda de sumideros): `innerHTML`
  en React (solo para `dangerouslySetInnerHTML`, prohibido en `src/`, y un truco interno
  para crear `<script>` que BPDF nunca pinta), en el decodificador de entidades de
  micromark (escribe `&nombre;` con un nombre que el parser ya validó) y en d3/Mermaid
  (dentro del marco aislado, otro documento con otra CSP). Sin `eval` ni `new Function`
  ejecutables: los `Function(` que aparecen son detecciones de `globalThis` que no llegan
  a ejecutarse (cero violaciones en los E2E). pdf.js 6 ya no tiene `isEvalSupported` ni
  ninguna ruta con `eval`. Ninguna dependencia usa cookies, IndexedDB, Cache API,
  service workers, `sendBeacon`, WebSocket ni `EventSource`; los `localStorage` y
  `sessionStorage` que aparecen en el lector son palabras reservadas de la gramática de
  JavaScript de highlight.js.
- **CSP**, directiva a directiva ([SEGURIDAD.md](SEGURIDAD.md) §2.1): ninguna se puede
  quitar sin romper algo medido; queda congelada en un test.
- **Trusted Types (T-4)**: la CSP con `require-trusted-types-for 'script'` en una copia de
  la build, contra todos los E2E (resultado abajo, A1-5).
- **Cabeceras de todas las rutas** contra la fuente: E2E nuevo; producción con
  `npm run cabeceras:verificar` y `curl -I`.
- **Producción** (*2026-10-03*, versión desplegada anterior a la Fase 11): un navegador
  recorre `https://bpdf.r3zon.com` con `diagramas.md`, `mermaid-hostil.md`,
  `matematicas.md` y `cjk.pdf`, vigilando consola, CSP y red.
- **Dependencias**: `npm audit` (también `--omit=dev`), versiones publicadas de los
  motores, avisos de seguridad de pdf.js, KaTeX y Mermaid en GitHub, origen e integridad
  de cada entrada del lockfile, `allowScripts` con npm 11.19 (código de npm leído).
- **Que los tests nuevos detectan el fallo**: dos mutaciones en copias aparte (pdf.js sin
  pintar las anotaciones; la política sin `clipboard-read`): fallan los dos tests.

### Hallazgos

| ID | Sev. | Hallazgo | Estado |
|---|---|---|---|
| A1-1 | 🟡 | `Permissions-Policy` no negaba `clipboard-read`, aunque BPDF nunca lee el portapapeles; y de la familia del hardware solo negaba `usb` | **Cerrado** (iteración 27): `clipboard-read=()`, `serial=()`, `hid=()` y `midi=()`. `clipboard-write` y `fullscreen` siguen permitidos (los usan «Copiar» y la pantalla completa). `bluetooth` se descartó: Chrome no lo reconoce en esta cabecera y da un error en consola (lo cazó la vigilancia de los E2E). Unitario + E2E: la app no puede leer el portapapeles con el permiso concedido; escribir y pegar con Ctrl+V siguen funcionando |
| A1-2 | 🟡 | Los E2E solo comprobaban 5 de las 8 cabeceras, y solo en `/`: `Permissions-Policy`, CORP y HSTS no se miraban en ninguna ruta servida; `/mermaid.html` solo la CSP | **Cerrado** (iteración 27): `seguridad.spec.ts` compara TODAS las cabeceras de la fuente en `/`, `/mermaid.html`, un módulo de `/assets/`, el worker de pdf.js, el favicon, `robots.txt` y un 404, y que `Access-Control-Allow-Origin` solo va en `/assets/`. Y un unitario congela la lista exacta de cabeceras por ruta y la CSP entera de la app y del marco |
| A1-3 | 🟡 | Ningún test comprobaba cookies, IndexedDB, Cache API ni service workers tras un recorrido completo (solo `localStorage`/`sessionStorage` en recorridos sueltos) | **Cerrado** (iteración 27): E2E con PDF (posición y preferencia guardadas), Markdown con KaTeX y Mermaid, y el editor: solo `bpdf:prefs` y `bpdf:positions`; ni cookies, ni `sessionStorage`, ni IndexedDB, ni cachés, ni service workers |
| A1-4 | 🟡 | D14 (formularios visibles, no rellenables) sin test automático: ningún PDF de prueba tenía campos AcroForm | **Cerrado** (iteración 27): `crearPdfFormulario()` (campo de texto y casilla con apariencia, JavaScript al abrir y en el campo). Unitario: pdf.js ve los dos campos y su JavaScript. E2E: sus apariencias se pintan, no hay capa de anotaciones ni controles en la página, pulsar y teclear no escribe nada y ningún diálogo se abre |
| A1-5 | 🟢 | **T-4: Trusted Types no se adopta en v1.** Medido: con `require-trusted-types-for 'script'`, 49 de 116 E2E fallan (220 bloqueos `TrustedScriptURL`: el worker de pdf.js y el del modo oscuro). Además el decodificador de entidades de micromark usa `innerHTML` (los E2E no tienen ninguna entidad con nombre, así que no lo destaparon). Adoptarlo exige una política `default` propia que deje pasar los dos workers y ese `innerHTML`, cargada antes que nada | **Aceptado: no adoptado en v1** (decisión del usuario, *2026-10-03*; revisado tras la F13 sin cambios y confirmado al cerrarla, *2026-10-04*). Motivo: los sumideros que protegería están inventariados (arriba) y ninguno recibe HTML del documento; la política `default` sería un punto de paso que hay que mantener, y Safari 26 (y quizá Firefox) aplicaría Trusted Types en rutas de código que solo se han probado en Chromium (la compatibilidad es de la F13), con el riesgo de romper funciones sin aviso. Se reevalúa tras la F13 o si una dependencia nueva introduce sumideros |
| A1-6 | 🟢 | Vercel manda `Access-Control-Allow-Origin: *` en **todas** las rutas (`/`, `/mermaid.html`…), no solo en `/assets/` como la fuente. `cabeceras:verificar` no lo ve: solo comprueba las cabeceras que la fuente define | **Aceptado**: son ficheros estáticos y públicos, sin cookies, credenciales ni datos de usuario; permite a otra web leer el HTML público, nada más. No se puede quitar desde `vercel.json` sin sobrescribirla con otro valor |
| A1-7 | 🟢 | `X-Frame-Options` es redundante con `frame-ancestors` en todos los navegadores mínimos | **Aceptado**: se conserva (no cuesta nada y cubre a quien no aplique CSP 2); documentado en `security-headers.ts` |
| A1-8 | 🟢 | `postMessage(…, "*")` en el marco de Mermaid (respuesta) y en la app (petición) | **Aceptado, correcto**: el marco tiene origen opaco y no hay otro destino posible; solo BPDF puede enmarcarlo (`frame-ancestors 'self'`); el marco solo atiende a `window.parent` y la app solo a ese iframe (`source`), con origen `"null"` y mensajes bien formados; el SVG se verifica en la app antes de mostrarlo como `<img>` |
| A1-9 | 🟢 | Actions de GitHub fijadas por etiqueta (`@v4`), no por SHA; `actions/checkout` deja el token en `.git/config` (`persist-credentials` por defecto) mientras corren `npm ci`, la build y los tests | **Aceptado** como mejora ([mejoras.md](mejoras.md)): los tres workflows tienen `permissions: contents: read` y ningún secreto salvo el webhook opcional de Discord en un job aparte |
| A1-10 | 🟢 | Hay versiones nuevas de los motores: pdf.js 6.4.299 (fijada 6.3.289), KaTeX 0.19.0 (0.18.9), highlight.js 11.12.0 (11.11.1, que pide `lowlight`), Mermaid 12.1.0 (11.17.2) | **Aceptado**: ningún aviso publicado afecta a las versiones fijadas. pdf.js CVE-2026-16633 (GHSA-hq66-cqwq-w95j, JavaScript arbitrario) se corrigió en 6.2.108 y además exigía `enableScripting` y una CSP sin `script-src`. KaTeX GHSA-238p-pmpm-9mq7, en 0.18.2. Los de Mermaid de 2026, en 11.16.1. `npm audit`: 0. Mermaid 12 queda fuera de v1 (decisión del usuario) |
| A1-11 | 🟢 | `fsevents@2.3.3` aparecía como paquete con scripts sin aprobar (npm 11.17) | **Cerrado** (iteración 27): con npm 11.19, `npm ci` no avisa. npm ignora las opcionales que no aplican a la plataforma (npm/cli#9562) y en macOS solo cuenta `preinstall`/`install`/`postinstall` o un `binding.gyp`, y el paquete publicado no trae ninguno (solo su binario compilado). No hace falta denegarlo en `allowScripts` |
| A1-13 | 🟢 | GHSA-238p-pmpm-9mq7 (KaTeX `>=0.11.0 <0.18.2`, bajo, publicado tras la Auditoría 1) afecta a la copia **transitiva** de KaTeX (0.16.47) que traen Mermaid 11.17.2 y `micromark-extension-math` 3.1.0; no hay 0.16.x corregida. `npm audit`: 4 avisos bajos, todos este | **Aceptado como riesgo conocido de dependencia transitiva para v1** (decisión del usuario, *2026-10-06*). BPDF pinta sus fórmulas con `katex@0.18.9`, que no está afectado. La copia vulnerable que llega a producción es `katex@0.16.47`, transitiva de Mermaid 11.17.2, que declara `katex ^0.16.47`: forzar 0.18.x queda fuera del rango de upstream. El aviso es de gravedad baja y explotarlo exige además una contaminación de prototipo previa. Esa copia solo corre en el marco aislado de Mermaid (iframe `sandbox="allow-scripts"`, origen opaco, CSP con `connect-src`, `img-src` y `font-src` a `'none'`, sin red) y su SVG se sanea y se muestra como `<img>`. La copia de `micromark-extension-math` no llega a la build. Un `override` fuera de rango aportaría ahora más riesgo de compatibilidad que reducción de riesgo real. Sin `npm audit fix --force` (bajaría Mermaid a 10.8.0). Se retira cuando Mermaid admita KaTeX ≥ 0.18.2 (TAREAS) |
| A1-12 | 🟢 | Un Markdown hecho a propósito (muchas listas cortas) bloquea la pestaña (cuadrático en `mdast-util-from-markdown`) | **Cerrado** (iteración 29, Fase 13): era una regresión de micromark 4.0.3 (micromark#246); BPDF fija la 4.0.2 con un `override` y vuelve a ser lineal (200 KB de listas: 1,45 s en el navegador) |

**Verificado y correcto.**

- **CSP**: `default-src 'none'` y solo lo medido; sin `unsafe-*`, `data:`, `https:` ni
  comodines. `'unsafe-inline'` solo en el estilo del marco de Mermaid, de origen opaco y
  sin red. Cero violaciones en los 120 E2E, también con KaTeX, Mermaid, CodeMirror, el
  favicon, las imágenes `blob:` y los dos workers.
- **Red**: nada sale del origen salvo lo que el usuario pide de forma explícita
  ([SEGURIDAD.md](SEGURIDAD.md) §6). Comprobado en cada E2E y en producción.
- **Almacenamiento**: solo `bpdf:prefs` y `bpdf:positions`, validadas como dato hostil,
  borrables desde la interfaz, sin nombres, contenido, contraseñas, búsquedas ni estado
  del editor ([SEGURIDAD.md](SEGURIDAD.md) §6).
- **Documentos hostiles**: corpus de XSS de Markdown (22 casos y `seguridad.md`), URLs,
  imágenes remotas, SVG con scripts, traversal, recursos no entregados, KaTeX y Mermaid
  hostiles, PDF dañado, cifrado, enlaces y acciones hostiles, JavaScript de PDF (sin motor
  ni sandbox servidos: 404), XFA desactivado, formularios (nuevo), cierre y cancelación a
  mitad de pintar (iteración 25). Cubiertos por sus tests; no se añadió ninguno repetido.
- **Producción** (versión desplegada, anterior a la Fase 11): `cabeceras:verificar` en
  verde para `/`, `/mermaid.html` y un módulo del marco; el recorrido con Mermaid (4
  diagramas, marco `sandbox="allow-scripts"`), Mermaid hostil (nada ejecutado), KaTeX (8
  fórmulas) y un PDF con cmaps: **cero errores, cero violaciones, ninguna petición
  externa** y ningún almacenamiento creado.
- **Producción con la Fase 12 desplegada** (`96fcafb`, *2026-10-03*): `cabeceras:verificar` en
  verde, con la `Permissions-Policy` nueva en `/` y `/mermaid.html`. Un recorrido con Markdown,
  «Copiar código», Mermaid, `mermaid-hostil.md`, KaTeX, PDF con cmaps, PDF con formulario,
  editor y pegar con Ctrl+V da **cero errores, cero violaciones y ninguna petición externa**:
  - el marco de Mermaid solo pidió sus 30 módulos a `/assets/`;
  - la app no puede leer el portapapeles, y copiar y pegar funcionan;
  - los campos del formulario se ven y no se rellenan;
  - almacenamiento: solo `bpdf:prefs` y `bpdf:positions` (al cambiar de página), sin nombres
    de fichero; ni cookies, `sessionStorage`, IndexedDB, cachés ni service workers.
- **Cadena de suministro**: 531 entradas en el lockfile, todas de
  `registry.npmjs.org` y con `integrity`; motores con versión exacta (los rangos `^`
  son `react`, `react-dom`, `lucide-react`, `clsx` y `tailwind-merge`, que no procesan
  contenido del documento); sin `overrides`; ningún script de instalación pendiente.
