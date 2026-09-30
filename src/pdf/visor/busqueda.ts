/**
 * Búsqueda de texto en un PDF, sin DOM ni pdf.js (docs/ARCHITECTURE.md → visor
 * PDF, «Búsqueda»). Solo busca en el texto que el PDF trae: sin OCR, así que un
 * escaneo no tiene texto que encontrar (y el visor lo dice).
 *
 * Normalización, igual en el texto y en la consulta:
 * - NFKD y sin marcas diacríticas: «canción» encuentra «cancion», y las
 *   ligaduras tipográficas («ﬁ») se buscan como sus letras («fi»);
 * - minúsculas, salvo con «distinguir mayúsculas» (los acentos se ignoran igual);
 * - cualquier secuencia de espacios cuenta como UN espacio, y un fin de línea
 *   del PDF también es un espacio (una frase partida entre dos líneas se
 *   encuentra);
 * - una palabra partida con guion al final de línea se une («pala-⏎bra» →
 *   «palabra»), y el guion blando (U+00AD) se ignora siempre.
 *
 * El índice de cada página guarda DOS textos de la misma longitud, con y sin
 * mayúsculas, y dos tablas paralelas que dicen, para cada unidad UTF-16 de esos
 * textos, de qué trozo del PDF (`item`, en el orden de `getTextContent`) y de
 * qué posición sale: con ellas se resalta la coincidencia en la capa de texto,
 * que tiene un elemento por trozo en ese mismo orden.
 */

/** Lo que la búsqueda usa de cada trozo de `getTextContent()` (los de texto). */
export type TrozoTexto = { str: string; hasEOL?: boolean };

export type IndicePagina = {
  /** Texto normalizado CONSERVANDO mayúsculas (para «distinguir mayúsculas»). */
  texto: string;
  /** El mismo texto en minúsculas: misma longitud, unidad a unidad. */
  minusculas: string;
  /** Para cada unidad de `texto` (y de `minusculas`): el trozo del que sale… */
  trozo: Int32Array;
  /** …y su posición (UTF-16) dentro del `str` de ese trozo. */
  posicion: Int32Array;
};

/** Opciones de la búsqueda (Fase 6). Sin ninguna, se busca como en la Fase 5. */
export type OpcionesBusqueda = {
  /** Distinguir mayúsculas de minúsculas (no los acentos: esos se ignoran siempre). */
  mayusculas: boolean;
  /** Solo coincidencias que no tengan letras ni números pegados a los lados. */
  palabraCompleta: boolean;
};

export const SIN_OPCIONES: OpcionesBusqueda = { mayusculas: false, palabraCompleta: false };

/** Un tramo resaltable: `[desde, hasta)` dentro del `str` del trozo `trozo`. */
export type Tramo = { trozo: number; desde: number; hasta: number };
export type Coincidencia = { pagina: number; tramos: Tramo[] };

const ESPACIO = /\s/u;
const MARCAS = /\p{M}/gu;
const LETRA = /\p{L}/u;
const DE_PALABRA = /[\p{L}\p{N}]/u;
const GUION_BLANDO = "­";
/** Guiones que parten una palabra al final de línea: el ASCII y U+2010. */
const GUIONES = new Set(["-", "‐"]);

/** Un carácter sin marcas diacríticas y en NFKD (puede quedar vacío o crecer). */
const sinMarcas = (c: string): string => c.normalize("NFKD").replace(MARCAS, "");

/**
 * La minúscula de una forma ya normalizada, de la MISMA longitud. Si pasar a
 * minúsculas cambiara la longitud (casos raros de Unicode), se deja como está:
 * así `texto` y `minusculas` siguen alineadas con `trozo` y `posicion`.
 */
function bajar(normalizado: string): string {
  const minuscula = normalizado.toLowerCase();
  return minuscula.length === normalizado.length ? minuscula : normalizado;
}

/** La consulta normalizada como el texto; `""` si no queda nada que buscar. */
export function normalizarConsulta(
  consulta: string,
  opciones: OpcionesBusqueda = SIN_OPCIONES,
): string {
  let salida = "";
  for (const c of consulta) {
    if (ESPACIO.test(c)) {
      if (salida !== "" && !salida.endsWith(" ")) salida += " ";
    } else if (c !== GUION_BLANDO) {
      const normalizado = sinMarcas(c);
      salida += opciones.mayusculas ? normalizado : bajar(normalizado);
    }
  }
  return salida.trimEnd();
}

