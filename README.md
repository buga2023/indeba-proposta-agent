# Indeba Proposta Agent

Plataforma interna da Indeba. Começou gerando propostas comerciais a partir de um
briefing em linguagem natural e cresceu para um conjunto de agentes que cobrem boa parte
do dia a dia comercial e administrativo: prospecção, posts de Instagram, atendimento,
financeiro, cobrança, compras, fiscal, contábil e contratos.

A ideia por trás de tudo é a mesma: um backbone determinístico faz o trabalho que não
pode errar, e a IA entra só onde faz sentido — selecionar e escrever. Preço, ficha,
embalagem e imagem vêm sempre do catálogo; na prospecção, empresa e contato vêm de fontes
reais (base da Receita e páginas web), nunca inventados pelo modelo. Se um dado crítico
não tem origem confiável, ele não sai.

## O que tem dentro

- **Propostas** — o vendedor descreve o cliente e a necessidade; a IA escolhe os produtos
  no catálogo e escreve o texto; o PDF sai no padrão Indeba. O tipo (orçamento,
  implantação ou comercial) é detectado pelo prompt e, em caso de dúvida, perguntado. Dá
  para refinar tudo antes de exportar. Existe também a via **manual**, sem IA, em que o
  vendedor monta a proposta direto do catálogo.
- **Prospecção** — descreve o que vende e o cliente ideal; o agente busca empresas reais
  (base da Receita Federal no Postgres, ou busca web via Tavily), minera contatos das
  páginas por regex e a IA escreve só a abordagem. Cada contato vem marcado como
  confirmado ou estimado, com a fonte que o embasou.
- **Posts de Instagram** — gera até cinco posts (gancho, legenda, hashtags, melhor horário
  e prompt de imagem) e renderiza a arte via Pollinations/Flux, sem chave nem login.
- **Atendimento** — perguntas e respostas sobre a base de conhecimento da empresa, com
  busca vetorial (Qdrant) e um corte de relevância que faz o agente dizer "não sei" em vez
  de inventar. Tem feedback 👍/👎 que vira conhecimento indexado.
- **Financeiro** — sobe uma planilha (CSV/XLSX) e o motor concilia, totaliza e comenta;
  a IA só escreve a leitura por cima dos números.
- **Cobrança** — a partir da planilha de títulos, o motor monta a lista de inadimplentes
  com severidade e a mensagem pronta, e o disparo envia o e-mail a cada cliente mais um
  resumo ao gestor (SMTP direto, sem depender de serviço externo).
- **Compras** — compara cotações de fornecedores trazendo o custo efetivo (com frete e
  prazo embutidos no valor do dinheiro no tempo).
- **Fiscal / NF-e** — lê o XML da nota, lista os itens e aponta divergências.
- **Contábil** — sobe o diário/razão e o motor fecha o balanço (partida dobrada, A = P +
  PL) e monta BP e DRE; a IA só comenta.
- **Contrato** — gera o contrato a partir de uma proposta existente e também extrai e
  analisa um contrato que você sobe.
- **Chamados** — suporte interno: o colaborador abre, o gestor (admin) responde.
- **Configurações** — cadastro de e-mails de cliente e ajustes do gestor.

A regra de procedência vale para tudo: cada item carrega de onde veio (`CATÁLOGO`,
`IA-SELEÇÃO`, `IA-TEXTO`, `MANUAL`; na prospecção, `confirmado`/`estimado` + fonte). Todo
PDF de proposta entra num log append-only.

## Stack

| Camada | Tecnologia |
|---|---|
| Runtime | Node.js 24 · runtime `nodejs` nas rotas |
| Pacotes | pnpm |
| Framework | Next.js 16 (App Router, app único — UI + API) |
| UI | React 19 · Tailwind CSS v4 · estilos inline |
| Linguagem | TypeScript strict |
| Contratos | Zod — fonte única de tipos, validação de API e validação da saída da IA |
| Banco | PostgreSQL + Prisma (Receita, propostas, chamados, contatos, config) |
| Vetorial | Qdrant (RAG do atendimento) |
| IA | Ollama via HTTP — `qwen2.5:7b` (classificação), `qwen3:14b` (texto), `qwen2.5vl` (visão), `nomic-embed-text` (embeddings) |
| Busca web | Tavily (prospecção) |
| Imagens IG | Pollinations.ai / Flux |
| PDF | Playwright + Chromium (`@sparticuz/chromium` na Vercel) |
| E-mail | Nodemailer (SMTP) |
| Rate limit / log | Upstash Redis em produção; JSONL local em dev |
| Testes | Vitest |

