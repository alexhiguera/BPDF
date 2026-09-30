import { type Page, test } from "@playwright/test";

/**
 * Carga la app vigilando tres cosas que ninguna otra puerta ve: errores en
 * consola, violaciones de CSP y peticiones fuera del propio origen
 * (docs/SEGURIDAD.md §2 y §6). Cada spec comprueba al final que las tres listas
 * siguen vacías.
 */
export type Vigilancia = { errores: string[]; violaciones: string[]; externas: string[] };

export async function abrir(page: Page, ruta = "/"): Promise<Vigilancia> {
  const v: Vigilancia = { errores: [], violaciones: [], externas: [] };
  const origen = new URL(test.info().project.use.baseURL ?? "").origin;
  page.on("console", (m) => {
    if (m.type() !== "error" && m.type() !== "warning") return;
    if (esFaviconAusente(m.location().url, origen)) return;
    v.errores.push(m.text());
  });
  page.on("pageerror", (e) => v.errores.push(e.message));
  // Los workers (el de pdf.js, el del modo oscuro) tienen su propia consola: sus
  // errores también cuentan. OJO: una violación de CSP DENTRO de un worker no dispara
  // `securitypolicyviolation` en el documento y Chromium tampoco la pasa a esta
  // consola, así que esta vigilancia no la ve. Lo que un worker necesita de la CSP se
  // prueba por su efecto (p. ej. el texto CJK de visor-pdf.spec.ts, que necesita
  // `connect-src 'self'` para los cmaps de pdf.js).
  page.on("worker", (w) =>
    w.on("console", (m) => {
      if (m.type() === "error" || m.type() === "warning") v.errores.push(`[worker] ${m.text()}`);
    }),
  );
  page.on("request", (r) => {
    if (new URL(r.url()).origin !== origen) v.externas.push(r.url());
  });
  await page.exposeFunction("__violacionCsp", (d: string) => v.violaciones.push(d));
  await page.addInitScript(() => {
    document.addEventListener("securitypolicyviolation", (e) => {
      (window as unknown as { __violacionCsp: (d: string) => void }).__violacionCsp(
        `${e.violatedDirective} ${e.blockedURI}`,
      );
    });
  });
  await page.goto(ruta);
  return v;
}

/**
 * BPDF aún no tiene favicon (llega en la Fase 11, TAREAS_PENDIENTES) y el
 * navegador lo pide igualmente. El Chromium «headless shell» de CI no lo pide,
 * pero Google Chrome sí, y anota el 404 en consola. Se tolera **solo** ese
 * error y solo de ese recurso del propio origen; con el favicon, esto se borra.
 */
function esFaviconAusente(url: string, origen: string): boolean {
  return url === `${origen}/favicon.ico`;
}
