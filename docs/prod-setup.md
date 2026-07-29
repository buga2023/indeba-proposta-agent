# Produção — Runbook (Vercel + Ollama túnel + Qdrant Cloud)

Setup atual de produção dos agentes de IA (Financeiro, Contrato, Atendimento/RAG, Feedback).
Complementa a skill `/deploy-prod` e a memória `agentes-ecossistema` / `deploy-vercel`.

- **App:** https://indeba-propostas-agent.vercel.app · Projeto Vercel `indeba-propostas-agent`
- **Repo:** github.com/buga2023/indeba-proposta-agent (deploy a partir de `main`)

## Arquitetura em prod

```
Navegador → Vercel (Next) ──► Qdrant Cloud   (recuperação do RAG)
                          └──► túnel cloudflared → Ollama no PC (embeddings + geração)
```

A Vercel é stateless e **não roda Ollama nem Qdrant**. Ambos vivem fora dela:
- **Ollama** roda no seu PC e é exposto por um **túnel cloudflared** (URL pública efêmera).
- **Qdrant** em prod é o **Qdrant Cloud** (free tier) — o `docker compose up -d qdrant` é só local.

> ⚠️ **Frágil:** a IA em prod só funciona com **PC + Ollama + túnel ligados**. Endgame real =
> mover app + Ollama para uma **VPS** e largar o túnel.

## Variáveis de ambiente (Vercel → Production)

| Env | Valor | Para quê |
|---|---|---|
| `OLLAMA_BASE_URL` | URL do túnel `https://xxx.trycloudflare.com` (**efêmera**) | geração + embeddings |
| `OLLAMA_MODEL` | `qwen2.5:7b-instruct` | roteamento/texto |
| `OLLAMA_EMBED_MODEL` | `nomic-embed-text` | embeddings do RAG |
| `QDRANT_URL` | `https://<cluster>.aws.cloud.qdrant.io:6333` (note a **:6333**) | vector DB |
| `QDRANT_API_KEY` | *(secret — só na Vercel, nunca no repo)* | auth do Qdrant Cloud |

Setar/atualizar (idempotente):
```bash
vercel env rm OLLAMA_BASE_URL production -y; printf '%s' "<URL>" | vercel env add OLLAMA_BASE_URL production
# (repetir para cada env). Mudou env → precisa REDEPLOY:
vercel --prod --yes
```

## Ligar a IA em prod (`com-ia`)

Ollama escuta SÓ em `127.0.0.1` (nunca `localhost` → IPv6 dá timeout).
```bash
# 1) Ollama no PC
"$LOCALAPPDATA/Programs/Ollama/ollama.exe" serve        # em background
curl http://127.0.0.1:11434/api/tags                    # confirma + lista modelos

# 2) Túnel (o --http-host-header é OBRIGATÓRIO, senão o Ollama responde 403)
CF="$LOCALAPPDATA/Microsoft/WinGet/Packages/Cloudflare.cloudflared_*/cloudflared.exe"
$CF tunnel --url http://127.0.0.1:11434 --http-host-header localhost:11434 --logfile cf.log
# pegue a URL https://*.trycloudflare.com do cf.log e valide pela URL pública:
curl https://XXX.trycloudflare.com/api/tags             # tem que listar o modelo

# 3) Aponte a Vercel pra essa URL (OLLAMA_BASE_URL) + redeploy (ver tabela acima)
```

> A URL do túnel **muda a cada restart** do cloudflared. Reiniciou → re-setar
> `OLLAMA_BASE_URL` e `vercel --prod --yes` de novo.

## Qdrant Cloud (uma vez)

1. https://cloud.qdrant.io → **Create Cluster** → Free.
2. Copie o **Cluster URL** e crie uma **API key** (Data Access).
3. Envs na Vercel: `QDRANT_URL` = `<cluster>:6333`, `QDRANT_API_KEY` = a key.
4. Indexe o catálogo no cluster (embeddings pelo Ollama local):
   ```bash
   QDRANT_URL="https://<cluster>.aws.cloud.qdrant.io:6333" QDRANT_API_KEY="<key>" \
     node scripts/rag-index.mjs
   ```
5. Redeploy.

> 🪤 **Gotcha:** o Qdrant Cloud exige a api-key **até no `/healthz`** (403 sem ela). Por isso
> `qdrantDisponivel()` (`src/lib/rag/qdrant.ts`) envia a key — sem isso o RAG dá **503 falso**.

## Deploy

```bash
git push origin main
pnpm build            # gate local (tem que compilar verde)
vercel --prod --yes   # escreva o output num arquivo; o tail do CLI buffeririza
```
Pré-checagem: e-mail do commit = `gustavossantos2905@gmail.com` (senão a Vercel bloqueia o
build silenciosamente) e `vercel.json` com `{"framework":"nextjs"}`.

