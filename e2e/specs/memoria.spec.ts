import { type CDPSession, expect, type Page, test } from "@playwright/test";
import { messages } from "../../src/i18n/messages";
import { abrir, type Vigilancia } from "../vigilancia";

/**
 * Ciclo de vida de los documentos (Fase 9): al cambiar de documento, el anterior
 * se libera. Se cuenta con CDP (`Runtime.queryObjects`, tras recolectar) cuántos
 * elementos de un tipo siguen vivos en el montón, frente a los que hay en la
 * página. Solo Chromium.
 *
 * Sin la traza de Playwright en este fichero: su grabador de instantáneas guarda
 * referencias a los nodos que fotografía y retendría él mismo lo que aquí se
 * cuenta (medido: 301 tablas vivas con traza, 1 sin ella).
 */
test.use({ trace: "off" });

const t = messages.markdown;

function limpia(v: Vigilancia) {
  expect(v.errores).toEqual([]);
  expect(v.violaciones).toEqual([]);
  expect(v.externas).toEqual([]);
}

async function elegir(page: Page, nombre: string, contenido: string) {
  const [selector] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: messages.open.button }).first().click(),
  ]);
  await selector.setFiles({ name: nombre, mimeType: "", buffer: Buffer.from(contenido) });
}

async function vivas(cdp: CDPSession, prototipo: string) {
  await cdp.send("HeapProfiler.collectGarbage");
  await cdp.send("HeapProfiler.collectGarbage");
  const { result } = (await cdp.send("Runtime.evaluate", {
    expression: `${prototipo}.prototype`,
  })) as { result: { objectId: string } };
  const { objects } = (await cdp.send("Runtime.queryObjects", {
    prototypeObjectId: result.objectId,
  })) as { objects: { objectId: string } };
  const { result: n } = (await cdp.send("Runtime.callFunctionOn", {
    objectId: objects.objectId,
    functionDeclaration: "function () { return this.length; }",
    returnByValue: true,
  })) as { result: { value: number } };
  return n.value;
}

test("cambiar de documento desde dividido libera el anterior: ninguna tabla suya sigue viva", async ({
  page,
}) => {
  // CodeMirror guarda su último Range de medida en una variable de módulo; cuando el
  // ShadowRoot del editor colgaba del árbol de React, ese Range retenía toda la
  // vista previa desmontada (EditorMarkdown.tsx).
  const v = await abrir(page);
  let doc = "# Grande\n\n";
  for (let i = 0; i < 300; i++)
    doc += `## Sección ${i}\n\nTexto ${i}.\n\n| a | b |\n|---|---|\n| ${i} | x |\n\n`;
  await elegir(page, "grande.md", doc);
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText("grande.md");
  await page.getByRole("button", { name: t.mode.dividido, exact: true }).click();
  const editor = page.getByRole("textbox", { name: t.editor.label });
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.type(" cambio");
  const articulo = page.getByRole("article");
  await expect(articulo.locator("table")).toHaveCount(300);

  await elegir(page, "otro.md", "# Otro\n\n| a |\n|---|\n| 1 |\n");
  await page
    .getByRole("dialog", { name: messages.discard.title })
    .getByRole("button", { name: messages.discard.confirm })
    .click();
  await expect(page.getByRole("heading", { level: 1 }).first()).toHaveText("otro.md");
  await expect(articulo.locator("table")).toHaveCount(1);
  const cdp = await page.context().newCDPSession(page);
  expect(await vivas(cdp, "HTMLTableElement")).toBe(1);
  limpia(v);
});