O catálogo continua sendo um arquivo (`data/catalogo.json`) — fonte de produto, ficha,
embalagem e imagem, versionada junto com o código. **Preço não mora ali**: todo `preco` é
`null` e quem cota é o consultor, na montagem, ou o orçamento importado. O que o catálogo
garante é que nome, ficha e tamanho de embalagem nunca são inventados. O Postgres guarda o
que muda no tempo: a base da Receita para prospecção, o store de propostas, os chamados,
os e-mails aprendidos e a config.

## Rotas de API

| Rota | Método | Para quê |
|---|---|---|
| `/api/montar` | POST | briefing → `PropostaScope` (detecta o tipo; pode pedir confirmação) |
| `/api/montar-estruturado` | POST | itens escolhidos à mão → `PropostaScope` (sem IA) |
| `/api/pdf` | POST | `PropostaScope` → PDF (Playwright) |
| `/api/catalogo` | GET | catálogo de produtos |
| `/api/propostas` | GET · POST | log/store das propostas |
| `/api/propostas/[id]` | GET · PATCH | abre e atualiza uma proposta |
| `/api/prospectar` | POST | prospecção (Receita/Tavily + mineração + IA) |
| `/api/instagram` | POST | briefing → posts de Instagram |
| `/api/referencias/sync` | GET · POST | perfil de estilo (GET na UI; POST alimentado por n8n/Drive) |
| `/api/rag` | POST | atendimento (busca vetorial + resposta) |
| `/api/feedback` | POST | 👍/👎 e correções dos agentes |
| `/api/contrato` | POST | gera o contrato a partir da proposta |
| `/api/contrato/extrair` | POST | extrai o texto de um contrato enviado |
| `/api/financeiro` | POST | análise de planilha financeira |
| `/api/cobranca` | POST | planilha de títulos → lista de inadimplentes |
| `/api/cobranca/disparar` | POST | dispara os e-mails de cobrança (admin) |
| `/api/compras` | POST | comparação de cotações |
| `/api/fiscal` | POST | leitura e análise de NF-e (XML) |
| `/api/contabil` | POST | diário/razão → BP + DRE |
| `/api/chamados` | GET · POST | chamados de suporte |
| `/api/chamados/[id]` | PATCH | gestor responde/atualiza um chamado |
| `/api/admin-config` | GET · PUT | configurações do gestor |
| `/api/contatos` | GET · POST · DELETE | cadastro de e-mails de cliente |
| `/api/login` · `/api/logout` | POST | sessão por cookie assinado |

Auth (cookie assinado) e rate limit ficam no `src/middleware.ts`, que cobre `/` e toda
`/api/*` exceto as rotas públicas de login.

## Estrutura

```
src/
  app/
    api/...                 rotas (ver tabela)
    page.tsx                a aplicação — todas as telas e a navegação
    login/                  tela de login
    _app/                   command palette, toast, helpers de UI
  middleware.ts             auth + rate limit
  components/               telas que saíram do page.tsx (chamados, admin, ...)
  lib/
    contracts/              schemas Zod — a fonte única
    catalogo.ts             leitura e validação do catálogo
    montar.ts               briefing → PropostaScope
    selecao/                matcher por facetas
    llm/                    cliente Ollama (gerarJson/gerarTexto) + geradores
    pdf/                    render Playwright + templates por tipo
    prospeccao/             tavily · contatos (mineração) · prospectar
    rag/                    embeddings + busca (Qdrant)
    financeiro/             motor de apuração, conciliação e fontes fiscais
    contrato/               geração e análise de contrato
    cobranca/ · contatos.ts motor de inadimplência + envio de e-mail
    db.ts · auth.ts · ratelimit.ts · log.ts · erro.ts
prisma/
  schema.prisma             modelos + seed (importa data/catalogo.json e a base Receita)
data/
  catalogo.json             catálogo — produto, ficha e embalagem (sem preço)
docs/                       spec, guia e templates de apoio
```

