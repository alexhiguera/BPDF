import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

/**
 * Compatibilidad (Fase 13): la misma suite E2E, contra la misma build de producción,
 * en Firefox y en WebKit (el motor de Safari). Los navegadores mínimos están en
 * `build.target` (Chrome/Edge 111, Firefox 128, Safari 16.4). Uso:
 * `npm run test:e2e:compat`. Los tests que dependen de algo que solo da Chromium (el
 * protocolo de depuración, permisos de portapapeles de Playwright) lo dicen y se
 * saltan ahí con su motivo (`soloChromium`, e2e/navegadores.ts).
 */
export default defineConfig({
  ...base,
  // En local, Firefox y WebKit comparten máquina: varios procesos pesados pueden
  // dejar sin CPU hasta al `vite preview` y agotar 30 s en `page.goto`. CI ya
  // limita Playwright por defecto; allí no se cambia la concurrencia.
  workers: process.env.CI ? undefined : 2,
  projects: [
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
