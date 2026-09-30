/**
 * Búsqueda de texto en un PDF, sin DOM ni pdf.js (docs/ARCHITECTURE.md → visor
 * PDF, «Búsqueda»). Solo busca en el texto que el PDF trae: sin OCR, así que un
 * escaneo no tiene texto que encontrar (y el visor lo dice).
 *
 * Normalización, igual en el texto y en la consulta:
 * - NFKD y sin marcas diacríticas: «canción» encuentra «cancion», y las
 *   ligaduras tipográficas («ﬁ») se buscan como sus letras («fi»);
 * - minúsculas;
 * - cualquier secuencia de espacios cuenta como UN espacio, y un fin de línea
 *   del PDF también es un espacio (una frase partida entre dos líneas se
 *   encuentra). Un guion de corte al final de línea NO se une: límite conocido.
 *
 * Cada carácter normalizado recuerda de qué trozo del PDF (`item`, en el orden
 * de `getTextContent`) y de qué posición sale, para resaltar la coincidencia en
 * la capa de texto, que tiene un elemento por trozo en ese mismo orden.
 */

/** Lo que la búsqueda usa de cada trozo de `getTextContent()` (los de texto). */
export type TrozoTexto = { str: string; hasEOL?: boolean };

export type IndicePagina = {
  texto: string;
  /** Para cada carácter de `texto`: el trozo del que sale… */
  trozo: Int32Array;
  /** …y su posición (UTF-16) dentro del `str` de ese trozo. */
  posicion: Int32Array;
};

/** Un tramo resaltable: `[desde, hasta)` dentro del `str` del trozo `trozo`. */
export type Tramo = { trozo: number; desde: number; hasta: number };
export type Coincidencia = { pagina: number; tramos: Tramo[] };

const ESPACIO = /\s/u;
const MARCAS = /\p{M}/gu;

const normalizarCaracter = (c: string): string =>
  c.normalize("NFKD").replace(MARCAS, "").toLowerCase();

/** La consulta normalizada como el texto; `""` si no queda nada que buscar. */
export function normalizarConsulta(consulta: string): string {
  let salida = "";
  for (const c of consulta) {
    if (ESPACIO.test(c)) {
      if (salida !== "" && !salida.endsWith(" ")) salida += " ";
    } else {
      salida += normalizarCaracter(c);
    }
  }
  return salida.trimEnd();
}

export function indexarPagina(trozos: readonly TrozoTexto[]): IndicePagina {
  const texto: string[] = [];
  const trozo: number[] = [];
  const posicion: number[] = [];
  let ultimoEspacio = true; // no empieza con espacio
  const espacio = (t: number, p: number) => {
    if (ultimoEspacio) return;
    texto.push(" ");
    trozo.push(t);
    posicion.push(p);
    ultimoEspacio = true;
  };
  trozos.forEach(({ str, hasEOL }, t) => {
    let p = 0;
    for (const c of str) {
      if (ESPACIO.test(c)) {
        espacio(t, p);
      } else {
        // Unidad UTF-16 a unidad UTF-16: `texto`, `trozo` y `posicion` deben tener
        // la misma longitud (un emoji son dos unidades).
        const normalizado = normalizarCaracter(c);
        for (let k = 0; k < normalizado.length; k++) {
          texto.push(normalizado.charAt(k));
          trozo.push(t);
          posicion.push(p);
        }
        if (normalizado !== "") ultimoEspacio = false;
      }
      p += c.length;
    }
    if (hasEOL) espacio(t, str.length);
  });
  return {
    texto: texto.join(""),
    trozo: Int32Array.from(trozo),
    posicion: Int32Array.from(posicion),
  };
}

/** ¿La página tiene algún texto buscable? */
export const tieneTexto = (indice: IndicePagina): boolean => indice.texto.trim() !== "";

/** Coincidencias (sin solaparse) de `consulta` ya normalizada en una página. */
export function buscarEnPagina(
  indice: IndicePagina,
  consulta: string,
  pagina: number,
): Coincidencia[] {
  const resultado: Coincidencia[] = [];
  if (consulta === "") return resultado;
  let desde = indice.texto.indexOf(consulta);
  while (desde !== -1) {
    resultado.push({ pagina, tramos: tramos(indice, desde, desde + consulta.length) });
    desde = indice.texto.indexOf(consulta, desde + consulta.length);
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
