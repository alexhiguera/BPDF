import type { BrowserContext } from "@playwright/test";

/** Ruta de la página auxiliar: no existe en la build, la sirve Playwright. */
const RUTA_AUXILIAR = "/__e2e-portapapeles";

/**
 * Lee el portapapeles DEL SISTEMA, para comprobar que «Copiar» copió de verdad.
 *
 * Desde la app no se puede: su `Permissions-Policy` niega `clipboard-read`
 * (Fase 12; BPDF nunca lee el portapapeles), aunque el contexto tenga el permiso.
 * Así que se lee desde una página auxiliar del MISMO origen, que Playwright sirve
 * sin esa cabecera: el permiso concedido al contexto la cubre y lo que lee es lo
 * que la app escribió, no una copia interceptada.
 */
export async function leerPortapapeles(context: BrowserContext): Promise<string> {
  await context.route(`**${RUTA_AUXILIAR}`, (r) =>
    r.fulfill({ contentType: "text/html", body: "<!doctype html><title>e2e</title>" }),
  );
  const auxiliar = await context.newPage();
  try {
    await auxiliar.goto(RUTA_AUXILIAR);
    return await auxiliar.evaluate(() => navigator.clipboard.readText());
  } finally {
    await auxiliar.close();
    await context.unroute(`**${RUTA_AUXILIAR}`);
  }
}