## Variáveis de ambiente

Copie `.env.example` para `.env.local` (local) ou configure no dashboard da Vercel (prod).
O arquivo de exemplo comenta cada uma; o resumo:

| Variável | Quando precisa | Para quê |
|---|---|---|
| `DATABASE_URL` / `DIRECT_URL` | sempre | Postgres (runtime e migrations) |
| `OLLAMA_BASE_URL` | com IA | URL do Ollama (local, ou via túnel em prod) |
| `OLLAMA_MODEL` / `_TEXTO` / `_VISAO` / `_EMBED_MODEL` | não | escolha dos modelos por tarefa |
| `OLLAMA_AUTH_TOKEN` | túnel com bearer | autentica o caminho Vercel→túnel (proxy local) |
| `OLLAMA_CF_ACCESS_CLIENT_ID` / `_SECRET` | túnel via Cloudflare Access | service token do Zero Trust |
| `QDRANT_URL` / `_API_KEY` / `_COLLECTION` | atendimento | banco vetorial do RAG |
| `TAVILY_API_KEY` | prospecção web | enriquece os prospects com busca web |
| `SMTP_HOST` / `_PORT` / `_USER` / `_PASS` / `_FROM` | cobrança | envio de e-mail |
| `GESTOR_EMAIL` | cobrança | destinatário do resumo (editável no painel) |
| `ADMIN_EMAILS` / `AUTH_SESSION_SECRET` | com auth | e-mails que nascem admin e assinatura do cookie |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | prod | rate limit e log durável |

Sem `TAVILY_API_KEY` a prospecção roda só com o conhecimento do modelo. Sem Ollama, a
proposta degrada para o caminho determinístico; a prospecção e o atendimento dependem da
IA. As envs SMTP precisam estar preenchidas para o disparo de cobrança funcionar — sem
elas, a rota responde que o envio não está configurado.

## Rodando local

```bash
pnpm install
pnpm exec playwright install chromium      # navegador do render de PDF
docker compose up -d db qdrant             # Postgres + Qdrant
pnpm prisma migrate dev                     # aplica o schema
pnpm prisma db seed                         # importa data/catalogo.json
ollama serve                                # IA — ollama pull qwen2.5:7b-instruct
pnpm dev                                     # http://localhost:3000
```

Build de produção local:

```bash
pnpm build && pnpm start
```

## Testes

```bash
pnpm test
```

Cada área entrega o seu teste-guardião. Os dois principais: o preço que sai no PDF é
sempre o que o humano informou — nunca um valor emitido pelo modelo, e o catálogo não
carrega preço nenhum pra vazar; e, na prospecção, sem fonte web que case, o contato não
sai e o prospect fica como estimado.

## Deploy

Roda na Vercel (projeto `indeba-propostas-agent`,
https://indeba-propostas-agent.vercel.app). O padrão é subir sem IA — a proposta cai no
determinístico e os agentes que dependem do modelo ficam indisponíveis. Para ligar a IA em
produção, o Ollama roda no PC e é exposto por um túnel autenticado (proxy com bearer ou
Cloudflare Access), com `OLLAMA_BASE_URL` apontando para ele. Vale lembrar que a Vercel
corta a função em 60s, então geração pesada em CPU pode estourar o limite — o caminho
robusto de verdade é hospedar tudo numa VPS. O skill `/deploy-prod` e os arquivos em
`docs/` guardam o passo a passo e as armadilhas já resolvidas.

O catálogo é o dado do qual saem preço, ficha, foto e o produto que vai na proposta — como
ele funciona, como se cadastra produto novo pela tela e por onde ele se propaga está em
[`docs/como-funciona-catalogo-e-cadastro.md`](docs/como-funciona-catalogo-e-cadastro.md).

## Princípios

1. Backbone determinístico, IA como tempero.
2. Dado crítico (preço, contato) nunca vem do modelo.
3. Dados primeiro: nada antes do schema Zod em `src/lib/contracts`.
4. Renderização não é geração — o PDF é uma view do `PropostaScope`.
5. Estender, não bifurcar contratos.
6. A IA é sempre revisável antes do export.
7. Procedência em todo item.
8. Log append-only de toda proposta gerada.
