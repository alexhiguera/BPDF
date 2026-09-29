import { ACCEPT } from "@/documents/detect";
import { readDocument } from "@/documents/read";
import type { Platform } from "./types";

/**
 * Plataforma web: solo APIs estándar del navegador. Los ficheros se leen en
 * memoria con `Blob.arrayBuffer()` y no salen del dispositivo: no hay subida,
 * ni `fetch`, ni URL de objeto (`blob:`).
 *
 * `doc` se inyecta para poder probarla en jsdom.
 */
export function createWebPlatform(doc: Document = document): Platform {
  return {
    async pickDocument() {
      const file = await pickFile(doc);
      return file ? readDocument(file) : null;
    },
    openDroppedFile: (file) => readDocument(file),
  };
}

/**
 * El selector estándar: un `<input type="file">` creado al vuelo, fuera del
 * DOM y del árbol de accesibilidad. El control accesible es el botón que llama
 * a esta función (`click()` necesita ese gesto del usuario).
 *
 * Cancelar resuelve `null` con el evento `cancel` (Chrome 113, Firefox 91,
 * Safari 16.4: los navegadores mínimos de `build.target`) o con un `change`
 * sin ficheros. Si un navegador no avisara, la promesa quedaría pendiente sin
 * efecto alguno: nadie espera por ella para desbloquear nada, y se libera con
 * el `<input>`.
 */
function pickFile(doc: Document): Promise<File | null> {
  return new Promise((resolve) => {
    const input = doc.createElement("input");
    input.type = "file";
    input.accept = ACCEPT;
    input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}
