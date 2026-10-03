/**
 * Generador de los PDF del visor (Fase 5). Se escriben objeto a objeto, sin
 * dependencias, para que su contenido sea evidente y reproducible. Todo es obra
 * de BPDF (Apache-2.0).
 *
 *   node tests/fixtures/pdf/visor/generar.mjs → visor.pdf, protegido.pdf, sin-texto.pdf,
 *                                              cjk.pdf, busqueda.pdf
 *
 * - `visor.pdf` (5 páginas): enlaces internos (destino explícito, destino con
 *   nombre y acción «página siguiente»), un enlace externo `https:`, enlaces
 *   hostiles que el visor debe ignorar (`javascript:`, `file:`, acción
 *   JavaScript), texto con acentos para la búsqueda, una página apaisada y una
 *   con `/Rotate 90`. `VISOR` dice dónde está cada cosa.
 * - `protegido.pdf`: cifrado (RC4 de 40 bits, revisión 2) con contraseña de
 *   apertura «bpdf»; pdf.js pide contraseña y BPDF la pide al usuario (Fase 6).
 *   `crearPdfProtegido("")` da la variante con solo contraseña de permisos
 *   (propietario), que se abre sin pedir nada; los tests la generan en memoria.
 * - `sin-texto.pdf`: dos páginas de solo dibujo, como un escaneo sin OCR.
 * - `cjk.pdf`: texto japonés con una fuente CID NO incrustada (Adobe-Japan1). pdf.js
 *   necesita pedir al propio origen sus cmaps (`/pdfjs/cmaps/`) para leerlo: con la CSP
 *   de producción eso exige `connect-src 'self'` (docs/SEGURIDAD.md §2.1).
 * - `busqueda.pdf` (Fase 6): mayúsculas y minúsculas de la misma palabra, una
 *   palabra dentro de otra y una palabra partida con guion al final de línea.
 *   `BUSQUEDA` dice cuántas veces aparece cada cosa.
 * - `crearPdfFormulario()` (Fase 12, solo en memoria): campos AcroForm con su
 *   apariencia y JavaScript al abrir y en los campos. `FORMULARIO` dice dónde.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";

export const VISOR = {
  paginas: 5,
  /** Rectángulos de los enlaces de la página 1, en puntos PDF [x1 y1 x2 y2]. */
  enlaces: {
    capitulo3: [72, 700, 300, 724],
    anexo: [72, 660, 300, 684],
    externo: [72, 620, 300, 644],
    siguiente: [72, 580, 300, 604],
    javascript: [72, 540, 300, 564],
    fichero: [72, 500, 300, 524],
    accionJs: [72, 460, 300, 484],
  },
  urlExterna: "https://example.com/bpdf",
  /** «búsqueda» aparece 3 veces en la página 2 y 1 en la 5. */
  busqueda: { palabra: "búsqueda", total: 4, paginas: [2, 2, 2, 5] },
  /** Frase partida entre dos líneas de la página 2. */
  frasePartida: "frase partida",
  apaisada: 3,
  girada: 4,
};

const escapar = (s) => s.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
const texto = (x, y, tamano, s) =>
  `BT /F1 ${tamano} Tf 0 0 0 rg ${x} ${y} Td (${escapar(s)}) Tj ET`;

/** Escribe un PDF con los objetos dados (cuerpos sin `obj`/`endobj`). */
export function escribirPdf(objetos, trailerExtra = "") {
  const partes = [Buffer.from("%PDF-1.5\n"), Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])];
  let desplazamiento = partes.reduce((s, b) => s + b.length, 0);
  const offsets = [];
  objetos.forEach((cuerpo, i) => {
    offsets.push(desplazamiento);
    const b = Buffer.from(`${i + 1} 0 obj\n${cuerpo}\nendobj\n`, "latin1");
    partes.push(b);
    desplazamiento += b.length;
  });
  const xref = [
    "xref",
    `0 ${objetos.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objetos.length + 1} /Root 1 0 R ${trailerExtra}>>`,
    "startxref",
    String(desplazamiento),
    "%%EOF",
    "",
  ].join("\n");
  partes.push(Buffer.from(xref, "latin1"));
  return Buffer.concat(partes);
}

