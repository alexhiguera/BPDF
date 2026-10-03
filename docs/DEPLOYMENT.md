# Despliegue

**La web de BPDF está publicada en Vercel, en `https://bpdf.r3zon.com`** (comprobado el
*2026-09-30*; la configuración del proyecto en Vercel no vive en este repositorio). La
decisión **D5** (hosting y dominio, [PLAN.md](PLAN.md) §14) está **confirmada** desde el
*2026-10-03*: hosting en Vercel y URL oficial `https://bpdf.r3zon.com`. `src/config/project.ts` aún usa
`app.example.com` (el cambio afecta a `robots.txt`, `sitemap.xml` y `public_docs/`, y
es parte de la Fase 15). El documento completo se escribe en la Fase 15, «Distribución
web» ([FASES.md](FASES.md)). BPDF es solo web (D19, *2026-10-03*): no hay instaladores ni
versión de escritorio.

## Web

- **Build:** `npm run build` produce en `dist/` un sitio **estático** (HTML, JS, CSS,
  fuentes, `robots.txt`, `sitemap.xml`) con dos páginas: la app (`index.html`) y el marco
  aislado de Mermaid (`mermaid.html`, Fase 8). Sin funciones de servidor ni variables de
  entorno. El hosting debe devolver **404** para rutas inexistentes (sin reescribirlas a
  `index.html`).
- **Cabeceras HTTP: [`vercel.json`](../vercel.json)** (desde el *2026-09-30*). Se
  **genera** desde la fuente única, [`src/config/security-headers.ts`](../src/config/security-headers.ts)
  (`reglasVercel`, a partir de `cabecerasPara`), con `npm run cabeceras:vercel`; no se
  edita a mano, y `tests/unit/vercel.test.ts` falla si se queda atrás. Solo define
  cabeceras. Tres reglas que no se solapan:

  | Ruta | Cabeceras |
  |---|---|
  | Todo salvo `/mermaid.html` y `/assets/…` | CSP de la app (con `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP, CORP y HSTS ([SEGURIDAD.md](SEGURIDAD.md) §2.1–2.2) |
  | `/mermaid.html` | Las mismas, con la CSP del marco (`frame-ancestors 'self'`) y `X-Frame-Options: SAMEORIGIN` |
  | `/assets/…` | Las de la app y `Access-Control-Allow-Origin: *`: el marco, con origen opaco, pide sus módulos en modo CORS |

  Son las mismas que manda `vite preview`, así que los E2E prueban lo que se publica.
  La CSP viaja además como `<meta>` en cada página (un hosting sin cabeceras no deja la
  app sin política, aunque `frame-ancestors` solo funciona como cabecera).
- **Antes de `vercel.json`** (comprobado el *2026-09-30*): Vercel no mandaba ninguna
  cabecera de seguridad (solo su HSTS por defecto) y la CSP llegaba solo por `<meta>`.
- **Comprobar un despliegue** (CLAUDE.md §10): `npm run cabeceras:verificar --
  https://bpdf.r3zon.com` pide `/`, `/mermaid.html` y un módulo del marco y compara cada
  cabecera con la fuente. Sale con error si falta o difiere alguna. Tras cada despliegue que
  toque cabeceras, CSP o rutas.

## Documentación pública

La publica el Docusaurus de R3ZON a partir de `public_docs/` (D4). Se da de alta el
producto (`id: 'bpdf'`) en `R3ZON-Docusaurus/config/products.ts` cuando haya contenido
que publicar; la entrada de ejemplo está en [`public_docs/README.md`](../public_docs/README.md) §3.

## Qué se retiró en la Fase 1

La plantilla desplegaba en Vercel (región `fra1`, junto a Supabase) con Supabase Cloud y
Sentry. Nada de eso aplica a BPDF: el `vercel.json` de la plantilla se borró porque solo
fijaba la región de las funciones de servidor, que BPDF no tiene. El actual es otro: solo
cabeceras, generado.