## Validar produção

```bash
P="https://indeba-propostas-agent.vercel.app"; JAR=$(mktemp)
curl -s -L $P/login | grep -i "<title>"                       # Agente de Proposta — Indeba Express
curl -s -c $JAR -X POST $P/api/login -H "Content-Type: application/json" \
  -d '{"login":"<user>","senha":"<senha>"}' -o /dev/null -w "login %{http_code}\n"   # 200
# Financeiro (IA via túnel):
curl -s -b $JAR -X POST $P/api/financeiro -H "Content-Type: application/json" \
  -d '{"pergunta":"qual o total?","planilhas":[{"nome":"v","csv":"P;Valor\nA;1.000,00"}],"planilhaAtual":"v"}'
# Atendimento (RAG → Qdrant Cloud + Ollama):
curl -s -b $JAR -X POST $P/api/rag -H "Content-Type: application/json" \
  -d '{"acao":"perguntar","pergunta":"produto desengordurante?"}'
```
RAG dando `503 "Qdrant indisponível"` → cluster fora, env errada, ou a api-key não está
sendo enviada. Financeiro/Contrato falhando → túnel/Ollama caíram (ver `OLLAMA_BASE_URL`).

## Desenvolvimento local

```bash
pnpm rag:up                      # Qdrant via docker (localhost:6333)
ollama pull nomic-embed-text     # modelo de embeddings (uma vez)
pnpm rag:index                   # indexa data/catalogo.json no Qdrant local
pnpm dev                         # http://127.0.0.1:3000
```
Local usa `QDRANT_URL=http://localhost:6333` (sem key) e `OLLAMA_BASE_URL=http://localhost:11434`.

> ⚠️ **`vercel env pull` sobrescreve o `.env.local` inteiro** — foi assim que o
> `DATABASE_URL` local sumiu em jul/2026, derrubando toda rota que toca o banco.
> Faça backup antes. E ele **não traz vars marcadas como *Sensitive***: grava a string
> `[SENSITIVE]` no lugar. O `DATABASE_URL` de produção é uma delas, então a connection
> string só sai do Supabase (*Project Settings → Database → Connection string*).
> O ambiente **Development** da Vercel está vazio: as vars locais são locais.

## Banco: propostas

`Proposta.status` é `String` livre no Postgres (sem CHECK), validado só pelo Zod
(`StatusProposta`). Isso já mordeu: alguém arquivou 32 propostas direto no banco com
`status = "arquivada"`, valor que o enum não tinha — o `parse` lançava dentro do `map` e
**o histórico inteiro voltava 500**. Duas defesas desde então:

- `listarPropostas` é tolerante: status fora do enum vira `rascunho` com `console.warn`, e
  linha que quebra o contrato em qualquer outro campo é pulada em vez de derrubar a lista.
- `arquivada` entrou no enum. Propostas arquivadas ficam **fora da listagem e dos totais**
  (corte no `WHERE`, não no cliente), com o checkbox "Mostrar arquivadas" pra reexibir —
  `GET /api/propostas?arquivadas=1`.

Ao adicionar status novo, mexa nos dois lados: `StatusProposta`
(`src/lib/contracts/proposta.ts`) e o `STATUS_UI` de `page.tsx`. O `Record<StatusProposta,…>`
quebra o build se faltar um — desde que a UI **importe** o tipo do contrato em vez de
redeclarar a união à mão, que foi exatamente o que deixou os dois lados divergirem.

Para limpar propostas de teste: `scripts/zerar-propostas.mts` (dump antes, `--confirmar`
pra apagar). Prefira arquivar — é reversível.

## Catálogo: contrato do payload

`data/catalogo.json` **não guarda preço**. Todo `preco`/`custoDiluido` é `null`: quem cota
é o consultor, na montagem (ou o orçamento importado). Há teste-guardião em
`tests/unit/catalogo.test.ts` pra preço não voltar a ser fixado ali. Os **tamanhos**, sim,
são do catálogo e batem com a seção `EMBALAGEM` das fichas em `public/fichas-tecnicas/` —
auditado produto a produto em jul/2026.

`GET /api/catalogo` não devolve a ficha completa: só `titulo` e `descricao`. A ficha rica
existe pro PDF, que é montado **no servidor** (`montar.ts` copia direto pro
`PropostaScope`) — mandá-la pro browser era 104 KB por request que nenhuma tela abria.
A resposta usa `Cache-Control: private, no-cache` + **ETag**: o browser sempre revalida e
recebe 304 vazio quando nada mudou. Não troque por `max-age`: com janela de tempo o
catálogo fica obsoleto depois de um deploy (aconteceu, com 5 min de atraso).
