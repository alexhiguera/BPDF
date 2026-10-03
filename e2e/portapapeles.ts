import type { BrowserContext } from "@playwright/test";

/** Ruta de la página auxiliar: no existe en la build, la sirve Playwright. */
const RUTA_AUXILIAR = "/__e2e-portapapeles";

/**
 * El portapapeles DEL SISTEMA en los E2E, en los tres navegadores (Fase 13).
 *
 * Desde la app no se puede leer: su `Permissions-Policy` niega `clipboard-read`
 * (Fase 12; BPDF nunca lee el portapapeles). Así que se usa una página auxiliar del
 * MISMO origen, que Playwright sirve sin esa cabecera, con dos campos de texto, y el
 * portapapeles se maneja con el TECLADO (Ctrl/⌘+C y Ctrl/⌘+V), como una persona:
 * funciona en Chromium, Firefox y WebKit, y lo que se lee es lo que la app escribió,
 * no una copia interceptada.
 */
async function conAuxiliar<T>(
  context: BrowserContext,
  hacer: (p: Awaited<ReturnType<BrowserContext["newPage"]>>) => Promise<T>,
): Promise<T> {
  await context.route(`**${RUTA_AUXILIAR}`, (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>e2e</title><textarea id=origen></textarea><textarea id=destino></textarea>",
    }),
  );
  const auxiliar = await context.newPage();
  try {
    await auxiliar.goto(RUTA_AUXILIAR);
    return await hacer(auxiliar);
  } finally {
    await auxiliar.close();
    await context.unroute(`**${RUTA_AUXILIAR}`);
  }
}

/** Lee el portapapeles del sistema (pegándolo en la página auxiliar). */
export function leerPortapapeles(context: BrowserContext): Promise<string> {
  return conAuxiliar(context, async (p) => {
    await p.locator("#destino").click();
    await p.keyboard.press("ControlOrMeta+V");
    return p.locator("#destino").inputValue();
  });
}

/** Pone `texto` en el portapapeles del sistema (copiándolo desde la página auxiliar). */
export function escribirPortapapeles(context: BrowserContext, texto: string): Promise<void> {
  return conAuxiliar(context, async (p) => {
    await p.locator("#origen").fill(texto);
    await p.locator("#origen").selectText();
    await p.keyboard.press("ControlOrMeta+C");
  });
}

/**
 * Permiso para que la APP escriba (`writeText` de «Copiar»). Chromium lo pide en
 * Playwright; Firefox y WebKit lo dan tras el clic del usuario y no admiten concederlo.
 */
export async function permitirEscribir(context: BrowserContext, navegador: string) {
  if (navegador === "chromium") await context.grantPermissions(["clipboard-write"]);
}
