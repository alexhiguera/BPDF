# Auditoría final BPDF v1.0.0

Fecha de cierre técnico: *2026-10-07*. Esta revisión consolida la auditoría de seguridad de
la Fase 12, la compatibilidad y el rendimiento medidos en la Fase 13, las pasadas responsive
de las Fases 17–18 y la revisión final del producto contra el código y la build reales.

## Resultado

- 🔴 **Bloqueantes: 0**
- 🟠 **Riesgos altos no resueltos: 0**
- ⚠️ **Limitaciones aceptadas: 5**
- 🟢 **Mejoras post-v1 activas: 3**

**BPDF v1.0.0 es apto para publicación estable.** La etiqueta y la GitHub Release todavía no
se han creado; son el siguiente acto de publicación, no trabajo de desarrollo pendiente.

## Producto

BPDF abre PDF y Markdown, crea y edita Markdown, exporta Markdown a PDF y mantiene los
documentos en el dispositivo. Los recorridos de portada, PDF, Markdown, editor, preferencias,
guardado y exportación están completos. La identidad visible, el repositorio, la versión
1.0.0 y las URLs públicas proceden de fuentes únicas y se validan en build.

Los estados límite también forman parte del producto: 404 propia, salida útil sin JavaScript,
red de seguridad ante errores de React, archivos no válidos, PDF cifrado, documentos vacíos,
búsqueda sin coincidencias, carga diferida y feedback de guardado, copia y exportación.

## Arquitectura

- Aplicación web estática React/Vite; no existe runtime de servidor ni aplicación Electron.
- Los documentos y la plataforma están separados de la UI. `readDocument(file)` valida el
  archivo y genera internamente su identidad; se eliminó el parámetro heredado de Electron.
- pdf.js, KaTeX, Mermaid, resaltado y CodeMirror se cargan bajo demanda.
- PDF usa worker y virtualización propia; Markdown conserva DOM semántico, anclas reales y
  sincronización por encabezados.
- Mermaid corre en un iframe aislado de origen opaco y el SVG se verifica antes de mostrarse.
- CSP, cabeceras, identidad, mensajes y tokens visuales tienen una fuente única.

No se detectaron dependencias circulares de diseño, código muerto funcional ni una segunda
fuente documental. `public_docs/` sigue siendo la fuente canónica de docs.r3zon.com y la Wiki.

## Seguridad

La superficie web se revisó desde el documento hostil hasta la build publicada:

- CSP restrictiva, sin `unsafe-eval`, red implícita ni scripts del documento.
- Markdown sin HTML arbitrario; URLs y recursos locales pasan por políticas explícitas.
- JavaScript y acciones peligrosas de PDF no se ejecutan; XFA está desactivado y los
  formularios se muestran como apariencia, no como controles rellenables.
- Mermaid no tiene red, origen compartido ni acceso al documento principal.
- Los enlaces externos se revalidan y se abren con aislamiento.
- La suite vigila consola, violaciones CSP, tráfico externo y almacenamiento inesperado.
- Las cabeceras de app, marco, assets, workers, favicon, robots, sitemap y 404 están probadas.

La auditoría de la Fase 12 cerró los huecos de `Permissions-Policy`, cobertura de cabeceras,
almacenamiento y AcroForm. Trusted Types se midió y se decidió no adoptar en v1: exigiría una
política `default` para los workers y un uso interno de micromark sin proteger ningún sumidero
propio que reciba HTML del documento. Es una limitación aceptada de bajo riesgo.

Vercel añade `Access-Control-Allow-Origin: *` a ficheros estáticos públicos; sin cookies,
credenciales, API ni datos personales no expone datos del usuario. `X-Frame-Options` se
conserva junto a `frame-ancestors`. Los `postMessage("*")` del marco son deliberados porque
su origen es opaco; ambos extremos validan `source`, estructura y resultado.

## Privacidad

El archivo se procesa localmente. BPDF no tiene cuentas, analítica, telemetría, cookies,
backend, anuncios ni llamadas a terceros. Solo persiste:

- `bpdf:prefs`: preferencias visuales y de interacción, incluida la apertura de miniaturas;
- `bpdf:positions`: página y zoom ligados a una huella local, con LRU de 50 entradas.

No persiste nombres, contenido, contraseñas, consultas, estado del editor ni handles. La UI
permite borrar esos datos. Los recorridos E2E confirman que no aparecen cookies,
`sessionStorage`, IndexedDB, Cache API ni service workers.

