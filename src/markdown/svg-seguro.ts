/**
 * Saneado del SVG que genera Mermaid (Fase 8, docs/SEGURIDAD.md §3.1).
 *
 * Mermaid ya sanea con DOMPurify en `securityLevel: "strict"`, pero BPDF no
 * se fía de que una librería genere algo seguro solo porque sea SVG. Este es
 * un segundo filtro, propio y con LISTA BLANCA, antes de convertir el SVG en
 * una imagen (`<img src="blob:…">`, donde además no puede ejecutar nada).
 * Importa porque la URL `blob:` se podría abrir como página.
 *
 * Dos piezas, en dos sitios:
 *
 * - `sanearSvg` (en el MARCO aislado, `marco-mermaid.ts`): limpia con DOM.
 *   Solo puede correr allí: `DOMParser` hereda la CSP del documento que lo
 *   usa, y en la app cada `style` del SVG sería una violación de CSP (medido).
 * - `verificarSvg` (en la APP, `mermaid.ts`): no se fía del marco. Recorre el
 *   XML ya serializado como texto, sin DOM, con la misma lista blanca, y
 *   RECHAZA (no arregla) lo que no la cumpla.
 *
 * `sanearSvg`:
 *
 * - Se parsea como XML (`DOMParser`, `image/svg+xml`): un documento inerte,
 *   sin scripts ni carga de recursos. Nada de `innerHTML`.
 * - Solo sobreviven elementos de dibujo conocidos. `script`, `foreignObject`
 *   (HTML dentro del SVG), `iframe`, `image`, `use` a otro documento… se
 *   eliminan con su contenido. Los enlaces `<a>` se desenvuelven (se queda su
 *   contenido, sin enlace).
 * - Atributos: fuera todo `on*`; `href`/`xlink:href` solo a `#id` del propio
 *   SVG; ningún valor con `javascript:`, `data:` ni `url(` a algo que no sea
 *   `#id`.
 * - `<style>` (Mermaid lo necesita para pintar): fuera `@import` y todo
 *   `url(…)` que no sea `#id`.
 * - El tamaño pasa a ser el del `viewBox` en píxeles (Mermaid pone
 *   `width="100%"`, que en una imagen no da tamaño propio).
 */

const SVG_NS = "http://www.w3.org/2000/svg";

const ELEMENTOS = new Set([
  "svg",
  "g",
  "defs",
  "symbol",
  "use",
  "marker",
  "style",
  "title",
  "desc",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "text",
  "tspan",
  "textPath",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "pattern",
  "filter",
  "feDropShadow",
  "feGaussianBlur",
  "feOffset",
  "feFlood",
  "feComposite",
  "feMerge",
  "feMergeNode",
  "feBlend",
  "feColorMatrix",
  "switch",
]);

/** Elementos que se quitan pero cuyo contenido se conserva. */
const DESENVOLVER = new Set(["a"]);

