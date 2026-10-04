# BPDF

Visor gratuito y open source de **PDF** y **Markdown** para leer en modo oscuro, creado por
[R3ZON](https://r3zon.com). Funciona en el navegador, en **https://bpdf.r3zon.com**, sin
instalar nada ni crear cuenta. Tus documentos se abren en tu dispositivo: **no se suben a ningún
servidor**.

Documentación para usuarios: **https://docs.r3zon.com/bpdf** (su fuente está en
[`public_docs/`](public_docs/)).

## Qué hace

- **PDF.** Visor propio sobre pdf.js con **modo oscuro selectivo**: oscurece el fondo, aclara el
  texto y conserva los colores sin poner las fotos en negativo. Búsqueda (mayúsculas, palabra
  completa), miniaturas, zoom, giro, vista continua o página a página, pantalla completa,
  atajos de teclado y PDF protegidos con contraseña (que no se guarda).
- **Markdown.** Lector GFM (tablas, listas de tareas, notas al pie, índice, código resaltado)
  con **fórmulas KaTeX** y **diagramas Mermaid**, dibujados en un marco aislado. El HTML del
  documento no se interpreta.
- **Imágenes locales.** Las de un Markdown se ven si eliges el `.md` junto con ellas o abres su
  carpeta. Las de internet no se cargan.
- **Editor.** Edición de Markdown con CodeMirror 6, **modo dividido** con vista previa
  sincronizada y guardado local (diálogo de guardar en Chrome y Edge; descarga en Firefox y
  Safari).
- **Preferencias.** Colores, zoom y vista de los PDF, letra y ancho de los Markdown, atajos de
  una tecla y la página por la que ibas en cada PDF. Se guardan solo en tu navegador.

## Privacidad

BPDF es una web **estática**: no tiene backend, base de datos, cuentas, sincronización ni
telemetría. Un documento no puede hacer que la app pida nada a internet (ni imágenes, ni
fuentes, ni scripts), y una CSP estricta lo refuerza. En el navegador solo guarda dos claves:
preferencias y posiciones de lectura de PDF (una huella del archivo, nunca su nombre ni su
contenido). Detalle: [`docs/SEGURIDAD.md`](docs/SEGURIDAD.md) y
[privacidad en la documentación pública](public_docs/referencia/privacidad-y-datos-locales.md).

## Navegadores

Chrome o Edge 111, Firefox 128 y Safari 16.4, o posteriores, con JavaScript. En ordenador y en
móvil. Las pruebas automáticas corren en Chromium, Firefox y WebKit.

## Desarrollo

Requisitos: **Node 24** (`.nvmrc`; con nvm, `nvm use`) y npm. En Windows, trabaja dentro de
WSL.

```bash
npm ci
npm run dev           # http://localhost:5173 (sin CSP: ver docs/DEVELOPMENT.md)
npm run build         # build estática en dist/
npm run preview       # sirve dist/ con la CSP y las cabeceras de producción
```

No hay servidor ni variables de entorno: `dist/` se sirve con cualquier hosting de ficheros
estáticos. La web oficial se publica en Vercel; sus cabeceras salen de
[`src/config/security-headers.ts`](src/config/security-headers.ts).

### Tests

```bash
npm run lint && npm run typecheck
npm run test:run          # Vitest: unitarios, componentes y accesibilidad
npm run test:e2e          # Playwright contra la build de producción (Chromium)
npm run test:e2e:compat   # la misma suite en Firefox y WebKit
npm run build && npm run build:tamano && npm run build:verificar
npm run docs:validar && npm run docs:enlaces
```

La primera vez, instala los navegadores de Playwright: `npx playwright install --with-deps`.

Guía completa: [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md). Arquitectura:
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Índice de la documentación interna:
[`docs/README.md`](docs/README.md).

## Contribuir

Las contribuciones son bienvenidas: lee [`CONTRIBUTING.md`](CONTRIBUTING.md) y el
[código de conducta](CODE_OF_CONDUCT.md). Para una vulnerabilidad, **no abras un issue
público**: sigue [`SECURITY.md`](SECURITY.md).

## Licencia

[Apache-2.0](LICENSE). Copyright 2026 R3ZON CONSULTING SL; ver [`NOTICE`](NOTICE). Las
dependencias y los recursos que se distribuyen con la build (pdf.js y sus fuentes, KaTeX y sus
fuentes, Mermaid…) conservan sus propias licencias.
