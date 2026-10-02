import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Benchmark del visor PDF (Fase 5, docs/ARCHITECTURE.md → visor PDF).
 * No es un test: mide e imprime. Fuera de la suite normal y de CI, porque sus
 * cifras dependen de la máquina. Uso: `npm run bench:pdf`.
 */
export default defineConfig({
  ...base,
  testDir: "e2e/bench",
  testMatch: "**/*.bench.ts",
  reporter: "list",
  retries: 0,
  timeout: 300_000,
  use: {
    ...base.use,
    // Sin la traza de Playwright: aunque solo se guarde si algo falla, se graba
    // siempre, y su instantánea del DOM en cada acción bloquea el hilo principal
    // (~0,9 s por instantánea con 1 MB, ~3,9 s con KaTeX). Con ella, el benchmark
    // del editor medía esas instantáneas como retraso al teclear (Fase 9).
    trace: "off",
  },
});
