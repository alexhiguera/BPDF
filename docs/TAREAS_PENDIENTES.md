# Tareas pendientes

Solo tareas **abiertas**. Al cerrar una, se borra la línea y se cuenta en
[CHANGELOG.md](CHANGELOG.md). Lo que no es una tarea (reglas, costumbres) va a
[`CLAUDE.md`](../CLAUDE.md). Convención completa: `CLAUDE.md` §7.

`[ ]` pendiente · `[~]` en curso · 🔴 alta · 🟠 media-alta · 🟡 media · 🟢 baja

**Qué se hace y cómo:** cada fase está especificada en [FASES.md](FASES.md) (alcance,
archivos, tests, criterios de aceptación). El diseño que construyen: [PLAN.md](PLAN.md),
[SEGURIDAD.md](SEGURIDAD.md) ([ELECTRON.md](ELECTRON.md) es histórico: D19). Aquí solo el
estado.

## Estado hoy — *2026-10-04*

Medido con Node 24.21.0 y npm 11.19.0 en **WSL2 (Ubuntu) sobre Windows**, con la **Fase 13
implementada y pendiente de revisión** (iteración 29). E2E con Chromium, Firefox y WebKit
de Playwright. Cerradas las Fases 0–12 (la 6 se hizo después de las 7, 7 bis y 8, por orden
del usuario, y conserva su número). **La 9 se aprobó con una excepción de rendimiento**
(*2026-10-03*): teclear en Dividido con 1 MB + KaTeX o con 1 MB de encabezados supera los
objetivos de latencia ([FASES.md](FASES.md), Fase 9). **BPDF es solo una aplicación web**
(D19): la Fase 14 (Electron) se canceló y la 15 se reescribió sin escritorio. La 12
(seguridad) se cerró verificada en producción ([auditoria.md](auditoria.md), Auditoría 1).

