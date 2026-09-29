/**
 * Generador de los PDF del spike de modo oscuro (Fase 4, docs/PDF_DARK_MODE_SPIKE.md).
 *
 * Se escriben objeto a objeto, sin dependencias, para que su contenido sea
 * evidente y reproducible: la «fotografía» es una imagen sintética calculada
 * píxel a píxel, con zonas claras y oscuras y una carta de colores de valores
 * exactos (el E2E los muestrea). Todo es obra de BPDF (Apache-2.0).
 *
 *   node tests/fixtures/pdf/modo-oscuro/generar.mjs          → modo-oscuro.pdf
 *   node tests/fixtures/pdf/modo-oscuro/generar.mjs --grande → además grande.pdf
 *                                                             (no se versiona)
 *
 * El módulo exporta `crearPdfModoOscuro()`, `crearPdfGrande(n)` y `GEOMETRIA`
 * para que los tests y el benchmark generen o muestreen sin tocar el disco.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { deflateSync } from "node:zlib";

/** A4 en puntos (1/72 in). Origen abajo a la izquierda, como en PDF. */
export const ANCHO = 595;
export const ALTO = 842;

/** Carta de colores de la fotografía sintética: [nombre, R, G, B]. */
export const CARTA = [
  ["rojo", 220, 40, 40],
  ["verde", 40, 170, 60],
  ["azul", 40, 80, 210],
  ["amarillo", 240, 210, 40],
  ["cian", 40, 190, 210],
  ["magenta", 200, 50, 170],
  ["blanco", 255, 255, 255],
  ["negro", 0, 0, 0],
];

const FOTO = { ancho: 400, alto: 300 };

/**
 * Dónde está cada cosa, en puntos PDF, para muestrear píxeles en el E2E. Cada
 * punto está en el interior de una superficie lisa (lejos de bordes).
 */
export const GEOMETRIA = {
  paginas: 8,
  /** Página 1 (texto): un hueco de fondo blanco y un bloque de «tinta» negra maciza. */
  texto: { pagina: 1, fondo: [520, 60], tinta: [80, 105] },
  /** Página 2 (imagen): centro de cada parche de la carta de colores, en orden de CARTA. */
  imagen: {
    pagina: 2,
    fondo: [520, 60],
    parches: CARTA.map((_, i) => [97 + 10 + i * 48 + 22, 420 + (FOTO.alto - 270)]),
    /** Una nube blanca y una sombra casi negra dentro de la foto: deben conservarse. */
    nube: [97 + 90, 420 + (FOTO.alto - 60)],
    sombra: [97 + 200, 420 + (FOTO.alto - 232)],
  },
  /** Página 3 (gráficos): interiores de barras de color y de un relleno muy claro. */
  /** Página 8 (diapositiva oscura): ya es oscura; no debe invertirse a clara. */
  oscura: { pagina: 8, fondo: [520, 60] },
  graficos: {
    pagina: 3,
    fondo: [520, 60],
    barras: [
      { color: [220, 40, 40], punto: [120, 520] },
      { color: [40, 80, 210], punto: [200, 520] },
      { color: [40, 170, 60], punto: [280, 520] },
      { color: [240, 160, 30], punto: [360, 520] },
    ],
    pastel: { color: [232, 240, 255], punto: [150, 300] },
    lineaNegra: { y: 460, x: [70, 520] },
  },
};

// ── Utilidades de contenido ───────────────────────────────────────────────────

const f = (n) => Number(n.toFixed(3)).toString();
const rgb = ([r, g, b]) => `${f(r / 255)} ${f(g / 255)} ${f(b / 255)}`;
const escapar = (s) => s.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

