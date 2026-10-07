# Instrucciones para Claude

Este repositorio es **BPDF**. Nació de la plantilla de proyectos SaaS de R3ZON y se separó
de ella (decisión D15): conserva su forma de trabajar, no su código SaaS. Aquí están las
reglas que cambian cómo se trabaja; el resto está en [`docs/`](docs/README.md). Cada regla
lleva su motivo: una norma sin motivo se salta en cuanto estorba.

## 0. Invariantes del proyecto

Son los hechos que cambian cómo se interpreta cualquier medición o tarea. Mantenlos al día.

- **Producto:** BPDF, visor gratuito y open source (Apache-2.0) de PDF y Markdown, oscuro
  por defecto. Identidad en [`src/config/project.ts`](src/config/project.ts); diseño
  objetivo en [`docs/PLAN.md`](docs/PLAN.md).
- **Principio rector:** los documentos del usuario **no salen del dispositivo**. Sin
  backend, API, base de datos, cuentas, sincronización ni telemetría.
- **Estado:** Fases 0–10 cerradas, 7 bis incluida (la 6 se hizo después de la 8 y conserva
  su número). La 9 se aprobó (*2026-10-03*) con una **excepción de rendimiento
  documentada**: teclear en Dividido con 1 MB + KaTeX, o con 1 MB de encabezados, supera
  los objetivos de latencia (medido; [`docs/FASES.md`](docs/FASES.md), Fase 9). La 10
  (preferencias, posición solo para PDF) se cerró el *2026-10-03* (ARCHITECTURE §4 nonies).
  La 11 (UI/UX final) se cerró el mismo día (D10: sin tema claro; D12: adaptación básica;
  título de ventana siempre «BPDF»). La 12 (seguridad) se cerró el mismo día, verificada en
  producción ([`docs/auditoria.md`](docs/auditoria.md), Auditoría 1; T-4, Trusted Types: no
  adoptado en v1, riesgo aceptado). La 13 (accesibilidad, rendimiento y compatibilidad) se
  cerró el *2026-10-04* (ARCHITECTURE §4 undecies): Firefox y WebKit corren la suite E2E
  también en CI; limitaciones de v1 aceptadas: Markdown de ~1 MB en ~3 s y, en WebKit,
  Dividido con 1 MB + KaTeX muy lento. La 15 (distribución web; la 14 se canceló) se
  cerró el *2026-10-04*, verificada en producción: dominio oficial, versión 0.1.0 y registro
  de cambios para usuarios ([`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)). La 16 (open
  source y documentación final) dejó preparada la publicación (repositorio listo para
  hacerse público, `public_docs/` completa y como GitHub Wiki generada, versión 1.0.0); su
  cierre pasó a la 18. La 17 (crear Markdown y exportar a PDF por la impresión del
  navegador; ARCHITECTURE §4 duodecies) se cerró el *2026-10-06*. La **Fase 18 está EN
  CURSO**: el repositorio ya es público y su metadata está completa; la Wiki y
  `docs.r3zon.com/bpdf` están preparados localmente. Quedan el commit/push autorizados por el
  usuario, CI, despliegues y verificación de producción, seguridad manual, etiqueta y release
  ([`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md), «Publicación final»). La app es una SPA estática de Vite + React (D1)
  que abre un PDF o un Markdown local (selector o arrastre), un documento a la vez (D16).
  Los PDF se leen en un visor propio sobre pdf.js (D17, build `legacy`: D18) con modo
  oscuro selectivo en un worker, búsqueda avanzada, pantalla completa, atajos de una tecla
  desactivables y contraseña de apertura ([`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) §4 quater);
  los Markdown, en un lector GFM que no interpreta HTML y muestra las imágenes que el
  usuario entrega con el `.md` (varios ficheros o una carpeta), fórmulas (KaTeX) y
  diagramas (Mermaid, en un iframe aislado con su propia CSP) (§4 quinquies a septies), y se
  editan con CodeMirror 6 (D9; en un Shadow DOM, sin tocar la CSP), con vista previa,
  modo dividido y guardado local (§4 octies, Fase 9). Plan y estado:
  [`docs/FASES.md`](docs/FASES.md) y [`docs/TAREAS_PENDIENTES.md`](docs/TAREAS_PENDIENTES.md).
- **Estática, siempre:** la build (`dist/`) son ficheros. Nada de servidor, SSR, API ni
  funciones serverless, ni variables de entorno.
- **Entornos:** local y la **web publicada en Vercel** (`https://bpdf.r3zon.com`, la URL en uso), que
  despliega desde git lo que el usuario sube; sus cabeceras salen de `vercel.json`
  (generado). **D5 confirmada**: Vercel, y `https://bpdf.r3zon.com` es la URL oficial. `project.ts`
  usa ese dominio desde la Fase 15, y de él salen `robots.txt`, `sitemap.xml` y lo que
  comprueba `public_docs/_meta/` ([`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)).
- **Datos de producción:** ninguno. La web publicada es estática: no guarda ni recibe
  datos de usuario (los documentos no salen del dispositivo) y no hay cuentas.
- **Alcance:** **solo web** (D19, *2026-10-03*): sin versión de escritorio (Electron) ni
  sustituto; la Fase 14 está cancelada. Fuera de alcance: usuarios, auth, backend, base de
  datos, almacenamiento remoto. Solo el usuario reabre lo que está fuera.
- **Decisiones pendientes:** las D-n abiertas de [`docs/PLAN.md`](docs/PLAN.md) §14.
  Ninguna fase empieza con una decisión que necesita sin confirmar.

## Comandos

```bash
nvm use                   # Node 24 (.nvmrc). En WSL, el Node del sistema es otro
npm ci                    # instalar
npm run dev               # Vite en http://localhost:5173 (SIN CSP: ver §13)
npm run lint              # Biome (lint:fix para corregir)
npm run typecheck
npm run test:run          # Vitest: unitarios, componentes y accesibilidad
npm run test:e2e          # Playwright contra la build de producción (vite preview)
npm run build             # build estática en dist/
npm run build:tamano      # peso del arranque (tras build; límite 150 KB gzip)
npm run build:verificar   # dist/ publicable: dominio, robots, sitemap, sin URLs externas (tras build)
npm run test:e2e:compat   # la misma suite E2E en Firefox y WebKit
npm run bench:pdf         # benchmark del visor PDF (mide; no es un test ni corre en CI; BPDF_CPU=4 frena la CPU)
npm run bench:memoria     # memoria real con CDP al abrir y cerrar documentos
npm run preview           # sirve dist/ con la CSP y las cabeceras de seguridad
npm run docs:validar      # public_docs + identidad del proyecto
npm run docs:enlaces      # enlaces de docs internos
npm run deps:overrides    # ¿siguen haciendo falta los overrides de package.json?
npm run cabeceras:vercel  # regenera vercel.json desde security-headers.ts
npm run cabeceras:verificar -- https://bpdf.r3zon.com  # cabeceras reales vs. la fuente
npm run test:humo         # smoke contra la web publicada (a mano, tras desplegar; no en CI)
npm run wiki:generar -- ../BPDF.wiki  # GitHub Wiki desde public_docs/ (genera; no publica)
```

## 1. Pregunta antes de decidir algo importante

Si una decisión cambia la **arquitectura, la seguridad, la privacidad, el alcance o algo
que el usuario percibe**, pregunta antes y espera respuesta. No la tomes en silencio,
aunque parezca evidente. Las decisiones menores se toman eligiendo la opción más
sencilla, y se dejan escritas (en la bitácora o en el comentario del código).

Motivo: una decisión importante tomada en silencio se descubre tarde, cuando ya hay
código encima.

## 2. Git

**Nunca ejecutes `git commit` ni `git push` sin autorización explícita.** Deja los
cambios en el árbol de trabajo y di qué hay listo. El commit y el push los decide el
usuario.

- **La autorización no se hereda.** Aprobar un push no aprueba el siguiente.
- **Mencionar el push no es autorizarlo.** «Luego pusheamos» describe un plan, no da
  permiso.
- **Pegar el log de un fallo es pedir un diagnóstico**, no un despliegue. Corregir un
  error propio tampoco autoriza a subir la corrección.

> Precedente (proyecto de origen de la plantilla, 2026-08-15): dos push sin permiso. El
> primero se justificó con un «para poder pushear» del usuario; el segundo, tras pegar un
> log.

**Mensajes de commit: Conventional Commits en inglés técnico.**
`feat(scope): add …` · `fix(pdf): handle truncated file` · `refactor(markdown): …` ·
`docs: …` · `test: …` · `chore: …` · `ci: …`.

`.claude/settings.json` pide confirmación para `git commit`, `git push` y `git tag`: es
la red, no la regla.

## 3. Definición de «hecho»

Una tarea está terminada cuando **todo** esto es verdad:

1. `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build` y
   `npm run build:tamano` en verde.
2. Hay **test nuevo de lo nuevo** (y de la regresión, si era un fallo).
3. Si tocó UI, rutas o cabeceras: `npm run test:e2e` en verde (y §10).
4. [`docs/CHANGELOG.md`](docs/CHANGELOG.md) tiene su entrada, con el **porqué**.
5. [`docs/TAREAS_PENDIENTES.md`](docs/TAREAS_PENDIENTES.md) al día: lo cerrado, borrado;
   **lo que ha salido, añadido**.
6. Si cambió algo que describe `docs/` o `public_docs/`, está actualizado, con su fecha;
   `npm run docs:enlaces` y `npm run docs:validar` en verde.
7. Los cambios están **en el árbol de trabajo** y has dicho qué hay listo.

Motivo: documentar «al final» no ocurre. En el proyecto de origen de la plantilla se
acumularon seis commits sin documentar y los docs acabaron describiendo un estado que ya
no existía, que es peor que no tenerlos.

## 4. Privacidad: los documentos no salen del dispositivo

- **Ninguna petición de red provocada por un documento**: ni imágenes remotas, ni
  fuentes, ni scripts, ni nada que un PDF o un Markdown pueda pedir. La CSP lo refuerza;
  la regla es no escribir el código que lo haría.
- **Sin telemetría, analítica ni informes de errores** hacia ningún servicio. Tampoco
  «anónimos».
- **No se persiste contenido de documentos**, ni nombres de fichero, ni rutas. Lo que se
  guarde en local (preferencias) está listado en [`docs/PLAN.md`](docs/PLAN.md) §8; un
  dato nuevo se añade ahí antes de guardarlo.
- **La app nunca ve rutas de disco**: ve documentos con un id opaco
  ([`docs/PLAN.md`](docs/PLAN.md) §4.1).

Motivo: es la razón de ser del producto. Una sola petición de red provocada por un
documento revela a un tercero qué se lee y cuándo.

## 5. Seguridad

Modelo de amenazas y controles: [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md). Cada fase
implementa los de lo que construye; no hay «seguridad al final».

- **Prohibido `dangerouslySetInnerHTML`, `innerHTML`, `outerHTML`,
  `insertAdjacentHTML` y `document.write`.** El contenido de un documento es hostil por
  definición.
- **URLs de documentos** (enlaces, imágenes) pasan siempre por la política de URLs del
  motor correspondiente: solo `http:`, `https:`, `mailto:` y anclas.
- **Mínimo privilegio**: ningún componente (renderer, motor, página) recibe un permiso
  que no necesita.
- **Secretos:** BPDF no tiene. Si algún día hace falta uno (firma de código en CI), vive
  solo en los secretos de CI, nunca en el repo ni con prefijo público.
- No leas ficheros `.env*` ni de secretos, por ninguna vía. `.claude/settings.json`
  bloquea los lectores habituales, pero es una red, no una garantía.

## 6. Tests

- **Test nuevo de lo nuevo.** Si arreglas un fallo, primero un test que lo reproduzca.
- **Lo que depende del navegador real** (canvas de PDF, portapapeles, CSP, descargas) se
  prueba en Playwright, no con mocks en jsdom.
- **Contenido hostil con corpus**: todo parser de contenido no confiable tiene su corpus
  de casos maliciosos y malformados ([`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) §3.3).
- **Un test que no puede ejecutarse no pasa en silencio**: falla o avisa de forma
  visible. Una suite que se salta sola da una tranquilidad falsa.
- Componentes: Testing Library (por rol y etiqueta, como un usuario) + jest-axe.
- Fixtures con procedencia y licencia conocidas, nunca documentos de terceros sin
  licencia.
- No borres ni debilites un test para que pase. Si el test estaba mal, dilo y explícalo.

## 7. Documentación interna (`docs/`)

**Bitácora — [`docs/CHANGELOG.md`](docs/CHANGELOG.md).** Al cerrar un bloque de
trabajo, arriba del todo:

```
### Iteración N — *YYYY-MM-DD* — Título
```

Contexto en un párrafo y bullets. **El porqué, no solo el qué**: dentro de tres meses el
qué está en el diff y el porqué no. Incluye lo **descartado** y los errores propios del
camino. El número solo tiene que ser único: **nunca se renumera**.

**Tareas — [`docs/TAREAS_PENDIENTES.md`](docs/TAREAS_PENDIENTES.md).** Solo tareas
abiertas. `[ ]` pendiente · `[~]` en curso · prioridad 🔴 🟠 🟡 🟢. Al cerrar una,
**se borra la línea** y se escribe en la bitácora. Arriba, «Estado hoy» con cifras
reales y su fecha. **Lo que no es una tarea no vive ahí**: una regla va aquí, a
CLAUDE.md; una «tarea» que no se puede cerrar nunca es una regla disfrazada.

**Fases — [`docs/FASES.md`](docs/FASES.md).** La especificación de cada fase. Si una fase
descubre algo que cambia las siguientes, se corrige ahí en la misma tarea.

Si un cambio afecta a lo que describe un documento de `docs/`, se actualiza en la misma
tarea. Un documento desactualizado es trabajo incompleto.

## 8. Anunciar al usuario lo que cambia

**Todo cambio que el usuario de BPDF pueda percibir se le anuncia.** Si no le cambia nada
(refactor, tipos, tests), **no se anuncia**: un aviso lleno de ruido interno deja de
leerse. El registro de cambios para usuarios es
[`public_docs/novedades.md`](public_docs/novedades.md) (Fase 15): el cambio se anota ahí,
bajo la versión que lo traerá, y se menciona al entregar para que quien mantiene el
proyecto decida la versión (SemVer: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)).

La bitácora (`docs/CHANGELOG.md`) y el anuncio al usuario son registros distintos: uno lo
lee quien mantiene el código, el otro quien usa el producto.

## 9. Documentación pública (`public_docs/`)

`public_docs/` es la documentación pública de BPDF, que publica el repositorio de
Docusaurus de R3ZON (D4). **Este repo es la fuente de verdad**; aquel solo la consume, y
BPDF no depende de él para compilar ni para probar. Contrato:
[`public_docs/README.md`](public_docs/README.md). Redacción:
[`public_docs/CONVENCIONES.md`](public_docs/CONVENCIONES.md).

- **`last_update.date` se actualiza a mano, en el mismo commit** en que cambia un paso,
  el nombre de un botón o un límite. Una errata no mueve la fecha. Nunca se deriva de git
  ni de `new Date()`: la sincronización copia el árbol entero y todas las páginas
  saldrían con la misma fecha.
- Lo mismo con las fechas literales de
  [`src/config/public-site.ts`](src/config/public-site.ts) (de ahí sale `sitemap.xml`):
  quien cambia el contenido visible de una página pública, cambia su fecha ahí.
- **Verifica cada dato contra el código** antes de escribirlo. Una función que no existe
  todavía no tiene guía: como mucho, `estado: proximamente`. Si el código se contradice,
  no elijas: anótalo como bloqueante en TAREAS y no escribas esa página.
- Solo Markdown y JSON de datos: **nada de lógica de Docusaurus** aquí.
- Si cambias una ruta que aparece en `public_docs/_meta/rutas-app.json` o renombras una
  página, actualiza `_meta/` en el mismo commit.

## 10. Comprobaciones que ninguna puerta hace por ti

- **Tras tocar cabeceras, CSP o rutas, pide las URLs de verdad** (`curl -I` contra el
  build de producción servido en local): el código compila y los tests pasan, pero una
  cabecera que no llega solo la ve quien hace la petición.
- **Tras tocar un motor de documento, ábrelo con documentos reales**, no solo con los
  fixtures: el corpus de tests nunca cubre todo lo que hay ahí fuera.

## 11. Origen: la plantilla R3ZON

BPDF se creó desde una plantilla interna de R3ZON, v1.0.0 (el registro del origen está en
[`docs/TEMPLATE.md`](docs/TEMPLATE.md)) y **no adopta versiones nuevas de su core** (D15): la plantilla es un SaaS y BPDF no. Si
una mejora de proceso de la plantilla (documentación, CI, validadores) sirve aquí, se
trae a mano, se revisa y se anota en la bitácora. Detalle:
[`docs/TEMPLATE.md`](docs/TEMPLATE.md).

## 11 bis. Dependencias

- **Cada dependencia de runtime se justifica** en la tabla de
  [`docs/STACK.md`](docs/STACK.md) (un test lo exige). No se añade ninguna «para más
  adelante»: entra en la fase que la usa.
- **Versiones exactas** para los motores que procesan contenido no confiable (pdf.js,
  KaTeX, Mermaid, resaltador, cadena de Markdown).
- Tras instalar o actualizar un paquete, si npm avisa de *install scripts not covered
  by allowScripts*: `npm install-scripts ls`, revisa qué ejecuta cada script y apruébalo
  con `npm install-scripts approve <paquete>` (o deniégalo si no hace falta). Commitea
  `package.json` y el lockfile juntos. Motivo: npm 11 **omite en silencio** los scripts no
  aprobados, y la aprobación va ligada a la versión exacta. Detalle en [`docs/STACK.md`](docs/STACK.md).
- Un `override` solo con motivo escrito en `docs/STACK.md`; `npm run deps:overrides` dice
  si sigue haciendo falta.

## 12. Herramientas opcionales

Nada de esto es requisito para desarrollar, probar ni desplegar.

- **graphify** (grafo de conocimiento del repo): si está instalado y existe
  `graphify-out/`, consúltalo antes de abrir ficheros a ciegas (`graphify query "…"`).
  `graphify-out/` está en `.gitignore`.
- **Servidores MCP** (p. ej. GitHub): configuración local de cada máquina; el repo no
  incluye `.mcp.json`.

## 13. Vite, CSP y textos

- **La CSP solo existe en la build.** `vite dev` inyecta scripts y estilos en línea que
  una CSP estricta bloquearía, así que en desarrollo no hay CSP. Todo lo que dependa de
  ella se prueba con `npm run test:e2e` o `npm run preview`, nunca dando por bueno lo que
  funciona en `dev`.
- **La CSP y las cabeceras viven en un único fichero:**
  [`src/config/security-headers.ts`](src/config/security-headers.ts). `vercel.json` (las
  cabeceras de la web publicada) se **genera** desde él con `npm run cabeceras:vercel`:
  nunca se edita a mano (un test lo vigila). Se abre una
  directiva solo cuando una fase la necesita, con su motivo escrito al lado, y nunca con
  `'unsafe-inline'` ni `'unsafe-eval'` sin aprobación
  ([`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) §2.1).
- **Todo texto visible sale de [`src/i18n/messages.ts`](src/i18n/messages.ts)** (D2). Un
  test busca texto suelto en los componentes.
- **Colores solo desde los tokens** de [`src/styles/globals.css`](src/styles/globals.css)
  (`bg-app`, `text-fg`, `outline-accent`…); nunca un color escrito en un componente.
- Los imports de ficheros TypeScript desde `vite.config.ts` llevan extensión `.ts`: el
  cargador nativo de configuración de Vite lo exigirá.
