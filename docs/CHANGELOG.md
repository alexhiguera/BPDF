# Bitácora

Registro de iteraciones para quien mantiene el código: **qué** cambió, **por qué**, qué
se descartó y qué salió mal por el camino. Convención en [`CLAUDE.md`](../CLAUDE.md) §7.
Las entradas nuevas van arriba. Los números de iteración solo tienen que ser únicos:
nunca se renumeran.

La historia de la plantilla de la que nace BPDF está en la bitácora del repositorio de
R3ZON SaaS Template.

---

### Iteración 27 — *2026-10-03* — Fase 12: seguridad, endurecimiento y auditoría (implementada, pendiente de revisión)

**Contexto.** La Fase 12 según su especificación (FASES): recorrer SEGURIDAD control a
control, cerrar la CSP, decidir T-3 y T-4, revisar cabeceras, dependencias y CI, y dejar la
auditoría escrita ([auditoria.md](auditoria.md), Auditoría 1). Sin funciones nuevas y sin
reabrir fases cerradas: no apareció ningún fallo de seguridad que lo pidiera. **Queda
IMPLEMENTADA / PENDIENTE DE REVISIÓN** con el usuario (cabeceras, CSP,
`Permissions-Policy`, producción, dependencias y riesgos aceptados).

**Hecho, y por qué así:**
- **CSP: sin cambios, y congelada.** Revisada directiva a directiva (tabla en SEGURIDAD
  §2.1: qué la necesita, si se puede quitar, qué amenaza limita). Ninguna sobra: `img-src
  'self'` es el favicon, `connect-src` los cmaps, `frame-src` el marco, y así las demás.
  `frame-src` no se puede acotar a `/mermaid.html` (`'self'` no admite rutas). Un unitario
  fija la política entera de la app y del marco: cambiarla obliga a cambiar el test y la
  tabla. **T-3 cerrada.**
- **`Permissions-Policy`**: `clipboard-read=()` (BPDF nunca lee el portapapeles) y, de la
  familia del hardware, `serial`, `hid` y `midi` junto al `usb` que ya estaba. Quedan
  permitidos `clipboard-write` («Copiar») y `fullscreen` (visor PDF). La lista vive en
  `CAPACIDADES_NEGADAS`, con el motivo de cada una. **`bluetooth` se probó y se quitó**:
  Chrome no lo reconoce en esta cabecera y da un error en consola en todas las páginas (lo
  cazó la vigilancia de los E2E). `vercel.json` regenerado.
- **Cabeceras revisadas una a una** (SEGURIDAD §2.2). Ninguna añadida por lista: COEP no
  hace falta (sin `SharedArrayBuffer`) y podría romper el marco; `X-DNS-Prefetch-Control`
  no aporta (los navegadores ya no hacen prefetch de los enlaces en HTTPS);
  `X-XSS-Protection` está retirada. `X-Frame-Options` es redundante con `frame-ancestors`
  y se conserva (no cuesta nada). Cada una lleva su motivo en `security-headers.ts`.
- **T-4 (Trusted Types): medida y no adoptada en v1**, pendiente de confirmar. En una copia
  con `require-trusted-types-for 'script'`, 49 de 116 E2E fallan: 220 bloqueos
  `TrustedScriptURL` (el worker de pdf.js y el del modo oscuro). Además el decodificador de
  entidades de micromark usa `innerHTML`, sin E2E que lo pise. Adoptarla exige una política
  `default` propia para esos tres casos. Los sumideros de la build están inventariados y
  ninguno recibe HTML del documento, y Safari 26 la aplicaría en rutas de código probadas
  solo en Chromium. Se reevalúa tras la F13.
- **Portapapeles en los E2E.** Dos tests comprobaban «Copiar» leyendo el portapapeles desde
  la app, que ahora no puede (y es lo que se quería). En vez de debilitarlos o interceptar
  `writeText`, se lee el portapapeles **del sistema** desde una página auxiliar del mismo
  origen que sirve Playwright sin esa cabecera (`e2e/portapapeles.ts`). Pegar con Ctrl+V en
  el editor sigue funcionando sin tocar su test: es el `paste` del usuario, que la política
  no afecta.
- **`e2e/specs/seguridad.spec.ts`** (huecos reales, nada repetido):
  - **cabeceras**: las de la fuente, todas, en siete rutas (`/`, `/mermaid.html`, un
    módulo, el worker de pdf.js, el favicon, `robots.txt` y un 404). Antes los E2E miraban
    5 de 8 y solo en `/`;
  - **portapapeles**: la app no puede leerlo aunque el contexto tenga el permiso (y Chrome
    dice que lo bloquea la política), pero sí escribir;
  - **almacenamiento**: tras un recorrido completo (PDF con posición y miniaturas, Markdown
    con KaTeX y Mermaid, editor), solo `bpdf:prefs` y `bpdf:positions`. Ni cookies, ni
    `sessionStorage`, ni IndexedDB, ni cachés, ni service workers;
  - **D14**: un PDF con campo de texto, casilla y JavaScript al abrir y en el campo
    (`crearPdfFormulario()`, en memoria). Sus apariencias se pintan, no hay capa de
    anotaciones ni controles, teclear no escribe nada y no se abre ningún diálogo. Un
    unitario con pdf.js real asegura la premisa: ve los dos campos y su JavaScript.
- **Los tests nuevos detectan el fallo**, comprobado con dos mutaciones en copias aparte:
  con pdf.js sin pintar las anotaciones falla el de D14, y sin `clipboard-read` el del
  portapapeles.