function texto(x, y, tamano, s, { negrita = false, color = [0, 0, 0] } = {}) {
  return `BT /${negrita ? "F2" : "F1"} ${tamano} Tf ${rgb(color)} rg ${f(x)} ${f(y)} Td (${escapar(s)}) Tj ET`;
}
const relleno = (x, y, w, h, color) => `${rgb(color)} rg ${f(x)} ${f(y)} ${f(w)} ${f(h)} re f`;
const trazo = (x, y, w, h, color, grosor = 1) =>
  `${rgb(color)} RG ${f(grosor)} w ${f(x)} ${f(y)} ${f(w)} ${f(h)} re S`;
const rellenoYTrazo = (x, y, w, h, fondo, borde, grosor = 2) =>
  `${rgb(fondo)} rg ${rgb(borde)} RG ${f(grosor)} w ${f(x)} ${f(y)} ${f(w)} ${f(h)} re B`;
const linea = (x1, y1, x2, y2, color, grosor = 1) =>
  `${rgb(color)} RG ${f(grosor)} w ${f(x1)} ${f(y1)} m ${f(x2)} ${f(y2)} l S`;

/** Círculo con cuatro curvas de Bézier. `op`: f (relleno), S (trazo) o B (ambos). */
function circulo(cx, cy, r, op, { fondo = [0, 0, 0], borde = [0, 0, 0], grosor = 2 } = {}) {
  const k = 0.5523 * r;
  return [
    `${rgb(fondo)} rg ${rgb(borde)} RG ${f(grosor)} w`,
    `${f(cx + r)} ${f(cy)} m`,
    `${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)} c`,
    `${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)} c`,
    `${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)} c`,
    `${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)} c ${op}`,
  ].join(" ");
}

/** Imagen `nombre` de w×h puntos con su esquina inferior izquierda en (x, y), girada `grados`. */
function imagen(nombre, x, y, w, h, grados = 0) {
  const a = (grados * Math.PI) / 180;
  const [c, s] = [Math.cos(a), Math.sin(a)];
  return `q ${f(c * w)} ${f(s * w)} ${f(-s * h)} ${f(c * h)} ${f(x)} ${f(y)} cm /${nombre} Do Q`;
}

// ── Imágenes sintéticas ───────────────────────────────────────────────────────

/** «Fotografía» RGB 400×300: cielo en degradado, sol, nubes blancas, colinas, sombra y carta. */
function fotografia() {
  const { ancho, alto } = FOTO;
  const px = Buffer.alloc(ancho * alto * 3);
  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      let c;
      const t = y / 180;
      c = [120 + 80 * t, 180 + 45 * t, 240 + 10 * t]; // cielo: de azul intenso a claro
      if ((x - 320) ** 2 + (y - 60) ** 2 < 35 ** 2) c = [255, 210, 60]; // sol
      const nube =
        ((x - 90) / 60) ** 2 + ((y - 60) / 22) ** 2 < 1 ||
        ((x - 140) / 45) ** 2 + ((y - 50) / 18) ** 2 < 1;
      if (nube) c = [255, 255, 255];
      const colina = 170 + 18 * Math.sin(x / 45) + 8 * Math.sin(x / 13);
      if (y > colina) c = [60 + 0.2 * (y - colina), 150 - 0.4 * (y - colina), 70];
      if (y >= 222 && y < 245) c = [15, 15, 20]; // sombra casi negra
      if (y >= 250 && y < 290) {
        const i = Math.floor((x - 10) / 48);
        const dentro = x >= 10 && (x - 10) % 48 < 44 && i >= 0 && i < CARTA.length;
        c = dentro ? CARTA[i].slice(1) : [128, 128, 128];
      }
      if (y >= 290) c = [128, 128, 128];
      const o = (y * ancho + x) * 3;
      px[o] = Math.round(c[0]);
      px[o + 1] = Math.round(c[1]);
      px[o + 2] = Math.round(c[2]);
    }
  }
  return { ancho, alto, espacio: "/DeviceRGB", datos: px };
}

