import { urlPermitida } from "@/lib/url-externa";

/**
 * Política de URLs de un Markdown (docs/SEGURIDAD.md §3). Funciones puras: lo
 * que decide aquí es lo único que puede acabar en un `href` del documento.
 *
 * Entrada: el destino tal como lo deja el parser. micromark ya ha decodificado
 * las referencias de carácter (`java&#x73;cript:` llega como `javascript:`) y
 * las barras invertidas de escape; esta capa NO vuelve a decodificar (lo que
 * quede con `&` es texto literal de la URL, y un `href` fijado por React no
 * interpreta entidades).
 *
 * Antes de clasificar se hace lo mismo que hace el navegador al leer una URL
 * (WHATWG URL): quitar tabuladores y saltos de línea de cualquier posición
 * (`java\tscript:` es `javascript:` para el navegador) y los controles y
 * espacios de los extremos. Así, lo que se compara es lo que el navegador
 * entendería.
 *
 * Resultado: solo dos tipos llevan a un `href` —`externo` (ya validado por la
 * política común de `src/lib/url-externa.ts`) y `ancla`—. Todo lo demás se
 * pinta como texto.
 */
export type DestinoEnlace =
  /** `http:`, `https:` o `mailto:` absoluta: se abre fuera de BPDF. */
  | { tipo: "externo"; url: string }
  /** `#fragmento`, ya decodificado: una sección del propio documento. */
  | { tipo: "ancla"; fragmento: string }
  /** Ruta relativa a otro fichero (`otro.md`, `./img/a.png`): no se navega. */
  | { tipo: "relativo"; ruta: string }
  /** Cualquier otro esquema (`javascript:`, `data:`, `file:`…), rutas absolutas o mal formadas. */
  | { tipo: "bloqueado" };

export type DestinoImagen =
  /** Ruta relativa: una imagen hermana del `.md`, que BPDF aún no recibe. */
  | { tipo: "local"; ruta: string }
  /** `http:` o `https:`: no se carga (D7); se ofrece como enlace. */
  | { tipo: "remota"; url: string }
  | { tipo: "bloqueada" };

/** Más larga que esto no es una URL que alguien escriba en un documento. */
const LONGITUD_MAXIMA = 2048;

/** Un esquema (`algo:`) al principio, como lo reconoce el parser de URLs. */
const ESQUEMA = /^[a-z][a-z\d+.-]*:/i;

/** Lo que el navegador ignora al leer una URL. */
function limpiar(url: string): string {
  // Tabuladores y saltos de línea en cualquier posición; controles C0 y
  // espacio en los extremos (WHATWG URL, «remove all ASCII tab or newline»).
  // biome-ignore lint/suspicious/noControlCharactersInRegex: es justo lo que se quita
  return url.replace(/[\t\n\r]/g, "").replace(/^[\u0000- ]+|[\u0000- ]+$/g, "");
}

export function clasificarEnlace(url: unknown): DestinoEnlace {
  if (typeof url !== "string" || url.length > LONGITUD_MAXIMA) return { tipo: "bloqueado" };
  const limpia = limpiar(url);
  if (limpia.startsWith("#")) {
    const fragmento = decodificar(limpia.slice(1));
    return fragmento ? { tipo: "ancla", fragmento } : { tipo: "bloqueado" };
  }
  if (ESQUEMA.test(limpia)) {
    const permitida = urlPermitida(limpia);
    return permitida ? { tipo: "externo", url: permitida } : { tipo: "bloqueado" };
  }
  return esRutaRelativa(limpia) ? { tipo: "relativo", ruta: limpia } : { tipo: "bloqueado" };
}

export function clasificarImagen(url: unknown): DestinoImagen {
  const destino = clasificarEnlace(url);
  if (destino.tipo === "relativo") return { tipo: "local", ruta: destino.ruta };
  if (destino.tipo === "externo" && !destino.url.startsWith("mailto:")) {
    return { tipo: "remota", url: destino.url };
  }
  return { tipo: "bloqueada" };
}

/**
 * El `urlTransform` de react-markdown: primera barrera, en el propio pipeline.
 * Vacía toda URL que la política bloquea, en cualquier atributo de URL. Los
 * componentes (`Enlace`, `Imagen`) vuelven a clasificar lo que les llega:
 * dos capas, para que un cambio en una no abra la otra.
 */
export function transformarUrl(url: string): string {
  return clasificarEnlace(url).tipo === "bloqueado" ? "" : url;
}

/**
 * Relativa «de verdad»: sin esquema, sin raíz (`/x`, `\x`) y sin autoridad
 * (`//host/x`, que el navegador resolvería contra otro servidor).
 */
function esRutaRelativa(url: string): boolean {
  return url !== "" && !url.startsWith("/") && !url.startsWith("\\");
}

function decodificar(fragmento: string): string {
  try {
    return decodeURIComponent(fragmento);
  } catch {
    return fragmento; // `%` suelto: se busca tal cual
  }
}