const flujo = (contenido) =>
  `<< /Length ${Buffer.byteLength(contenido, "latin1")} >>\nstream\n${contenido}\nendstream`;

/**
 * Páginas: objetos 3.. (página, contenido) por página; después las
 * anotaciones. 1 catálogo, 2 árbol de páginas, último: la fuente.
 */
export function crearPdfVisor() {
  const E = VISOR.enlaces;
  const pagina = (n) => 3 + (n - 1) * 2; // id del objeto página n
  const paginas = [
    {
      contenido: [
        texto(72, 780, 24, "Manual de prueba del visor"),
        texto(76, 706, 14, "Ir al capitulo 3"),
        texto(76, 666, 14, "Ir al anexo"),
        texto(76, 626, 14, "Enlace externo"),
        texto(76, 586, 14, "Pagina siguiente"),
        texto(76, 546, 14, "Enlace javascript (ignorado)"),
        texto(76, 506, 14, "Enlace a fichero (ignorado)"),
        texto(76, 466, 14, "Accion JavaScript (ignorada)"),
      ].join("\n"),
      anotaciones: [
        `/Rect [${E.capitulo3.join(" ")}] /Dest [${pagina(3)} 0 R /XYZ null null null]`,
        `/Rect [${E.anexo.join(" ")}] /Dest /anexo`,
        `/Rect [${E.externo.join(" ")}] /A << /S /URI /URI (${VISOR.urlExterna}) >>`,
        `/Rect [${E.siguiente.join(" ")}] /A << /S /Named /N /NextPage >>`,
        `/Rect [${E.javascript.join(" ")}] /A << /S /URI /URI (javascript:alert\\(1\\)) >>`,
        `/Rect [${E.fichero.join(" ")}] /A << /S /URI /URI (file:///etc/passwd) >>`,
        `/Rect [${E.accionJs.join(" ")}] /A << /S /JavaScript /JS (app.alert\\(1\\)) >>`,
      ],
    },
    {
      contenido: [
        texto(72, 780, 20, "La canción del búho"),
        texto(72, 740, 12, "Primera búsqueda del documento."),
        texto(72, 720, 12, "Segunda BÚSQUEDA, en mayúsculas."),
        texto(72, 700, 12, "Tercera busqueda, sin tilde."),
        texto(72, 660, 12, "Esta es una frase"),
        texto(72, 645, 12, "partida entre dos lineas."),
      ].join("\n"),
    },
    { contenido: texto(72, 520, 28, "Capitulo 3 (pagina apaisada)"), caja: [0, 0, 842, 595] },
    { contenido: texto(72, 780, 20, "Pagina girada 90 grados"), extra: "/Rotate 90" },
    { contenido: [texto(72, 780, 20, "Anexo"), texto(72, 740, 12, "Ultima búsqueda.")].join("\n") },
  ];
  const nPaginas = paginas.length;
  const idAnotacion0 = 3 + nPaginas * 2;
  const anotaciones = paginas.flatMap((p) => p.anotaciones ?? []);
  const idFuente = idAnotacion0 + anotaciones.length;

  const objetos = [
    `<< /Type /Catalog /Pages 2 0 R /Dests << /anexo [${pagina(5)} 0 R /Fit] >> >>`,
    `<< /Type /Pages /Kids [${paginas.map((_, i) => `${pagina(i + 1)} 0 R`).join(" ")}] /Count ${nPaginas} >>`,
  ];
  let a = idAnotacion0;
  for (const [i, p] of paginas.entries()) {
    const annots = (p.anotaciones ?? []).map(() => `${a++} 0 R`);
    objetos.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [${(p.caja ?? [0, 0, 595, 842]).join(" ")}] ${p.extra ?? ""} /Contents ${pagina(i + 1) + 1} 0 R /Resources << /Font << /F1 ${idFuente} 0 R >> >>${annots.length ? ` /Annots [${annots.join(" ")}]` : ""} >>`,
    );
    objetos.push(flujo(p.contenido));
  }
  for (const anotacion of anotaciones) {
    objetos.push(`<< /Type /Annot /Subtype /Link /Border [0 0 0] ${anotacion} >>`);
  }
  objetos.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  return escribirPdf(objetos);
}

/** Búsqueda avanzada (Fase 6): una página, cada caso en su línea. */
export const BUSQUEDA = {
  lineas: [
    "Rosa, rosa y ROSA en el Rosal.",
    "Una pala-",
    "bra partida por guion al final de linea.",
  ],
  /** «rosa» sin opciones: Rosa, rosa, ROSA y la de «Rosal». */
  rosa: { todas: 4, mayusculas: 1, palabra: 3 },
  partida: "palabra",
};
export function crearPdfBusqueda() {
  const contenido = BUSQUEDA.lineas.map((l, i) => texto(72, 760 - i * 24, 14, l)).join("\n");
  return escribirPdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    flujo(contenido),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ]);
}

/** Dos páginas de solo dibujo (sin texto): lo que ve BPDF de un escaneo sin OCR. */
export function crearPdfSinTexto() {
  const dibujo = "0.8 0.8 0.8 rg 72 600 450 150 re f 0.2 0.2 0.2 rg 72 400 300 20 re f";
  return escribirPdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R >>",
    flujo(dibujo),
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 6 0 R >>",
    flujo(dibujo),
  ]);
}

/** «日本語» (UCS-2) con una fuente CID japonesa no incrustada, y una línea latina. */
export const CJK = { texto: "日本語", latino: "Latin Helvetica" };
export function crearPdfCjk() {
  const contenido =
    "BT /F1 36 Tf 72 700 Td <65E5672C8A9E> Tj ET\nBT /F2 24 Tf 72 600 Td (Latin Helvetica) Tj ET";
  return escribirPdf([
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 7 0 R >> >> >>",
    flujo(contenido),
    "<< /Type /Font /Subtype /Type0 /BaseFont /KozMinPr6N-Regular /Encoding /UniJIS-UCS2-H /DescendantFonts [6 0 R] >>",
    "<< /Type /Font /Subtype /CIDFontType0 /BaseFont /KozMinPr6N-Regular /CIDSystemInfo << /Registry (Adobe) /Ordering (Japan1) /Supplement 6 >> /FontDescriptor 8 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Type /FontDescriptor /FontName /KozMinPr6N-Regular /Flags 6 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 880 /Descent -120 /CapHeight 700 /StemV 80 >>",
  ]);
}

/**
 * Formulario AcroForm (Fase 12, D14: se ve, no se rellena). Un campo de texto con
 * valor y una casilla marcada, los dos con su apariencia (un bloque relleno, fácil
 * de encontrar en los píxeles), y JavaScript en todas partes: al abrir el
 * documento (`/OpenAction`) y en las acciones del campo (pulsación y formato).
 * Solo en memoria (`crearPdfFormulario()`); no se escribe en disco.
 */
export const FORMULARIO = {
  /** Rectángulos en puntos PDF [x1 y1 x2 y2]. */
  campo: [72, 600, 372, 640],
  casilla: [72, 540, 102, 570],
  /** Un punto de la página sin nada pintado. */
  vacio: [450, 300],
  valor: "valor-del-campo",
};
export function crearPdfFormulario() {
  const F = FORMULARIO;
  const apariencia = (ancho, alto, contenido) =>
    `<< /Type /XObject /Subtype /Form /BBox [0 0 ${ancho} ${alto}] /Length ${Buffer.byteLength(contenido, "latin1")} >>\nstream\n${contenido}\nendstream`;
  const js = (codigo) => `<< /S /JavaScript /JS (${escapar(codigo)}) >>`;
  const [cx1, cy1, cx2, cy2] = F.campo;
  const [kx1, ky1, kx2, ky2] = F.casilla;
  return escribirPdf([
    "<< /Type /Catalog /Pages 2 0 R /AcroForm << /Fields [5 0 R 6 0 R] >> /OpenAction 9 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 10 0 R >> >> /Annots [5 0 R 6 0 R] >>",
    flujo(texto(72, 780, 20, "Formulario de prueba")),
    `<< /Type /Annot /Subtype /Widget /FT /Tx /T (nombre) /V (${F.valor}) /Rect [${F.campo.join(" ")}] /F 4 /P 3 0 R /AP << /N 7 0 R >> /AA << /K ${js("app.alert(1)")} /F ${js("app.alert(2)")} >> >>`,
    `<< /Type /Annot /Subtype /Widget /FT /Btn /T (acepto) /V /Si /AS /Si /Rect [${F.casilla.join(" ")}] /F 4 /P 3 0 R /AP << /N << /Si 8 0 R /Off 11 0 R >> >> >>`,
    apariencia(cx2 - cx1, cy2 - cy1, `0 0 0 rg 0 0 ${cx2 - cx1} ${cy2 - cy1} re f`),
    apariencia(kx2 - kx1, ky2 - ky1, `0 0 0 rg 0 0 ${kx2 - kx1} ${ky2 - ky1} re f`),
    js("app.alert(3)"),
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    apariencia(kx2 - kx1, ky2 - ky1, ""),
  ]);
}

// ── Cifrado estándar, revisión 2 (ISO 32000-1 §7.6.3, algoritmos 2, 3 y 4) ──

const RELLENO = Buffer.from(
  "28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a",
  "hex",
);
const rellenar = (clave) => Buffer.concat([Buffer.from(clave, "latin1"), RELLENO]).subarray(0, 32);
const md5 = (...partes) => createHash("md5").update(Buffer.concat(partes)).digest();

function rc4(clave, datos) {
  const s = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 0, j = 0; i < 256; i++) {
    j = (j + s[i] + clave[i % clave.length]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
  }
  const salida = Buffer.alloc(datos.length);
  for (let k = 0, i = 0, j = 0; k < datos.length; k++) {
    i = (i + 1) & 0xff;
    j = (j + s[i]) & 0xff;
    [s[i], s[j]] = [s[j], s[i]];
    salida[k] = datos[k] ^ s[(s[i] + s[j]) & 0xff];
  }
  return salida;
}

/**
 * Un PDF de una página cifrado con contraseña de usuario «bpdf». Con
 * `usuario = ""`, solo tiene contraseña de propietario (permisos): se abre
 * sin pedir nada.
 */
export function crearPdfProtegido(usuario = "bpdf") {
  const [propietario, permisos] = ["propietario-bpdf", -44];
  const id = md5(Buffer.from("bpdf-protegido"));
  const o = rc4(md5(rellenar(propietario)).subarray(0, 5), rellenar(usuario));
  const p = Buffer.alloc(4);
  p.writeInt32LE(permisos);
  const u = rc4(md5(rellenar(usuario), o, p, id).subarray(0, 5), RELLENO);
  return escribirPdf(
    [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>",
      `<< /Filter /Standard /V 1 /R 2 /O <${o.toString("hex")}> /U <${u.toString("hex")}> /P ${permisos} >>`,
    ],
    `/Encrypt 4 0 R /ID [<${id.toString("hex")}> <${id.toString("hex")}>] `,
  );
}

if (process.argv[1]?.endsWith(path.join("visor", "generar.mjs"))) {
  const dir = import.meta.dirname;
  for (const [nombre, pdf] of [
    ["visor.pdf", crearPdfVisor()],
    ["protegido.pdf", crearPdfProtegido()],
    ["sin-texto.pdf", crearPdfSinTexto()],
    ["cjk.pdf", crearPdfCjk()],
    ["busqueda.pdf", crearPdfBusqueda()],
  ]) {
    writeFileSync(path.join(dir, nombre), pdf);
    console.log(`${nombre}: ${pdf.length} bytes`);
  }
}
