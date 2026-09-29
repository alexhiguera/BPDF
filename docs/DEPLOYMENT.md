# Despliegue

**BPDF no está desplegado en ningún sitio** (*2026-09-29*). Este documento se escribe de
verdad en la Fase 15 ([FASES.md](FASES.md)); hasta entonces solo recoge lo ya decidido.

## Lo que se sabe

- **Web:** desde la Fase 2, `npm run build` produce en `dist/` un sitio **estático**
  (HTML, JS, CSS, `robots.txt`, `sitemap.xml`): sin funciones de servidor ni variables de
  entorno. Se publica en un hosting que permita definir cabeceras HTTP, porque
  `frame-ancestors` y el resto de cabeceras de [SEGURIDAD.md](SEGURIDAD.md) §2 solo
  funcionan como cabecera. La CSP ya viaja además como `<meta>` en `dist/index.html`, así
  que un hosting sin cabeceras no deja la app sin política. Las cabeceras se generarán
  desde [`src/config/security-headers.ts`](../src/config/security-headers.ts). El hosting
  debe devolver **404** para rutas inexistentes (sin reescribirlas a `index.html`). El
  hosting y el dominio están pendientes de la decisión **D5** ([PLAN.md](PLAN.md) §14).
- **Escritorio:** instaladores de Electron publicados como releases, con checksums. Firma y
  plataformas pendientes de **D11** ([ELECTRON.md](ELECTRON.md) §8).
- **Documentación pública:** la publica el Docusaurus de R3ZON a partir de `public_docs/`
  (D4). Se da de alta el producto (`id: 'bpdf'`) en `R3ZON-Docusaurus/config/products.ts`
  cuando haya contenido que publicar; la entrada de ejemplo está en
  [`public_docs/README.md`](../public_docs/README.md) §3.

## Qué se retiró en la Fase 1

La plantilla desplegaba en Vercel (región `fra1`, junto a Supabase) con Supabase Cloud y
Sentry. Nada de eso aplica a BPDF: `vercel.json` se borró porque solo fijaba la región de
las funciones de servidor, que BPDF no tendrá. La configuración del hosting la crea la
fase que la necesite (cabeceras en la 12, publicación en la 15).