- **`fsevents` resuelto sin tocar `allowScripts`** (STACK). Con npm 11.19 `npm ci` no avisa
  (npm/cli#9562: las opcionales que no aplican a la plataforma no cuentan). En macOS npm
  solo miraría `preinstall`/`install`/`postinstall` o un `binding.gyp`, y el tarball no trae
  ninguno. Comprobado con un `npm ci` aislado, el tarball y el código de npm. STACK y CLAUDE
  ya documentaban el comando bueno (`npm install-scripts`); `npm approve-scripts` también
  existe, pero solo aprueba.
- **Dependencias.** `npm audit` 0 (también solo runtime). Lockfile: 531 entradas, todas del
  registro oficial y con `integrity`. Avisos publicados de pdf.js (CVE-2026-16633), KaTeX y
  Mermaid: todos corregidos antes de las versiones fijadas. Hay versiones nuevas (pdf.js
  6.4.299, KaTeX 0.19.0); no se actualizan en esta fase porque ningún aviso lo pide.
  Mermaid se queda en 11.17.2.
- **CI**: los tres workflows con `permissions: contents: read`. Actions por etiqueta y
  `persist-credentials` por defecto, que quedan como mejora ([mejoras.md](mejoras.md)).
- **Producción** (`https://bpdf.r3zon.com`, versión desplegada anterior a la F11):
  - `cabeceras:verificar` en verde, y `/mermaid.html` responde 200 con su CSP; la tarea
    antigua de «sin cabeceras en producción» estaba superada;
  - un recorrido con Mermaid, Mermaid hostil, KaTeX y un PDF con cmaps da **cero errores,
    cero violaciones y ninguna petición externa**, y no crea almacenamiento;
  - encontrado: Vercel manda `Access-Control-Allow-Origin: *` en todas las rutas (aceptado,
    A1-6);
  - **lo nuevo no está desplegado**: se repite tras el push.

**Descartado.**
- Interceptar `writeText` en los E2E de «Copiar», porque no comprobaría el portapapeles real.
- Denegar `fsevents` «por si acaso», que es una entrada que no cambia nada.
- Subir pdf.js o KaTeX sin un aviso que lo pida.
- Una lista larga de `Permissions-Policy`.

**Verificación.** `lint`, `typecheck`, `npm test` **1001/1001**
(53 ficheros), `test:e2e` **120/120**, `build`, `build:tamano` (94,8 KB, sin cambios),
`docs:enlaces` (282), `docs:validar` y `npm audit` (0). En la primera pasada completa de
los E2E falló uno del editor de la F9 («la vista previa se refresca 200 ms después…»): exige
que la vista previa aún NO se haya refrescado y, con la suite entera cargando el equipo, los
pasos del propio test tardaron más de 200 ms. Pasa 8 de 8 aislado y no toca nada de esta
fase; anotado en TAREAS, sin debilitarlo.

### Iteración 26 — *2026-10-03* — El mínimo de Firefox es 128 (Tailwind 4), no 114

**Contexto.** Corrección del usuario a la iteración 25: el soporte oficial de Tailwind CSS
4 es Chrome 111, Safari 16.4 y **Firefox 128**, así que ese es el mínimo de BPDF.
Firefox 114 era solo lo que pide pdf.js 6 (su worker es un módulo ES).

- `build.target`: `firefox114` → `firefox128`, con el motivo en `vite.config.ts`. Sin
  polyfills ni compatibilidad artificial con versiones anteriores.
- STACK, ARCHITECTURE y FASES (Fase 5) dicen que el mínimo global lo fija Tailwind 4 y que
  pdf.js por sí solo funcionaría desde Firefox 114. El spike de modo oscuro anota el
  valor de hoy.
- **Error propio:** en la iteración 25 apunté la duda («STACK dice Firefox 111 por Tailwind,
  pero su documentación cita 128») y no la comprobé antes de fijar 114. La entrada de la
  iteración 25 no se reescribe: esta la corrige.
- D14, D5 y D19 siguen confirmadas.

### Iteración 25 — *2026-10-03* — Antes de la Fase 12: arreglo de `worker-destruido`; D5, D14 y Firefox 114 confirmados

**Contexto.** Un arreglo aislado de una deuda de la Fase 5 y tres decisiones del usuario,
sin empezar la Fase 12. No se tocó Markdown, preferencias ni la Fase 11.

**`worker-destruido`: la causa exacta.** `oscurecerLienzo` (`src/pdf/dark/aplicar.ts`)
recolorea por franjas con **hasta dos en el worker a la vez**, pero solo esperaba la primera.
Si la página dejaba de ser vigente (el visor la libera al cerrar o sustituir el documento) o
la primera fallaba, la segunda promesa quedaba **sin observar**. Al cerrar el PDF, el
controlador destruye el transformador, y `destruir()` del worker rechaza todo lo pendiente con
`worker-destruido`: ese rechazo de la segunda franja no lo escuchaba nadie y el navegador lo
anotaba como «Uncaught (in promise)». Además, si la primera era la rechazada, el visor lo
tomaba por un fallo del worker y pasaba al modo oscuro en el hilo principal para un documento
que se estaba cerrando.

**Cambio** (solo `aplicar.ts`):
- **Toda franja enviada se espera antes de que `oscurecerLienzo` vuelva**, termine como termine
  (completa, cancelada o con error): `finally` con `Promise.allSettled` sobre las que queden en
  vuelo. Ni rechazos sueltos ni trabajo de esa página pendiente cuando vuelve; con el documento
  cerrado, el worker además se termina (`terminate`).
- **Con la página ya cancelada, que una franja no llegue no es un fallo:** devuelve `null`
  (cancelado) en vez de lanzar, así que no se pide el transformador local. Con la página
  vigente, el error del worker se propaga como antes y el visor repinta en el hilo principal.
- Nada se escribe en un lienzo cancelado (ya era así; ahora lo comprueba un test).
- **Descartado:** un `catch` genérico sobre la segunda franja, que habría silenciado el aviso
  dejando trabajo sin esperar.
- Camino normal: con todas las franjas escritas, `allSettled` recibe una lista vacía. Sin
  cambios de estrategia ni de rendimiento: sin benchmark.

**Tests.** Primero, tres unitarios que reproducían el fallo con el código anterior (los tres
fallaban, y Vitest detectaba el `Unhandled Rejection: worker-destruido`): cerrar con dos
franjas en vuelo no deja rechazos sueltos y devuelve `null`; con la página cancelada espera
las dos antes de terminar y no escribe nada; si el worker falla con dos en vuelo, lanza ese
error y no deja la otra sin observar. Y un E2E en `visor-pdf.spec.ts` que cierra o sustituye
el PDF a 0–220 ms de empezar a pintarse, con la consola limpia y sin páginas del documento
anterior. Comprobado que el E2E detecta el fallo: en copias aparte, con 6 navegadores a la
vez, **6 de 6 fallaban sin el arreglo** (29 `worker-destruido`) y **6 de 6 pasan con él**.
Un primer intento del E2E esperaba ver una página «pintando» y fallaba si todas terminaban
antes de mirar; se corrigió esperando al visor.

**Decisiones confirmadas por el usuario:**
- **D14:** los formularios PDF se muestran, pero no se rellenan ni se editan en v1 (como desde
  la Fase 5). PLAN §14.0, SEGURIDAD §4; fuera de TAREAS.
- **Firefox 114 como mínimo:** `build.target` pasa de `firefox111` a `firefox114`, porque pdf.js
  6 crea su worker como módulo ES y en Firefox 111–113 el visor no abría un PDF. Sin
  polyfills. STACK y ARCHITECTURE al día; fuera de TAREAS.
- **D5:** hosting en **Vercel**, URL oficial **`https://bpdf.r3zon.com`**. PLAN §14.0, CLAUDE,
  DEPLOYMENT, MODULES, SEGURIDAD y FASES (F15). **El dominio de `project.ts` no cambia**: la
  especificación de la Fase 15 lo incluye, junto con `robots.txt`, `sitemap.xml` y
  `public_docs/_meta/` (solo se actualizó su comentario). TAREAS ya no tiene decisiones
  pendientes.

**Verificación.** `lint`, `typecheck`, `npm test` **992/992** (53 ficheros), `test:e2e`
**116/116**, `build`, `build:tamano` (94,8 KB), `docs:enlaces`, `docs:validar` y `npm audit`
(0). La CSP y las cabeceras no cambian.

### Iteración 24 — *2026-10-03* — Fase 11 cerrada: mención a R3ZON y favicon aprobado

**Contexto.** Tras revisar la implementación, el usuario añadió una decisión de producto
antes de cerrar: reflejar de forma discreta que BPDF es gratis, open source y creado por
R3ZON. Aprobó el favicon. **La Fase 11 queda CERRADA / APROBADA.**

**Hecho, y por qué así:**
- **Pie «BPDF · Gratis y open source · Creado por R3ZON con ❤️»** (`src/app/Creditos.tsx`),
  **solo en la pantalla vacía**: un pie fijo con un documento abierto le quitaría una línea
  al visor, que es justo lo que se pidió evitar; con un documento, la misma información está
  en «Acerca de». Texto pequeño en `fg-subtle` sobre `app` (combinación permitida por PLAN
  §9.2).
- **«R3ZON» enlaza a `https://r3zon.com`** por `Platform.openExternal`, el mecanismo de los
  enlaces de los documentos: revalida la URL y abre una pestaña sin `opener` ni `Referer`;
  el clic se intercepta y el central se anula; `target` y `rel` quedan como red. El enlace
  tiene un área de 24 px de alto (D12). La CSP no cambia: abrir una pestaña no es una
  petición de la app.
- **«Acerca de»** añade «BPDF es una herramienta gratuita y open source creada por R3ZON con
  ❤️.», junto a la versión, la licencia y la privacidad. Sigue sin enlaces.
- **Identidad:** la URL de la organización, en `project.ts` (`organizationUrl`), junto a
  `organization`. El dominio de BPDF **no** cambia: `https://bpdf.r3zon.com` queda escrito
  como la URL pública en uso (CLAUDE §0, PLAN §9.3); formalizarlo es D5, en la Fase 15.
- Un detalle medido: `openExternal` abre la forma canónica de la URL (`https://r3zon.com/`,
  con la barra que añade `URL` al revalidarla). El E2E comprueba exactamente esa.

**Pendientes que se mantienen.** Para la Fase 13: el separador de Dividido (6 px) y la
navegación con flechas de las barras. Para la Fase 16: el enlace al repositorio, la
documentación pública final (Docusaurus de `docs.r3zon.com`) y una GitHub Wiki (FASES y
TAREAS).

**Tests.** Componentes: `Creditos` (texto, un solo enlace, `href` exacto, `target` y `rel`,
el clic va a la plataforma y se cancela, el central se anula, jest-axe); `App` (el pie con la
pantalla vacía abre r3zon.com por la plataforma y desaparece con un documento); «Acerca de»
con la frase nueva y jest-axe. E2E: el clic llega a `window.open` con
`noopener,noreferrer`, la app no navega, el clic central no abre nada, sin peticiones
externas ni violaciones de CSP, y el pie no aparece con un PDF abierto; la comprobación de
375 px ya recorría la pantalla vacía (ahora con el pie).

**Verificación.** `lint`, `typecheck`, `npm test` **989/989** (53 ficheros), `test:e2e`
**115/115**, `build`, `build:tamano` (**94,8 KB** gzip), `docs:enlaces`, `docs:validar` y
`npm audit` (0). Sin benchmark: no se tocó `markdown.css` ni el editor.

### Iteración 23 — *2026-10-03* — Fase 11: interfaz final (implementada, pendiente de revisión)

**Contexto.** Tras la auditoría previa, el usuario confirmó **D10** (sin tema claro en v1) y
**D12** (adaptación básica: sin desplazamiento horizontal a 375 px, controles ≥ 24 px, barras
que se reparten, sin gestos) y decidió: título de la ventana siempre «BPDF»; «Acerca de»
dentro de Preferencias; sin enlace al repositorio (F16); favicon SVG sencillo; sin
navegación con flechas en las barras (F13); sin capturas visuales. **La fase queda
implementada y pendiente de su revisión.** Lista de revisión: PLAN §9.5 (nueva).

**Documentación primero.** D10 y D12 a PLAN §14.0; PLAN §9.3 (cabecera, «Acerca de», título,
favicon; el tamaño de letra ya es de la F10), §9.5 (la lista que la especificación citaba y
no existía) y §10 (decía que la barra navega con flechas, y no lo hace); FASES, Fase 11
reescrita con las decisiones, y la Fase 13 hereda lo de las flechas y el separador; TAREAS
(fuera D10, D12 y el favicon; dentro la limpieza de `readDocument.id`).

**Hecho, y por qué así:**
- **Atajos anunciados** (`title` y `aria-keyshortcuts`) en los botones del visor PDF, el campo
  de página, la barra de búsqueda y los dos «Abrir archivo». Para no duplicar: **una sola
  tabla de teclas visibles** (`messages.keys`), que ahora usan también la ayuda (`?`) y el
  estado vacío; los valores de ARIA viven junto a la lógica de las teclas (`ATAJOS_BOTON`).
  `anuncioDeAtajo` deja el nombre accesible intacto (el que leen los lectores de pantalla y
  los E2E): ningún test existente cambió. Los de una tecla solo se anuncian con
  `atajosUnaTecla` activado (un tooltip «(T)» con la tecla desactivada prometería algo
  falso).
- **Estados de carga:** los `fallback` de `App` eran los únicos sin `role="status"`; ahora usan
  `Cargando`.
- **D12:** medido primero con una sonda y fijado después en un E2E (`interfaz.spec.ts`) que
  recorre a 375 px la pantalla vacía, Preferencias, el PDF con búsqueda y miniaturas, la ayuda
  de atajos, la contraseña, Markdown con índice, Edición, Dividido y el diálogo de cambios sin
  guardar. Solo fallaban las casillas de los diálogos (16 px): pasan a 24 px. No cuenta el
  contenido del documento (enlaces del texto, anotaciones del PDF).
- **Título:** ya era «BPDF»; un E2E con documentos de nombre conocido y un test de componente
  lo vigilan.
- **«Acerca de»:** versión y licencia de `package.json` por `define` de Vite (y de Vitest, que
  tiene su propia configuración), desde `src/config/compilacion.ts`: se sustituye al compilar,
  sin leer `package.json` ni evaluar nada en el navegador.
- **Favicon:** `public/favicon.svg`, una hoja clara (`fg`) con la esquina doblada en el acento,
  sobre el fondo de la app (`app`), con dos renglones; sin texto (no dependería de fuentes y
  se lee a 16 px). Los colores van escritos (un SVG de favicon no lee las propiedades CSS) y un
  test comprueba que son tokens. Retirada la tolerancia al 404 de `vigilancia.ts`. `curl -I`
  contra `vite preview`: `200`, `image/svg+xml` y las cabeceras de la app.
- **Texto:** el estado vacío decía «Atajo: Ctrl+O (⌘O en Mac)» y la ayuda «Ctrl/⌘ O»; ahora
  los dos salen de la misma tabla («Atajo: Ctrl/⌘ O»).

**Pasada visual (PLAN §9.5), resultado:** espaciados y alturas coherentes (botones de barra
de 32 px en PDF y Markdown, diálogos con el mismo marco); iconos `lucide` `size-4` con
`aria-hidden` en todas partes; ningún icono sin nombre; nada se anima salvo el indicador de
carga (anulado con `prefers-reduced-motion`) y no hay desplazamientos suaves; todo texto en
`messages.ts` (las 201 claves están en uso). **Quedan para la Fase 13**: el separador de
Dividido (6 px de ancho en escritorio, por debajo de 24 px; a 375 px no aparece) y la
navegación con flechas de las barras. `markdown.css` no se tocó (ni `content-visibility`):
sin benchmark.

**Descartado.** Un PNG/ICO junto al SVG: generarlo exigiría un rasterizador o una
dependencia; anotado en TAREAS por si se echa en falta. Un botón «Acerca de» en la cabecera
(decisión del usuario: dentro de Preferencias).

**Errores propios del camino.** La sonda de 375 px pulsó Esc antes de que el diálogo de
Preferencias (a demanda) terminara de abrirse y midió con él encima; se corrigió esperando
al diálogo. Un script con heredoc rompió una expresión regular (`\b`); se reescribió con la
herramienta de ficheros.

**Verificación.** `lint`, `typecheck`, `npm test` **986/986** (52 ficheros), `test:e2e`
**114/114**, `build`, `build:tamano` (**94,4 KB** gzip: +1,1 KB por `atajos.ts` y `Cargando`
en el arranque), `docs:enlaces` (263), `docs:validar`, `npm audit` (0) y `curl -I` del favicon.
La CSP no cambia.

### Iteración 22 — *2026-10-03* — Fase 10 cerrada; D19: BPDF es solo una aplicación web (Fase 14 cancelada, Fase 15 reescrita)

**Contexto.** El usuario hizo las pruebas manuales 1–10 de la Fase 10 en la build de
producción (posición real de un PDF, «recordar» desactivado, preferencias sin documento,
diálogo solo con teclado, cabecera de 375 px, tipografía de Markdown, miniaturas y atajos,
olvidar, restablecer, consola y almacenamiento) y todas salieron bien; aceptó el botón
«Preferencias» solo con icono en pantalla estrecha. Pidió una corrección menor antes de
cerrar, corregir la nota de rendimiento y cerrar la fase. Y decidió que **BPDF no tendrá
versión Electron** (D19).

**Fase 10: corrección antes de cerrar.** El inicializador de `useState` del visor escribía
en `localStorage` (recuperar una posición actualizaba su `t`): una escritura durante el
render, que StrictMode hace dos veces en desarrollo. Ahora `recuperarPosicion` **solo lee**
y una función nueva, `marcarUso`, actualiza el `t` desde el efecto que ya restauraba la
página. Mismo comportamiento observable: la restauración de página y zoom y el LRU de 50 no
cambian (sus tests siguen igual, el de componente que comprueba el `t` incluido). Tests
nuevos: recuperar no escribe; marcar el uso actualiza solo `t`; sin entrada, con una huella
inválida o con una versión futura no escribe. El de las entradas corruptas ya no se apoyaba
en una escritura de `recuperarPosicion` para limpiar: lo hace `marcarUso`.

**Fase 10: la nota de rendimiento** de la iteración 21 se corrigió (conservando sus cifras):
la comparación válida es la A/B alternada, y no muestra regresión atribuible a la fase.

**La Fase 10 queda CERRADA / APROBADA** (FASES, TAREAS, PLAN §8, ARCHITECTURE §4 nonies,
SEGURIDAD §6, MODULES, CLAUDE.md §0).

**D19: BPDF es solo una aplicación web** (decisión de producto del usuario; sustituye toda la
planificación anterior de Electron). Consecuencias, revisando todo el proyecto:
- **Fase 14 (Electron): cancelada / no aplica.** Sin trabajo pendiente; conserva su número
  y una referencia histórica en FASES.
- **Fase 15: reescrita como «Distribución web».** Se conserva lo que vale para la web
  (despliegue con las cabeceras de la Fase 12, dominio real en `project.ts`,
  `cabeceras:verificar` y `curl -I`, E2E de humo contra la URL pública, `DEPLOYMENT.md`,
  versión semver y registro de cambios para usuarios). Se retira, sin sustituirlo, lo que
  solo tenía sentido con escritorio: instaladores, firma y notarización, fuses, asociación
  de tipos, T-5, D11, release por etiqueta con matriz de SO y artefactos con SHA-256. Ya no
  depende de la 14. Fijar las Actions por SHA pasa de requisito a mejora (`mejoras.md`).
- **PLAN:** D19 en §14.0; D11 y T-5, «ya no aplica»; fuera la columna de Electron de §5,
  la capa `electron.ts` de §4.1, la carpeta `electron/`, la fila de tests de Electron, el
  escritorio de §13, el mantenimiento de Electron y su riesgo de seguridad. §2 y §3 (la
  auditoría de la plantilla y la comparación con la que se decidió D1) se conservan como
  historia, marcada.
- **ELECTRON.md** se conserva como **histórico**, con un aviso arriba: explica decisiones que
  sí quedaron en la web (la frontera `src/platform/`, la CSP en una fuente única). SEGURIDAD
  §5 (Electron), igual: marcada como histórica, sin borrar su contenido.
- **Resto de documentos** (CLAUDE, README, docs/README, STACK, ARCHITECTURE, SEGURIDAD,
  STRUCTURE, MODULES, DEPLOYMENT, TAREAS, mejoras): fuera los planes de Electron; `zod` ya no
  «volverá a usarse en IPC» (su único consumidor es `schema.ts`, y `jitless` se queda allí).
- **Código:** solo comentarios que anunciaban Electron, y el nombre de un test
  (`read.test.ts`). **No se borró código:** la capa `src/platform/` la usa la web. El
  parámetro opcional `id` de `readDocument` se pensó para Electron y hoy solo lo usan los
  tests: se conserva y su comentario lo dice (decisión pendiente del usuario).
- **Se conservan sin tocar**, por ser historia: esta bitácora, `PDF_DARK_MODE_SPIKE.md` y las
  especificaciones de las fases ya cerradas. «Escritorio» como pantalla de escritorio (frente a
  móvil) no tiene que ver con Electron y se queda.
- La CSP no cambia.

**Verificación.** `lint`, `typecheck`, `npm test` **973/973** (50 ficheros), `test:e2e`
**108/108**, `build`, `build:tamano` (93,3 KB gzip), `docs:enlaces` (260), `docs:validar` y
`npm audit` (0 vulnerabilidades; sin overrides). Sin benchmark: el cambio del visor mueve una
escritura de `localStorage` del render a un efecto al abrir un PDF, y no toca ningún
recorrido que un benchmark mida.

### Iteración 21 — *2026-10-03* — Fase 10: preferencias y posición de lectura (implementada, pendiente de aprobación)

**Contexto.** El usuario aprobó empezar la Fase 10 con la especificación de la iteración 20 y
confirmó la tipografía de Markdown: 15, 16, 17, 18, 20 y 22 px; 60, 72 y 90 ch; por defecto
17 px y 72 ch, exactamente como antes. **La fase queda implementada y pendiente de su
aprobación**; no se da por cerrada. Diseño: ARCHITECTURE §4 nonies.

**Hecho.**
- `zod` 4.6.5 (exacta, sin dependencias ni scripts de instalación) y `src/preferences/`:
  `schema.ts` (campo a campo, valores por defecto, huella hexadecimal), `store.ts` (todo en
  `try/catch`, lectura versionada con tabla de migraciones vacía en la v1, copia en memoria,
  avisos de esta pestaña y de otras por `storage`), `usePreferences.ts`
  (`useSyncExternalStore`), `positions.ts` (página y zoom por huella, LRU de 50, versión
  futura ni leída ni pisada) y `PreferencesDialog.tsx`.
- Botón «Preferencias» en la cabecera, **siempre** (también sin documento); el diálogo se
  carga a demanda.
- Visor PDF: abre con el modo, el zoom, la vista y las miniaturas guardados; restaura la
  página y el zoom de ese PDF (huella `fingerprints[0]`) si «recordar» está activado;
  guarda la posición 1 s después del último cambio, al cerrar y en `pagehide`; el
  interruptor de atajos de una tecla pasa de variable de módulo a preferencia (se borra
  `atajosDeUnaTecla`).
- Lector de Markdown: tamaño de letra y ancho al momento, también en la vista previa.
- No se guarda: nombres, contenido, contraseñas, posición ni huella de Markdown, opciones de
  búsqueda ni estado del editor.

**Desviaciones y decisiones al implementar, y por qué:**
- **`zod` con `jitless: true`.** La primera ejecución de los E2E falló casi entera por
  `script-src eval`: zod 4 prueba `new Function("")` para compilar validadores y, aunque
  captura el error, Chromium informa la violación de CSP. Su propio código prevé el caso.
  La CSP no se abre.
- **Tipografía por `data-letra`/`data-ancho`**, no por propiedades CSS en un `style` en
  línea, que fue el primer intento: el corpus de XSS (22 casos) solo admite en el contenido
  el `style` de las celdas de tabla, y falló. Corregido el código, no el test. Los valores
  van en rem (17 px = 1.0625rem, como antes) y la regla de pantalla estrecha resta 1 px,
  como antes (17 → 16).
- **`MarkdownView` ya tiene un oyente global**: el `storage` de las preferencias (uno solo,
  compartido, que se quita al desmontar). Su test «no añade listeners globales» exigía cero;
  ahora exige exactamente ese oyente y que se quite con el mismo manejador. Es la
  sincronización entre pestañas que pide la fase.
- **Botón solo con icono en pantalla estrecha** (`max-sm:sr-only` en el texto, más
  `title`): con el texto, la cabecera desbordaba a 413 px en 375 y 390 px (dos E2E de
  ventana estrecha). Una regresión de diseño propia, vista por los E2E.
- La posición solo se guarda cuando cambia: abrir un PDF y no moverse no deja historial.
- Recuperar una posición actualiza su `t` (el uso cuenta para el LRU), como dice la
  especificación.

**Tests cambiados (igual o más estrictos):**
- `atajos.test.ts`: fuera el test del interruptor en memoria (el módulo ya no lo tiene); su
  comportamiento lo prueban `Visor.test.tsx` y `store.test.ts`.
- `Visor.test.tsx`: el interruptor ahora exige que `localStorage` tenga **solo**
  `bpdf:prefs`, con `atajosUnaTecla`, sin el nombre del documento.
- `visor-pdf.spec.ts`, contraseña: buscaba «bpdf» (la contraseña del fixture) en todo el
  almacenamiento, claves incluidas, y fallaría por el nombre de `bpdf:prefs`. Ahora usa las
  preferencias de verdad (miniaturas y posición guardadas) y comprueba que las claves son
  exactamente las dos permitidas, que ningún valor contiene la contraseña ni las erróneas, y
  que `sessionStorage` y las cookies están vacíos.
- `MarkdownView.test.tsx`: el de los oyentes globales (arriba).
- Los que exigen almacenamiento vacío donde nada debe guardarse (`DocumentProvider`, la
  contraseña en `App`, guardar en `editor.spec.ts`) **no se tocan** y siguen en verde.

**Tests nuevos.** Unitarios: `schema` (valores por defecto, campo a campo, zooms,
`__proto__`, huella, entradas de posición), `store` (vacío, corrupto, versión futura que no
se reescribe, migraciones sintéticas en orden y rotas, almacenamiento que lanza o no existe,
cambiar y validar, restablecer, varias pestañas, oyente único), `positions` (guardar y
recuperar, `t`, LRU de 50, huellas inválidas, entradas corruptas, versión futura, olvidar).
Componentes: diálogo (axe, etiquetas, valores por defecto, guardar al momento, olvidar,
restablecer, otra pestaña), `Visor` (valores al abrir, restaurar y acotar, esperar 1 s,
desmontar, `pagehide`, recordar desactivado, sin huella, miniaturas, búsqueda no guardada),
`App` (botón con y sin documento, foco de vuelta, Markdown sin nada guardado, tipografía al
momento). E2E (`preferencias.spec.ts`, 11): ver TAREAS.

**Hallazgo fuera de alcance (no se corrige).** Un E2E nuevo cerraba el PDF justo después
de navegar y vio `worker-destruido` en consola. Antes de achacarlo a la fase, se midió con
el código de antes en una copia aparte: **6 de 24** ejecuciones con 8 navegadores en
paralelo (10 de 24 con la Fase 10: mismo orden). Es anterior (worker del modo oscuro, Fase
5) y va a TAREAS. Los E2E de la fase cierran con todo pintado.

**Benchmark (`bench:editor`).** Comprobación, no optimización (Chromium, mismo equipo;
una ejecución completa más dos de los casos de la excepción, que es como la iteración 18
juntó tres). Por pulsación, Event Timing (redondea a 8 ms):

| Caso | Modo | Iteración 18 (3 ejec.) | Fase 10 |
|---|---|---|---|
| 2 KB · 100 KB · 200 KB | ambos | máx. ≤ 32 ms | máx. ≤ 24 ms; 0 eventos ≥ 50 ms |
| 1 MB | Edición / Dividido | máx. 32 / P95 48, máx. 56 | máx. 32 / P95 40, máx. 56 |
| 1 MB + Mermaid | Dividido | P95 24, máx. 56 | P95 32, máx. 64 |
| 1 MB + KaTeX | Edición | máx. 32 | máx. 32 (las tres) |
| **1 MB + KaTeX** | **Dividido** | P95 96 · P99 216 · máx. 256; ≥ 100 ms: 5–11 por ejec.; tarea larga 97–203 | P95 104 (las tres) · P99 208–288 · máx. 208–288; ≥ 100 ms: 9–14; tarea larga 188–223 |
| 1 MB de encabezados | Edición | P95 40, máx. 48 | P95 32–40, máx. 40–48 |
| 1 MB de encabezados | Dividido | P95 64 · P99 112 · máx. 120 | P95 40–64 · P99 56–128 · máx. 56–128 |

Vista previa: 208 ms (2 KB) y 327 ms (100 KB) desde la última tecla, como antes.
**Lectura inicial, corregida después:** esta tabla compara con cifras de la iteración 18,
medidas en otro momento, y la diferencia en 1 MB + KaTeX en Dividido (un escalón de 8 ms en
el P95, algo más de eventos ≥ 100 ms) se leyó como una variación. **La comparación válida es
la A/B posterior**, en la auditoría previa al cierre: `4210a78` (Fase 9) frente a `57e82e8`
(Fase 10), en copias aparte, con las ejecuciones alternadas para que la deriva de la máquina
afecte igual a las dos (1 MB + KaTeX en Dividido; Edición, idéntica):

| Dividido, 1 MB + KaTeX | P95 | Máx. | Eventos ≥ 100 ms | Tarea larga |
|---|--:|--:|--:|--:|
| Fase 9, 3 ejecuciones | 88–96 ms | 176–272 ms | 3–12 | 164–256 ms |
| Fase 10, 3 ejecuciones | 72–96 ms | 192–248 ms | 3–7 | 175–221 ms |

Los rangos se solapan: **no hay regresión atribuible a la Fase 10**. La diferencia frente a
la iteración 18 era variación entre ejecuciones de distinto momento: la propia Fase 9,
medida otra vez, sale de los rangos de la iteración 18. (Un primer intento de esta A/B se
descartó porque las dos copias tenían ya la Fase 10.) En el código tampoco hay causa: en
ese recorrido la Fase 10 solo añade dos atributos fijos en `.md-contenido` y una
suscripción que no se dispara al teclear.

**Verificación.** `lint`, `typecheck`, `npm test` (971 tests en 50 ficheros), `build`, `build:tamano` (arranque 93,3 KB gzip; `zod` en un trozo a demanda de ~23 KB), `docs:enlaces` (264), `docs:validar` y `test:e2e` **108/108** (tres veces seguidas en verde al final), con cero errores de consola, cero violaciones de CSP y ninguna petición externa. `npm audit`: 0 vulnerabilidades. CSP y cabeceras sin cambios.

### Iteración 20 — *2026-10-03* — Fase 9 cerrada y aprobada, con una excepción de rendimiento; Fase 10 especificada de nuevo

**Contexto.** Al preparar la Fase 10, la auditoría previa encontró que la Fase 9 no estaba
cerrada en ningún sentido: los documentos decían «abierta, no aprobada», y el commit
`4abd868` (que lleva las entradas de las iteraciones 17–19) **había borrado la regla de
`content-visibility` de `markdown.css`** sin contarlo en ninguna entrada. La iteración 19
dice «sin cambios de código» y describe esa regla como vigente; el E2E que la protege
(`markdown.spec.ts`, «bloques con fórmulas fuera de la vista…») fallaba (96/97).

**Qué pasó en realidad, en orden** (para leer las iteraciones 17–19 sin confusión):

1. Iteraciones 17 y 18: cambios de código reales y documentados (el ShadowRoot del editor
   en un nodo propio; el panel del editor por encima en el apilado, `relative z-1`). Las
   cifras del benchmark de la iteración 18 se midieron **con** `content-visibility`.
2. Iteración 19: investigación sin cambios de código; propuso, como opción a medir, quitar
   `content-visibility` de los bloques con fórmulas.
3. Después, como experimento, se quitó la regla y se midió. Ese cambio quedó dentro del
   commit `4abd868` sin entrada propia: es el origen de la inconsistencia.
4. Resultado del experimento (medición del usuario; **sus cifras no están en el
   repositorio**): mejoraba el P99 y el máximo, pero empeoraba el P95, los eventos ≥ 50 ms,
   la memoria y el tiempo de entrar en Dividido. Decisión: **se conserva
   `content-visibility`**.
5. Esta iteración: el usuario restauró `src/styles/markdown.css` desde `3eb39e9`
   (idéntico byte a byte; comprobado con `git diff 3eb39e9`). El código vuelve a ser el
   que midieron las iteraciones 18 y 19, así que sus cifras siguen valiendo y no se repitió
   el benchmark.

**Decisión del usuario: la Fase 9 queda CERRADA y APROBADA** con una excepción de
rendimiento documentada (FASES, Fase 9; ARCHITECTURE §4 octies):

- **1 MB + KaTeX en Dividido** no cumple los objetivos de latencia propuestos en la
  iteración 16 (P95 ≤ 50, P99 ≤ 100, máx. ≤ 200 ms…). Última medición oficial, iteración
  18 (Chromium, 3 ejecuciones): P95 96, P99 216, máx. 256 ms; 5–11 eventos ≥ 100 ms por
  ejecución; tarea larga 97–203 ms. Firefox (iteración 17): P95 56–72, máx. 88 ms.
- **1 MB con una cantidad extrema de encabezados** (56 000 bloques) puede superarlos por el
  coste del parser de Lezer: Dividido P95 64, P99 112, máx. 120 ms (iteración 18).
- Motivo: el comportamiento está perfilado y su causa identificada (materializar bloques
  con fórmulas al saltar de zona; Lezer reequilibrando bloques de primer nivel); la
  alternativa probada empeoraba otras métricas; los documentos normales no tienen el
  problema (2 KB–200 KB y 1 MB sin KaTeX: máx. ≤ 64 ms en Dividido, iteración 16–18).
- **No se afirma que se cumpla el criterio** «1 MB sin retraso perceptible» en esos dos
  casos: se acepta como excepción.

**Fase 10: decisiones del usuario** (FASES, Fase 10, especificada de nuevo; PLAN §8 y §14):

- **D8 confirmada:** recordar posición activado por defecto, con huella, 50 entradas y
  «Olvidar posiciones guardadas»; sin nombres ni contenido.
- Posición **solo para PDF**: ni posición ni SHA-256 de Markdown.
- Opciones de búsqueda: **no se guardan** (estado de sesión).
- Panel de miniaturas abierto/cerrado: **sí** (PLAN §8).
- Estado del editor (modo, separador): **fuera** de la Fase 10.
- «Preferencias» en la cabecera, también sin documento abierto.
- Sin página pública de privacidad en la Fase 10; la documentación técnica (PLAN §8,
  SEGURIDAD §6) describe qué se guarda y cómo se borra.
- Migración: el mecanismo de versiones se diseña y se prueba con versiones sintéticas; no
  hay una «migración v1 → v2» de usuario, porque la v1 es la primera.
- El E2E de posición usa un PDF con páginas suficientes (`modo-oscuro.pdf`, 8 páginas).

**Cambios.** Solo documentación: CLAUDE.md, FASES, TAREAS, PLAN, ARCHITECTURE, MODULES,
SEGURIDAD y esta bitácora (más la nota de la iteración 19). Ningún test se tocó. El CSS
lo restauró el usuario.

**Verificación.** `lint`, `typecheck`, `test:run` (904), `build`, `build:tamano` (92,5 KB),
`docs:enlaces`, `docs:validar` y `test:e2e` **97/97** (con la vigilancia de siempre: cero
errores de consola, cero violaciones de CSP, ninguna petición externa).

**Error propio del camino.** En la auditoría previa interpreté el borrado de la regla como
«el experimento revertido» y lo di por bueno; era al revés: el experimento era el borrado.

### Iteración 19 — *2026-10-03* — Fase 9: la cola de 1 MB + KaTeX en Dividido, investigada (sin cambios de código; sigue sin aprobar)

> **Nota (iteración 20).** Esta investigación no cambió código. Pero el commit que la
> contiene (`4abd868`) borró además la regla de `content-visibility` de `markdown.css`, como
> experimento de la opción 1 de abajo, sin contarlo aquí. Ese experimento se midió después,
> se descartó y la regla se restauró: ver la iteración 20.

**Objetivo.** Por orden del usuario, solo investigar la cola que queda en 1 MB + KaTeX en
Dividido: 184–368 ms en las primeras teclas tras saltar a otra zona.

**Restricciones.** Sin implementar soluciones. Sin tocar el benchmark, la corrección del
apilado ni el resaltado.

**Decisión del usuario sobre el resaltado.** Con muchos encabezados se mantiene tal cual,
como limitación documentada de Lezer.

**Método.** Una sonda temporal reproduce lo que hace el benchmark (Ctrl+End o Ctrl+Home, y
teclear sin esperar), con una traza de CDP que empieza antes del salto y marcas «salto» y
«teclear». Variantes:
- KaTeX, 1 MB sin KaTeX, y fórmulas solo en la segunda mitad;
- teclear en el acto («fría») o tras calmarse el hilo («caliente»);
- diagnósticos con CSS inyectado: KaTeX sin posicionar, y sin `content-visibility`.

**Qué pasa tras el salto** (KaTeX, salto al final, en frío; primera tecla de 360 ms):

| Desde el salto | Duración | Qué es |
|---|--:|---|
| 42 ms | 72 ms | rAF de la app (CodeMirror mide y la sincronía mueve la vista previa, ~34 ms) + Paint 42 ms |
| 114 ms | 60 ms | la tecla: CodeMirror, con 27 ms de layout forzado |
| **175 ms** | **223 ms** | **la vista previa en la zona nueva: PrePaint 92 + entradas de composición 52 + Paint 46 + Layout 27** |
| luego | 44–101 ms | CodeMirror termina de analizar en `requestIdleCallback` |
| luego | 30 ms | MinorGC |

**Es el salto, no teclear.** «En caliente», ese coste lo paga la propia tecla del salto
(264–296 ms) y después se teclea a 24 ms. «En frío», como en el benchmark, lo pagan las
primeras pulsaciones.

**El fotograma caro es materializar bloques con `content-visibility`:**

| Escenario | PrePaint | Fotograma |
|---|--:|--:|
| 1 MB sin KaTeX (sin bloques con `content-visibility`) | ~16 ms | 33 ms |
| Fórmulas solo en una mitad, salen de la vista (se ocultan) | 24 ms | 60 ms |
| Fórmulas solo en una mitad, entran 4 bloques | 60 ms | 133 ms |
| KaTeX entero, entran 4 bloques | 87–115 ms | 169–223 ms |
| KaTeX entero sin posicionar | 85 ms | 169 ms |
| **Sin `content-visibility` (diagnóstico)** | — | **el fotograma desaparece** |

- Se materializan 1–4 bloques (43–172 nodos), y aun así el coste crece con el tamaño del
  documento. Ocultar bloques es barato. Las capas de KaTeX no son la causa.
- Sin `content-visibility`, la primera tecla tras el salto baja de 360 a 208 ms, y la tecla
  del salto en caliente de 264 a 80 ms.

**Lo que no es:**
- **React:** no trabaja (la vista previa está en pausa). Solo la sincronía, en el trozo
  `MarkdownView`, cuesta ~30 ms.
- **KaTeX:** no se ejecuta; su DOM ya existe.
- **IntersectionObserver:** 3,5 ms tras el salto.
- **GC:** una MinorGC de 30 ms, sin coincidir con el pico.

**Qué es de BPDF y qué del navegador:**

| Componente | Coste | De quién |
|---|--:|---|
| Materializar bloques (PrePaint + composición) | ~110–170 ms | Chromium, pero lo provoca `content-visibility`, que pone BPDF |
| Sincronía (medir encabezados tras el salto) | ~30 ms | BPDF |
| Análisis en segundo plano | 40–100 ms por tramo | CodeMirror (su `Work.Slice`, no configurable) |
| Detectores de anuncios | ~55 ms por segundo | Chromium |
| Teclear ya estabilizado | ~24 ms | — |

**Opciones** (ninguna implementada):

1. **Quitar `content-visibility` de los bloques con fórmulas.**
   - Por qué ahora: el hit test que lo justificó (iteración 15) ya lo resuelve el apilado
     (iteración 18).
   - Mantiene exactamente la UX; incluso mejora la estimación de la barra y la sincronía.
   - En diagnóstico quita el fotograma de materialización. A cambio, los detectores de
     anuncios suben de ~55 a ~72 ms y el Paint de cada fotograma sube algo.
   - Hay que medirlo con el benchmark oficial antes de decidir: no se sabe si el balance
     cumple.
2. **No recalcular las anclas de la sincronía en cada salto:** ~30 ms. Riesgo: anclas
   desfasadas.
3. **Retrasar la sincronía hasta que se deje de teclear:** cambia la UX (la vista previa
   iría por detrás).
4. **El análisis en segundo plano de CodeMirror y los detectores de anuncios:** BPDF no
   puede cambiarlos sin parchear dependencias.

**No hay una corrección mínima segura sin medir antes la opción 1. El código queda
intacto.**

### Iteración 18 — *2026-10-03* — Fase 9: perfil de KaTeX y de encabezados en Chromium; el editor, por encima en el apilado (sigue sin aprobar)

Por orden del usuario, había que localizar con perfiles qué trabajo queda en cada pulsación
en dos casos, sin suponer que tienen la misma causa: 1 MB + KaTeX en Dividido, y 1 MB de
encabezados en Edición y en Dividido. **La Fase 9 sigue abierta y no aprobada.** El
benchmark no se ha tocado.

Herramientas: trazas de Chromium (CDP `Tracing`) y perfiles de CPU de V8 (CDP `Profiler`),
con la escritura del benchmark, en una sonda temporal.

**1 MB + KaTeX en Dividido: causa**

Cuánto KaTeX participa: de 2184 bloques con fórmulas solo 4 están pintados (160 de 203 112
nodos KaTeX). `content-visibility` funciona.

Coste por componente en la traza, con el ratón sobre el editor (27 pulsaciones):

| Componente | Coste |
|---|--:|
| Hit test del `mousemove` sintético que Chrome lanza tras cada maquetación | 1045 ms (30–50 ms por tecla) |
| JavaScript (CodeMirror) | 293 ms |
| Commit, que incluye los hit tests de los detectores de anuncios | 255 ms |
| Layout | 196 ms |
| IntersectionObserver | 86 ms |
| Paint | 55 ms |
| Recalcular estilos | 3 ms |

El hit test es el coste dominante:

| Escenario | Hit test total | Pulsaciones ≥ 50 ms |
|---|--:|--:|
| Ratón sobre el editor | 1045 ms | 18 |
| Ratón sobre la vista previa | 224 ms | 3 |
| Fórmulas solo en la mitad del documento, fuera de la vista (101k nodos KaTeX) | ~16–21 ms por tecla | 1 |
| Encabezados (sin KaTeX) | ~0,2 ms por tecla | — |

El hit test crece con todo el KaTeX del documento aunque esté saltado. La vista previa va
después del editor en el orden de pintado, así que, para un punto sobre el editor, Chrome
la recorre entera antes de llegar a él.

Diagnóstico con CSS inyectado (no son correcciones):
- **El editor por encima del apilado:** el hit test del ratón desaparece. Igual que con el
  ratón sobre la vista previa.
- **KaTeX sin posicionar:** sigue en ~21 ms. Sus capas pesan, pero no lo explican todo.

**Corrección** (`SplitView.tsx`): con los dos paneles, el izquierdo (el editor) lleva
`relative z-1`.
- Los paneles no se solapan: no cambia qué se ve ni dónde se pulsa.
- El índice (`z-10`), la capa de arrastre (`z-10`) y los diálogos (capa superior) siguen
  por encima.
- Sin cambios para la sincronía del scroll, las anclas ni la accesibilidad (el apilado es
  solo visual).
- E2E nuevo: el panel queda apilado, y un punto del editor y otro de la vista previa
  devuelven su propio panel (`elementFromPoint`).

Efecto en la traza (ratón sobre el editor): hit test 1045 → 157 ms; hilo ocupado 1804 → 865
ms; pulsación más lenta 136 → 96 ms; ≥ 50 ms, 18 → 3.

Benchmark oficial sin cambios, 3 ejecuciones juntas (≈ 285 pulsaciones), antes (iteración
16) → después:

| 1 MB + KaTeX en Dividido | Antes | Después |
|---|--:|--:|
| P50 | 48 ms | 16 ms |
| P95 | 112 ms | 96 ms |
| P99 | 320 ms | 216 ms |
| Máx. | 400 ms | 256 ms |
| Eventos ≥ 50 ms por ejecución | 38–111 | 14–28 |
| Eventos ≥ 100 ms por ejecución | 17–21 | 5–11 |
| Tarea larga | 223–288 ms | 97–203 ms |

**Sigue sin cumplir.** Lo que queda, por zonas:
- La cola está en las primeras pulsaciones tras saltar a una zona:
  - al principio, nada más entrar en Dividido: 184–193 ms;
  - al final: hasta 368 ms.
  - La zona media queda en ≤ 64 ms.
  - Es el fotograma que pinta lo que se acaba de hacer visible (PrePaint y entradas de
    composición, ya visto en la iteración 15).
- Una vez por segundo, los detectores de anuncios de Chromium hacen un hit test dentro del
  Commit (~55 ms). Es interno del navegador.

**1 MB de encabezados: otra causa**

En la traza no hay hit test (~0,2 ms por tecla), ni layout ni paint relevantes. Cada
pulsación es ~20 ms de JavaScript de CodeMirror.

El perfil de CPU lo sitúa en el parser incremental de Markdown (Lezer), al aplicar cada
transacción:
- `applyTransaction` → `LanguageState` → `work` / `advance`: 401 ms en 27 pulsaciones,
  ~15 ms por tecla;
- dentro: `reuseFragment` / `takeNodes` (~207 ms) y `toTree` / `balance` (~192 ms);
- GC menor: 65–74 ms.

Con 56 013 bloques colgando de la raíz del documento, cada edición reutiliza y reequilibra
esa lista hasta la posición editada:

| Edición | Parser en 27 pulsaciones |
|---|--:|
| Encabezados, al final | 401 ms |
| Encabezados, al principio | 47 ms |
| KaTeX (13k bloques), al final | 135 ms |

No es el índice, la sincronía, los observers, el foco ni `content-visibility`.

**No se ha corregido.** No hay una corrección mínima que no cambie lo que ve el usuario (por
ejemplo, menos resaltado en documentos enormes). Queda como propuesta.

Benchmark después, sin cambios para este caso (3 ejecuciones):
- **Edición:** P95 40, P99 48, máx. 48 ms; 0 eventos ≥ 50 ms.
- **Dividido:** P95 64, P99 112, máx. 120 ms; 12–19 eventos ≥ 50 ms y 4 ≥ 100 ms.
  - La peor pulsación (105–120 ms) es la primera tras el clic en la zona media.

**Otras cifras (después, 3 ejecuciones):**
- 1 MB: Edición máx. 32 ms; Dividido P95 48, máx. 56 ms.
- 1 MB + Mermaid, Dividido: P95 24, máx. 56 ms.
- 1 MB + KaTeX, Edición: máx. 32 ms.

**WebKit:** `sudo -n npx playwright install-deps webkit` → `sudo: a password is required`.
Sin medir.

**Verificación**
- `lint`, `typecheck`, 904 tests unitarios, `build` y `build:tamano` (92,5 KB): en verde.
- 97 E2E en verde, incluidos sincronía con y sin fórmulas, separador y pantalla estrecha.
- CSP sin cambios.

### Iteración 17 — *2026-10-03* — Fase 9: el documento anterior ya se libera; Firefox medido sin el ruido de Playwright (sigue sin aprobar)

El benchmark ampliado (iteración 16) dejó dos problemas por investigar antes de seguir
optimizando:
- al cambiar de documento, el DOM del preview anterior seguía vivo;
- en Firefox, cambiar de modo tardaba hasta 143 s.

Por orden del usuario se buscó la causa real de cada uno; nada de Chromium se ha
optimizado. **La Fase 9 sigue abierta y no aprobada.**

**1. Retención del DOM al cambiar de documento: causa y corrección**

- **Cómo se encontró.** Se tomó un heap snapshot por CDP tras cambiar de documento y se
  buscó el camino de retención más corto (sin aristas débiles) desde la raíz hasta una
  tabla separada del árbol:

  ```
  módulo → variable «An» → Range → ShadowRoot del editor → host → contenedor de SplitView
    → <article> → el preview entero
  ```

  En el bundle, `var An; function jn(e,t,n=t){let r=An||=document.createRange(); …}` es el
  `scratchRange` de `@codemirror/view`: CodeMirror guarda en una variable de módulo el
  último `Range` con el que midió texto y nunca lo suelta. Al destruir la vista, el `Range`
  queda en el ShadowRoot; el ShadowRoot colgaba del `div` de React, dentro del mismo árbol
  que el preview.
- **Por qué solo desde Dividido.** Al salir desde Lectura o Edición no pasa: en Edición el
  preview está desmontado. Se liberaba «tras el siguiente refresco» cuando CodeMirror volvía
  a medir y reapuntaba el `Range`.
- **Lo que no es.** Con la corrección, el snapshot no tiene ninguna tabla del documento
  anterior alcanzable: no hay un segundo retenedor. No retienen nada React, los observers,
  los listeners, los temporizadores, la sincronía del scroll, Mermaid, KaTeX ni los `blob:`.
- **Corrección** (`EditorMarkdown.tsx`): el ShadowRoot cuelga de un nodo que crea y quita
  el propio editor. El `Range` de CodeMirror solo llega ya a ese nodo vacío.
  - El `data-testid` pasa a ese nodo: los tests que usan `shadowRoot` no cambian.
  - Sin cambios de CSP ni de maquetación (el nodo lleva `h-full`).
- **Test** (`e2e/specs/memoria.spec.ts`, CDP): con la versión anterior falla (301 tablas
  vivas, 1 en la página); con la corrección pasa.
  - Va sin la traza de Playwright, en su propio fichero: con traza, el grabador de
    instantáneas de Playwright retiene él mismo los nodos (301 vivas también con la
    corrección).
  - Playwright no deja cambiar `trace` dentro de un `describe`.
- **Memoria (benchmark sin cambios), antes → después:**

  | Momento | Antes | Después |
  |---|---|---|
  | Tras cambiar de 1 MB a 2 KB | V8 22,8 MB · Blink 35,6 MB · 2575 tablas vivas / 6 | V8 7,4 MB · Blink 8,3 MB · **6 / 6** |
  | Tras volver al 1 MB | Blink 168,7 MB · 5138 / 2569 | Blink 137,0 MB · **2569 / 2569** |
  | 1 MB + KaTeX | Blink 359,9 MB · 4753 / 2184 | Blink 319,2 MB · **2184 / 2184** |
  | 1 MB + Mermaid | Blink 299,3 MB · 4747 / 2563 | Blink 180,4 MB · **2563 / 2563** |

**2. Firefox: las cifras de minutos eran Playwright**

- **Perfil de Gecko** (`MOZ_PROFILER_STARTUP`) del cambio de modo del benchmark. Los
  ~105 s entre el clic y el editor visible estaban enteros en el script que inyecta
  Playwright (`JSActor message handler` → `debugger eval code` → `getAriaRole`, con
  2197 reflows síncronos). `getByRole` / `getByText` calculan roles y nombres de todo el
  documento en cada sondeo: con ≈ 280 000 nodos, decenas de segundos por sondeo.
- **Segundo artefacto.** Con localizadores CSS, `expect(editor).toBeVisible()` seguía
  tardando 84,6 s, con el editor listo en la página en < 1 s. Esperando desde la página
  (`waitForFunction`, misma condición), 54 ms.
- **Benchmark corregido** (error demostrado):
  - localizadores CSS acotados, que apuntan a los mismos elementos;
  - la espera de `entrarEn`, desde la página.
  - Chromium da las mismas cifras que antes (una ejecución de latencia completa).
- **Lo real, medido desde la página** (Firefox / Chromium, hasta el hilo quieto):

  | Cambio | Firefox | Chromium |
  |---|--:|--:|
  | Lectura → Dividido, 1 MB + KaTeX | 0,97 s | 1,07 s |
  | Lectura → Edición, 1 MB + KaTeX | 1,1 s | 0,9 s |
  | Edición → Dividido, 1 MB + KaTeX | 6,3–7,9 s | 3,7–3,9 s |
  | Edición → Dividido, 1 MB | 3,1 s | 1,9–2,1 s |
  | Dividido → Edición | < 0,5 s | < 0,1 s |

  Perfil de Edición → Dividido en Firefox, con KaTeX:
  - React vuelve a montar el preview (~4 s): el parser de Markdown ~1,9 s, KaTeX ~0,65 s e
    insertar el DOM ~0,65 s;
  - layout ~2,7 s (Reflow 1,8 s y Styles 1,1 s);
  - el foco de CodeMirror, que lee `scrollTop`, 0,6 s;
  - GC ~0,5 s.

  Es el coste de reconstruir el preview, que en Edición está desmontado por diseño. Firefox
  es ~1,5–2 veces más lento en cada fase; no se encontró una causa propia de Firefox. No se
  ha optimizado (no se pidió).
- **Teclear en Firefox, con el benchmark corregido (dos ejecuciones):**

  | Caso | P95 | P99 | Máx. | Eventos ≥ 50 ms | Entrar en el modo |
  |---|--:|--:|--:|--:|--:|
  | 1 MB, Edición | 24 ms | 32 ms | 32 ms | 0 | 0,47–0,57 s |
  | 1 MB, Dividido | 16–24 ms | 24 ms | 24 ms | 0 | 3,0–3,2 s |
  | 1 MB + KaTeX, Dividido | 56–72 ms | 72–88 ms | 88 ms | 11 por ejecución | 0,83–0,87 s |

  Antes salía en KaTeX un máximo de 40 ms solo porque se tecleaba tras ~90 s de espera
  involuntaria, con todo ya asentado. La cifra nueva es peor y es la comparable con
  Chromium.

**Errores propios del camino**

- La primera sonda de Firefox medía también con `getByRole`, así que sus 16–27 s
  también eran ruido.
- La marca de «visible» de la sonda se ponía tras un `getBoundingClientRect` que forzaba el
  layout pendiente. Eso creaba un falso «fotograma de 2,4 s después de verse el editor».
- El primer test de memoria iba con la traza de Playwright y no podía pasar.
- `test.use({ trace })` no se admite dentro de un `describe`.

**Verificación**

- `lint`, `typecheck`, 904 tests unitarios, `build` y `build:tamano` (92,5 KB): en verde.
- 96 E2E en verde (los 95 de antes más el de memoria). Incluyen recursos locales,
  sincronía con y sin fórmulas, KaTeX y Mermaid, cambios sin guardar con su confirmación,
  y CSP (cabecera idéntica, cero violaciones y ninguna petición externa).
- WebKit, sin datos: sigue sin las bibliotecas del sistema.

### Iteración 16 — *2026-10-02* — Fase 9: benchmark del editor ampliado (sigue sin aprobar)

Por orden del usuario, antes de más optimizaciones hacía falta medir todo lo que faltaba:
- P50, P95 y P99 por pulsación;
- las fases de la vista previa;
- la memoria;
- Mermaid en el navegador;
- la carga de CodeMirror;
- Firefox y WebKit.

No se ha tocado la app; solo el benchmark (`e2e/bench/editor.bench.ts`,
`playwright.bench.config.ts`, scripts `bench:*`). **La Fase 9 sigue abierta y no
aprobada.** Tablas de latencia y vista previa en [FASES.md](FASES.md), Fase 9.

**Cómo se mide, y por qué así**

- **Escritura:** la de siempre, para que las cifras sean comparables con las anteriores. Se
  teclea nada más saltar a cada zona.
  - Error propio: la primera versión añadía una espera entre saltar y teclear. Escondía el
    fotograma caro tras el salto (el pico de KaTeX) y se quitó.
- **Latencia por pulsación, dos métodos:**
  - Event Timing por `interactionId` (Chromium y Firefox; «<16» = no informada).
  - Tecla → siguiente fotograma, con `keydown.timeStamp` y una tarea tras el
    `requestAnimationFrame`. Este método vale también para WebKit, que no tiene Event
    Timing.
- **Muestras:** tres ejecuciones juntas, ≈ 280 pulsaciones por caso y modo. Con una sola
  (93 pulsaciones), el P99 es el máximo.
- **Instrumentación:** solo desde el benchmark (`addInitScript`): oyentes de `keydown` y
  clic, un envoltorio de los temporizadores de 200 ms (la espera de la vista previa) y las
  respuestas del marco de Mermaid. Ningún cambio en la app.
- **Corregido: el benchmark anterior inflaba los recuentos.** Creaba un PerformanceObserver
  por zona sin desconectar los anteriores, así que cada evento se contaba hasta 6 veces. Los
  recuentos de «eventos ≥ 50 ms» de las iteraciones 14 y 15 salían multiplicados ×1 a ×6;
  los máximos no. No se reescriben: se explican aquí.
- **Vista previa:** se mide la cadena tecla → disparo de la espera → fin del callback → primera
  mutación del artículo → fotograma siguiente. En pausa, desde el clic en «Actualizar». El
  aviso de pausa solo aparece con cambios sin mostrar: se mira después de teclear (la
  primera versión lo miraba antes y no pulsaba nunca).
- **Memoria (CDP):**
  - `Runtime.getHeapUsage` (V8 y Blink) y `Memory.getDOMCounters`, tras
    `HeapProfiler.collectGarbage`.
  - Tablas vivas en el montón con `Runtime.queryObjects`, frente a las del documento.
  - Sin la instrumentación del benchmark en la página. No incluye GPU, rasterización ni el
    marco de Mermaid.

**Resultados que no están en FASES**

Memoria (Chromium, 1 MB = 2569 tablas):

| Momento | V8 | Blink | Nodos | Tablas vivas / en el documento |
|---|--:|--:|--:|--:|
| Inicial, sin documento | 2,3 MB | 0,5 MB | 63 | 0 / 0 |
| 1 MB abierto (Lectura) | 44,1 MB | 135,3 MB | 141 408 | 2569 / 2569 |
| 1 MB, editando en Edición (sin GC) | 12,5 MB | 15,1 MB | 533 | — / 0 |
| 1 MB, tras editar en Edición | 8,8 MB | 3,7 MB | 527 | 0 / 0 |
| 1 MB, editando en Dividido (sin GC) | 58,5 MB | 136,6 MB | 134 134 | — / 2569 |
| 1 MB, tras editar en Dividido | 47,6 MB | 128,9 MB | 134 131 | 2569 / 2569 |
| **Tras cambiar a otro documento (2 KB)** | 22,8 MB | 35,6 MB | 134 092 | **2575 / 6** |
| Ídem, 5 s después | 22,7 MB | 35,5 MB | 134 092 | 2575 / 6 |
| **Tras volver al 1 MB** | 61,8 MB | 168,7 MB | 275 067 | **5138 / 2569** |
| 1 MB + KaTeX (Lectura) | 73,5 MB | 359,9 MB | 548 743 | 4753 / 2184 |
| 1 MB + KaTeX, tras editar en Dividido | 61,8 MB | 329,0 MB | 408 909 | 2184 / 2184 |
| 1 MB + Mermaid (Lectura) | 73,0 MB | 299,3 MB | 550 159 | 4747 / 2563 |
| 1 MB + Mermaid, tras editar en Dividido | 53,9 MB | 170,2 MB | 134 429 | 2563 / 2563 |

**Hallazgo: al cambiar de documento, el DOM de la vista previa anterior queda retenido**
fuera del árbol. Se ve con `queryObjects`, recolectado, y sin la instrumentación del
benchmark en la página. Se libera tras el siguiente pintado del documento nuevo: la
retención es de un documento, no crece sin límite. Pico: dos documentos a la vez (Blink,
360 MB). Causa no investigada (no se pidió); es una tarea.

Mermaid (Chromium):
- Primer dibujo con el marco en frío: 523–542 ms.
- Edición fuera de los diagramas: 0 dibujos y el mismo nodo y la misma URL `blob:`.
- Edición dentro de un diagrama: 1 dibujo (solo ese), de la tecla al diagrama nuevo
  224–241 ms. El otro, intacto.
- 1 MB + Mermaid: los 52 diagramas se dibujan al acercarse a la vista (solo 1 al abrir; el
  primero a los 3,3 s). Al pulsar «Actualizar» tras editar fuera de ellos, 0 dibujos.

Carga de CodeMirror (Chromium, 5 contextos en frío; 3 más con traza):

| Documento | Hasta pedir el trozo | Descarga | Hasta visible | Hasta estable |
|---|--:|--:|--:|--:|
| 2 KB | 2 ms | 9–10 ms | 329 ms | 336 ms |
| 1 MB | 33–57 ms | 10 ms | 362–392 ms | 371–403 ms |

- **Trozo:** `EditorMarkdown` es uno solo (100 995 B). Se analiza fuera del hilo principal
  (`v8.parseOnBackground`, ~10 ms) y se ejecuta en ~8 ms (2 KB) o ~34 ms (1 MB).
- **Con 2 KB,** el hilo principal trabaja ~60 ms de los ~330 hasta ver el editor: el resto
  es espera. Encaja con la espera mínima con la que React muestra el contenido de un
  `Suspense` (no verificado en el código de React).
- **Con 1 MB,** la traza incluye trabajo de después de estabilizarse el editor y no se
  separa.

**Compatibilidad**

- **Firefox, escenarios críticos, dos ejecuciones.** Teclear va bien:
  - 1 MB Edición: P95 32, P99 32, máx. 40 ms.
  - 1 MB Dividido: P95 24, P99 32, máx. 32 ms.
  - 1 MB + KaTeX Dividido: P95 40, P99 40, máx. 40 ms.
  - En los tres, 0 eventos ≥ 50 ms; por fotograma, máx. 37, 31 y 71 ms.
- **Firefox, cambiar de modo es lento:**
  - 1 MB a Edición: 9,6–11,0 s (Chromium: 2,5–4,1 s).
  - 1 MB + KaTeX a Dividido: 128–143 s, hasta el editor visible y el hilo quieto (Chromium:
    5,2–6,5 s).
  - En la ejecución completa, tras el caso de 1 MB, el editor no apareció en 120 s, dos
    veces de dos.
  - En una pestaña recién abierta, aparece a los 16–27 s.
  - Una sonda descartó la instrumentación: ni los temporizadores envueltos, ni los
    oyentes, ni el observador de Event Timing, ni la espera de fotogramas lo provocan.
- **WebKit:** no arranca en este WSL. Faltan bibliotecas del sistema (libgtk-4, gstreamer,
  libxslt…), que instala `sudo npx playwright install-deps webkit`: necesita la contraseña
  del usuario. Sin datos.

**Propuesta de criterio técnico** para «1 MB editable sin retraso perceptible». Se mide con
`bench:editor`, Chromium, ≥ 3 ejecuciones juntas, todas las zonas y los dos modos, sin
quitar el primer fotograma tras saltar. Cada umbral sale de una referencia externa, no de
las cifras:

| Medida | Umbral | Referencia |
|---|---|---|
| P95 por pulsación | ≤ 50 ms | presupuesto de RAIL para gestionar la entrada |
| P99 por pulsación | ≤ 100 ms | respuesta «inmediata» de RAIL |
| Máximo por pulsación | ≤ 200 ms | INP «bueno» |
| Pulsaciones ≥ 100 ms | 0 por ejecución | — |
| Tarea larga máxima al teclear | ≤ 100 ms | — |
| P95 de Dividido sobre el de Edición | ≤ 16 ms más | un fotograma |

Aplicada a las cifras de hoy:

- **Cumplen:** 1 MB (Edición y Dividido), 1 MB + Mermaid y 1 MB + KaTeX en Edición.
- **No cumplen:**
  - 1 MB + KaTeX en Dividido: todas las medidas.
  - 1 MB de encabezados: P95 56 ms ya en Edición (es el propio editor), y P99 104 ms en
    Dividido. Este caso no fallaba con las cifras anteriores.
- **Fuera del umbral de teclear:** cambiar de modo en Firefox con KaTeX (minutos). Que
  cuente para «editable» lo decide quien aprueba.

**Errores propios del camino** (además de los de arriba):
- El análisis de Mermaid buscaba un `<svg>`, y el diagrama dibujado es un `<img>` con URL
  `blob:`.
- Contaba como «primer diagrama» uno del documento anterior.
- Tras «Actualizar», el foco se quedaba en el botón y la siguiente escritura no llegaba al
  editor.
- Un `$i` sin escapar a través de `wsl` hizo que tres ejecuciones escribieran en el mismo
  fichero: se repitieron.

### Iteración 15 — *2026-10-02* — Fase 9: diagnóstico del retraso en Dividido con trazas de Chromium (sigue sin aprobar)

La Fase 9 se reabrió porque teclear en Dividido con 1 MB tenía retraso (iteración 14). Por
orden del usuario, primero había que encontrar la causa con trazas reales y no aplicar
soluciones a ciegas. Se grabaron trazas de Chromium vía CDP (`Tracing.start`) contra la
build de producción y se analizaron por tareas del hilo principal. **La fase sigue abierta y
no aprobada**: 1 MB + KaTeX en Dividido no cumple.

**Qué se encontró (evidencia de la traza)**

- **Los picos de 224–256 ms de 1 MB en Dividido no eran de la app.** El benchmark heredaba
  `trace: "retain-on-failure"` de `playwright.config.ts`: la traza de Playwright se graba
  siempre, aunque solo se guarde si algo falla. En cada acción, su instantánea del DOM es
  un `EvaluateScript` sin URL que recorre todo el documento. En la traza: 16 tareas de
  ~900 ms (~3,9 s con KaTeX) y 2,4 millones de maquetaciones forzadas, mientras las tareas
  de teclado tenían una mediana de 9,9 ms y un máximo de 38,9 ms. Con `--trace off`, sin
  más cambios, 1 MB en Dividido baja a un máx. de 24–64 ms.
- **KaTeX sí tenía un coste real.** Tras cada tecla, Chrome lanza un `mousemove` sintético
  para recalcular el *hover*, y su hit test (`LayoutView::HitTest`) recorría la vista previa
  entera: 282 000 nodos, 45 864 posicionados (43 680 de KaTeX), ~40–50 ms por tecla.
- **Lo que no es la causa.** Costaba lo mismo con el ratón sobre el editor o sobre la vista
  previa, y `contain: strict` no lo evita. Además, una vez por segundo, los detectores de
  anuncios de Chromium (`StickyAdDetector`, `OverlayInterstitialAdDetector`) hacen sus
  propios hit tests, a los que se suma un Commit (~100 ms).
- **Sonda con CSS inyectado** (hoja construible, sin tocar la app). Con `pointer-events: none`
  no cambiaba nada. Con KaTeX sin posicionar, 40 → 31 ms: las capas pesan, pero no lo
  explican todo. Con `content-visibility: auto` en los bloques, el hit test bajaba a
  ~13 ms y la tecla más lenta de 200 a 64 ms.

**Qué se cambió y por qué**

- **`content-visibility: auto` en los bloques de primer nivel con fórmulas**
  (`.md-contenido > :has(.md-formula)`, markdown.css). Aprobado por el usuario tras ver la
  causa. Se probó primero en **todos** los bloques, y el benchmark lo tumbó: con 1 MB de
  encabezados (56 013 bloques), el IntersectionObserver interno de `content-visibility`
  costaba ~37 ms dos veces por fotograma (`computeIntersections`, 1,7 s en 3 s de traza), y
  Dividido pasó a un máx. de 168–608 ms. Acotado a los bloques con fórmulas, F vuelve a su
  sitio y ningún encabezado de primer nivel queda dentro de un bloque saltado, que es lo que
  mide la sincronía.
- **`overflow-clip-margin: 0.5rem`.** La contención de pintado recortaba el contorno de foco
  (desplazado 2px) de un enlace pegado al borde del bloque. Se comprobó en Chromium
  comparando píxeles, y lo cubre un E2E.
- **`playwright.bench.config.ts` con `trace: "off"`** (aprobado), con el motivo escrito. Las
  cifras de la iteración 14 se quedan en su entrada: no se borran, se explican.
- **Tests:**
  - E2E nuevo: los bloques con fórmulas lejanos se saltan y los que no tienen fórmulas no;
    el índice llega al último; el foco no sale recortado.
  - La sincronía del editor se prueba también con fórmulas.
  - El E2E de 1 MB comprueba además que el salto del índice deja el encabezado a la vista.

**Descartado, y errores propios del camino**

- Una corrección en `sincronia.ts` (recolocar la vista previa en los fotogramas siguientes,
  porque los bloques sin pintar miden una altura estimada). Hizo falta con la regla en todos
  los bloques: el E2E de sincronía falló por dos secciones. Con la regla acotada, el test no
  falla sin ella, ni con párrafos cuatro veces más largos, así que se quitó: sin un caso que
  la exija, es código de más.
- `trace: "off"` en el E2E de 1 MB del lector: hizo falta solo mientras la regla estaba en
  todos los bloques. La instantánea de Playwright lee el estilo de cada nodo, y dentro de
  bloques saltados cada lectura obliga a calcularlo: `getComputedStyle` de 90 000 nodos
  pasaba de 41 ms a 8 s. Se quitó al acotar la regla.
- Errores propios:
  - El primer analizador de trazas (`Math.max(...array)` con millones de eventos)
    desbordaba la pila.
  - La primera sonda acumulaba observadores (los recuentos salían duplicados) y aplicaba la
    regla al único hijo del artículo.
  - El primer E2E usaba mal `checkVisibility`: mira si el elemento está dentro de un bloque
    saltado, no el bloque en sí.

**Cifras** (benchmark completo dos veces, sin la traza de Playwright; tablas en FASES y
ARCHITECTURE §4 octies)

| Caso | Antes (iteración 14) | Después |
|---|---|---|
| 1 MB, Edición | máx. 24 ms · 0 lentos | máx. 16–32 ms · 0 |
| 1 MB, Dividido | máx. 224–256 ms · 37–46 lentos | máx. 24–72 ms · 0–28 |
| 1 MB + KaTeX, Dividido | mediana 72–80 · máx. 784–1104 ms · 468–708 | mediana 48 · máx. 104–344 ms · 10–75 |

Lo que queda en KaTeX en Dividido, según la traza:

- Un hit test de ~30 ms por tecla: los bloques sin fórmulas siguen pintados.
- ~100 ms por segundo de los detectores de anuncios de Chromium y un Commit.
- ~270 ms en el primer fotograma tras saltar al final (PrePaint 157 ms, entradas de
  composición 55 ms). De ahí el pico de 336–344 ms en la zona «final».

**Verificación**

- `lint`, `typecheck`, 904 tests unitarios en 46 ficheros, `build`, `build:tamano`
  (92,5 KB) y 95 E2E en verde.
- CSP sin cambios: el E2E compara la cabecera y cuenta cero violaciones y ninguna petición
  externa.
- Sin dependencias nuevas.

### Iteración 14 — *2026-10-01* — Fase 9: editor de Markdown, vista previa y modo dividido (no aprobada)

> **Reabierta el 2026-10-02**: el benchmark definitivo demostró que el criterio de 1 MB
> falla en Dividido (tabla abajo). La fase sigue abierta; esta entrada recoge lo hecho.

La Fase 9 añade la edición de Markdown con D9 confirmada al empezar: **CodeMirror 6**. Tres
modos (Lectura, Edición, Dividido), vista previa con el mismo lector, desplazamiento
sincronizado, cambios sin guardar con confirmación y guardado local. **La CSP no cambia.**
Seis dependencias de runtime nuevas (`@codemirror/*` y `@lezer/highlight`, versiones
exactas), solo en un trozo a demanda.

**Qué se hizo y por qué**

- **CodeMirror en un Shadow DOM, por la CSP.** Antes de construir encima se miró cómo
  inyecta estilos: `style-mod` pone una `<style>` si la raíz es el `document` (bloqueada por
  `style-src 'self'`) y hojas construibles si es un `ShadowRoot`. El editor se monta en su
  propio Shadow DOM: cero violaciones, cabecera idéntica (E2E). Los tokens de color cruzan
  la frontera (son propiedades personalizadas).
- **Escribir sobre una selección provocaba violaciones de CSP** (encontrado con E2E): la
  edición nativa de Chrome crea `<span style>` al sustituir texto seleccionado (dos
  violaciones por pulsación; teclear normal y Retroceso no). Un manejador de `beforeinput`
  aplica esos cambios como transacción de CodeMirror. Una sonda de seis escenarios lo
  confirmó antes y después; queda un E2E permanente (escribir y pegar sobre una selección).
- **Mínimo de CodeMirror**: sin el paquete `codemirror` (autocompletado, lint, búsqueda) y
  solo `markdownLanguage` + `markdownKeymap` de `lang-markdown`, así `lang-html`, CSS y
  JavaScript no entran en la build (comprobado). Trozo del editor: 98 KB gzip.
- **Vista previa = el mismo lector** con el texto editado, 200 ms después de la última
  tecla. Cada tecla hace O(1) fuera del editor; el texto (O(tamaño)) solo se saca al
  refrescar, guardar o cambiar de modo.
- **Pausa de la vista previa en documentos grandes (decisión del usuario).** Medido: con
  1 MB, cada refresco bloqueaba la escritura 1,4–3,4 s (tecla más lenta hasta 2,4 s). Con
  el lector actual, «200 ms» y «no bloquear» no se pueden cumplir a la vez; se le
  plantearon cuatro opciones (pausa, espera adaptativa, 200 ms siempre, cambiar la
  arquitectura) y eligió la pausa: si pintar la vista previa costó > 250 ms, en Dividido no
  se refresca sola, avisa y se actualiza a mano o al cambiar de modo.
- **Vista previa desmontada en Edición.** Se probó mantenerla montada y oculta (para no
  volver a pintarla al cambiar de modo): con 1 MB + KaTeX, teclear tenía picos de casi 1 s.
  Se desmonta en Edición; Lectura ↔ Dividido sí la comparten sin volver a montarla, y el
  editor se queda una vez cargado. Paneles con `contain: strict`.
- **Sincronía por encabezados**, sin bucles (manda el panel con el que se interactúa) y con
  las posiciones de los encabezados medidas solo cuando cambian (medirlas en cada fotograma
  bloqueaba con 1 MB de encabezados).
- **Diagramas recordados** en `MarcoMermaid` (por fuente y colores, 64): un diagrama sin
  cambios no vuelve al marco al refrescar.
- **Confirmación antes de perder cambios** en todas las vías de apertura y al cerrar,
  **después** de validar lo elegido y antes de aplicarlo (la especificación decía «antes de
  abrir el selector», anterior a la 7 bis): cancelar o elegir algo no válido no pregunta.
  `beforeunload` solo con cambios. `close()` pasa a ser asíncrono (devuelve si cerró).
- **Guardar**: `Platform.saveText` en web, con `showSaveFilePicker` (destino elegido la
  primera vez, `FileSystemFileHandle` en memoria y olvidado si falla) o descarga. Nunca se
  sobrescribe en silencio el fichero abierto. `Ctrl/⌘+S` y botón; error con aviso y el
  documento sigue modificado.
- **Documentación desactualizada corregida**: ELECTRON §3 (la interfaz `Platform` de la
  F7 bis y la F9; ya no existe `openDroppedFile`), FASES F14 y MODULES (la F6, en pasado).

**Descartado**: el paquete `codemirror`; `@codemirror/language-data`; un `<textarea>`;
`'unsafe-inline'` o un nonce fijo para CodeMirror (equivale a `'unsafe-inline'`); refrescar
la vista previa siempre a los 200 ms (bloquea con 1 MB); mantener la vista previa oculta en
Edición (picos de casi 1 s).

**Rendimiento** (`npm run bench:editor`, Ryzen 7 5800X, Event Timing API, 50 ms entre
teclas):

Benchmark definitivo de la iteración 14 (`npm run bench:editor`, *2026-10-01*; Chromium
headless, 1400×900, build de producción; Event Timing API: duración de cada evento de
teclado, de la tecla al pintado, solo los de 16 ms o más; 22 teclas a 50 ms, 5 teclas con
pausas de 400 ms, deshacer y rehacer, al principio, en medio y al final). «Lentos» = eventos
de 50 ms o más por zona:

| Caso | Edición: mediana · máx. · lentos | Dividido: mediana · máx. · lentos |
|---|---|---|
| 2 KB | 16 · 24 ms · 0 | 16 · 16–24 ms · 0 |
| 200 KB | 16 · 16–24 ms · 0 | 16 · 56–72 ms · 27–30 (vista previa en pausa) |
| 1 MB | 16 · 24 ms · 0 | **24 · 224–256 ms · 37–46** (en pausa) |
| 1 MB + KaTeX | 16–24 · 24–56 ms · 0–3 | **72–80 · 784–1104 ms · 468–708** (en pausa) |
| 1 MB + Mermaid | 16 · 24–32 ms · 0 | 24–32 · 240–328 ms · 18–68 (en pausa) |
| 1 MB de encabezados | 16–40 · 24–48 ms · 0 | 32–48 · 56–72 ms · 16–54 (en pausa) |

**Resultado: el criterio «1 MB sin retraso perceptible» se cumple en Edición y NO en
Dividido**, también con la vista previa en pausa (sin refrescos): el retraso no viene del
refresco. Por eso la Fase 9 está abierta y no aprobada (*2026-10-02*).

**Errores propios por el camino**:

- El primer benchmark tecleaba en ráfaga (sin pausas): cada tecla medía la cola de las
  anteriores, no lo que se percibe. Se pasó a 50 ms entre teclas. También cronometraba el
  cambio de modo con el hilo aún ocupado por la apertura (cifras de hasta 20 s que no eran
  del cambio de modo): ahora espera a que la página esté quieta.
- La pausa medía también el primer pintado de cualquier documento; en una página recién
  cargada eso pasa de 250 ms aunque el documento sea pequeño, y la vista previa se pausaba
  sin motivo (lo cazaron los E2E). Ahora el primer pintado solo cuenta en documentos
  grandes (los que se pintan en diferido).
- Tests con la cola de la plataforma falsa en el orden equivocado, una promesa devuelta
  desde una función asíncrona (que la esperaba), y `findByRole` con temporizadores falsos.

**Anuncio al usuario (CLAUDE.md §8)**: los Markdown se pueden editar (Edición y Dividido),
con vista previa, y guardar (`Ctrl/⌘+S`); BPDF avisa antes de perder cambios sin guardar.

**Verificación.** Desde `npm ci`: lint, typecheck, 904 tests en 46 ficheros, build,
`build:tamano` (92,5 KB gzip), 93 E2E (cero errores de consola, cero violaciones de CSP y
ninguna petición externa), `npm audit` (0), `docs:validar` y `docs:enlaces`, todo en verde.
**Benchmark: no cumple el criterio de 1 MB en Dividido** (arriba).

---

### Iteración 13 — *2026-09-30* — Fase 6: pantalla completa, atajos, búsqueda avanzada y contraseña

La Fase 6, especificada y aprobada en la iteración 12, completa el visor PDF. Se hizo
después de las 7, 7 bis y 8 y conserva su número. Sin dependencias nuevas y sin cambios de
CSP ni de cabeceras (así que tampoco de `vercel.json`).

**Qué se hizo y por qué**

- **Atajos, lista cerrada** (`atajos.ts`, ahora `atajoDe(tecla, contexto)`):
  - De una tecla: `F`, `T`, `R`, `Mayús+R`, `?`.
  - De navegación: `Espacio`/`Mayús+Espacio`, `→`/`←` solo en «página a página»,
    `Ctrl/⌘+G`, `F3`/`Mayús+F3`.
  - El contexto (vista, búsqueda abierta, atajos de una tecla, diálogo modal) entra como
    parámetro: la resolución sigue siendo pura y probada en Node.
  - `Mayús+R` se mira por `shiftKey` (con Bloq Mayús, `R` sigue girando a la derecha) y `?`
    por el carácter (sale con Mayús en casi todos los teclados).
  - `Espacio` no actúa sobre botones, enlaces ni casillas. `F3` actúa también en el campo
    de búsqueda y, con la búsqueda cerrada, no se toca.
- **Interruptor de los atajos de una tecla** (WCAG 2.1.4), en la ayuda:
  - Vive en memoria del módulo, así que dura la sesión y sobrevive al abrir otro documento
    (el visor se vuelve a montar). Se eligió frente a subir el estado a `App`: era cruzar
    tres componentes por un booleano que la Fase 10 moverá a preferencias.
  - La ayuda también se abre desde un botón de la barra: si no, con `?` desactivado no
    habría forma de volver a activarlos.
- **Pantalla completa** del área de lectura. `Permissions-Policy` no cambia: el valor por
  defecto de `fullscreen` ya es `self`, y un E2E lo comprueba con las cabeceras reales.
- **Búsqueda.** Se amplió el índice existente, no se rehízo:
  - Dos textos de la misma longitud, con y sin mayúsculas, sobre las mismas tablas de trozo
    y posición. El resaltado no cambió.
  - Palabra completa por los caracteres vecinos (`\p{L}`, `\p{N}`).
  - Guion de fin de línea unido, y guion blando ignorado.
  - Probado con el texto real de pdf.js sobre un fixture nuevo, `busqueda.pdf`.
  - También con un PDF generado por Chromium, que pone el guion (U+2010) en su propio trozo
    con `hasEOL`. Ese caso lo cubre la regla del trozo vacío o de solo guion.
  - Y con el único PDF real que hay en el equipo: sin opciones, mismas cifras que la F5.
- **Contraseña** (D13). Cada intento vuelve a abrir el PDF con `password` y una copia nueva
  de los bytes:
  - `PdfProtegidoError` dice si faltaba o era incorrecta. **Ya no lleva el error de pdf.js
    como `cause`**, para que la contraseña no pueda acabar en un registro por accidente.
  - Borrado de la contraseña: el campo se vacía al enviarla, y la referencia se limpia al
    terminar cada intento y al desmontar.
  - La referencia no se borra al empezar el intento, sino al terminarlo. Con `StrictMode`,
    que en desarrollo monta dos veces, se habría perdido.
- **Miniaturas:** índice de tabulación móvil y `↑`/`↓`. El panel se queda esas flechas; sin
  eso, además de mover el foco, desplazaban el documento.
- **`<dialog>` en jsdom**: no tiene `showModal`, así que `tests/setup.ts` trae el mínimo
  (solo tests). Lo modal de verdad (fondo inerte, `Esc`) se prueba en Playwright.

**Rendimiento**, medido en Node y en el mismo equipo, con 1000 páginas de ~3000 caracteres:

| | Índice de la F5 | Índice de la F6 |
|---|---|---|
| Indexar, por página | ~0,40 ms | ~0,52 ms |
| Memoria del índice | ~25,6 MiB | ~30,2 MiB |
| Cuatro búsquedas sobre las 1000 páginas | 20–30 ms | 20–30 ms |

**Descartado**:
- `onPassword` de pdf.js: mantiene viva la tarea de carga mientras el usuario escribe.
- Declarar `fullscreen=(self)`: no cambia nada y obligaba a regenerar `vercel.json`.
- Tokens `--rgb-find*`: el resaltado de la F5 ya usa el acento.

**Errores propios por el camino**:
- Los 8 E2E nuevos fallaron la primera vez contra un `vite preview` huérfano de una
  ejecución anterior. Playwright reutiliza el servidor fuera de CI, y ese servía un `dist/`
  viejo. Al pararlo pasaron 7 de 8.
- El octavo buscaba el botón «Cerrar» de la ayuda, que coincidía también con «Cerrar
  documento». Se renombró a «Cerrar la ayuda», porque también era ambiguo para un lector de
  pantalla.
- Un `\n` se perdió al escribir el generador de fixtures por el shell.

**Tests de `App` intermitentes (anteriores a la F6), encontrados y corregidos al revisar el
cierre.**
- **Qué fallaba.** Sobre todo «abrir otro documento mientras un PDF carga cancela su
  apertura», el primer test del fichero que abre un Markdown. Alguna vez también «abre un
  PDF con el botón…» (el primero que abre un PDF) y «abre un Markdown…».
- **Por qué.**
  - `App` carga los visores con `React.lazy`. El primer `import()` obliga a Vitest a
    transformar todo su árbol de módulos: unos 330 ms en condiciones normales y más de 1 s
    con la máquina cargada.
  - Los tests lo esperaban con el tiempo por defecto de `findByRole` (1 s). Medían el
    transformador de Vitest, no la app.
- **Frecuencia real.**
  - Con dos suites a la vez: 7 de 10 suites con fallos sobre `HEAD` (sin la F6) y 9 de 10
    con la F6.
  - Suites completas de una en una: 2 fallos en unas 15.
  - `App.test.tsx` solo: sin fallos.
  - Las duraciones de esos tests son iguales con y sin la F6, así que la F6 no encareció la
    carga.
- **Corrección.** `App.test.tsx` precarga los dos visores en un `beforeAll`, sin tocar
  tiempos de espera. `React.lazy` y `Suspense` siguen actuando igual, y la carga de los
  trozos reales la prueban los E2E.
- **Después de la corrección.** 0 de 10 suites con fallos con dos a la vez, y 5 de 5 suites
  normales en verde.

**Contraseña retenida en un cierre (encontrado en la misma revisión).**
- El problema: `const clave` quedaba capturada en el ámbito del efecto de `VisorPdf`, cuya
  función de limpieza sigue viva mientras el documento está abierto.
- La corrección: ahora es `let clave` y se suelta en un `finally` al terminar el intento, sea
  cual sea el resultado.
- Lo que no depende de BPDF: pdf.js envía la contraseña a su propio worker y puede
  conservarla allí mientras el documento esté abierto. Ahora lo dicen SEGURIDAD §4 y
  ARCHITECTURE.

**Anuncio al usuario (CLAUDE.md §8)**: pantalla completa, atajos de una tecla con su ayuda
e interruptor, girar a la izquierda, búsqueda con «Distinguir mayúsculas» y «Palabra
completa» (y palabras partidas con guion), `F3`, flechas en las miniaturas, y los PDF con
contraseña ya se abren.

**Verificación.** Todo en verde:
- `lint`, `typecheck`.
- 842 tests en 43 ficheros.
- 77 E2E, con cero errores de consola, cero violaciones de CSP y ninguna petición externa.
- `build`, y `build:tamano` con 90,5 KB (+0,9 KB).
- `npm audit` sin vulnerabilidades.
- `docs:validar`, `docs:enlaces` y `git diff --check`.

---

### Iteración 12 — *2026-09-30* — Especificación de la Fase 6 y documentos al día

Antes de empezar la Fase 6 (que quedó atrás cuando el usuario pidió primero las 7, 7 bis
y 8), una revisión de los documentos contra el código encontró afirmaciones que ya no eran
ciertas. Esta iteración solo toca documentación: ningún cambio de código, cabeceras ni
tests.

**Decisiones del usuario**

- **D13 confirmada**: la contraseña de PDF entra en la F6 (diálogo, reintento, cancelar
  cierra el documento, la contraseña no se guarda).
- **Atajos de la F6, lista cerrada**: `F`, `T`, `R`, `Shift+R`, `?` (de una tecla,
  desactivables desde la ayuda, en memoria) y `F3`/`Shift+F3`, `→`/`←`,
  `Espacio`/`Shift+Espacio`, `Ctrl/Cmd+G`. **`I` sale de la tabla** de PLAN §9.4, igual que
  `T` para el índice de Markdown: no tienen fase que los especifique.
- Numeración histórica intacta: la siguiente es la 6, no la 9.

**Qué se hizo y por qué**

- **FASES, Fase 6 reescrita** con el punto de partida real del código (`atajos.ts`,
  `estado.ts`, `busqueda.ts`, `PanelMiniaturas.tsx`, `engine.ts`), las reglas de foco de
  cada atajo, el comportamiento de la pantalla completa y de la contraseña, el diseño del
  índice de búsqueda (dos textos de la misma longitud, con y sin mayúsculas, sobre las
  mismas tablas de trozo y posición) y los tests.
- **Pantalla completa sin tocar cabeceras.** SEGURIDAD §2.2 decía que `fullscreen` «se
  declarará» en `Permissions-Policy`, pero su valor por defecto ya es `self`: declararlo no
  cambiaría nada y obligaría a regenerar `vercel.json` y volver a comprobar producción.
  Un E2E lo comprobará con las cabeceras reales.
- **Tokens `--rgb-find*` retirados del plan**: nunca se crearon (el resaltado de la F5 usa
  el acento) y las opciones de búsqueda de la F6 no cambian el resaltado.
- **Contradicciones corregidas**:
  - CLAUDE.md §0 decía «solo local» y «no hay producción», aunque la web ya está en Vercel.
  - TAREAS daba 752 tests en 42 ficheros; comprobado de nuevo, son 768 en 43.
  - PLAN tenía varias afirmaciones viejas:
    - el error `multiple`, retirado en la 7 bis;
    - las imágenes locales como «pendiente»;
    - la vista provisional de la F3, borrada en la F7;
    - la virtualización «la da `PDFViewer`», en contra de D17;
    - rutas de componentes que no existen;
    - D5 sin mencionar Vercel.
  - FASES F10 citaba `PdfViewer.tsx`.
  - FASES F12 citaba `security-headers.mjs` y pedía quitar un `data:` que ya no está.

**Descartado**: `onPassword` de pdf.js para la contraseña. Mantiene viva la tarea de carga
mientras el usuario escribe, y complica la cancelación que ya existe. Se vuelve a abrir
con `password` y una copia nueva de los bytes.

**Verificación.** `docs:enlaces` y `docs:validar` en verde. Recuento: `test:run`, 768
tests en 43 ficheros; `playwright test --list`, 69 E2E en 6 ficheros.

---

### Iteración 11 — *2026-09-30* — Cabeceras HTTP en Vercel y cierre de la Fase 8

Decisiones de la Fase 8 tomadas por el usuario: cabeceras en Vercel, **aprobadas**;
`$…$` en línea se mantiene (el caso «$5 y $10» queda como limitación documentada, se
escribe `\$5`); Mermaid se queda en 11.17.2 (la 12 será una tarea aparte); el fondo claro
para imágenes transparentes sigue pendiente.

**Qué se hizo y por qué**

- **`vercel.json` generado, no escrito a mano.** Vercel lee las cabeceras de un JSON en la
  raíz del repositorio, así que no puede importar `security-headers.ts`. Para no tener dos
  copias de la CSP (la que se relaja es la que nadie mira), `reglasVercel()` las deriva de
  `cabecerasPara` y `npm run cabeceras:vercel` escribe el fichero; `tests/unit/vercel.test.ts`
  falla si el versionado no coincide, igual que los fixtures generados.
- **Tres reglas que no se solapan** (`/((?!assets/|mermaid\.html$).*)`, `/mermaid.html`,
  `/assets/(.*)`): el resultado no depende de cómo combine Vercel varias coincidencias. El
  test comprueba, ruta a ruta (`/`, `/pdfjs/…`, `/mermaid.html`, `/assets/…`, una
  inexistente), que coincide exactamente una regla y que da lo mismo que `vite preview`.
- **Solo cabeceras**: nada de reescrituras, redirecciones ni configuración de build (el
  proyecto de Vercel no está en el repositorio y no se toca).
- **`npm run cabeceras:verificar -- <url>`**: la comprobación de CLAUDE.md §10 convertida en
  comando. Pide `/`, `/mermaid.html` y un módulo del marco y compara cada cabecera con la
  fuente. Contra `vite preview`: todo coincide. Contra `bpdf.r3zon.com` antes de desplegar:
  ninguna cabecera de seguridad y `/mermaid.html` en 404 (la Fase 8 no estaba publicada).
- **DEPLOYMENT.md** decía que BPDF no estaba desplegado: ahora describe Vercel, el fichero y
  cómo comprobarlo. D5 no se da por cerrada, y el dominio de `project.ts` sigue siendo el de
  ejemplo (trabajo de SEO, aparcado).

**Lo que NO se pudo hacer**: comprobar las cabeceras en `bpdf.r3zon.com` con
`vercel.json` aplicado. Vercel despliega desde git y no hubo commit ni push. Queda como
tarea 🔴 en TAREAS, con el comando exacto.

**Errores propios por el camino**: la barra de `mermaid\.html` se perdió dos veces al
escribir por el shell (una en el código, que dejaba el punto como comodín, y otra en su
test); lo cazó el propio test de bordes.

**Verificación.** Desde `npm ci`: lint, typecheck, 768 tests (43 ficheros), build,
`build:tamano` (89,6 KB), 69 E2E (el marco de Mermaid funciona con esas mismas cabeceras en
`vite preview`: cero violaciones y ninguna petición externa), `npm audit` (0),
`docs:validar` y `docs:enlaces`, todo en verde. `cabeceras:verificar` contra `vite preview`:
las tres rutas coinciden con la fuente.

---

### Iteración 10 — *2026-09-30* — Fase 8: fórmulas (KaTeX) y diagramas (Mermaid)

El Markdown ya muestra fórmulas LaTeX (`$…$`, `$$…$$`, ```` ```math ````) y diagramas
Mermaid (```` ```mermaid ````), todo local y a demanda. Se empezó por una inspección del
árbol (los cambios pendientes eran exactamente los de la Fase 7 bis) y por medir en el
navegador real antes de diseñar, y eso cambió el diseño dos veces. Diseño completo en
[ARCHITECTURE.md](ARCHITECTURE.md) §4 septies.

**Qué se hizo y por qué**

- **KaTeX sin HTML.** `rehype-katex`, lo previsto, convierte la cadena HTML de KaTeX con
  `innerHTML` en el navegador. En su lugar, BPDF pide a KaTeX su árbol y crea los nodos
  con el `toNode()` de KaTeX (`createElement`, `setAttribute`, estilos por CSSOM), en un
  nodo que React no gestiona. `trust: false`, `maxExpand`, `maxSize`, macros nuevas por
  fórmula (un `\gdef` no se filtra a otra), `throwOnError` con el código como reserva.
- **Estilos de KaTeX por atributo.** Leyendo su código antes de integrarlo: `\vec`,
  `\oiint`/`\oiiint` y `\pmb` ponen `style` con `setAttribute`, que la CSP bloquea. Se
  quita del árbol y el ancho se suple con CSS. Cero violaciones medidas con esos comandos.
- **Mermaid en un marco aislado** (decisión preguntada y confirmada). La primera prueba en
  el navegador dio 250 violaciones de CSP en un documento de cinco diagramas: Mermaid mide
  el texto dibujando en el documento con `<style>` y atributos `style`. Ninguna opción de
  Mermaid lo evita. En vez de `'unsafe-inline'` en la app, Mermaid corre en `mermaid.html`,
  dentro de un iframe con `sandbox="allow-scripts"` (origen opaco), con su propia CSP
  (estilos en línea sí, red no), y habla con la app por `postMessage`. La app gana solo
  `frame-src 'self'`.
- **El SVG, saneado en el marco y verificado en la app.** La segunda sorpresa: el saneador
  con `DOMParser` en la app producía violaciones de CSP (el documento que crea `DOMParser`
  hereda la CSP de quien lo crea; medido aislado). Se partió en dos: `sanearSvg` con DOM
  en el marco, donde los estilos están permitidos, y `verificarSvg` en la app, sin DOM,
  que recorre el XML y rechaza entero lo que no cumpla la lista blanca. La app no se fía
  del marco.
- **Nodos con imagen de Mermaid** (`@{ img: … }`): al probar el documento hostil, Mermaid
  intentaba cargar la imagen dentro del marco para medirla; la CSP del marco lo cortaba,
  pero dejaba errores. El marco los rechaza antes de dibujar, con su propio aviso.
- **Configuración de Mermaid**: `securityLevel: "strict"`, `htmlLabels: false`, topes, y
  `secure` con todo lo que un `%%{init}%%` podría usar para relajar la seguridad o
  inyectar CSS. Mermaid 11.17.2 y no la 12.0.0 (un major de tres semanas).
- **A demanda**: KaTeX con la primera fórmula; el marco (y Mermaid) con el primer
  diagrama, y cada diagrama al entrar en pantalla. Un Markdown sin nada de eso no
  descarga nada (E2E).
- **Vite y `data:`**: las fuentes de KaTeX de menos de 4 KB se incrustaban como `data:` y
  `font-src 'self'` las bloqueaba. `assetsInlineLimit: 0`: nada se incrusta.
- **Cabeceras por ruta** en `vite preview` (`cabecerasPara`): `/mermaid.html` con su CSP y
  `X-Frame-Options: SAMEORIGIN`; `/assets/` con `Access-Control-Allow-Origin: *`, porque el
  marco pide sus módulos desde un origen opaco (modo CORS).
- **Discrepancia encontrada**: DEPLOYMENT.md dice que BPDF no está desplegado, pero está
  publicado en Vercel (`bpdf.r3zon.com`). Una petición HEAD muestra que allí no hay
  cabeceras de seguridad propias (la CSP llega solo por `<meta>`) y sí
  `Access-Control-Allow-Origin: *` en los estáticos, así que el marco funcionará. No se tocó
  el despliegue (anotado en TAREAS).

**Seguridad comprobada en el navegador, no solo en tests.** Documentos hostiles de KaTeX
(`\href`, `\url`, `\html*`, `\includegraphics`, macros recursivas y exponenciales,
`\gdef`, `\rule` gigante, colores inyectados) y de Mermaid (`click`, `link`, `callback`,
HTML y scripts en etiquetas, `%%{init}%%` con `securityLevel: "loose"` y `themeCSS`, nodos
con imagen remota y `data:`, ids hostiles): cero errores, cero violaciones, ninguna
petición externa, nada ejecutado. El aislamiento del marco se comprobó desde dentro: origen
`null`, sin acceso a `parent.document` ni a `localStorage`. Abierta directamente,
`mermaid.html` no responde a nada.

**Rendimiento y bundle.** Medido con `npm run bench:markdown`: 30 fórmulas en
0,42 s y 1500 en 2,4 s; 3 diagramas en 0,83 s y 30 en 2,2 s (~60 ms cada uno, en el marco,
al entrar en pantalla); un Markdown sin fórmulas ni diagramas tarda lo mismo que antes y no
descarga nada de esto. Arranque 89,2 → 89,6 KB gzip; lector de Markdown 71 → 75 KB; KaTeX
77 KB + 4 KB de CSS y sus fuentes; Mermaid ~50 KB de entrada y ~870 KB en trozos por tipo
de diagrama, todo a demanda. El primer benchmark se colgó 30 minutos: no era la app, sino
el propio benchmark bajando pantalla a pantalla por un documento de más de un millón de
píxeles con consultas de Playwright sobre 72 000 elementos. Ahora salta a cada diagrama.

**Errores propios por el camino**

- Un `String.replace` con `` $` `` en el texto de sustitución (el comentario sobre `$…$`)
  corrompió `pipeline.ts`: `$` y comilla invertida son un patrón especial. El fichero no tenía
  cambios pendientes y se restauró desde git.
- Una expresión regular escrita a través del shell perdió su `\b` (quedó un carácter de
  retroceso invisible); se reescribió desde un fichero.
- El primer diseño del componente de diagrama revocaba su URL justo al crearla (la
  limpieza del efecto de dibujo corría al pasar a «listo»).
- Tests mal planteados que hubo que corregir: esperaban no ver la palabra «javascript» en
  la salida de KaTeX (sin `trust`, KaTeX pinta el comando como texto rojo); contaban cuatro
  fórmulas en bloque donde hay tres; y uno de `mermaid.html` daba por bueno recibir su
  propio mensaje.

**Verificación.** Desde `npm ci`: lint, typecheck, 752 tests (42 ficheros), build,
`build:tamano` (89,6 KB), 69 E2E, `npm audit` (0), `docs:validar` y `docs:enlaces`, todo en
verde. `curl -I` contra la build servida: la app con `frame-src 'self'` y sin
`unsafe-inline`; `/mermaid.html` con su política en cabecera y `<meta>`; `/assets/` con
CORS; ningún `data:` en la build. Capturas revisadas de fórmulas y diagramas.

**Para quien usa BPDF** (anuncio, CLAUDE.md §8): el Markdown ya muestra fórmulas
(`$…$` y `$$…$$`) y diagramas Mermaid. Todo se dibuja en tu equipo, sin pedir nada a
internet. Si una fórmula o un diagrama no son válidos, se ve su código; para escribir un
precio con `$`, escríbelo como `\$`.

---

### Iteración 9 — *2026-09-30* — Fase 7 bis: recursos locales de Markdown

Un Markdown ya puede mostrar sus imágenes locales, siempre que el usuario las entregue
con él: eligiendo el `.md` junto con ellas, abriendo su carpeta o soltando cualquiera de
las dos cosas. El encargo la llamó «Fase 8»; en el plan es la tarea aplazada de la F7 y se
registra como **7 bis**, antes de KaTeX y Mermaid, sin renumerar. Decisiones del encargo:
HTML crudo como texto (visto bueno a D6 tal como quedó), parser lento y < 1 s fuera, D16
intacto. Diseño en [ARCHITECTURE.md](ARCHITECTURE.md) §4 sexies.

**Qué se hizo y por qué**

- **El principio manda el diseño: BPDF nunca busca ficheros.** El navegador ya lo impone
  (un `File` suelto no da acceso a sus hermanos); en vez de rodearlo, la app pide la
  entrega explícita y todo lo demás trabaja sobre ese conjunto. `resolverRecurso` solo
  puede devolver algo del mapa de lo entregado: no hay ninguna operación que toque otro
  fichero, así que «no acceder a lo no seleccionado» no depende de acertar con cada
  ruta hostil, aunque también se prueba con 25 variantes.
- **Modelo mínimo**: `resources` en `OpenedMarkdown`, un mapa de ruta relativa
  normalizada → `RecursoLocal` (`Blob` sin leer), el directorio del `.md` y las rutas
  ambiguas. Sin rutas de disco (el navegador no las da y Electron no las mandará), sin
  Node, sin un «sistema de ficheros» abstracto.
- **La apertura, común a las plataformas** (`abrirSeleccion`): un fichero suelto se abre
  como siempre; varios deben ser un `.md` y sus imágenes; una carpeta con varios `.md`
  pregunta cuál. Así Electron solo tendrá que construir la misma `Seleccion` en su main.
- **Una sola vía de ficheros**: «Abrir archivo» admite selección múltiple en lugar de
  añadir un «Abrir Markdown con recursos». Un fichero suelto funciona igual que antes, y
  el texto del estado vacío explica cómo ver las imágenes. «Abrir carpeta» sí es un botón
  aparte: un mismo diálogo no deja elegir ficheros y carpetas.
- **Lo soltado se captura dentro del evento** (`DropZone`): el navegador invalida
  `DataTransfer` y sus entradas de carpeta al acabar el `drop`. La interfaz `Platform`
  recibe una copia (`Soltado`), lo que además permite probarlo en jsdom, que no tiene
  `DataTransfer`.
- **Resolución exacta**: decodificar una vez, rechazar `\`, absolutas y esquemas,
  normalizar segmento a segmento y buscar sin tolerar mayúsculas distintas ni buscar por
  nombre. Adivinar sería resolver a un fichero que el documento no nombra.
- **URL `blob:` bajo demanda** (`AlmacenUrls`): se crean cuando una imagen se monta, una
  por recurso con recuento de usos, y se revocan todas al desmontar el visor. Adquirir y
  liberar en un efecto con limpieza funciona también con el doble montaje de React en
  desarrollo; un almacén que solo revocara al desmontar habría dejado URL revocadas en
  caché tras ese doble montaje.
- **CSP: `img-src 'self' blob:`**, lo único que se abre. `data:` se descartó (copia la
  imagen en Base64 y admitiría cualquier `data:`). Un test exige `blob:` solo en `img-src`.
- **Errores nuevos** en lugar de `multiple` (que suponía «un fichero y nada más»):
  `no-markdown`, `several-markdown`, `incompatible`, `folder-no-markdown`,
  `folder-too-large` y `mixed-drop`. Los problemas de una imagen no son errores de
  apertura: son marcadores en su sitio, cada uno con su motivo.

**SVG: lo que se comprobó en el navegador y no se había supuesto.** Como `<img>`, un SVG
no ejecuta scripts ni carga recursos. El E2E también abre la URL `blob:` del SVG hostil
como página, lo que alguien podría hacer desde el menú contextual. Primero pareció una
fuga: Playwright registró dos peticiones a `tracker.example`. Al mirar el fallo, las dos
terminaban en `failure: csp`: el documento `blob:` **hereda la CSP de BPDF**, que corta sus
imágenes externas antes de la red y no deja correr su `<script>` ni su `onload`. El test
ahora exige eso exactamente (ninguna respuesta; todo intento cortado por CSP) en vez de
«ningún intento», que era falso. Se descartó sanear el SVG (superficie grande y frágil) y
rasterizarlo (pierde nitidez, y la CSP ya cubre el caso).

**Rendimiento (medido).** Resolver una ruta ~1,5 µs; construir el conjunto ~3,4 µs por
fichero. 50 imágenes de 6 Mpx elegidas con 50 que no se usan: texto en 0,64 s, primera
imagen en 0,67 s, **50 URL** (ninguna para las no usadas), heap de JavaScript 14 MiB. El
arranque sube 2,8 KB gzip (89,2 de 150) por la apertura de selecciones; el lector, 1 KB.

**Errores propios por el camino**

- Un `\n` dentro de una cadena de un script de edición acabó como salto de línea real
  en el `key` del panel de elección (TSX roto). Se quitó el `key`, que no hacía falta.
- El test del SVG exigía cero intentos de red (ver arriba): medía lo equivocado.
- La sonda de URL revocadas genera, como es lógico, «Failed to load resource» en consola;
  la vigilancia lo contaba como error. Ahora el test aparta exactamente esos.
- Un ejemplo de enlace en ARCHITECTURE rompió `docs:enlaces`.

**Verificación.** Desde `npm ci`: lint, typecheck, 660 tests (38 ficheros), build,
`build:tamano` (89,2 KB), 62 E2E, `npm audit` (0), `docs:validar` y `docs:enlaces` (210),
todo en verde. `curl -I`: la cabecera y el `<meta>` llevan `img-src 'self' blob:`.
Capturas revisadas: documento con todos los formatos, marcadores y panel de elección.

**Para quien usa BPDF** (anuncio, CLAUDE.md §8): un Markdown ya muestra sus imágenes si
lo abres junto con ellas (elige el `.md` y sus imágenes a la vez, o usa el nuevo botón
«Abrir carpeta», o arrástralos); si la carpeta tiene varios Markdown, BPDF pregunta cuál
abrir. BPDF no busca nada más en tu equipo, y las imágenes de internet siguen sin
cargarse.

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
