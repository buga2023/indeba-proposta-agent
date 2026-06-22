# Indeba Proposta Agent

Plataforma local da Indeba que faz três coisas a partir de linguagem natural:

1. **Gera propostas comerciais em PDF** — o vendedor descreve o cliente e a
   necessidade; a IA seleciona produtos do catálogo e escreve o texto; o PDF sai no
   padrão visual da Indeba.
2. **Prospecta leads** — o vendedor descreve o que vende e que cliente quer; o agente
   busca empresas reais na web, **minera contatos** (e-mail, telefone, redes) das
   páginas e a IA escreve a abordagem.
3. **Gera posts para Instagram** — o vendedor descreve em linguagem natural o que quer
   divulgar; a IA escreve legenda, gancho, hashtags e o roteiro do criativo.

> **Regra de ouro (constituição §2):** preço, imagem, embalagem, ficha — e, na
> prospecção, os contatos — **nunca são fabricados pelo modelo**. Preço/ficha vêm do
> catálogo; contatos vêm minerados de páginas web reais. A IA só **seleciona e escreve**.

---

## Stack e versões

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 24.15 (dev) · `nodejs` runtime nas rotas |
| Gerenciador | pnpm | 11.8 |
| Framework | **Next.js** (App Router, app único) | **16.2.9** |
| UI | React / React DOM | 19.2.4 |
| Linguagem | TypeScript (strict) | ^5 |
| Estilo | Tailwind CSS + `@tailwindcss/postcss` | ^4 |
| Fonte | geist | ^1.7.2 |
| Contratos/validação | **Zod** (fonte única de tipos/validação) | ^4.4.3 |
| PDF | Playwright / playwright-core | ^1.61.0 |
| PDF serverless | `@sparticuz/chromium` (Chromium na Vercel) | ^149.0.0 |
| IA | **Ollama** (modelo padrão `qwen2.5:7b-instruct`) | via HTTP, sem SDK |
| Busca web | **Tavily** (prospecção) | via `fetch`, sem SDK |
| Rate limit | `@upstash/ratelimit` + `@upstash/redis` | ^2.0.8 / ^1.38.0 |
| Log/persistência | Upstash Redis (prod) · JSONL local (dev) | — |
| Testes | Vitest | ^4.1.9 |
| Lint | ESLint + `eslint-config-next` | ^9 / 16.2.9 |

> ⚠️ **Não usa** Prisma/PostgreSQL, shadcn/ui, React Hook Form, TanStack Query nem
> sharp (apesar de citados em docs antigas). O catálogo é um **arquivo JSON**
> (`data/catalogo.json`); a UI é feita com estilos inline + Tailwind. Persistência do
> log é Redis (Vercel) ou JSONL local — **sem banco relacional**.

---

## Funcionalidades

### Propostas
O tipo é detectado pelo prompt; em dúvida, o sistema pergunta antes de gerar.

- **Orçamento** — tabela enxuta (produto, embalagem, valor, subtotal, total).
- **Proposta de Implantação** — formato Indeba Express, um produto por bloco, com
  custo por litro diluído em destaque.
- **Proposta Comercial** — formato institucional (capa, apresentação, programa de
  higienização, soluções e condições comerciais).

A proposta é editável/refinável antes do export. Todo PDF gerado entra num **log
append-only** (cliente, itens, preços aplicados, autor, timestamp).

### Prospecção de leads
- Traz **clientes potenciais** (o `tipoCliente` — quem compra), **nunca concorrentes
  do mesmo nicho** do solicitante. O nicho/diferencial é só contexto pra entender o encaixe.
- Busca web (Tavily) em **2 passadas**: genérica do tipo de cliente (escolha das empresas)
  e **dirigida por empresa** depois que a IA escolhe (acha as redes/contatos de cada uma).
- **Minerador determinístico** (`src/lib/prospeccao/contatos.ts`) raspa por regex e-mail,
  telefone BR (só formatado — descarta timestamps/IDs) e LinkedIn/Instagram/Facebook/WhatsApp.
- **Individualidade garantida** (`prospectar.ts`): e-mail casa por domínio do site, perfil
  social casa por **slug ↔ nome**, e a passada `removerCompartilhados` elimina qualquer
  contato repetido em 2+ empresas (vazamento de diretório). Cada empresa fica só com o que é dela.
- A IA só seleciona empresas e escreve: o **`problema`** (dor que o diferencial resolve),
  `comoAjudar` (o encaixe) e uma **mensagem pronta** por canal.
- `confiabilidade` (`confirmado`/`estimado`), `total` e contatos são **derivados no backend**,
  nunca pelo modelo. Cada prospect carrega a **fonte** (URL) que embasou os contatos.
- Botão **"Gerar proposta"** leva o prospect direto pro briefing e já gera a proposta.

### Posts para Instagram
- O vendedor descreve o post em **linguagem natural** (input principal); nicho,
  produto/serviço, público-alvo, tom de voz e nº de posts (1/3/5) são ajustes opcionais.
- A IA (`src/lib/llm/gerar-instagram.ts`, saída JSON restrita por schema) escreve até 5
  posts num **framework editorial** (autoridade, educativo, prova social, oferta, conexão):
  **abertura** (gancho), legenda com CTA, 5–15 **hashtags**, **melhor horário** (com
  justificativa) e um **prompt de imagem em inglês** por post — mais uma nota editorial.
- **Imagem por IA (4:5):** gerada via **Pollinations.ai** (modelo **Flux**) — grátis, **sem
  chave e sem login**. Cada card carrega a imagem direto de `image.pollinations.ai` (URL com
  o `imagemPrompt` em inglês + seed estável) no `<img>`, com loading, fade e botão "tentar
  de novo" em caso de falha. Só `*.pollinations.ai` é liberado na CSP (`img-src`).
