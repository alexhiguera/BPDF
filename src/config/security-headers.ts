/**
 * CSP y cabeceras de seguridad: la ÚNICA fuente (docs/SEGURIDAD.md §2).
 *
 * La consumen `vite.config.ts` (cabeceras de `vite preview` y `<meta>` de la
 * build) y los tests, y de aquí se genera la configuración del hosting
 * (`vercel.json`, `npm run cabeceras:vercel`). No se copian a mano a ningún
 * otro sitio: dos copias de una CSP divergen, y la que se relaja es la que
 * nadie mira.
 *
 * Filosofía: DENEGAR POR DEFECTO. `default-src 'none'` y solo se abre lo que la
 * app usa HOY. Cada fase que necesite algo más (pdf.js: worker, fuentes, cmaps;
 * imágenes locales de Markdown: `blob:`) lo añade aquí con su motivo.
 */

type Directivas = Readonly<Record<string, readonly string[]>>;

export const CSP: Directivas = {
  "default-src": ["'none'"],
  // Solo los módulos de la build, servidos desde el propio origen. Nada en línea
  // (Vite no emite scripts en línea en producción) y nada de eval.
  "script-src": ["'self'"],
  // La hoja de estilos de la build. Sin 'unsafe-inline': React fija estilos por
  // CSSOM, que la CSP no bloquea.
  "style-src": ["'self'"],
  // Fase 7 bis: las imágenes locales de un Markdown se pintan con URL `blob:` que
  // crea BPDF desde los ficheros que el usuario entregó (`AlmacenUrls`). Una URL
  // `blob:` solo puede crearla código del propio origen y no sale a la red. Nada de
  // `data:` ni `https:`: las imágenes remotas siguen bloqueadas (D7).
  "img-src": ["'self'", "blob:"],
  // Fase 4: el worker de pdf.js (`/pdfjs/pdf.worker.min.mjs`), donde se parsea el
  // PDF aislado del DOM. Solo desde el propio origen: nada de `blob:`.
  "worker-src": ["'self'"],
  // Fase 4: sustitutas de las 14 fuentes estándar de PDF (`/pdfjs/standard_fonts/`,
  // p. ej. LiberationSans para Helvetica) que pdf.js carga con `FontFace` cuando el
  // documento no las incrusta. Las fuentes incrustadas llegan como bytes, sin URL.
  "font-src": ["'self'"],
  // Fase 5: pdf.js pide al PROPIO origen, con `fetch` desde su worker, los mapas de
  // caracteres (`/pdfjs/cmaps/`) de las fuentes CID no incrustadas (japonés, chino,
  // coreano…). Sin esto, ese texto desaparece EN SILENCIO: la violación ocurre en el
  // worker y no llega al documento. Solo 'self': el documento nunca sale de BPDF
  // (entra como bytes) y ningún PDF puede pedir nada a otro origen.
  "connect-src": ["'self'"],
  // Fase 8: el marco aislado de Mermaid (`/mermaid.html`, abajo). Solo el propio
  // origen: ningún documento puede enmarcar otra cosa.
  "frame-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
  // No se puede enmarcar BPDF (clickjacking). Solo funciona como cabecera.
  "frame-ancestors": ["'none'"],
};

/** Directivas que un `<meta http-equiv>` ignora (y Chrome avisa en consola si aparecen). */
const SOLO_CABECERA = new Set(["frame-ancestors", "report-uri", "sandbox"]);

function serializar(directivas: Directivas, omitir: Set<string> = new Set()): string {
  return Object.entries(directivas)
    .filter(([nombre]) => !omitir.has(nombre))
    .map(([nombre, valores]) => `${nombre} ${valores.join(" ")}`)
    .join("; ");
}

/** CSP completa, para la cabecera HTTP. */
export const cspCabecera = (): string => serializar(CSP);

/**
 * CSP para `<meta http-equiv>` en el `index.html` de la build: la misma política
 * sin las directivas que en `<meta>` no existen. Hace que el `dist/` lleve su
 * CSP puesta aunque el hosting no mande cabeceras (el hosting está pendiente de
 * D5); donde sí las mande, se aplican las dos y manda la más estricta.
 */
export const cspMeta = (): string => serializar(CSP, SOLO_CABECERA);

/**
 * Cabeceras de toda respuesta. `Permissions-Policy` niega lo que la app no usa;
 * solo lista características que Chrome reconoce, porque una desconocida
 * produce un error en consola.
 */
