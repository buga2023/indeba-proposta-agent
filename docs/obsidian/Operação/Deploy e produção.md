# Deploy e produção

**Push na main é o deploy.** Não rodar `vercel --prod` depois do push (faz um segundo build do mesmo commit).

## Portão local antes do push
```
npx eslint src tests     # 0 errors
npx tsc --noEmit
npx vitest run           # 611 testes em 22/09
```
O CI (GitHub Actions) roda lint, tsc, testes, audit e build, e trata warning de react-hooks como erro. CI e Vercel são pipelines separados: CI vermelho não derruba produção.

## Acompanhar
Build leva ~2 minutos (prisma generate + migrate deploy + next build).
```
npx vercel ls --yes | head -6
npx vercel inspect <url> --json | node .claude/skills/deploy/estado-deploy.mjs
```
Estado final READY e alias `indeba-express.vercel.app`.

## Verificar o que ficou no ar
```
npx playwright test tests/e2e/producao-smoke.spec.ts tests/e2e/anexos-smoke.spec.ts
```
Telas logadas se testam no navegador com a conta do Mateus (Gustavo digita a senha; o agente não digita credenciais).

## Onde costuma falhar
- Ficha em PDF dando 500: rota sem o Chromium no bundle (outputFileTracingIncludes). Chave de rota dinâmica usa `*`.
- `pnpm lint` falha só no CI: setState dentro do corpo de effect.
- Dois deployments do mesmo commit: alguém rodou vercel --prod.

Skill do projeto: `.claude/skills/deploy`. Runbook de infra: `docs/prod-setup.md`.
