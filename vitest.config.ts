import path from "node:path";
import { defineConfig } from "vitest/config";

// Config aparte de `vite.config.ts` a propósito: los tests no necesitan
// Tailwind ni el plugin de la build. Sin `@vitejs/plugin-react` (tampoco en la
// app): Vite transforma el JSX por su cuenta con el runtime automático
// (`"jsx": "react-jsx"` en tsconfig).
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  test: {
    // `node` por defecto; los tests de componentes piden jsdom con el pragma
    // `// @vitest-environment jsdom` en su cabecera.
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}", "scripts/**/*.mjs"],
    },
  },
});
