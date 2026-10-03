import { defineConfig, devices } from "@playwright/test";
import { siteUrl } from "./src/config/project";

/**
 * Prueba de humo de la web PUBLICADA (Fase 15): `npm run test:humo`. Por defecto, contra
 * la URL de `project.ts` (`https://bpdf.r3zon.com`); otra con `BPDF_URL`. No corre en CI
 * ni con `test:e2e`: depende de un despliegue que el repo no controla, y se lanza a mano
 * tras desplegar (docs/DEPLOYMENT.md).
 *
 * Con `BPDF_URL=http://localhost:<puerto>` levanta la build de producción en ese puerto
 * (`vite preview`, las mismas cabeceras que Vercel): el ensayo local del mismo smoke.
 * Sin reintentos: un smoke que pasa a la segunda no da por bueno un despliegue.
 */
const URL_OBJETIVO = process.env.BPDF_URL ?? siteUrl();
const objetivo = new URL(URL_OBJETIVO);
const LOCAL = objetivo.hostname === "localhost";

export default defineConfig({
  testDir: "e2e/produccion",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: objetivo.origin,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: LOCAL
    ? {
        command: `npm run build && npx vite preview --port ${objetivo.port} --strictPort`,
        url: objetivo.origin,
        reuseExistingServer: false,
        timeout: 120_000,
      }
    : undefined,
});