/** Página «escaneada» en escala de grises: papel casi blanco con líneas de «texto». */
function escaneo() {
  const [ancho, alto] = [298, 421];
  const px = Buffer.alloc(ancho * alto, 246);
  for (let fila = 0; fila < 34; fila++) {
    const y0 = 40 + fila * 10;
    const largo = 200 + ((fila * 37) % 50);
    for (let y = y0; y < y0 + 4; y++) for (let x = 30; x < 30 + largo; x++) px[y * ancho + x] = 40;
  }
  return { ancho, alto, espacio: "/DeviceGray", datos: px };
}

// ── Páginas ───────────────────────────────────────────────────────────────────

function paginaTexto() {
  const c = [texto(60, 780, 28, "Texto negro sobre fondo blanco", { negrita: true })];
  for (const [i, t] of [8, 10, 12, 14, 18, 22].entries()) {
    c.push(texto(60, 730 - i * 34, t, `Cuerpo ${t} pt: el veloz murcielago hindu comia feliz`));
  }
  c.push(texto(60, 510, 14, "Texto en negrita, mismo cuerpo", { negrita: true }));
  c.push(texto(60, 485, 14, "Texto gris medio (50 %)", { color: [128, 128, 128] }));
  c.push(texto(60, 460, 14, "Texto gris claro (70 %)", { color: [178, 178, 178] }));
  c.push(texto(60, 435, 14, "Titulo en azul marino", { negrita: true, color: [20, 40, 100] }));
  c.push(relleno(50, 330, 495, 80, [242, 242, 242]));
  c.push(texto(60, 380, 12, "Recuadro de fondo ligeramente gris (95 %) con texto negro"));
  c.push(relleno(50, 90, 60, 30, [0, 0, 0])); // bloque de tinta maciza (GEOMETRIA.texto.tinta)
  c.push(texto(120, 100, 12, "<- bloque de tinta negra maciza"));
  return c.join("\n");
}

function paginaImagen() {
  return [
    texto(60, 780, 22, "Fotografia (imagen rasterizada)", { negrita: true }),
    imagen("Im1", 97, 420, FOTO.ancho, FOTO.alto),
    texto(60, 395, 11, "Arriba: nubes blancas, sombra casi negra y carta de colores exactos."),
    texto(60, 370, 11, "Abajo: la misma imagen girada 30 grados y a escala 0,4."),
    imagen("Im1", 200, 120, FOTO.ancho * 0.4, FOTO.alto * 0.4, 30),
  ].join("\n");
}

function paginaGraficos() {
  const c = [texto(60, 780, 22, "Graficos vectoriales", { negrita: true })];
  c.push(linea(70, 470, 70, 720, [0, 0, 0], 1.5)); // eje Y
  c.push(linea(70, 460, 520, 460, [0, 0, 0], 2)); // línea negra (GEOMETRIA.graficos.lineaNegra)
  for (const [i, b] of GEOMETRIA.graficos.barras.entries()) {
    const altura = [180, 120, 220, 90][i];
    c.push(rellenoYTrazo(90 + i * 80, 470, 60, altura, b.color, [0, 0, 0], 1));
  }
  c.push(rellenoYTrazo(90, 250, 120, 100, [232, 240, 255], [120, 150, 200], 1)); // pastel
  c.push(texto(95, 230, 10, "Relleno muy claro"));
  c.push(relleno(240, 250, 120, 100, [255, 243, 205]));
  c.push(texto(245, 230, 10, "Crema muy claro"));
  c.push(circulo(460, 300, 50, "B", { fondo: [120, 60, 180], borde: [0, 0, 0], grosor: 3 }));
  c.push(circulo(460, 300, 20, "f", { fondo: [255, 255, 255] }));
  c.push(circulo(460, 150, 40, "S", { borde: [220, 40, 40], grosor: 4 }));
  for (let i = 0; i < 6; i++)
    c.push(linea(60, 100 + i * 12, 300, 100 + i * 12, [0, 0, 0], 0.5 + i * 0.5));
  c.push(trazo(320, 90, 120, 70, [128, 128, 128], 2));
  return c.join("\n");
}

