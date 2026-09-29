/**
 * CSP y cabeceras de seguridad: la ÚNICA fuente (docs/SEGURIDAD.md §2).
 *
 * La consumen `vite.config.ts` (cabeceras de `vite preview` y `<meta>` de la
 * build) y los tests; la configuración del hosting (D5) y el protocolo de
 * Electron (Fase 14) las generarán desde aquí. No se copian a mano a ningún
 * otro sitio: dos copias de una CSP divergen, y la que se relaja es la que
 * nadie mira.
 *
 * Filosofía: DENEGAR POR DEFECTO. `default-src 'none'` y solo se abre lo que la
 * app usa HOY. Cada fase que necesite algo más (pdf.js: `'wasm-unsafe-eval'`,
 * worker; imágenes locales de Markdown: `blob:`) lo añade aquí con su motivo.
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
  "img-src": ["'self'"],
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
