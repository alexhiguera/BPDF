import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";
import { crearPdfGrande } from "../../tests/fixtures/pdf/modo-oscuro/generar.mjs";

/**
 * Benchmark reproducible del spike (docs/PDF_DARK_MODE_SPIKE.md §8). Usa el
 * botón «Medir» del laboratorio (render + transformación selectiva a escalas 1,
 * 2 y 4) y lo imprime como tabla. `npm run bench:pdf`.
 *
 * Con DPR 1 (el de Playwright), escala 2 ≈ escala 1 en una pantalla HiDPI de
 * DPR 2, y escala 4 ≈ zoom 200 % en esa misma pantalla: lo que cuenta es el
 * número de píxeles del lienzo.
 */

const t = messages.pdfSpike;
const FIXTURE = "tests/fixtures/pdf/modo-oscuro/modo-oscuro.pdf";

async function abrirDocumento(page: Page, nombre: string, buffer: Buffer): Promise<number> {
  await page.goto("/spike.html");
  const inicio = Date.now();
  await page
    .getByLabel(t.file)
    .setInputFiles({ name: nombre, mimeType: "application/pdf", buffer });
  await expect(page.getByTestId("lienzo")).toHaveAttribute("data-estado", "listo", {
    timeout: 120_000,
  });
  return Date.now() - inicio;
}

async function medir(page: Page, pagina: number) {
  await page.getByRole("spinbutton", { name: t.page }).fill(String(pagina));
  await expect(page.getByTestId("lienzo")).toHaveAttribute("data-estado", "listo");
  await page.getByRole("button", { name: t.benchmark }).click();
  // La tabla de ESTA página (la anterior sigue visible hasta que llega la nueva).
  const tabla = page.locator(`[data-testid="medicion"][data-pagina="${pagina}"]`);
  await expect(tabla).toBeVisible({ timeout: 120_000 });
  const filas = await tabla
    .locator("tbody tr")
    .evaluateAll((trs) =>
      trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent ?? "")),
    );
  await page.getByRole("button", { name: t.benchmark }).waitFor();
  return filas;
}

test("benchmark del modo oscuro selectivo", async ({ page }) => {
  const resultados: Record<string, string>[] = [];
  const cabeceras = Object.values(t.benchmarkColumns);

  const msFixture = await abrirDocumento(page, "modo-oscuro.pdf", readFileSync(FIXTURE));
  const estado = await page.getByTestId("estado").textContent();
  console.log(`\nmodo-oscuro.pdf (8 págs.): apertura + primer render ${msFixture} ms · ${estado}`);
  for (const [pagina, nombre] of [
    [1, "pequeña (texto)"],
    [6, "compleja (1500 formas)"],
    [2, "con imágenes"],
    [4, "mixta"],
  ] as const) {
    for (const fila of await medir(page, pagina)) {
      resultados.push({
        página: `${pagina} ${nombre}`,
        ...Object.fromEntries(cabeceras.map((c, i) => [c, fila[i] ?? ""])),
      });
    }
  }

  const grande = crearPdfGrande(300);
  const msGrande = await abrirDocumento(page, "grande.pdf", grande);
  const estadoGrande = await page.getByTestId("estado").textContent();
  console.log(
    `grande.pdf (300 págs., ${(grande.length / 1024).toFixed(0)} KiB): apertura + primer render ${msGrande} ms · ${estadoGrande}`,
  );
  for (const fila of await medir(page, 150)) {
    resultados.push({
      página: "150 de 300 (mixta)",
      ...Object.fromEntries(cabeceras.map((c, i) => [c, fila[i] ?? ""])),
    });
  }
  console.table(resultados);
});
