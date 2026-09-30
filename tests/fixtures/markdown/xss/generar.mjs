/**
 * Corpus de XSS de Markdown (docs/SEGURIDAD.md §3.3): un caso por fichero.
 * Generado por script porque algunos casos llevan tabuladores y caracteres de
 * control que un editor limpiaría sin avisar. Si algo se ejecutara, escribiría
 * en `window.__bpdfXss`.
 *
 *   node tests/fixtures/markdown/xss/generar.mjs
 *
 * `tests/components/markdown/xss.test.tsx` comprueba que los ficheros
 * versionados son exactamente estos. Un caso nuevo: añadirlo aquí y regenerar.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const M = "window.__bpdfXss";

export const CASOS = {
  "html-script.md": `# Script en línea\n\n<script>${M} = "script";</script>\n\nTexto después del script.\n`,
  "html-img-onerror.md": `# Imagen con onerror\n\n<img src="x" onerror="${M} = 'img'">\n\nEn línea: <img src=x onerror=${M}='img2'> fin.\n`,
  "html-svg-onload.md": `# SVG con onload\n\n<svg onload="${M} = 'svg'"><circle r="10"/></svg>\n`,
  "html-iframe.md": `# Iframes\n\n<iframe src="https://tracker.example/espia"></iframe>\n\n<iframe srcdoc="<script>parent.${M}='srcdoc'</script>"></iframe>\n`,
  "html-object-embed.md": `# Object y embed\n\n<object data="https://tracker.example/x.swf"></object>\n\n<embed src="https://tracker.example/x.swf">\n`,
  "html-a-javascript.md": `# Enlace HTML con javascript:\n\n<a href="javascript:${M}='a'">pulsa</a>\n`,
  "html-details-ontoggle.md": `# details con ontoggle\n\n<details open ontoggle="${M}='details'"><summary>x</summary>y</details>\n`,
  "html-estilos.md": `# Estilos inyectados\n\n<style>body { display: none !important; }</style>\n\n<div style="position:fixed;inset:0;background:red">tapa la app</div>\n\n<link rel="stylesheet" href="https://tracker.example/estilo.css">\n\n<base href="https://tracker.example/">\n\n<meta http-equiv="refresh" content="0;url=https://tracker.example/">\n\n<form action="https://tracker.example/"><input name="q"><button>enviar</button></form>\n`,
  "enlace-javascript.md": `# Enlace javascript:\n\n[pulsa](javascript:${M}='enlace')\n\n[con título](javascript:alert(1) "título")\n`,
  "enlace-mayusculas.md": `# Mayúsculas\n\n[a](JAVASCRIPT:alert(1))\n\n[b](JaVaScRiPt:alert(1))\n`,
  "enlace-entidades.md": `# Entidades y escapes\n\n[a](jav&#x61;script:alert(1))\n\n[b](java&#x73;cript:alert(1))\n\n[c](&#106;avascript:alert(1))\n\n[d](javascript&#58;alert(1))\n\n[e](%6Aavascript:alert(1))\n\n[f](javascript\\:alert(1))\n`,
  "enlace-control.md": `# Tabuladores, saltos y controles\n\n[a](<java\tscript:alert(1)>)\n\n[b](<\u0001javascript:alert(1)>)\n\n[c]( javascript:alert(1))\n\n[d](<java\u00a0script:alert(1)>)\n`,
  "enlace-data.md": `# data:\n\n[a](data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==)\n\n[b](<data:text/html,<script>alert(1)</script>>)\n`,
  "enlace-otros-protocolos.md": `# Otros protocolos\n\n[a](vbscript:msgbox(1))\n\n[b](file:///etc/passwd)\n\n[c](ftp://tracker.example/x)\n\n[d](blob:https://tracker.example/x)\n\n[e](intent://x#Intent;end)\n\n[f](https://usuario:clave@tracker.example/)\n`,
  "enlace-rutas.md": `# Rutas que no son relativas\n\n[a](//tracker.example/x)\n\n[b](/etc/passwd)\n\n[c](\\\\\\\\servidor\\\\x)\n\n[d](C:\\\\Windows\\\\x.md)\n`,
  "autolink-javascript.md": `# Autolink\n\n<javascript:alert(1)>\n\n<JAVASCRIPT:alert(1)>\n\n<data:text/html,x>\n`,
  "referencia-javascript.md": `# Definición de referencia\n\n[pulsa][r] y [otra][s]\n\n[r]: javascript:alert(1)\n[s]: <java\tscript:alert(1)> "t"\n`,
  "imagen-javascript.md": `# Imagen javascript:\n\n![x](javascript:alert(1))\n`,
  "imagen-remota.md": `# Imagen remota\n\n![pixel espía](https://tracker.example/p.gif)\n\n![](http://tracker.example/q.gif)\n\n[![enlazada](https://tracker.example/r.gif)](https://tracker.example/)\n`,
  "imagen-rutas.md": `# Rutas de imagen\n\n![padre](../../x.png)\n\n![absoluta](/etc/x.png)\n\n![windows](C:\\\\x.png)\n\n![svg local](./dibujo.svg)\n`,
  "imagen-data.md": `# Imagen data:\n\n![x](data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIi8+)\n\n![y](data:image/png;base64,iVBORw0KGgo=)\n`,
  "encabezados-clobbering.md": `# location\n\n## \\_\\_proto\\_\\_\n\n### contenido\n\n#### titulo-documento\n\n##### constructor\n\n[a location](#location)\n`,
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  for (const [nombre, texto] of Object.entries(CASOS)) {
    writeFileSync(path.join(dir, nombre), texto);
  }
  console.log(`${Object.keys(CASOS).length} casos escritos en ${dir}`);
}