| Comprobación | Resultado |
|---|---|
| Código | SPA estática de Vite 8 + React 19 que abre un PDF o un Markdown local, uno a la vez (D16): visor PDF propio sobre pdf.js con modo oscuro selectivo (ARCHITECTURE §4 quater), lector GFM con recursos locales, KaTeX y Mermaid aislado (§4 quinquies a septies), editor CodeMirror 6 (§4 octies), preferencias (§4 nonies), interfaz final (§4 decies) y, desde la Fase 13, barra del visor con flechas, separador de 24 px y foco en los diálogos (§4 undecies). **Web publicada** en Vercel (`bpdf.r3zon.com`), en `96fcafb` (Fase 12) |
| `npm run lint` · `typecheck` | ✅ |
| `npm run test:run` | ✅ 1011 tests en 53 ficheros (Fase 13: la barra con el teclado, el campo de página que no pierde lo escrito, los escuchadores del selector, el campo de contraseña sin nada que enviar; antes: CSP congelada, `Permissions-Policy`, D14 con pdf.js real, `worker-destruido`, interfaz, preferencias, XSS, recursos, Mermaid, `vercel.json`…) |
| `npm run test:e2e` (Chromium) | ✅ 130 tests en 12 ficheros contra la build de producción, entre ellos 9 de accesibilidad (Fase 13: axe en cada pantalla y estado, barra con flechas, diálogos y foco, separador) y el de IME sobre una selección (CDP) |
| `npm run test:e2e:compat` (Firefox y WebKit) | ✅ 250 de 251 en la última pasada completa (el otro, en Firefox, agotó los 30 s cargando la página: 10 de 10 al repetirlo) (Fase 13); 9 saltados con su motivo (solo Chromium: memoria con CDP, `Permissions-Policy`, bloques saltados observables, IME; WebKit: `beforeunload` con `runBeforeUnload`) |
| `npm run build` · `build:tamano` | ✅ arranque **95,1 KB gzip** (límite 150; +0,3 KB en la F13: la barra con flechas y el foco al cancelar). A demanda, sin cambios: visor PDF, pdf.js 148 KB, lector de Markdown, editor 98 KB, KaTeX, Mermaid en el marco, workers |
| CSP | ✅ Definitiva (Fase 12, congelada en un test; T-3 cerrada; T-4, Trusted Types, no adoptado en v1: riesgo aceptado, revisado tras la F13 sin cambios). Sin cambios en la F13 |
| `npm run docs:validar` · `docs:enlaces` | ✅ · ✅ (280 enlaces en 18 ficheros) |
| `npm audit` | ✅ 0 vulnerabilidades · **1 override** (`micromark` 4.0.2: regresión cuadrática de la 4.0.3, micromark#246; STACK.md) · 0 scripts de instalación sin aprobar |
| Dependencias | 20 de runtime (las de contenido no confiable, con versión exacta). Desarrollo: + `@axe-core/playwright` (Fase 13) |
| Rendimiento (Ryzen 7 5800X; ARCHITECTURE §4 undecies, PLAN §11) | PDF de 1000 páginas: primera página 0,95 s, ninguna tarea larga > 200 ms al navegar (CPU ×4: 1,3 s; máx. 179 ms). Modo oscuro con worker: 8–60 ms de hilo principal por página (×4: hasta 226 ms a 400 % y DPR 2). Markdown 1 MB: 3,0 s; listas cortas 200 KB: 1,45 s, lineal. Editor (teclear): Chromium como en la F9; Firefox, Dividido 1 MB + KaTeX máx. 40 ms; **WebKit, Dividido 1 MB + KaTeX: P50 ~400 ms (abierto)** |
| Memoria (CDP, `bench:memoria`) | Al cerrar, el montón vuelve a 6–9 MiB (de 44–63 MiB con 1 MB); workers y URL `blob:` a 0; escuchadores estables. ~10 nodos por apertura: el `<input>` del selector, retenido por las herramientas de medida |
| Accesibilidad | axe sin violaciones (WCAG 2.0–2.2 A y AA) en todas las pantallas y estados; teclado y foco con E2E; lector de pantalla: manual (abajo) |
| PDF y Markdown reales | 9 PDF y 14 Markdown probados en fases anteriores; la búsqueda con PDF reales la comprobó el usuario a mano |
| CI en GitHub | ✅ en verde en su primera ejecución (commit `04c1291`); no se ha vuelto a comprobar con los commits subidos después |
| Licencia | ✅ Apache-2.0 |

## Decisiones pendientes de confirmación

Detalle, opciones y recomendación de cada una en [PLAN.md §14](PLAN.md#14-decisiones). Una
fase no empieza con una decisión que necesita sin confirmar.

Para cerrar la Fase 13 (propuestas, a revisar con el usuario):

- **WebKit, Dividido con 1 MB + KaTeX** (P50 ~400 ms por tecla): ¿se acepta como límite
  conocido, se pausa también la vista previa con KaTeX en WebKit, o se espera a medirlo en
  Safari de verdad? (ARCHITECTURE §4 undecies)
- **Markdown de 1 MB** (3,0 s): se propone mantenerlo como está.
- **`override` de micromark 4.0.2** hasta que micromark publique el arreglo.

## Fases

- [~] 🔴 **F13** Accesibilidad, rendimiento y compatibilidad — **implementada, pendiente de
  revisión** (barra y separador, Firefox, WebKit, memoria, Markdown grande, listas
  cuadráticas y riesgos aceptados; [FASES.md](FASES.md), Fase 13)
- [ ] 🟡 **F15** Distribución web (reescrita el *2026-10-03* sin escritorio: D19; FASES, Fase 15)
- [ ] 🟡 **F16** Open source y documentación final. Hereda de la F11: el enlace al repositorio
  público en la interfaz, la documentación pública final (`public_docs/` en el Docusaurus de
  `docs.r3zon.com`) y una GitHub Wiki

## Pruebas manuales (del usuario)

Lo que no se puede automatizar de forma fiable. Ninguna bloquea el cierre de la Fase 13.

- [ ] 🟡 **Lector de pantalla** (NVDA en Windows o VoiceOver en macOS): estado vacío, visor PDF
  (barra con flechas, página anunciada, búsqueda), Markdown (índice, fórmulas, diagramas),
  editor y Dividido (separador), Preferencias, carga y errores
- [ ] 🟡 **Safari de verdad** (macOS e iOS): el editor con 1 MB + KaTeX en Dividido (el caso
  que WebKit en Linux no puede), pantalla completa (macOS e iPadOS; en iPhone no hay botón),
  guardar (descarga) y abrir una carpeta
- [ ] 🟢 **IME en Firefox y Safari**: escribir en japonés o chino encima de una selección en el
  editor (texto correcto, sin violaciones de CSP en la consola). En Chromium lo cubre un E2E
- [ ] 🟢 **Gestor de contraseñas** con la contraseña de un PDF en Chrome, Firefox y Safari: el
  campo es `type="password"`, `autocomplete="off"`, sin `name` y el formulario no se envía
  (test); si alguno ofrece guardarla, valorar otro tipo de campo
- [ ] 🟢 **Atajos con otras distribuciones de teclado** (`?` y `Mayús+R`)
- [ ] 🟢 **Soltar una carpeta** en los tres navegadores (Playwright no simula entradas de
  carpeta; elegirla con el selector sí tiene E2E en los tres)
- [ ] 🟢 **Más PDF y formularios reales**, también de ofimática (LibreOffice o Word: estilos,
  tablas, imágenes, notas al pie), en los tres navegadores

## Otras

- [ ] 🟡 **Quitar el `override` de micromark** cuando micromark publique el arreglo de
  micromark#246 (regresión cuadrática de la 4.0.3): comprobar con `listas: 200 KB` de
  `npm run bench:markdown` que sigue siendo lineal (STACK.md)
- [ ] 🟡 **Dominio en `project.ts`**: sigue siendo `app.example.com`; cambiarlo es parte de la
  Fase 15, junto con `robots.txt`, `sitemap.xml` y `public_docs/_meta/` (D5 confirmada)
- [ ] 🟢 **Revisar T-4 (Trusted Types)** después de v1: no adoptado (Fase 12, A1-5; revisado tras
  la F13 sin cambios). Si se adopta, política `default` para los dos workers y el decodificador
  de entidades de micromark, y probarla en Firefox y Safari
- [ ] 🟢 **Texto del diálogo de carpeta de Chrome** («¿Subir N archivos a este sitio?»): es del
  navegador; BPDF no sube nada. Decirlo en la guía pública (F16)
- [ ] 🟢 **Guía pública del visor PDF** en `public_docs/` (F16)
- [ ] 🟢 **Limpieza técnica:** el parámetro opcional `id` de `readDocument`
  (`src/documents/read.ts`) se pensó para Electron (cancelado, D19) y hoy solo lo usa un test
  (`read.test.ts`). Revisar si se retira (decisión del usuario: se conserva por ahora)
- [ ] 🟢 **Favicon solo en SVG** (Fase 11): sin variante PNG/ICO, los navegadores que no usan
  favicons SVG muestran el icono genérico. Añadir un PNG si se echa en falta
- [ ] 🟢 **E2E intermitente del editor** (Fase 9): «dividido: la vista previa se refresca
  200 ms después de la última tecla, no antes» exige que la vista previa NO se haya refrescado
  aún, y con el equipo cargado los pasos del propio test pueden tardar más de 200 ms. No es un
  fallo de la app: hacer el test independiente del ritmo sin quitarle lo que comprueba

Fuera de v1 (Mermaid 12, búsqueda en el editor, fondo para imágenes transparentes, oscurecer
imágenes del PDF, Markdown enorme más rápido, tema claro) y las mejoras de CI:
[mejoras.md](mejoras.md).