## Accesibilidad

- Navegación completa por teclado, foco visible, enlace de salto y retorno de foco en diálogos.
- Diálogos nativos o equivalentes modales con nombre, Escape cuando corresponde y límites de
  viewport; sheets móviles con acciones alcanzables por touch.
- Acciones principales de al menos 44 px, contraste vigilado y movimiento reducido respetado.
- Estados de error usan `alert`; carga, búsqueda y feedback dinámico usan `status` cuando
  necesitan anunciarse, sin ARIA redundante.
- Componentes cubiertos con jest-axe y recorridos reales con axe/Playwright.

No apareció un bloqueo de teclado, lector de pantalla o touch en la ronda final.

## Compatibilidad

El mínimo declarado es Chrome/Edge 111, Firefox 128 y Safari 16.4. La suite principal corre
en Chromium y la suite de compatibilidad en Firefox y WebKit. El último CI completo —CI,
Chromium, Firefox, WebKit y Security— está verde.

Una ejecución de WebKit se canceló mientras GitHub instalaba dependencias del sistema, antes
de arrancar ningún E2E. El rerun instaló WebKit, ejecutó la suite y terminó verde: fue una
incidencia transitoria del runner, no un fallo de BPDF. El anterior incidente de sincronía de
Dividido también está cerrado: el E2E lee ambos encabezados atómicamente, con el mismo gesto y
la misma tolerancia, sin esperas artificiales ni cambios funcionales.

## Rendimiento

Mediciones de la Fase 13, conservadas porque esta ronda no toca algoritmos de rendimiento:

- primera página de un PDF de 1000 páginas: 0,95 s; 1,3 s con CPU ×4;
- navegación PDF sin tareas largas; máximo 179 ms con CPU ×4;
- Markdown de 1 MB: 3,0 s; listas de 200 KB: 1,45 s tras fijar micromark 4.0.2;
- memoria después de cerrar: 6–9 MiB, sin workers ni URLs `blob:` residuales;
- arranque final: 102,5 KB gzip, por debajo del límite de 150 KB.

El caso artificial Dividido + 1 MB + muchas fórmulas puede superar 200 ms. Chromium midió
224 ms y WebKit de Playwright en Linux, con render por software/DPR 2/CPU limitada, alrededor
de 400 ms P50. Sigue siendo usable, no falla funcionalmente y el entorno no equivale a Safari
real; medirlo allí queda post-v1.

## Responsive

Se revisaron 320, 375, 390, 430, 768 y 1440 px o más, incluida rotación móvil. El documento
conserva prioridad visual: barras compactas, herramientas secundarias en sheets y ningún doble
scroll u overflow horizontal conocido. PDF mantiene apertura, zoom, tema, giro, disposición,
búsqueda, miniaturas, página y cierre. Markdown mantiene Lectura, Editar, Dividido adaptado,
TOC, guardado, creación, exportación y preferencias.

En móvil, Dividido alterna **Editar | Vista previa** y nunca presenta dos columnas estrechas.
Los diálogos se limitan al viewport y admiten teclado virtual mediante scroll interno.

## Testing

- Vitest: lógica pura, componentes, accesibilidad, seguridad, configuración y validadores.
- Playwright Chromium: recorridos funcionales, visuales, responsive, CSP, red y almacenamiento.
- Playwright Firefox/WebKit: la misma compatibilidad funcional relevante.
- Build real: tamaño, recursos autocontenidos, canonical, robots, sitemap y ausencia de restos
  de desarrollo o Electron.
- Producción: humo, cabeceras, versión, repositorio, favicon, creación, guardado y exportación,
  sin errores de consola, CSP ni red externa.

Resultado final: 1.128 tests Vitest, 142 E2E Chromium y 271 E2E Firefox/WebKit en verde; las
13 omisiones de compatibilidad corresponden a capacidades expresamente exclusivas de
Chromium. El smoke publicado pasa 6/6. La concurrencia de compatibilidad se limita a dos
workers solo en desarrollo local para no privar de CPU al servidor de preview; CI conserva su
configuración.

Los flakies investigados quedan cerrados: el test de latencia de 200 ms usa reloj virtual
pausado durante la medición; el
salto de página PDF de WebKit pasó 20/20 repeticiones seriales; la sincronía de Dividido usa
una lectura atómica equivalente entre motores.

