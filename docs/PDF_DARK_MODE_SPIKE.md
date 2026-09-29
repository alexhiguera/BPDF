# Spike: PDF en modo oscuro (Fase 4)

> **Resultado: Caso 1 con limitaciones conocidas.** El recoloreado selectivo funciona:
> fondo oscuro, texto claro, fotografías intactas y gráficos con su color, con un coste
> asumible. Se adopta como estrategia del visor (T-1), con dos condiciones para la Fase 5
> que necesitan aprobación ([§12](#12-implicaciones-para-la-fase-5)).
>
> Fecha: 2026-09-29 · pdf.js **6.3.289** · Chromium de Playwright 1.63 · WSL2, AMD Ryzen 7
> 5800X.

## 1. Objetivo

Averiguar, con evidencia y **antes** de construir el visor, si se puede leer un PDF con:

- el fondo de página oscuro y el texto claro;
- las fotografías e imágenes con sus colores originales;
- los gráficos vectoriales con sus colores cuando sea posible;

sin `filter: invert()` y sin la opción de pdf.js que cambia globalmente los colores.

## 2. Alternativas estudiadas

| Estrategia | Resultado | Por qué |
|---|---|---|
| `filter: invert()` (CSS) o negativo por píxel | ❌ Referencia negativa | Invierte las fotos: sol azul, cielo marrón, colinas rosa. Implementada como modo «inversión completa» para compararla |
| `pageColors` de pdf.js (modo de alto contraste) | ❌ Descartada sin implementar | Leído en el código de 6.3.289 (`CanvasGraphics.#drawFilter`): aplica un filtro SVG al lienzo entero que lo pasa a gris y lo cuantiza en 6 niveles. Destruye las fotos igual |
| Heurística de color sola (recolorear todo por croma) | ❌ Insuficiente | Implementada como modo «solo heurística». Oscurece las nubes blancas de una foto, aclara su sombra negra e intercambia los parches blanco y negro. **Demuestra que el color del píxel no basta**: hay que saber dónde hay imágenes |
| **Recoloreado selectivo** (la heurística fuera de las regiones de imagen que registra pdf.js) | ✅ **Adoptada** | Ver §6 y §7 |
| Envolver el contexto 2D para recolorear los colores vectoriales (estrategia «A» de FASES) | ⏸️ No implementada | Innecesaria tras encontrar `recordImages` (§6.2). Exige interceptar internos de pdf.js (grupos de transparencia, máscaras `SMask` de luminosidad) y no resuelve los escaneos. **No se midió**: se descarta por coste y fragilidad, no por evidencia de calidad |

## 3. Versión de pdf.js y cómo se carga

- **`pdfjs-dist` 6.3.289**, versión exacta (la última estable el 2026-09-29; CLAUDE.md §11 bis).
- Se importa a demanda (`import()`): no entra en el arranque de la app (`build:tamano`
  sin cambios).
- **Worker** `pdf.worker.min.mjs` servido desde el propio origen (`/pdfjs/`, lo copia
  `scripts/copiar-pdfjs.mjs` en `predev`/`prebuild`). El PDF se parsea ahí, aislado del DOM.
- **`useWasm: false`**. pdf.js 6.3 usa WebAssembly para JPEG 2000, JBIG2, perfiles ICC y
  para compilar funciones PostScript. Leído en su código: con `useWasm: false` usa
  decodificadores en JavaScript (`*_nowasm_fallback.js`, cargados con `import()` desde el
  propio origen) y un intérprete propio de PostScript (`PsJsCompiler`), **sin `eval` ni
  `new Function`**. Así la CSP **no necesita `'wasm-unsafe-eval'`**. Coste: JPEG 2000 y
  JBIG2 algo más lentos y sin gestión de color ICC (se usa el espacio alternativo).
- **No se sirven** los `.wasm`, `quickjs-eval.*` (el motor para ejecutar el JavaScript de
  un PDF) ni `pdf.sandbox*`. Un E2E comprueba que dan 404.
- Arrastra la dependencia **opcional** `@napi-rs/canvas` 1.0.9 (binario nativo de 34 MiB,
  sin scripts de instalación): pdf.js la usa solo en Node. No entra en el bundle.

### Compatibilidad de navegadores: build «moderna» frente a `legacy`

La build moderna de pdf.js 6.3 usa APIs de JavaScript recientes:
`Map.prototype.getOrInsertComputed`, `Math.sumPrecise`, `Uint8Array.prototype.toHex` y
`fromBase64`, y `Promise.try`. Falla en Node 24 (`hashOriginal.toHex is not a function`) y
**no funcionará en los navegadores mínimos que declara BPDF** (Chrome/Edge 111, Firefox 111,
Safari 16.4, en `vite.config.ts` → `build.target`). La build `legacy/` trae polyfills.

El spike usa la moderna en el navegador (el Chromium de Playwright y Electron son
recientes) y la `legacy` en los tests de Node. **Decisión pendiente para la Fase 5**
([§12](#12-implicaciones-para-la-fase-5)).

## 4. Metodología

1. **Fixtures reproducibles** (§5), generados por script, con geometría conocida.
2. **Laboratorio** `spike.html` (temporal): abre un PDF, lo pinta con cada estrategia a
   varias escalas, marca las regiones de imagen detectadas y mide.
3. **Inspección visual** de capturas de las 8 páginas × 4 estrategias a escalas 1 y 2.
4. **Muestreo de píxeles** en E2E (Playwright contra la build de producción) en superficies
   lisas de posición conocida: fondo, tinta, cada parche de la carta de colores de la foto,
   nube blanca, sombra negra, barras, línea negra, pastel, escaneo y diapositiva oscura.
5. **Benchmark** reproducible (`npm run bench:pdf`, §8).
6. Vigilancia en cada E2E: errores de consola, violaciones de CSP y peticiones fuera del
   propio origen.

## 5. Fixtures

`tests/fixtures/pdf/modo-oscuro/modo-oscuro.pdf` (43 KiB), generado por
[`generar.mjs`](../tests/fixtures/pdf/modo-oscuro/generar.mjs) (`node
tests/fixtures/pdf/modo-oscuro/generar.mjs`; un test comprueba que el fichero versionado
es exactamente lo que produce el script). A4, Helvetica sin incrustar.

| Página | Contenido | Casos del requisito |
|---|---|---|
| 1 Texto | Negro en 6 cuerpos (8–22 pt), negrita, gris 50 % y 70 %, título azul marino, recuadro gris 95 %, bloque de tinta negra | texto negro · gris · pesos · fondo ligeramente gris |
| 2 Imagen | «Fotografía» RGB 400×300 sintética: cielo en degradado, sol, nubes **blancas**, colinas, sombra **casi negra**, carta de 8 colores exactos. Además, girada 30° y a escala 0,4 | foto · zonas blancas y negras · colores reconocibles · imagen girada |
| 3 Gráficos | Barras de colores con borde, ejes y líneas negras de varios grosores, rellenos muy claros (azul pastel, crema), círculos con relleno y borde, rectángulo solo con trazo | vectoriales · colores muy claros · líneas negras |
| 4 Mixta | Título, párrafo, foto con texto **blanco y negro encima**, barras, tabla con filas sombreadas | mezcla · texto sobre imagen |
| 5 Fondos | Página entera crema; cajas azul marino (texto blanco), gris claro y rosa pálido | página con fondo de color |
| 6 Compleja | 1500 rectángulos de colores y 60 líneas de texto pequeño | rendimiento |
| 7 Escaneo | Una imagen en grises a página completa (papel casi blanco con líneas de «texto») | PDF escaneado |
| 8 Oscura | Diapositiva de fondo casi negro, texto blanco y bloques de color | documento ya oscuro |

`grande.pdf` (300 páginas mixtas, 215 KiB) no se versiona: lo genera `generar.mjs
--grande` o, en el benchmark, `crearPdfGrande()`.

## 6. Estrategia adoptada: recoloreado selectivo

### 6.1 La regla de color (heurística)

Por píxel, en OKLab (L luminosidad; a, b color), en
[`src/pdf/dark/recolor.ts`](../src/pdf/dark/recolor.ts):

- **Se invierte la luminosidad** entre el color de página (`--rgb-page`) y el de texto
  (`--rgb-fg`): L = 1 (blanco) → página; L = 0 (negro) → texto. Papel, tinta, grises y
  antialiasing quedan al revés, con el orden de los grises conservado.
- **Cuanto más color tiene el píxel** (croma √(a²+b²)), **más conserva su luminosidad**.
  Entre croma 0,03 y 0,09 se mezcla con una curva suave, para que el borde antialiasado de
  un color sobre blanco no haga escalón.
- Un color conservado que no llega a **3:1 de contraste** sobre la página (WCAG para
  elementos gráficos y texto grande) se aclara lo justo, comprobando el contraste real.
- El tono (a, b) no se toca nunca.
- Resultados cacheados por color en una tabla de 64 K entradas: una página tiene
  millones de píxeles pero pocos colores distintos.

Umbrales (heurísticos, ajustados en el spike): `cromaMin = 0.03`, `cromaMax = 0.09`,
`contrasteMin = 3`.

### 6.2 Las regiones de imagen: `recordImages` de pdf.js

pdf.js 6.3 tiene una opción **pública** de render, `recordImages: true`, que registra cada
imagen rasterizada que pinta en `page.imageCoordinates`. Son seis números por imagen, tres
esquinas de un paralelogramo, normalizados al tamaño del lienzo y **ya recortados por el
clip**. Sin ella habría que recorrer el `OperatorList` siguiendo la pila de transformaciones
(la estrategia «B» prevista en FASES), sin conocer el clip.

- Solo se registra en el primer render de cada página; al estar normalizadas, valen para
  cualquier escala.
- Registra `paintImageXObject` y `paintInlineImageXObject`. **No** registra
  `paintImageXObjectRepeat` (imágenes en mosaico) ni las máscaras de imagen: las máscaras
  son «tinta» (texto escaneado en JBIG2, iconos de un color) y **deben** recolorearse.
- pdf.js guarda las coordenadas en `Float16Array` si el navegador lo admite (±1 px a escala 4).

[`regiones.ts`](../src/pdf/dark/regiones.ts) las convierte en una máscara por franjas.

### 6.3 Decisiones tomadas por evidencia durante el spike

| Problema observado | Causa | Corrección |
|---|---|---|
| **Flecos de color** en el texto | pdf.js crea el lienzo opaco (`alpha: false`) y Chromium suaviza el texto con subpíxel LCD; esos bordes de color la heurística los conserva | El contexto se crea antes que pdf.js con `alpha: true` (pdf.js reutiliza el existente y sigue pintando el fondo blanco) |
| **Filo blanco** alrededor de las fotos | La región dilatada 1,5 px conservaba papel blanco del borde | Margen 0: los píxeles del borde los resuelve la heurística |
| **Escaneo** que se queda blanco | La página entera es una imagen, y se conserva | Una imagen que cubre ≥ 90 % de la página se trata como escaneo y se recolorea con la heurística |
| **Diapositiva oscura** que se volvería clara | La regla invierte los neutros sin mirar el contexto | Si > 50 % de una miniatura de la página es neutro y oscuro, la página no se transforma |
| Aviso de pdf.js en consola con un PDF dañado | pdf.js avisa al reindexar | `verbosity: ERRORS` (los errores siguen saliendo) |
| Violación de CSP `font-src` | pdf.js carga las sustitutas de las fuentes estándar (`LiberationSans` para Helvetica) con `FontFace` desde `/pdfjs/standard_fonts/` | `font-src 'self'` |

### 6.4 Aplicación

[`aplicar.ts`](../src/pdf/dark/aplicar.ts): sobre el lienzo ya pintado por pdf.js, por
**franjas de 256 filas** (`getImageData` → transformar en su sitio sobre un `Uint32Array` →
`putImageData`). Nunca se copia la página entera: el búfer temporal es una franja más su
máscara. El render se hace con la API núcleo (`page.render({ canvas, recordImages })`),
en [`src/pdf/render.ts`](../src/pdf/render.ts).

## 7. Resultados

Verificado por muestreo de píxeles en E2E (`e2e/specs/pdf-spike.spec.ts`) a escalas 1 y 2
y por inspección visual.

| Criterio (punto 10 del encargo) | Resultado |
|---|---|
| El fondo deja de ser blanco | ✅ Blanco → `--rgb-page` (43, 43, 43) ±3 |
| El texto se vuelve legible | ✅ Negro → `--rgb-fg` (236, 236, 236), **12:1** sobre la página; nítido en todos los cuerpos (8–22 pt) sin flecos |
| Una fotografía no queda invertida | ✅ Los 8 parches de la carta, **±3** del original; la nube blanca sigue blanca y la sombra casi negra sigue negra; también girada 30° |
| Los colores de una imagen siguen siendo reconocibles | ✅ Idénticos |
| Los gráficos no sufren inversión global | ✅ Verde y naranja **idénticos**; rojo y azul aclarados lo justo para 3:1 con el mismo tono; líneas y bordes negros → claros |
| Razonable a distintas escalas | ✅ Mismos resultados a escala 1 y 2 (E2E) y visualmente a 4 |
| Texto gris | ✅ Conserva su jerarquía (el gris 70 %, poco contrastado en el original, sigue poco contrastado: fiel) |
| Fondo ligeramente gris / filas sombreadas | ✅ Pasan a grises oscuros distinguibles de la página |
| Colores muy claros (pastel) | ⚠️ Se oscurecen conservando el matiz (azul pastel → azul pizarra, crema → oliva). Coherente con el modo oscuro, pero no es el color original |
| Texto sobre imagen | ✅ Se conserva como en el original (forma parte de la imagen o está dentro de su región) |
| Página con fondo de color | ⚠️ Crema → oliva oscuro, rosa → granate oscuro: legible, con el matiz del original |
| Caja oscura de color con texto claro | ⚠️ Invierte la polaridad: el azul marino se aclara y el blanco pasa a oscuro. Legible (≈ 3:1), pero peor que el original |
| PDF escaneado | ✅ Con la regla de página completa: oscuro, con el «texto» claro |
| Documento ya oscuro | ✅ Se deja tal cual |

**Viabilidad (A):** claramente mejor que `invert()` y que la heurística sola, que fallan
justo en lo que el requisito protege.

## 8. Benchmark

`npm run bench:pdf` (Playwright, fuera de la suite de CI). Chromium de Playwright, DPR 1,
WSL2 sobre Ryzen 7 5800X. Con DPR 1, escala 2 equivale a escala 1 en una pantalla HiDPI
(DPR 2) y escala 4 a un zoom del 200 % en esa pantalla: lo que cuenta son los píxeles.

| Página | Lienzo | Render pdf.js | Transformación | Lienzo | Transitorio |
|---|---|---|---|---|---|
| 1 texto | 595×842 · 1190×1684 · 2380×3368 | 9 · 11 · 28 ms | 14 · 26 · 74 ms | 1,9 · 7,6 · 30,6 MiB | 0,6 · 1,2 · 2,3 MiB |
| 6 compleja | ídem | 14 · 14 · 23 ms | 15 · 28 · 78 ms | ídem | ídem |
| 2 imágenes | ídem | 12 · 9 · 19 ms | 6 · 18 · 100 ms | ídem | 0,7 · 1,5 · 2,9 MiB |
| 4 mixta | ídem | 13 · 10 · 22 ms | 9 · 22 · 83 ms | ídem | ídem |
| 150 de 300 | ídem | 12 · 8 · 23 ms | 8 · 22 · 81 ms | ídem | ídem |

- **Apertura** con pdf.js: 160–190 ms, también con 300 páginas (las páginas se cargan bajo
  demanda). Apertura + primer render: ~380 ms.
- **Coste (C):** ~10 ms por megapíxel, lineal. Criterio de FASES (A4 a escala 2 < 50 ms):
  ✅ 18–28 ms. A 8 Mpx (zoom 200 % en HiDPI): 74–100 ms en el hilo principal.
- **Memoria (D):** la transformación añade solo una franja (≤ 3 MiB). Lo caro es el lienzo
  en sí: **30,6 MiB por página** a 8 Mpx. `performance.memory` (solo Chromium) sale
  constante (12,8 MiB): está cuantizado y no cuenta los lienzos, así que **no sirve** para
  medir esto; las cifras de lienzo son calculadas (ancho × alto × 4).
- **Escalabilidad (E):** el coste es por página *visible*, no por documento. Con
  virtualización (pintar solo lo visible y un margen) 300 páginas cuestan lo mismo que 3. El
  riesgo es de memoria si se retienen muchos lienzos grandes: 10 páginas a 8 Mpx son ~300 MiB.

Las páginas del corpus son sintéticas y ligeras; un PDF real (fuentes incrustadas, mucho
texto, imágenes grandes) tarda más en el **render de pdf.js**, no en la transformación,
que solo depende de los píxeles.

## 9. Problemas encontrados

- **pdf.js 6.3 moderno exige APIs muy recientes** (§3): los mínimos de navegador que
  declara BPDF no lo ejecutarían. En Node hace falta la build `legacy`.
- **`PDFViewer` no sirve para esta estrategia:** crea sus propios lienzos opacos (flecos
  LCD) y no pasa `recordImages` a `page.render`, así que no hay regiones. El visor tiene
  que renderizar cada página con la API núcleo.
- La memoria de un lienzo no se puede medir de forma fiable desde el navegador.
- Error propio: la primera versión del benchmark leía la tabla de la medición anterior
  (filas desplazadas una página). Se detectó por incoherencias (una página con 1 imagen
  marcaba 2 regiones) y se corrigió; ver bitácora.

## 10. Limitaciones

Documentadas para el usuario en la Fase 5 las marcadas con 👤.

- 👤 **Imágenes de texto** (capturas, diagramas en PNG) conservan sus colores: siguen claras.
- 👤 **Cajas oscuras de color con texto claro** invierten la polaridad (§7).
- 👤 **Colores pastel y fondos de página de color** pasan a oscuro con su matiz; no son su
  color original.
- 👤 **Foto a página completa** (portada, lámina) se trata como escaneo y se recolorea.
  Heurística: ≥ 90 % del área.
- **Página «ya oscura»**: heurística (> 50 % neutro y oscuro). Una página de mayoría gris
  oscuro con fotos de color podría quedar sin transformar.
- **Imágenes en mosaico** (`paintImageXObjectRepeat`) y **sombreados de malla** no se
  registran como imagen: se recolorean con la heurística (conservan lo que tiene color).
- **Anotaciones** no se renderizan en el spike (sus apariencias reinician la matriz). La
  Fase 5 las pinta aparte.
- **Modos de fusión** (subrayados con `multiply`), **grupos de transparencia**, máscaras
  suaves, formularios y PDF de LaTeX **no están en el corpus**. Se validan en la Fase 5 con
  documentos reales (CLAUDE.md §10).
- **Probado solo en Chromium** (el E2E de CI y Electron). Firefox y Safari no aplican el
  suavizado LCD igual; pendiente de comprobar.
- Sin ICC ni WASM: color de imágenes con perfil ICC aproximado.

## 11. Decisión

**Se adopta el recoloreado selectivo** (heurística OKLab fuera de las regiones de
`recordImages`, con las reglas de escaneo y de página oscura) como estrategia del modo
oscuro de BPDF, y **se mantiene el selector «página original»** para lo que la heurística
no resuelva. Cierra **T-1**: el visor se construye sobre la **API núcleo** de pdf.js, no
sobre `PDFViewer`.

## 12. Implicaciones para la Fase 5

**Necesitan aprobación:**

1. **Visor propio sobre la API núcleo** en lugar de `PDFViewer` (§9). Se reutilizan de
   pdf.js las piezas que no dependen del lienzo: `TextLayer` (selección y copia),
   `AnnotationLayer` (enlaces) y, si encaja, `PDFLinkService`. Hay que construir a mano la
   virtualización, el zoom y los modos continuo y de página, y la búsqueda sobre
   `getTextContent`. Es más código del previsto en PLAN §6.1.
2. **Build moderna o `legacy` de pdf.js** (§3):
   - **(a)** `legacy`: funciona en los navegadores mínimos actuales; bundle mayor
     (polyfills).
   - **(b)** Moderna, subiendo los mínimos de BPDF a navegadores de 2025–2026: excluye
     equipos no actualizados, pero Electron no se ve afectado.

   Recomendación: **(a) `legacy`** para la web; se puede revisar al publicar solo Electron.

**Decididas por el spike (sin aprobación adicional):**

- Reutilizar tal cual `src/pdf/engine.ts`, `src/pdf/render.ts` y `src/pdf/dark/*`, que ya son
  código definitivo con sus tests. **Borrar** `src/pdf-spike/`, `spike.html`, su entrada en
  `vite.config.ts`, la sección `pdfSpike` de `messages.ts`, `e2e/specs/pdf-spike.spec.ts`
  (convertido en los E2E del visor) y `e2e/bench/` (o mantenerlo apuntando al visor).
- **Transformación fuera del hilo principal** cuando pase de ~50 ms: a 8 Mpx ya lo pasa en
  esta máquina, y en una modesta pasaría a 2 Mpx. Opciones, por orden: franjas transferidas
  a un worker (sin copia) o un shader WebGL que recolorea al pintar. Decidir midiendo.
- **Virtualización con pocos lienzos vivos** (visibles ± 1) y tope de píxeles por lienzo
  (`maxCanvasPixels`): a 30 MiB por página, retener 10 es demasiado.
- Validar con **PDF reales**: fusión, transparencias, LaTeX, formularios y anotaciones.
- CSP: `worker-src 'self'` y `font-src 'self'` ya están; **no** hace falta
  `'wasm-unsafe-eval'` ni `connect-src`.
