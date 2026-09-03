---
name: deploy
description: Sobe o indeba-proposta-agent para produção na Vercel. Use quando o pedido for "sobe pro vercel", "faz o deploy", "publica em produção" ou "manda pra produção". Cobre o portão local (lint/tsc/testes), o push que dispara o build e a verificação do que ficou no ar.
---

# Deploy — indeba-proposta-agent

O deploy deste projeto é **disparado pelo git push na `main`**, não pela CLI. `git push` já cria
o deployment de produção; rodar `vercel --prod` depois faz um **segundo build do mesmo commit**,
gastando o dobro do tempo e deixando dois deployments concorrendo pelo alias. Não faça isso.

## 1. Portão local — rode ANTES do push

O CI (`.github/workflows/ci.yml`) roda `pnpm lint` → `tsc --noEmit` → `pnpm test` → `pnpm audit`
→ `pnpm build`, e **`pnpm lint` trata warning do React como erro** (`react-hooks/*`). Descobrir
isso no CI custa uma volta inteira. Rode os três, nesta ordem, e só siga com tudo limpo:

```bash
npx eslint src tests   # 0 errors — warnings podem ficar
npx tsc --noEmit
npx vitest run
```

Se mexeu em tela, rode também os e2e locais (precisam do dev server, ver seção 4).

## 2. Commit e push

```bash
git add -A && git commit -m "..."   # mensagem no padrão do repo: tipo(escopo): o quê
git push origin main                # ISTO é o deploy
```

## 3. Acompanhar o build

O build de produção leva **~2 minutos** e é dominado por `prisma generate && prisma migrate
deploy && next build` (package.json). Dois minutos é o normal aqui, não é lentidão.

```bash
npx vercel ls --yes | head -6
npx vercel inspect <url-do-deployment>          # status legível
npx vercel logs <url-do-deployment>             # quando der Error
```

Para esperar sem ficar chamando a CLI em loop (cada `npx vercel` custa segundos só de resolver
o pacote), use o JSON e pare no estado final:

```bash
npx vercel inspect <url> --json | node .claude/skills/deploy/estado-deploy.mjs
# imprime: READY | production | indeba-propostas-agent.vercel.app
```

Use o SCRIPT, não um `node -e` inline: aspas e parênteses do one-liner se perdem no shell
(aconteceu em 02/09/2026 — doze iterações do laço morreram com SyntaxError sem dizer o estado).

`readyState` vira `READY` ou `ERROR`. **Não conte com `grep` na tabela do `vercel ls`**: ela vem
com bullets e colunas alinhadas que quebram o match — foi assim que uma verificação anterior
"passou" sem status nenhum.

## 4. Verificar o que ficou no ar

O app é fechado por login em produção, então o e2e cobre o que dá para conferir sem credencial:

```bash
npx playwright test tests/e2e/producao-smoke.spec.ts tests/e2e/anexos-smoke.spec.ts
```

Confirme também que o alias de produção aponta para o deployment novo — `aliases` do JSON acima
tem que conter `indeba-propostas-agent.vercel.app`.

Telas novas se testam **localmente**, com as rotas de API interceptadas (esta máquina não tem
Postgres nem Docker):

```bash
AUTH_ENABLED=false DATABASE_URL="postgresql://x:x@127.0.0.1:5432/x" npx next dev -H 127.0.0.1 -p 3123
E2E_BASE_URL=http://127.0.0.1:3123 npx playwright test tests/e2e/<spec>
```

## Onde o deploy costuma falhar

| Sintoma | Causa | O que fazer |
|---|---|---|
| CI vermelho, produção no ar | GitHub Actions e Vercel são pipelines **separados** — o CI falhando não derruba o deploy | corrigir mesmo assim: é o CI que guarda o repo |
| `pnpm lint` falha só no CI | `react-hooks/set-state-in-effect` é erro, não warning | tirar o `setState` do corpo do effect (`void Promise.resolve().then(...)`, padrão já usado nas telas de ferramentas) |
| Build de 2min "demorado" | `prisma migrate deploy` roda contra o banco no build | é o esperado; não é regressão |
| Dois deployments do mesmo commit | alguém rodou `vercel --prod` depois do push | esperar o primeiro; não repetir |
