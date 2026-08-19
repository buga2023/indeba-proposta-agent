import { defineConfig } from "@playwright/test";

// E2E contra a PRODUÇÃO (deploy do Vercel). Roda só o que não precisa de login;
// fluxos autenticados exigem credenciais que não ficam no repositório.
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://indeba-propostas-agent.vercel.app",
  },
});
