import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config do QA de layout do PDF (tests/*.qa.ts) — fica FORA da suíte normal: abre o
// Chromium do Playwright e leva ~20s pro catálogo inteiro, e o CI não instala browsers.
// Rode com `pnpm qa:layout` (veja o cabeçalho de tests/qa-layout.qa.ts).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.qa.ts"],
    testTimeout: 600_000,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