export function cabecerasSeguridad(): Record<string, string> {
  return {
    "Content-Security-Policy": cspCabecera(),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy":
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
    // Sin `preload`: entrar en la lista de precarga es un compromiso del dominio.
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  };
}

/**
 * Fase 8: la página del marco de Mermaid (`/mermaid.html`,
 * docs/SEGURIDAD.md §2.1). Mermaid dibuja con `<style>` y atributos `style`
 * en línea, que la CSP de la app prohíbe; en vez de relajarla, Mermaid corre en
 * esta página, dentro de un iframe con `sandbox="allow-scripts"` (origen
 * opaco: no puede tocar el DOM, el almacenamiento ni las cookies de BPDF), con
 * esta política propia:
 *
 * - `style-src 'unsafe-inline'`: lo único que Mermaid necesita y la app no da.
 * - Sin red: `connect-src`, `img-src` y `font-src` a `'none'`. El diagrama llega
 *   por `postMessage` y el SVG vuelve igual; nada más entra ni sale.
 * - `frame-ancestors 'self'`: solo BPDF puede enmarcarla (solo en cabecera).
 */
export const CSP_MARCO_MERMAID: Directivas = {
  "default-src": ["'none'"],
  "script-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'none'"],
  "font-src": ["'none'"],
  "connect-src": ["'none'"],
  "worker-src": ["'none'"],
  "object-src": ["'none'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
  "frame-ancestors": ["'self'"],
};

/** Ruta de la página del marco (una entrada más de la build). */
export const RUTA_MARCO_MERMAID = "/mermaid.html";

export const cspMarcoCabecera = (): string => serializar(CSP_MARCO_MERMAID);
export const cspMarcoMeta = (): string => serializar(CSP_MARCO_MERMAID, SOLO_CABECERA);

/**
 * Cabeceras según la ruta, para `vite preview` y el hosting:
 *
 * - `/mermaid.html`: la CSP del marco, y `X-Frame-Options: SAMEORIGIN` (la
 *   enmarca BPDF, nadie más).
 * - `/assets/…`: además, `Access-Control-Allow-Origin: *`. El marco tiene origen
 *   opaco (`null`), así que sus módulos se piden en modo CORS; son ficheros
 *   públicos de la build, sin credenciales ni datos. (El hosting actual ya lo
 *   manda en todos los estáticos.)
 * - Todo lo demás: las de siempre.
 */
export function cabecerasPara(ruta: string): Record<string, string> {
  const base = cabecerasSeguridad();
  const camino = ruta.split("?")[0] ?? ruta;
  if (camino === RUTA_MARCO_MERMAID) {
    return {
      ...base,
      "Content-Security-Policy": cspMarcoCabecera(),
      "X-Frame-Options": "SAMEORIGIN",
    };
  }
  if (camino.startsWith("/assets/")) return { ...base, "Access-Control-Allow-Origin": "*" };
  return base;
}

/** Una regla de cabeceras de `vercel.json`. */
export type ReglaVercel = {
  source: string;
  headers: { key: string; value: string }[];
};

/**
 * Las cabeceras para el hosting (Vercel, `bpdf.r3zon.com`), sacadas de
 * `cabecerasPara`: la misma política que `vite preview` y los E2E. Tres reglas
 * que NO se solapan (así no depende del orden en que Vercel aplica varias
 * coincidencias):
 *
 * - todo lo que no es `/mermaid.html` ni `/assets/…`: las de la app;
 * - `/mermaid.html`: la CSP del marco y `X-Frame-Options: SAMEORIGIN`;
 * - `/assets/…`: las de la app más `Access-Control-Allow-Origin: *`.
 *
 * `vercel.json` se genera con `npm run cabeceras:vercel` y un test comprueba
 * que coincide con esto: no se edita a mano.
 */
export function reglasVercel(): ReglaVercel[] {
  const aLista = (h: Record<string, string>) =>
    Object.entries(h).map(([key, value]) => ({ key, value }));
  return [
    { source: "/((?!assets/|mermaid\\.html$).*)", headers: aLista(cabecerasPara("/")) },
    { source: RUTA_MARCO_MERMAID, headers: aLista(cabecerasPara(RUTA_MARCO_MERMAID)) },
    { source: "/assets/(.*)", headers: aLista(cabecerasPara("/assets/x")) },
  ];
}
