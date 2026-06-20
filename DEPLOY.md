# Deploy na Vercel — Agente de Proposta

Arquitetura do deploy: a **Vercel hospeda a UI + a API**; a **IA (Ollama) continua na sua
máquina**, alcançada pela Vercel através de um **túnel seguro**. O PDF é gerado na própria
função serverless (Chromium enxuto).

```
[navegador] → Vercel (UI + /api/*) → (túnel seguro) → Ollama na sua máquina
                     │
                     └─ PDF: @sparticuz/chromium (serverless)
```

## 1. Pré-requisitos
- `pnpm build` passando localmente (ver §5).
- Conta na Vercel + repositório git conectado.
- Conta no [Upstash](https://upstash.com) (Redis serverless, free tier) para o rate limit.

## 2. Expor o Ollama com segurança (a IA fica na sua máquina)
O Ollama roda em `localhost:11434` e **não pode ser exposto sem proteção** (qualquer um
poderia usar seu modelo). Use um túnel autenticado:

- **Cloudflare Tunnel** (recomendado): `cloudflared tunnel --url http://localhost:11434`
  e proteja com uma *Access Policy* (Cloudflare Zero Trust). Use a URL gerada como
  `OLLAMA_BASE_URL`.
- Alternativa: `ngrok http 11434` com `--basic-auth`.

> A máquina precisa estar **ligada e com o túnel ativo** quando o app for usado.

## 3. Variáveis de ambiente na Vercel
Em *Settings → Environment Variables* (Production):

| Variável | Valor |
|---|---|
| `OLLAMA_BASE_URL` | URL do seu túnel (ex.: `https://xxxx.trycloudflare.com`) |
| `OLLAMA_MODEL` | `qwen2.5:7b-instruct` |
| `MARCA_PADRAO` | `indeba_express` |
| `NEXT_TELEMETRY_DISABLED` | `1` |
| `AUTH_USERS` | `login:senha:papel,...` (defina seus usuários e senhas) |
| `AUTH_SESSION_SECRET` | um valor **longo e aleatório** (ex.: `openssl rand -hex 32`) |
| `UPSTASH_REDIS_REST_URL` | do painel do Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | do painel do Upstash |

> As **senhas ficam só na Vercel** (e no seu `.env.local`), nunca no git.

## 4. Segurança aplicada (resumo)
- **Auth** por sessão assinada (HMAC, cookie httpOnly) — ativa quando `AUTH_USERS` existe.
- **Rate limit** por IP (Upstash, 30/min) — permite 10–20 prompts seguidos, barra abuso.
- **Headers** OWASP (CSP, HSTS, X-Frame-Options DENY, nosniff, etc.) — `next.config.ts`.
- **PDF**: caminho de imagem restrito a `public/` (anti-LFI), HTML escapado, rede bloqueada no render.
- **Validação** Zod em toda rota, com limites de tamanho (anti-DoS).

## 5. Build e deploy
```bash
pnpm build          # valida o build de produção (inclui middleware/edge)
# conecte o repo na Vercel (ou: vercel --prod)
```
> Se o render de PDF faltar memória, aumente a *Function Memory* para 1024 MB nas
> configurações do projeto na Vercel (o `@sparticuz/chromium` precisa disso).

## 6. Pós-deploy (teste)
1. Acesse a URL → tela de **login** (use um usuário de `AUTH_USERS`).
2. Envie 10–20 briefings seguidos → propostas montadas, sem bloqueio (dentro do rate limit).
3. Baixe um PDF → confira preços do catálogo.
