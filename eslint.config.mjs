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
    // Bibliotecas vendorizadas servidas como estático (pdf-lib do gerador de contratos):
    // código minificado de terceiro reprovava o lint e derrubava o CI inteiro desde set/2026,
    // escondendo typecheck, testes e build atrás de um "Unexpected aliasing of this".
    "public/**",
    "**/*.min.js",
    // Material comercial (deck em HTML + scripts de montagem), não é código do app.
    "apresentacao/**",
  ]),
]);

export default eslintConfig;
