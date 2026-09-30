import type { Heading, Nodes, Root } from "mdast";

/**
 * Ids de los encabezados y el índice del documento (docs/PLAN.md §7).
 *
 * **Ids deterministas y con prefijo.** El id sale del texto del encabezado con
 * las reglas habituales (las de GitHub: minúsculas, sin puntuación, espacios a
 * guiones), así que los enlaces `[x](#mi-seccion)` que ya funcionan en GitHub
 * funcionan aquí. Siempre con el prefijo `md-`: un encabezado `# location` o
 * `# __proto__` daría ids que pisarían propiedades globales de `window`
 * (DOM clobbering, docs/SEGURIDAD.md §2.3). Los repetidos llevan sufijo
 * (`md-uso`, `md-uso-1`…), en orden de aparición.
 *
 * El id se asigna en el árbol de Markdown (mdast) mediante
 * `data.hProperties`, que remark-rehype copia al elemento: nunca se escribe
 * HTML con él. React lo pone como atributo `id`.
 */
export const PREFIJO_ID = "md-";

export type EntradaIndice = { nivel: number; texto: string; id: string };

/** Nombre de reserva para un encabezado sin letras ni números (`# !!!`). */
const SIN_TEXTO = "seccion";

/** Genera ids únicos para un documento. Un slugger por documento. */
export function crearSlugger() {
  const usados = new Map<string, number>();
  return (texto: string): string => {
    const base = slug(texto) || SIN_TEXTO;
    let id = base;
    let n = usados.get(base) ?? 0;
    // `uso-1` escrito a mano también puede existir: se salta hasta uno libre.
    while (usados.has(id)) id = `${base}-${++n}`;
    usados.set(base, n);
    usados.set(id, usados.get(id) ?? 0);
    return PREFIJO_ID + id;
  };
}

/**
 * Minúsculas; se conservan letras y números de cualquier alfabeto, guiones y
 * guiones bajos; los espacios pasan a guiones. Como `github-slugger`, sin su
 * dependencia.
 */
export function slug(texto: string): string {
  return texto
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc} -]/gu, "")
    .replace(/ /g, "-");
}

/** El texto visible de un nodo de Markdown (con el `alt` de las imágenes). */
export function textoDe(nodo: Nodes): string {
  if ("value" in nodo && typeof nodo.value === "string" && nodo.type !== "html") return nodo.value;
  if (nodo.type === "image") return nodo.alt ?? "";
  if ("children" in nodo) return nodo.children.map((h) => textoDe(h as Nodes)).join("");
  return "";
}

/**
 * Plugin de remark: da a cada encabezado su id. Recorrido iterativo (con
 * pila, no recursivo): un documento hostil puede anidar citas y listas miles de
 * niveles.
 */
export function remarkIdsEncabezados() {
  return (arbol: Root) => {
    const siguiente = crearSlugger();
    for (const encabezado of encabezados(arbol)) {
      encabezado.data = {
        ...encabezado.data,
        hProperties: { ...encabezado.data?.hProperties, id: siguiente(textoDe(encabezado)) },
      };
    }
  };
}

/** Los encabezados en orden de documento. */
function encabezados(arbol: Root): Heading[] {
  const encontrados: Heading[] = [];
  const pila: Nodes[] = [arbol];
  while (pila.length > 0) {
    const nodo = pila.pop() as Nodes;
    if (nodo.type === "heading") encontrados.push(nodo);
    else if ("children" in nodo) {
      for (let i = nodo.children.length - 1; i >= 0; i--) pila.push(nodo.children[i] as Nodes);
    }
  }
  return encontrados;
}

/** Con menos de dos encabezados, un índice no ayuda a navegar: no se muestra. */
export const MINIMO_ENTRADAS = 2;

/**
 * El índice, leído de los encabezados YA pintados (`h1`–`h6` con id `md-…`):
 * lo que se ve es exactamente lo que se enlaza, sin volver a parsear el
 * documento. El texto se usa solo como texto.
 */
export function leerIndice(raiz: ParentNode): EntradaIndice[] {
  const entradas: EntradaIndice[] = [];
  for (const h of raiz.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")) {
    if (!h.id.startsWith(PREFIJO_ID)) continue;
    entradas.push({
      nivel: Number(h.tagName.slice(1)),
      texto: (h.textContent ?? "").trim(),
      id: h.id,
    });
  }
  return entradas.length >= MINIMO_ENTRADAS ? entradas : [];
}

/**
 * Los ids que puede querer decir un enlace `#fragmento` del documento, por
 * orden: el del encabezado (`#uso` → `md-uso`), y el fragmento tal cual si ya
 * lleva el prefijo (las notas al pie, `#md-fn-1`). Nunca un id sin prefijo: un
 * enlace del documento no puede apuntar a la interfaz de BPDF.
 */
export function idsCandidatos(fragmento: string): string[] {
  const candidatos = [PREFIJO_ID + fragmento, PREFIJO_ID + fragmento.toLowerCase()];
  if (fragmento.startsWith(PREFIJO_ID)) candidatos.unshift(fragmento);
  return [...new Set(candidatos)];
}
