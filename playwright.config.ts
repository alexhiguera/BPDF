import { defineConfig, devices } from "@playwright/test";

/**
 * E2E contra la BUILD DE PRODUCCIÓN (`vite build` + `vite preview`), no contra
 * `vite dev`: es lo que se publica, y la CSP solo existe ahí (en desarrollo
 * Vite inyecta código en línea que una CSP estricta bloquearía).
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e/specs",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
