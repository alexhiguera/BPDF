/**
 * Fixtures de recursos locales de Markdown (Fase 7 bis). Todo generado aquí,
 * sin imágenes de terceros:
 *
 *   node tests/fixtures/markdown/recursos/generar.mjs
 *
 * - PNG: codificados por este script (zlib de Node), de tamaños distintos para
 *   poder comprobar en el navegador cuál se pintó (`naturalWidth`).
 * - JPEG y WebP: los codifica el Chromium de Playwright desde un lienzo (Node
 *   no trae codificadores). Su salida depende de la versión de Chromium, así
 *   que no hay test de identidad byte a byte: se versionan tal cual.
 * - GIF: el 1×1 de 43 bytes de toda la vida, escrito a mano.
 * - SVG: uno normal y uno hostil (script, `onload`, imagen externa,
 *   `foreignObject`). Si algo se ejecutara, escribiría en `window.__bpdfXss`.
 *
 * Estructura (ver tests/fixtures/README.md):
 *
 *   markdown/
 *   ├── fuera-de-recursos.png      ← existe en disco pero FUERA de la carpeta
 *   ├── recursos/                  ← la carpeta que se abre
 *   │   ├── documento.md
 *   │   ├── imagen.png · logo.svg · malicioso.svg · pixel.gif · foto grande.png
 *   │   ├── año ñandú 🙂.png · no-usada.png
 *   │   └── images/ foto.jpg · diagrama.png · dibujo.webp
 *   └── recursos-varios/           ← carpeta con dos Markdown
 *       ├── a.md · b.md · img.png
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const MARKDOWN = path.dirname(AQUI);

// --- PNG ---------------------------------------------------------------

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function trozo(tipo, datos) {
  const cab = Buffer.alloc(8);
  cab.writeUInt32BE(datos.length, 0);
  cab.write(tipo, 4, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(tipo, "ascii"), datos])), 0);
  return Buffer.concat([cab, datos, crc]);
}

/** PNG RGB de `ancho`×`alto`: franjas horizontales de los colores dados. */
export function png(ancho, alto, colores) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 2; // RGB
  const filas = [];
  for (let y = 0; y < alto; y++) {
    const [r, g, b] = colores[Math.floor((y * colores.length) / alto)];
    const fila = Buffer.alloc(1 + ancho * 3); // filtro 0
    for (let x = 0; x < ancho; x++) fila.set([r, g, b], 1 + x * 3);
    filas.push(fila);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo("IHDR", ihdr),
    trozo("IDAT", deflateSync(Buffer.concat(filas))),
    trozo("IEND", Buffer.alloc(0)),
  ]);
}

// --- Resto ---------------------------------------------------------------

const GIF_1X1 = Buffer.from(
  "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==",
  "base64",
);

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40" viewBox="0 0 120 40">
  <rect width="120" height="40" rx="8" fill="#10a37f"/>
  <text x="60" y="26" font-family="sans-serif" font-size="18" text-anchor="middle" fill="#fff">BPDF</text>
</svg>
`;

const MALICIOSO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="90" height="30" onload="window.__bpdfXss='svg-onload'">
  <script>window.__bpdfXss = "svg-script"; fetch("https://tracker.example/svg");</script>
  <image href="https://tracker.example/pixel-svg.png" width="10" height="10"/>
  <foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml"><img src="https://tracker.example/fo.png"/></div></foreignObject>
  <rect width="90" height="30" fill="#b45309"/>
</svg>
`;

const DOCUMENTO = `# Documento con recursos

Una imagen junto al documento, con y sin \`./\`:

![Imagen](./imagen.png)

![Imagen otra vez](imagen.png)

Un SVG (se muestra como imagen, nunca en línea):

![Logo](./logo.svg)

De un subdirectorio:

![Foto](./images/foto.jpg)

![Diagrama](images/diagrama.png)

![Dibujo WebP](images/dibujo.webp)

Un GIF:

![Píxel](pixel.gif)

Con espacios y Unicode:

![Foto grande](foto%20grande.png)

![Año](<año ñandú 🙂.png>)

## Lo que no debe verse

![No existe](./no-existe.png)

![Fuera de la carpeta](../fuera-de-recursos.png)

![Fuera, codificado](%2e%2e/fuera-de-recursos.png)

![Remota](https://tracker.example/remota.png)

![SVG hostil](malicioso.svg)

Un enlace a otro Markdown: [el otro](../basico.md).
`;

function escribir(ruta, datos) {
  mkdirSync(path.dirname(ruta), { recursive: true });
  writeFileSync(ruta, datos);
}

/** JPEG y WebP con el Chromium de Playwright (Node no trae codificadores). */
async function conChromium() {
  const { chromium } = await import("@playwright/test");
  const navegador = await chromium.launch();
  try {
    const pagina = await navegador.newPage();
    const codificar = (ancho, alto, color, tipo) =>
      pagina.evaluate(
        async ({ ancho, alto, color, tipo }) => {
          const c = new OffscreenCanvas(ancho, alto);
          const g = c.getContext("2d");
          g.fillStyle = color;
          g.fillRect(0, 0, ancho, alto);
          g.fillStyle = "#ffffff";
          g.fillRect(ancho / 4, alto / 4, ancho / 2, alto / 2);
          const blob = await c.convertToBlob({ type: tipo, quality: 0.8 });
          return Array.from(new Uint8Array(await blob.arrayBuffer()));
        },
        { ancho, alto, color, tipo },
      );
    return {
      jpg: Buffer.from(await codificar(80, 60, "#1d4ed8", "image/jpeg")),
      webp: Buffer.from(await codificar(70, 50, "#7c3aed", "image/webp")),
    };
  } finally {
    await navegador.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = (...p) => path.join(AQUI, ...p);
  escribir(r("documento.md"), DOCUMENTO);
  escribir(
    r("imagen.png"),
    png(64, 48, [
      [220, 38, 38],
      [250, 204, 21],
    ]),
  );
  escribir(r("logo.svg"), LOGO_SVG);
  escribir(r("malicioso.svg"), MALICIOSO_SVG);
  escribir(r("pixel.gif"), GIF_1X1);
  escribir(r("foto grande.png"), png(40, 30, [[22, 163, 74]]));
  escribir(r("año ñandú 🙂.png"), png(36, 36, [[236, 72, 153]]));
  escribir(r("no-usada.png"), png(20, 20, [[0, 0, 0]]));
  escribir(
    r("images", "diagrama.png"),
    png(96, 32, [
      [14, 165, 233],
      [255, 255, 255],
    ]),
  );
  const { jpg, webp } = await conChromium();
  escribir(r("images", "foto.jpg"), jpg);
  escribir(r("images", "dibujo.webp"), webp);
  // Existe en disco, al lado de la carpeta, pero NO dentro de ella.
  escribir(path.join(MARKDOWN, "fuera-de-recursos.png"), png(50, 50, [[255, 0, 255]]));
  // Carpeta con dos Markdown: el usuario elige.
  const v = (...p) => path.join(MARKDOWN, "recursos-varios", ...p);
  escribir(v("a.md"), "# Documento A\n\n![Img](img.png)\n");
  escribir(v("b.md"), "# Documento B\n\n![Img](./img.png)\n");
  escribir(v("img.png"), png(30, 20, [[234, 88, 12]]));
  console.log("Fixtures de recursos generados.");
}
