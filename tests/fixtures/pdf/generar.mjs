/**
 * Genera `minimo.pdf`: un PDF 1.4 válido de una página con una línea de texto
 * en Helvetica (una de las 14 fuentes estándar, sin fuente incrustada). Se
 * escribe a mano, objeto a objeto, para que su contenido sea evidente y su
 * procedencia no ofrezca dudas; la tabla `xref` se calcula con los
 * desplazamientos reales.
 *
 * Uso: node tests/fixtures/pdf/generar.mjs
 *
 * El resultado lleva bytes no ASCII (la segunda línea, como recomienda la
 * especificación, para que se trate como binario) y desplazamientos exactos:
 * por eso `.gitattributes` marca `*.pdf` como binario y git no toca sus
 * finales de línea.
 */
import { writeFileSync } from "node:fs";
import path from "node:path";

const texto = "BPDF: PDF de prueba";
const contenido = `BT /F1 18 Tf 24 60 Td (${texto}) Tj ET`;

const objetos = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 150] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  `<< /Length ${contenido.length} >>\nstream\n${contenido}\nendstream`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
];

const partes = [Buffer.from("%PDF-1.4\n"), Buffer.from([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])];
let desplazamiento = partes.reduce((n, b) => n + b.length, 0);
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
  `<< /Size ${objetos.length + 1} /Root 1 0 R >>`,
  "startxref",
  String(desplazamiento),
  "%%EOF",
  "",
].join("\n");
partes.push(Buffer.from(xref, "latin1"));

const destino = path.join(import.meta.dirname, "minimo.pdf");
writeFileSync(destino, Buffer.concat(partes));
console.log(`${destino}: ${Buffer.concat(partes).length} bytes`);
