# Segurança — Agente de Proposta (padrão OWASP)

Este projeto adota o **OWASP Top 10 (2021)** como padrão de segurança. Abaixo, o
mapeamento de cada categoria ao que está implementado. Postura: **tudo roda local por
padrão**; no deploy Vercel, a segurança passa a depender de auth + rate limit + headers
(ver `DEPLOY.md`).

## Mapeamento OWASP Top 10 (2021)

| Categoria | Status | Como é tratado |
|---|---|---|
| **A01 – Broken Access Control** | ✅ | Auth por sessão assinada (HMAC, cookie httpOnly) no `proxy.ts`; rotas `/api/*` exigem login quando `AUTH_USERS` está setado. Path traversal no render de PDF bloqueado (`dentroDePublic`). |
| **A02 – Cryptographic Failures** | ✅ | Sem segredos no código (só em `.env.local`/env da Vercel). Sessão assinada com HMAC-SHA256. HTTPS na Vercel + HSTS. Preço como `Decimal`/string (sem float). |
| **A03 – Injection** | ✅ | Zod valida toda entrada. HTML do PDF escapa `& < > " '` (anti-injeção de atributo). Path do asset restrito a `public/`. Prompt da IA trata o briefing como **dado, não comando** (anti prompt-injection). Sem SQL (catálogo em arquivo); Prisma parametrizado quando entrar. |
| **A04 – Insecure Design** | ✅ | Design seguro por princípio: **backbone determinístico, a IA nunca emite preço** (teste-guardião). Render = view do objeto canônico. |
| **A05 – Security Misconfiguration** | ✅ | Headers: CSP, HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `X-Powered-By` removido. Telemetria do Next desligada. Erros não vazam stack trace. |
| **A06 – Vulnerable & Outdated Components** | ✅ | `pnpm audit --audit-level=high` no CI (falha o build em vuln alta). Override de `postcss` para versão corrigida. Lockfile determinístico + allowlist de build scripts. |
| **A07 – Identification & Auth Failures** | ✅ | Login multiusuário com papéis; sessão expira em 8h; cookie httpOnly/secure/sameSite. Senhas só em env, nunca no git. |
| **A08 – Software & Data Integrity** | ✅ | `pnpm` com `frozen-lockfile` no CI e build scripts em allowlist explícita. Sem fonte/asset externo em runtime. |
| **A09 – Logging & Monitoring** | ✅ | Log append-only de toda proposta gerada (cliente, itens, preços, autor, timestamp) em `lib/log.ts` — JSONL local / Upstash Redis na Vercel. |
| **A10 – SSRF** | ✅ | No render de PDF, toda requisição não-`data:`/`blob:`/`about:` é abortada (sem exfiltração). `OLLAMA_BASE_URL` vem de env (não de entrada do usuário). |

## Defesa em profundidade (resumo)
- **Rede:** local em `127.0.0.1`; na Vercel, endpoint público protegido por auth + rate limit (Upstash, 30/min por IP).
- **Entrada:** validação Zod com limites de tamanho (anti-DoS) em todas as rotas.
- **Render PDF:** asset só de `public/` (anti-LFI), HTML escapado (anti-injeção), rede bloqueada (anti-SSRF).
- **Dependências:** auditoria no CI; sem vulnerabilidades conhecidas na data do último build.

## Pendências conhecidas
- **CSP:** evoluir de `'unsafe-inline'` para CSP baseada em nonce (endurecimento futuro).
- **Integridade do log:** encadeamento por hash (tamper-evidence) — hoje é append-only por uso.

## Reporte de vulnerabilidades
Por ser uma ferramenta interna, reporte diretamente ao responsável técnico do projeto.