export function indexarPagina(trozos: readonly TrozoTexto[]): IndicePagina {
  const texto: string[] = [];
  const minusculas: string[] = [];
  const trozo: number[] = [];
  const posicion: number[] = [];
  let ultimoEspacio = true; // no empieza con espacio

  const emitir = (normal: string, minuscula: string, t: number, p: number) => {
    texto.push(normal);
    minusculas.push(minuscula);
    trozo.push(t);
    posicion.push(p);
  };
  const espacio = (t: number, p: number) => {
    if (ultimoEspacio) return;
    emitir(" ", " ", t, p);
    ultimoEspacio = true;
  };

  /**
   * Un guion al final de un trozo, precedido de letra, que aún no se sabe si
   * parte una palabra: depende de que la línea acabe ahí y de que lo siguiente
   * sea una letra. Mientras tanto, ni él ni el espacio que le sigue se emiten.
   */
  let guion: {
    c: string;
    t: number;
    p: number;
    espacio: { t: number; p: number } | null;
    eol: boolean;
  } | null = null;
  const soltarGuion = () => {
    if (!guion) return;
    const { c, t, p, espacio: sp } = guion;
    guion = null;
    emitir(c, c, t, p);
    ultimoEspacio = false;
    if (sp) espacio(sp.t, sp.p);
  };

  trozos.forEach(({ str, hasEOL }, t) => {
    // Fin del texto del trozo sin los espacios del final: un guion justo ahí
    // puede ser de corte de palabra.
    const fin = str.trimEnd().length;
    let p = 0;
    for (const c of str) {
      if (ESPACIO.test(c)) {
        if (guion) guion.espacio ??= { t, p };
        else espacio(t, p);
      } else if (c !== GUION_BLANDO) {
        const normalizado = sinMarcas(c);
        if (guion) {
          // Se une si la línea acabó tras el guion y sigue una letra.
          if (guion.eol && LETRA.test(normalizado)) guion = null;
          else soltarGuion();
        }
        const esCorte =
          GUIONES.has(c) &&
          p + c.length === fin &&
          !ultimoEspacio &&
          LETRA.test(texto.at(-1) ?? "");
        if (esCorte) {
          guion = { c: normalizado, t, p, espacio: null, eol: false };
        } else {
          // Unidad UTF-16 a unidad UTF-16: `texto`, `minusculas`, `trozo` y
          // `posicion` deben tener la misma longitud (un emoji son dos unidades).
          const minuscula = bajar(normalizado);
          for (let k = 0; k < normalizado.length; k++) {
            emitir(normalizado.charAt(k), minuscula.charAt(k), t, p);
          }
          if (normalizado !== "") ultimoEspacio = false;
        }
      }
      p += c.length;
    }
    if (hasEOL) {
      if (guion) {
        guion.eol = true;
        guion.espacio ??= { t, p: str.length };
      } else {
        espacio(t, str.length);
      }
    }
  });
  soltarGuion();
  return {
    texto: texto.join(""),
    minusculas: minusculas.join(""),
    trozo: Int32Array.from(trozo),
    posicion: Int32Array.from(posicion),
  };
}

/** ¿La página tiene algún texto buscable? */
export const tieneTexto = (indice: IndicePagina): boolean => indice.texto.trim() !== "";

/** El carácter (punto de código) que acaba justo antes de `i`, o `""`. */
function caracterAntes(s: string, i: number): string {
  if (i <= 0) return "";
  const bajo = s.charCodeAt(i - 1);
  const inicio = bajo >= 0xdc00 && bajo <= 0xdfff && i >= 2 ? i - 2 : i - 1;
  return String.fromCodePoint(s.codePointAt(inicio) ?? 0);
}

/** El carácter (punto de código) que empieza en `i`, o `""`. */
const caracterEn = (s: string, i: number): string =>
  i >= s.length ? "" : String.fromCodePoint(s.codePointAt(i) ?? 0);

/**
 * Coincidencias (sin solaparse) de `consulta`, ya normalizada con las mismas
 * `opciones`, en una página.
 */
export function buscarEnPagina(
  indice: IndicePagina,
  consulta: string,
  pagina: number,
  opciones: OpcionesBusqueda = SIN_OPCIONES,
): Coincidencia[] {
  const resultado: Coincidencia[] = [];
  if (consulta === "") return resultado;
  const fuente = opciones.mayusculas ? indice.texto : indice.minusculas;
  let desde = fuente.indexOf(consulta);
  while (desde !== -1) {
    const hasta = desde + consulta.length;
    const valida =
      !opciones.palabraCompleta ||
      (!DE_PALABRA.test(caracterAntes(fuente, desde)) &&
        !DE_PALABRA.test(caracterEn(fuente, hasta)));
    if (valida) {
      resultado.push({ pagina, tramos: tramos(indice, desde, hasta) });
      desde = fuente.indexOf(consulta, hasta);
    } else {
      // Un candidato que no vale no salta los que empiezan dentro de él.
      desde = fuente.indexOf(consulta, desde + 1);
    }
  }
  return resultado;
}

/** Los tramos de `[inicio, fin)` del texto normalizado, uno por trozo del PDF. */
function tramos(indice: IndicePagina, inicio: number, fin: number): Tramo[] {
  const salida: Tramo[] = [];
  for (let k = inicio; k < fin; k++) {
    const t = indice.trozo[k] ?? 0;
    const p = indice.posicion[k] ?? 0;
    const ultimo = salida.at(-1);
    if (ultimo && ultimo.trozo === t) {
      ultimo.desde = Math.min(ultimo.desde, p);
      ultimo.hasta = Math.max(ultimo.hasta, p + 1);
    } else {
      salida.push({ trozo: t, desde: p, hasta: p + 1 });
    }
  }
  return salida;
}

/**
 * Amplía un tramo que acaba en mitad de un par sustituto (un emoji, un carácter
 * fuera del plano básico) para que el resaltado no lo parta.
 */
export function ajustarTramo(str: string, { trozo, desde, hasta }: Tramo): Tramo {
  let h = Math.min(hasta, str.length);
  const codigo = str.charCodeAt(h - 1);
  if (codigo >= 0xd800 && codigo <= 0xdbff && h < str.length) h++;
  return { trozo, desde: Math.min(desde, h), hasta: h };
}

/** Índice de la coincidencia siguiente (o anterior), dando la vuelta. */
export function siguienteIndice(actual: number, total: number, direccion: 1 | -1): number {
  if (total === 0) return -1;
  if (actual < 0) return direccion === 1 ? 0 : total - 1;
  return (actual + direccion + total) % total;
}

/** La primera coincidencia en la página `pagina` o después (para empezar donde se lee). */
export function primeraDesde(coincidencias: readonly Coincidencia[], pagina: number): number {
  if (coincidencias.length === 0) return -1;
  const i = coincidencias.findIndex((c) => c.pagina >= pagina);
  return i === -1 ? 0 : i;
}