function paginaMezcla() {
  return [
    texto(60, 780, 24, "Pagina mixta", { negrita: true, color: [20, 40, 100] }),
    texto(60, 750, 12, "Parrafo de texto negro junto a una imagen y un grafico de barras."),
    imagen("Im1", 60, 430, 300, 225),
    texto(80, 610, 16, "Texto blanco sobre la foto", { negrita: true, color: [255, 255, 255] }),
    texto(80, 450, 14, "Texto negro sobre la foto", { negrita: true }),
    rellenoYTrazo(390, 430, 40, 150, [220, 40, 40], [0, 0, 0], 1),
    rellenoYTrazo(440, 430, 40, 90, [40, 80, 210], [0, 0, 0], 1),
    rellenoYTrazo(490, 430, 40, 200, [40, 170, 60], [0, 0, 0], 1),
    linea(380, 430, 540, 430, [0, 0, 0], 1.5),
    texto(60, 390, 12, "Una tabla con filas sombreadas:"),
    ...[0, 1, 2, 3, 4].flatMap((i) => [
      i % 2 ? "" : relleno(60, 340 - i * 22, 470, 22, [235, 235, 235]),
      texto(70, 347 - i * 22, 11, `Fila ${i + 1}    valor ${(i + 1) * 17}    estado correcto`),
    ]),
  ]
    .filter(Boolean)
    .join("\n");
}

function paginaFondos() {
  return [
    relleno(0, 0, ANCHO, ALTO, [255, 248, 220]), // página entera color crema
    texto(60, 780, 22, "Pagina con fondo de color", { negrita: true }),
    texto(60, 750, 12, "Todo el fondo es crema (255, 248, 220), no blanco."),
    relleno(50, 560, 495, 150, [20, 40, 100]),
    texto(70, 660, 16, "Texto blanco sobre caja azul marino", {
      negrita: true,
      color: [255, 255, 255],
    }),
    relleno(50, 360, 495, 150, [240, 240, 240]),
    texto(70, 460, 14, "Texto negro sobre caja gris claro"),
    relleno(50, 160, 495, 150, [255, 220, 220]),
    texto(70, 260, 14, "Texto negro sobre caja rosa palido"),
  ].join("\n");
}

function paginaCompleja() {
  const c = [
    texto(40, 810, 16, "Pagina compleja: 1500 formas y 60 lineas de texto", { negrita: true }),
  ];
  let semilla = 7;
  const azar = () => {
    semilla = (semilla * 1103515245 + 12345) % 2147483648;
    return semilla / 2147483648;
  };
  for (let i = 0; i < 1500; i++) {
    const color = [Math.floor(azar() * 256), Math.floor(azar() * 256), Math.floor(azar() * 256)];
    c.push(relleno(40 + azar() * 500, 420 + azar() * 360, 4 + azar() * 16, 4 + azar() * 16, color));
  }
  for (let i = 0; i < 60; i++)
    c.push(
      texto(
        40,
        400 - i * 6.3,
        5.5,
        `Linea ${i + 1}: texto de relleno pequeno para medir coste de glifos y antialiasing`,
      ),
    );
  return c.join("\n");
}

const paginaEscaneo = () => `q ${ANCHO} 0 0 ${ALTO} 0 0 cm /Im2 Do Q`;

/** Diapositiva de fondo casi negro con texto blanco y formas de color: ya es oscura. */
function paginaDiapositivaOscura() {
  return [
    relleno(0, 0, ANCHO, ALTO, [24, 24, 28]),
    texto(60, 760, 28, "Diapositiva oscura", { negrita: true, color: [255, 255, 255] }),
    texto(60, 720, 14, "Fondo casi negro y texto blanco: no debe volverse clara.", {
      color: [220, 220, 220],
    }),
    relleno(60, 450, 140, 200, [220, 40, 40]),
    relleno(230, 450, 140, 150, [40, 170, 60]),
    relleno(400, 450, 140, 240, [240, 210, 40]),
  ].join("\n");
}

