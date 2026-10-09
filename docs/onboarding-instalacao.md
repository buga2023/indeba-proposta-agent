# Onboarding de uma nova distribuidora (instalação por cliente)

> Estado em 09/10/2026. O sistema ainda é **uma instalação por distribuidora** (um projeto na
> Vercel + um Postgres + um Upstash por cliente). Multi-tenant real (model `Empresa`) está no
> roadmap de `MELHORIAS-PRODUTO-NOXIS-2026-10-08.md`, item #1. Este é o passo a passo com as
> alavancas que **já existem** no código hoje.

## 1. O que muda de uma distribuidora para outra

| O quê | Onde mora hoje | Como trocar |
|---|---|---|
| Nome, razão social, CNPJ, IE, endereço, telefone, e-mail, cidade, região de entrega, consultor padrão, marca dos produtos | `src/lib/empresa.ts` (objeto `EMPRESA`) | Editar o objeto. Alimenta PDFs, prompts de IA, e-mails, contrato, título do app. |
| Logos (color, white, símbolo, header) | `public/marca/` | Substituir os arquivos mantendo os nomes (ver `src/components/brand.tsx` e `src/lib/pdf/render.ts`). |
| Cores e fontes dos PDFs | `src/lib/pdf/template.ts` (`MARCAS`) e `template-consolidada.ts` | Editar os tokens. |
| Textos padrão da Proposta de Solução | Tabela `Config`, pela tela **Configurações → Textos padrão** | O gestor edita na tela, sem deploy. |
| Ferramentas do plano (Basic/Regular/Premium) | Tabela `Config` (chave `ferramentas`), pela tela **Configurações → Plano e ferramentas** | Clicar no preset ou marcar ferramenta a ferramenta. Bloqueio vale no servidor. |
| E-mail do gestor (resumo de cobrança) | `Config` via **Configurações** | Na tela. |
| Catálogo base (150 produtos da Indeba) | `data/catalogo.json` + `public/produtos` + `public/fichas-tecnicas` | **Ponto fraco atual:** outra distribuidora herda o catálogo da Indeba. Opções: (a) trocar o JSON e as pastas por um pacote da distribuidora; (b) marcar os produtos como excluídos pela tela e cadastrar os dela um a um (há importação em lote prevista, item #15). |
| Cláusulas do gerador de contratos | `public/gerador-contratos/index.html` (CNPJ e cláusulas no HTML) | Editar o HTML (item #16 do roadmap: parametrizar). |
| Contatos do consultor na proposta | Env `INDEBA_WHATSAPP`, `INDEBA_CONSULTOR_EMAIL` | Definir na Vercel. |
| Primeiro gestor | Env `ADMIN_EMAILS` + cadastro pela tela `/cadastro` | O e-mail listado vira admin ao se cadastrar. |
| Link da ficha técnica nos PDFs | Env `SITE_URL` (só origem, sem barra) | Definir na Vercel com o domínio final. O boot avisa se estiver errado. |

## 2. Checklist de go-live (ordem)

1. **Repositório**: fork/branch do cliente. Editar `src/lib/empresa.ts`, `public/marca/`, cores.
2. **Vercel**: novo projeto apontando para a branch. Variáveis obrigatórias:
   `DATABASE_URL`, `DIRECT_URL` (Postgres), `AUTH_SESSION_SECRET` (32+ chars), `SITE_URL`,
   `ADMIN_EMAILS`, `INDEBA_WHATSAPP`/`INDEBA_CONSULTOR_EMAIL`, `UPSTASH_REDIS_REST_URL`/`TOKEN`
   (rate limit), `SMTP_*` (se usar cobrança por e-mail). Ver `.env.example`.
3. **Deploy**: `git push` na branch de produção. O build roda `prisma migrate deploy`.
4. **Verificar o boot**: nos logs da função, procurar linhas `[env]` — cada aviso é uma variável
   faltando ou errada (`src/lib/env-check.ts`).
5. **Primeiro acesso**: o gestor se cadastra em `/cadastro` com o e-mail de `ADMIN_EMAILS`.
6. **Configurações**: textos padrão, e-mail do gestor, **plano** (Basic/Regular/Premium).
7. **Catálogo**: cadastrar/importar produtos com foto e ficha técnica (PDF). Validação por
   assinatura do arquivo: só PNG/JPG/WebP/PDF.
8. **Colaboradores**: cada vendedor se cadastra; o gestor libera em Configurações.
9. **Smoke**: `E2E_BASE_URL=https://<dominio> npx playwright test tests/e2e/producao-smoke.spec.ts tests/e2e/anexos-smoke.spec.ts`.
10. **Primeira proposta de verdade** pelo gestor, PDF gerado, link da ficha técnica aberto sem login.

## 3. O que ainda é trabalho de desenvolvedor (não de tela)

- Trocar o catálogo base inteiro (item #15 do roadmap: importação por planilha).
- Cláusulas do contrato e certificado (item #16).
- Cores dos PDFs (hoje tokens no código).
- IA: depende de `OLLAMA_BASE_URL` apontando para um servidor acessível (hoje túnel do PC da
  Noxis — item #3: provedor hospedado).

## 4. Operação (Noxis)

- CI: lint, typecheck, testes, auditoria de dependências, build, guardião do tamanho da função
  de PDF, e2e de tela. Tudo tem que estar verde antes do deploy.
- Logs: erros saem em JSON (`"origem":"api"`, `"tag":"degradacao"`, `"tag":"pdf-render"`),
  filtráveis nos logs da Vercel.
- Backup do Postgres: **ainda não automatizado** (item #8).
