import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

/**
 * Benchmark del spike de modo oscuro (Fase 4, docs/PDF_DARK_MODE_SPIKE.md §8).
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
});