// ── Escritura del PDF ─────────────────────────────────────────────────────────

function flujo(dicc, datos) {
  const comprimido = deflateSync(datos);
  return [
    `<< ${dicc} /Filter /FlateDecode /Length ${comprimido.length} >>\nstream\n`,
    comprimido,
    "\nendstream",
  ];
}

function objetoImagen({ ancho, alto, espacio, datos }) {
  return flujo(
    `/Type /XObject /Subtype /Image /Width ${ancho} /Height ${alto} /ColorSpace ${espacio} /BitsPerComponent 8`,
    datos,
  );
}

/** Ensambla un PDF con las páginas dadas (contenido de cada una) y recursos compartidos. */
function ensamblar(contenidos) {
  // 1 catálogo · 2 páginas · 3-4 fuentes · 5-6 imágenes · después, página y contenido por página.
  const n = contenidos.length;
  const idPagina = (i) => 7 + i * 2;
  const recursos = "<< /Font << /F1 3 0 R /F2 4 0 R >> /XObject << /Im1 5 0 R /Im2 6 0 R >> >>";
  const objetos = [
    ["<< /Type /Catalog /Pages 2 0 R >>"],
    [
      `<< /Type /Pages /Kids [${contenidos.map((_, i) => `${idPagina(i)} 0 R`).join(" ")}] /Count ${n} >>`,
    ],
    ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"],
    ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"],
    objetoImagen(fotografia()),
    objetoImagen(escaneo()),
  ];
  contenidos.forEach((contenido, i) => {
    objetos.push([
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ANCHO} ${ALTO}] /Contents ${idPagina(i) + 1} 0 R /Resources ${recursos} >>`,
    ]);
    objetos.push(flujo("", Buffer.from(contenido, "latin1")));
  });

  const partes = [Buffer.from("%PDF-1.5\n"), Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])];
  let desplazamiento = partes.reduce((s, b) => s + b.length, 0);
  const offsets = [];
  objetos.forEach((trozos, i) => {
    offsets.push(desplazamiento);
    const cuerpo = [`${i + 1} 0 obj\n`, ...trozos, "\nendobj\n"].map((t) =>
      typeof t === "string" ? Buffer.from(t, "latin1") : t,
    );
    for (const b of cuerpo) {
      partes.push(b);
      desplazamiento += b.length;
    }
  });
  const xref = [
    "xref",
    `0 ${objetos.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objetos.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(desplazamiento),
    "%%EOF",
    "",
  ].join("\n");
  partes.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(partes);
}

/** Las 8 páginas del spike, en el orden de GEOMETRIA. */
export function crearPdfModoOscuro() {
  return ensamblar([
    paginaTexto(),
    paginaImagen(),
    paginaGraficos(),
    paginaMezcla(),
    paginaFondos(),
    paginaCompleja(),
    paginaEscaneo(),
    paginaDiapositivaOscura(),
  ]);
}

/** Documento de `paginas` páginas mixtas (comparten la imagen): prueba de escala. */
export function crearPdfGrande(paginas = 300) {
  return ensamblar(Array.from({ length: paginas }, () => paginaMezcla()));
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("generar.mjs")) {
  const dir = import.meta.dirname;
  const pdf = crearPdfModoOscuro();
  writeFileSync(path.join(dir, "modo-oscuro.pdf"), pdf);
  console.log(`modo-oscuro.pdf: ${pdf.length} bytes`);
  if (process.argv.includes("--grande")) {
    const grande = crearPdfGrande();
    writeFileSync(path.join(dir, "grande.pdf"), grande);
    console.log(`grande.pdf: ${grande.length} bytes (no se versiona)`);
  }
}