const HREF = new Set(["href", "xlink:href"]);
const PELIGROSO = /javascript:|vbscript:|data:|@import|expression\s*\(/i;
const URL_EXTERNA = /url\(\s*(['"]?)\s*(?!#)[^)]*\)/gi;

/** El SVG saneado como cadena, o `null` si no es un SVG bien formado. */
export function sanearSvg(fuente: string): string | null {
  const doc = new DOMParser().parseFromString(fuente, "image/svg+xml");
  const raiz = doc.documentElement;
  if (
    doc.getElementsByTagName("parsererror").length > 0 ||
    raiz.localName !== "svg" ||
    raiz.namespaceURI !== SVG_NS
  ) {
    return null;
  }
  limpiar(raiz);
  fijarTamano(raiz);
  return new XMLSerializer().serializeToString(raiz);
}

function limpiar(raiz: Element) {
  // Recorrido iterativo sobre una copia de la lista: se quitan nodos por el camino.
  const pila: Element[] = [raiz];
  while (pila.length > 0) {
    const el = pila.pop() as Element;
    for (const hijo of Array.from(el.children)) {
      const nombre = hijo.localName;
      if (hijo.namespaceURI === SVG_NS && DESENVOLVER.has(nombre)) {
        hijo.replaceWith(...Array.from(hijo.childNodes));
        pila.push(el); // revisar lo que ha subido
        continue;
      }
      if (hijo.namespaceURI !== SVG_NS || !ELEMENTOS.has(nombre)) {
        hijo.remove();
        continue;
      }
      limpiarAtributos(hijo);
      if (nombre === "style") hijo.textContent = limpiarCss(hijo.textContent ?? "");
      pila.push(hijo);
    }
    if (el === raiz) limpiarAtributos(raiz);
  }
  // Comentarios e instrucciones de proceso fuera (no pintan nada).
  const recorrido = raiz.ownerDocument.createTreeWalker(raiz, 0x80 | 0x40);
  const sobrantes: Node[] = [];
  while (recorrido.nextNode()) sobrantes.push(recorrido.currentNode);
  for (const n of sobrantes) n.parentNode?.removeChild(n);
}

function limpiarAtributos(el: Element) {
  for (const { name, value } of Array.from(el.attributes)) {
    const local = name.toLowerCase();
    if (local.startsWith("on")) el.removeAttribute(name);
    else if (HREF.has(local)) {
      if (!value.trim().startsWith("#")) el.removeAttribute(name);
    } else if (PELIGROSO.test(value)) el.removeAttribute(name);
    else if (URL_EXTERNA.test(value)) el.setAttribute(name, value.replace(URL_EXTERNA, "none"));
    URL_EXTERNA.lastIndex = 0;
  }
}

export function limpiarCss(css: string): string {
  return css
    .replace(/@import[^;]*;?/gi, "")
    .replace(URL_EXTERNA, "none")
    .replace(/expression\s*\(/gi, "(")
    .replace(/javascript:|vbscript:/gi, "");
}

function fijarTamano(raiz: Element) {
  const caja = (raiz.getAttribute("viewBox") ?? "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const [, , ancho, alto] = caja;
  if (caja.length === 4 && ancho && alto && ancho > 0 && alto > 0) {
    raiz.setAttribute("width", String(Math.ceil(ancho)));
    raiz.setAttribute("height", String(Math.ceil(alto)));
    raiz.removeAttribute("style"); // `max-width: …px` de Mermaid: el tamaño ya está fijado
  }
}

/** Entidades XML: las que produce `XMLSerializer` y las numéricas. */
function decodificarEntidades(valor: string): string {
  return valor.replace(/&(#x[\da-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (_, e: string) => {
    const x = e.toLowerCase();
    if (x === "lt") return "<";
    if (x === "gt") return ">";
    if (x === "amp") return "&";
    if (x === "quot") return '"';
    if (x === "apos") return "'";
    const n = x.startsWith("#x")
      ? Number.parseInt(x.slice(2), 16)
      : Number.parseInt(x.slice(1), 10);
    return Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  });
}

/**
 * ¿Es este SVG (texto serializado, venga de donde venga) un dibujo inerte?
 * Sin DOM: un recorrido de etiquetas sobre el XML.
 *
 * - Solo etiquetas de la lista blanca (sin `<a>`: `sanearSvg` ya las quitó).
 * - Nada de `<!…>` (comentarios, CDATA, DOCTYPE, entidades declaradas) ni
 *   `<?…?>`: `XMLSerializer` no los produce de un SVG ya saneado; si están, se
 *   rechaza en vez de interpretarlos.
 * - Atributos con comillas dobles (así los escribe `XMLSerializer`); ninguno
 *   `on*`; `href` solo `#id` literal; ningún valor, ya decodificado, con
 *   `javascript:`, `data:`, `@import` o `url(` a algo que no sea `#id`.
 * - El texto de `<style>`, igual.
 * - La raíz es `<svg>` con el espacio de nombres de SVG.
 */
export function verificarSvg(svg: string): boolean {
  if (typeof svg !== "string" || !/^\s*<svg[\s>]/.test(svg)) return false;
  if (!svg.includes(`xmlns="${SVG_NS}"`)) return false;
  if (/<[!?]/.test(svg)) return false;
  const etiqueta = /<(\/?)([^\s/>]+)((?:\s+[^\s=/>]+="[^"]*")*)\s*(\/?)>/gy;
  let pos = 0;
  let enStyle = false;
  while (pos < svg.length) {
    const siguiente = svg.indexOf("<", pos);
    const texto = svg.slice(pos, siguiente < 0 ? svg.length : siguiente);
    if (texto.includes(">")) return false; // un `>` suelto: no es XML de XMLSerializer
    if (enStyle && inseguro(decodificarEntidades(texto))) return false;
    if (siguiente < 0) break;
    etiqueta.lastIndex = siguiente;
    const m = etiqueta.exec(svg);
    if (!m) return false;
    const [, cierre, nombre = "", atributos = ""] = m;
    if (!ELEMENTOS.has(nombre)) return false;
    if (!cierre) {
      for (const a of atributos.matchAll(/([^\s=/>]+)="([^"]*)"/g)) {
        const [, clave = "", crudo = ""] = a;
        const k = clave.toLowerCase();
        if (k.startsWith("on")) return false;
        if (HREF.has(k) || k.endsWith(":href")) {
          if (!crudo.startsWith("#") || crudo.includes("&")) return false;
        } else if (inseguro(decodificarEntidades(crudo))) return false;
      }
    }
    enStyle = nombre === "style" && !cierre && m[4] !== "/";
    pos = etiqueta.lastIndex;
  }
  return true;
}

function inseguro(valor: string): boolean {
  URL_EXTERNA.lastIndex = 0;
  const externa = URL_EXTERNA.test(valor);
  URL_EXTERNA.lastIndex = 0;
  return PELIGROSO.test(valor) || externa || /<\s*script/i.test(valor);
}