- Idioma: todo o conteúdo sai em **português**; só o `imagemPrompt` (técnico, para a
  imagem) é em inglês — os modelos de imagem entendem melhor.
- Texto é 100% criativo (IA-TEXTO) — **não** há dado crítico do catálogo. Sem Ollama, cai
  num **template determinístico** (degradação graciosa, §5).
- Cada card permite **copiar** legenda + hashtags e **baixar** a imagem.

---

## Rotas de API (`src/app/api`)

| Rota | Método | Função |
|---|---|---|
| `/api/montar` | POST | briefing/entrada → `PropostaScope` |
| `/api/montar-estruturado` | POST | itens estruturados → `PropostaScope` |
| `/api/pdf` | POST | `PropostaScope` → PDF (Playwright) |
| `/api/catalogo` | GET | catálogo de produtos (protegido) |
| `/api/propostas` | GET | log append-only das propostas geradas |
| `/api/prospectar` | POST | prospecção de leads (IA + Tavily + mineração) |
| `/api/instagram` | POST | briefing → posts de Instagram (legenda, hashtags, horário) |
| `/api/login` · `/api/logout` | POST | autenticação por cookie de sessão |

Auth (cookie assinado) e rate limit são aplicados no `src/middleware.ts`.

---

## Estrutura

```
src/
  app/                      UI (App Router) + rotas de API
    api/...                 ver tabela acima
    page.tsx                telas: briefing, review, PDF, histórico, catálogo, prospecção, instagram
  middleware.ts             auth + rate limit
  lib/
    contracts/              schemas Zod — fonte única (produto, pedido, selecao,
                            proposta, entrada, prospeccao, instagram)
    catalogo.ts             leitura/validação do catálogo
    montar.ts               orquestra briefing → PropostaScope
    tipo-proposta.ts        detecção do tipo de proposta
    selecao/                matcher por facetas (linha, segmento, função, método)
    llm/                    cliente Ollama (gerarJson/gerarTexto) + gerar-instagram.ts
    pdf/                    render Playwright + templates por tipo
    prospeccao/             tavily.ts (busca) · contatos.ts (mineração) · prospectar.ts
    auth.ts · ratelimit.ts · log.ts · imagens · utils.ts
data/
  catalogo.json             catálogo de produtos (fonte de preço/ficha)
  imagens/                  imagens dos produtos
docs/                       documentação de apoio (spec e guia)
```

---

## Variáveis de ambiente

Copie `.env.example` para `.env.local` (local) ou configure no dashboard da Vercel (prod).

| Variável | Obrigatória | Para quê |
|---|---|---|
| `OLLAMA_BASE_URL` | recomendada | URL do Ollama (local `http://127.0.0.1:11434`; prod via túnel) |
| `OLLAMA_MODEL` | não | modelo (default `qwen2.5:7b-instruct`) |
| `MARCA_PADRAO` | não | marca/template padrão do PDF |
| `TAVILY_API_KEY` | só p/ prospecção | busca web p/ minerar contatos (free em app.tavily.com) |
| `AUTH_USERS` | recomendada | `login:senha:papel,...` — vazio = auth desligada (uso local) |
| `AUTH_SESSION_SECRET` | com auth | segredo p/ assinar o cookie de sessão |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | prod | rate limit + log durável; sem isso, rate limit desligado e log em JSONL |

Sem `TAVILY_API_KEY` a prospecção roda só com o conhecimento do modelo (tudo `estimado`).
Sem Ollama, a prospecção retorna 503 (não há fallback determinístico); já o fluxo de
proposta degrada para o caminho determinístico.

---

## Como rodar (local)

```bash
pnpm install
pnpm exec playwright install chromium     # navegador para o render de PDF
ollama serve                              # IA (host) — modelo: ollama pull qwen2.5:7b-instruct
# .env.local: preencha TAVILY_API_KEY para a prospecção achar contatos reais
pnpm dev                                  # http://localhost:3000
```

Build de produção local:

```bash
pnpm build && pnpm start
```

---

## Testes

```bash
pnpm test          # Vitest (unit/integração)
```

Todo PR entrega o **teste-guardião** da sua área:
- Proposta: o preço que sai no PDF é igual ao do catálogo, com a IA no fluxo.
- Prospecção: sem fonte web que case, o contato **não sai** e o prospect fica `estimado`.

---

## Deploy

- **Plataforma:** Vercel — projeto `indeba-propostas-agent`.
- **URL:** https://indeba-propostas-agent.vercel.app
- **Sem IA (padrão):** estável; proposta cai no determinístico, prospecção exige IA.
- **Com IA:** Ollama no PC + túnel `cloudflared` apontando `OLLAMA_BASE_URL` para a prod.
  Atenção ao `maxDuration` de 60s da Vercel — geração em CPU pode estourar o limite.
- Detalhes e causas-raiz de armadilhas estão no skill `/deploy-prod` e em `docs/`.

---

## Princípios (constituição)

1. Backbone determinístico, IA como tempero.
2. Dado crítico (preço, contato) nunca vem do modelo.
3. Dados primeiro: nada antes do schema Zod em `src/lib/contracts`.
4. Renderização ≠ geração: o PDF é *view* do `PropostaScope`.
5. Estender, não bifurcar contratos.
6. A IA é sempre revisável antes do export.
7. Procedência em todo item (`CATÁLOGO`/`IA-SELEÇÃO`/`IA-TEXTO`/`MANUAL`; na
   prospecção, `confirmado`/`estimado` + fonte).
8. Log append-only de toda proposta gerada.
