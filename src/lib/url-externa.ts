/**
 * La política de URLs externas de BPDF (CLAUDE.md §5, docs/SEGURIDAD.md §4):
 * solo `http:`, `https:` y `mailto:`, absolutas, sin credenciales y de
 * longitud razonable. La aplican los motores de documento (enlaces de un PDF,
 * de un Markdown) y, otra vez, la plataforma antes de abrir nada.
 */
const PROTOCOLOS = new Set(["http:", "https:", "mailto:"]);

/** La URL normalizada si la política la permite; `null` si no. */
export function urlPermitida(url: unknown): string | null {
  if (typeof url !== "string" || url.length > 2048) return null;
  let analizada: URL;
  try {
    analizada = new URL(url.trim());
  } catch {
    return null; // relativa o mal formada: sin base contra la que resolverla
  }
  if (!PROTOCOLOS.has(analizada.protocol)) return null;
  if (analizada.protocol !== "mailto:" && analizada.hostname === "") return null;
  if (analizada.username !== "" || analizada.password !== "") return null;
  return analizada.href;
}