## Open source

Repositorio público bajo Apache-2.0, con README, contribución, conducta, seguridad, plantillas
de Issues, metadata, topics, labels, Issues, reporte privado de vulnerabilidades, alertas de
Dependabot y Wiki. La Wiki publicada se genera desde las 36
páginas de `public_docs/`, más Home, Sidebar y Footer; no se mantiene una copia manual.
docs.r3zon.com/bpdf usa la misma fuente.

## SEO técnico

La portada tiene título, descripción, Open Graph, Twitter Card, JSON-LD, canonical oficial,
favicon, `robots.txt` y `sitemap.xml`. La 404 devuelve estado HTTP 404, es útil sin JavaScript
y no se indexa. El validador de build acepta solo el canonical exacto del dominio oficial y
sigue rechazando recursos externos.

## Dependencias y cadena de suministro

- Versiones de motores exactas, lockfile íntegro y recursos servidos desde el mismo origen.
- `npm audit`: el único aviso conocido de producción es KaTeX 0.16.47 transitivo de Mermaid,
  gravedad baja y aislado dentro del marco. BPDF renderiza sus fórmulas con KaTeX 0.18.9.
- `micromark` permanece fijado en 4.0.2: 4.0.3 introdujo la regresión cuadrática #246.
- Los workflows tienen permisos mínimos. Fijar Actions por SHA y desactivar persistencia de
  credenciales siguen siendo mejoras de endurecimiento, no riesgos altos de v1.

No se fuerza una versión de KaTeX fuera del rango declarado por Mermaid ni se ejecuta
`npm audit fix --force`, porque ambas opciones aumentarían el riesgo de compatibilidad.

## Limitaciones aceptadas

1. Trusted Types no se activa en v1 por la política `default` que exigirían dependencias.
2. El caso extremo Markdown Dividido de 1 MB + KaTeX puede superar 200 ms.
3. La exportación a PDF usa el diálogo de impresión del navegador y depende de sus opciones.
4. KaTeX 0.16.47 transitivo de Mermaid conserva un aviso bajo, mitigado por aislamiento.
5. BPDF muestra la apariencia de los formularios PDF, pero no permite rellenarlos.

Ninguna impide los recorridos anunciados ni rebaja una garantía de seguridad o privacidad.

## Mejoras post-v1

Las tres tareas activas y sus condiciones de cierre están en
[TAREAS_PENDIENTES.md](TAREAS_PENDIENTES.md):

1. actualizar Mermaid cuando admita una versión corregida de KaTeX;
2. retirar el `override` cuando micromark tenga una versión lineal validada;
3. medir en Safari real el caso extremo de Dividido con 1 MB y muchas fórmulas.

Las ideas opcionales que todavía no son tareas viven en [mejoras.md](mejoras.md).

## Historial de hallazgos de seguridad

La Auditoría 1 (*2026-10-03*, Fase 12) quedó **cerrada/aprobada**. Resumen trazable:

| ID | Hallazgo | Estado final |
|---|---|---|
| A1-1 | `Permissions-Policy` incompleta | Cerrado: lectura de portapapeles y hardware adicional denegados |
| A1-2 | Cobertura parcial de cabeceras | Cerrado: rutas y tipos de recurso cubiertos |
| A1-3 | Almacenamiento no recorrido de punta a punta | Cerrado: E2E sin estado inesperado |
| A1-4 | Formularios AcroForm sin prueba real | Cerrado: apariencia visible, edición y JavaScript inactivos |
| A1-5 | Trusted Types | Aceptado para v1 con medición y motivo documentados |
| A1-6–8 | CORS de Vercel, XFO redundante y `postMessage` opaco | Aceptados; no exponen documentos ni credenciales |
| A1-9 | Actions por etiqueta y credencial persistida | Mejora post-v1, permisos actuales de solo lectura |
| A1-10 | Motores con mayores posteriores | Aceptado: versiones fijadas, upgrades amplios fuera del cierre |
| A1-11 | supuesto script de `fsevents` | Cerrado: no aplica ni ejecuta instalación en la plataforma |
| A1-12 | regresión cuadrática de micromark | Cerrado: override 4.0.2 y benchmark lineal |
| A1-13 | KaTeX transitivo | Riesgo bajo aceptado y seguimiento post-v1 |
