import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Ferramental de agentes de IA instalado na raiz: é código de terceiro, escrito em
    // CommonJS, e reprovava no lint do app (~1900 erros de `require()`) afogando os
    // problemas reais do produto. O lint aqui responde pelo app, não pelo tooling.
    ".aiox-core/**",
    ".aiox/**",
    ".claude/**",
    ".codex/**",
    ".cursor/**",
    ".gemini/**",
    ".antigravity/**",
    ".kimi/**",
    ".github/agents/**",
  ]),
]);

export default eslintConfig;
