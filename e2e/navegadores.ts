import { test } from "@playwright/test";

/**
 * Tests que solo tienen sentido en Chromium (Fase 13, compatibilidad): lo que miden
 * depende de algo que solo da ese motor o que Playwright solo controla ahí. Se saltan
 * en Firefox y WebKit **con su motivo**, que sale en el informe: nunca en silencio.
 * Se llaman al principio del test, con su `browserName`.
 */
export function soloChromium(navegador: string, motivo: string) {
  test.skip(navegador !== "chromium", motivo);
}

/** Lo mismo para un navegador concreto que no puede ejecutar el test. */
export function exceptoEn(navegador: string, excluido: "firefox" | "webkit", motivo: string) {
  test.skip(navegador === excluido, motivo);
}
