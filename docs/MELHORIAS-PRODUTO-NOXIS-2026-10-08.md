# Indeba Express → produto Noxis: melhorias priorizadas (08/10/2026)

> Origem: revisão por 6 lentes independentes (produto/multi-tenant, UX do vendedor, arquitetura,
> segurança/LGPD, operação/observabilidade, comercial), cada uma lendo o código de verdade.
> 48 achados brutos; 20 passaram por um verificador cético e todos os 20 foram confirmados com
> evidência (arquivo:linha). Os demais 28 não foram verificados porque a cota semanal de agentes
> acabou no meio da rodada; estão marcados como **(não verificado)**. Nada aqui foi inventado:
> toda linha cita onde está no repositório.

## 1. Resumo executivo

1. **Não existe tenant.** Nenhum dos 14 models do Prisma tem `empresaId`; marca, logo, CNPJ,
   cidade, textos e gestor vêm de env ou estão chumbados em ~36 arquivos. Hoje a 2ª distribuidora
   é um fork + um banco + um deploy. Esta é a decisão que destrava tudo o resto.
2. **A IA vendida no nome ("PRO IA") depende do PC do Gustavo ligado** com túnel cloudflared de
   URL efêmera. Cada reboot exige redeploy. Para 30 clientes é inviável e é risco LGPD.
3. **Os planos Basic/Regular/Premium não existem no código.** Tudo é liberado para todos; não há
   como entregar um Basic sem entregar o Premium.
4. **Operação às cegas.** Sem healthcheck, sem Sentry, logs da Vercel somem em 1h, CI vermelho
   desde setembro (ninguém notou), `SITE_URL` apontou para domínio morto por 19 dias.
5. **UX do vendedor tem 3 bugs de perda de dado** (itens excluídos voltam ao reabrir, F5 perde o
   rascunho, erros ficam invisíveis) e `page.tsx` com 6.960 linhas torna qualquer correção cara.

## 2. Tabela priorizada

| # | Melhoria | Lentes | Impacto | Esforço | Verificado |
|---|---|---|---|---|---|
| 1 | Model `Empresa` + `empresaId` em todos os dados; catálogo para o banco | produto, arquitetura, segurança, ops, comercial | alto | semanas | ✅ |
| 2 | Objeto `Marca/Tenant` substituindo 156 ocorrências de "Indeba" (PDF, prompts, contratos, UI) | produto, arquitetura, comercial | alto | dias | ✅ |
| 3 | IA em provedor hospedado; túnel só em dev | produto, comercial, ops, segurança | alto | dias | ✅ |
| 4 | Planos como `ferramentas[]` da empresa, bloqueio no backend | comercial | alto | dias | — |
| 5 | CI verde: ignorar `pdf-lib.min.js` no ESLint; tirar `migrate deploy` do build | arquitetura, ops | alto | horas | ✅ |
| 6 | Healthcheck `/api/health` + `src/lib/env.ts` com Zod | ops, arquitetura | alto | dias | ✅ |
| 7 | Sentry + logger estruturado no lugar de 60+ `console.error` | ops | alto | dias | — |
| 8 | Backup diário do Postgres; anexos para storage em vez de `Bytes` | ops | alto | dias | — |
| 9 | Upload valida magic bytes; SVG não serve inline (XSS armazenado) | segurança | alto | horas | — |
| 10 | Sessão revogável (`sessaoVersao`) e `exigirUsuario()` em toda rota | segurança | alto | dias | — |
| 11 | Itens excluídos na Revisão persistem no scope | UX | alto | dias | ✅ |
| 12 | Erros de refino/reabrir/editar visíveis (toast), `aria-live` | UX | alto | horas | ✅ |
| 13 | URL reflete tela+id; rascunho em `localStorage`; auto-save da Revisão | UX | alto | dias | ✅ |
| 14 | Validação da montagem contínua, por item, com foco no campo | UX | alto | dias | ✅ |
| 15 | Onboarding: CLI/tela "criar empresa" + importação de catálogo por planilha | produto, comercial | alto | semanas | ✅ |
| 16 | Geradores de contrato/certificado parametrizados por tenant | produto | alto | dias | ✅ |
| 17 | Quebrar `page.tsx` em telas; apagar 9 telas sem rota (~2.000 linhas) | arquitetura, UX, comercial | alto | semanas | ✅ |
| 18 | Botão "Enviar proposta" (link público assinado + wa.me + e-mail) e rastreio de abertura | comercial | médio | dias | — |
| 19 | Add-on "IA" nos planos: RAG do catálogo, edição por comando, importar orçamento | comercial | alto | dias | — |
| 20 | Auditoria em tabela Prisma (hoje PDF-log mora no Redis do rate limit) | ops, segurança | médio | dias | — |
| 21 | Cadastro por convite + verificação de e-mail; rate limit por conta, falhar fechado | segurança | médio | dias | — |
| 22 | LGPD: inventário de dados, expurgo, anonimização, DPA por distribuidora | segurança | alto | semanas | — |
| 23 | Chromium: `maxDuration` na rota de registros, memória no `vercel.json`, métricas de render | ops | alto | dias | — |
| 24 | Base comum dos 4 templates de PDF (`esc` definido 5 vezes) | arquitetura | médio | dias | — |
| 25 | Mobile: alvos ≥36px, `aria-label` em −/+/×, Selecionados como barra fixa | UX | médio | dias | ✅ |
| 26 | Campo de preço controlado, PT-BR, `inputMode=decimal` | UX | médio | horas | ✅ |
| 27 | Overlay honesto (sem "IA roda no computador da equipe"), cancelar, timeout | UX | médio | horas | ✅ |
| 28 | Testes: job de integração com Postgres, componentes em jsdom, e2e em preview | arquitetura | médio | dias | ✅ |

## 3. Achados em detalhe

### 3.1 Não existe tenant (✅ confirmado por 5 lentes)

**Problema.** `prisma/schema.prisma`: nenhum model tem `empresaId`. Proposta (l.43), Chamado
(l.61), VisitaCarteira, ContratoComodato, ProdutoCustom (l.108), Usuario (l.300, `email @unique`
global), Config (l.88, chave→valor global). Recorte de dados é `where.autor = email` em
`src/lib/propostas.ts:149-152` e `src/lib/anexos.ts:14-16`; admin vê tudo. `ContatoCliente` usa a
razão social como `@id` (l.86): duas distribuidoras com o mesmo cliente colidem. Catálogo base são
150 produtos em `data/catalogo.json` lidos do disco (`src/lib/catalogo.ts:15`), 468 fotos em
`public/produtos`, 147 fichas em `public/fichas-tecnicas`; a 2ª distribuidora herdaria o catálogo
da Indeba. Rate limit e log de PDF no Redis sem prefixo de empresa (`ratelimit.ts:37`, `log.ts:11`).

**Proposta.** Decidir explicitamente entre (a) um deploy + banco por cliente, com provisionamento
scriptado, ou (b) multi-tenant real. Recomendação das lentes: começar por (a) se a 2ª venda for
imediata, migrar para (b) antes de ~5 clientes. Para (b): model `Empresa {id, slug, nome, cnpj,
cidade, cores, logos, contatos, plano, ferramentas[]}`, `empresaId` obrigatório e indexado em todo
model de negócio, `@@unique([empresaId, chave])` em Config e ContatoCliente, `empresaId` carimbado
na sessão (`src/lib/auth.ts:117`) e aplicado por `$extends` do Prisma Client para nenhuma query
escapar. Migração aditiva com `empresaId = indeba` como backfill. Catálogo inteiro para o banco;
`data/catalogo.json` + `public/produtos` viram `prisma/seed-indeba.mjs`. Anexos em Vercel Blob ou
Supabase Storage.

### 3.2 Marca chumbada em 156 ocorrências (✅)

**Problema.** `Marca = z.enum(["indeba","pratt"])` em `contracts/produto.ts:37`;
`template: z.enum(["indeba","indeba_express"])` em `contracts/proposta.ts:101`; `MARCAS` com
cores fixas em `pdf/template.ts:14-17`; `CONSULTOR_PADRAO = Matheus Resende` em `template.ts:37`;
`CIDADE = "Salvador – BA"` em `capa-express.ts:20`; CNPJ/IE/e-mail literais em
`template-orcamento.ts:123-131`; endereço completo em `render.ts:199`; logos em
`brand.tsx:12-24` e `render.ts:228-233`; textos "A Indeba Express agradece" em
`consolidada-defaults.ts:22-61`; prompts de LLM em `escrever-texto.ts:72/101/125`,
`rag/responder.ts:37`, `cobranca/redigir.ts:26`, `extrair-pedido.ts:45`, `gerar-instagram.ts:48`;
contratos em `contrato/gerar.ts:16-17` e `public/gerador-contratos/index.html:271-276` (CNPJ, 18
cláusulas nominais, foro Salvador); envs `INDEBA_WHATSAPP`/`INDEBA_CONSULTOR_EMAIL`
(`montar.ts:45-46`); `page.tsx:3684-3693` (preview do PDF), `:4403`, `:1232`, `:1283`.
O verificador acrescentou: `template-comercial.ts:88/122`, `contatos.ts:101/125`,
`prospectar.ts:64-65/96`.

**Proposta.** Um objeto `Marca` (razão social, fantasia, CNPJ, IE, endereço, cidade, região de
entrega, telefone, e-mails, cores primária/secundária, logos color/white/símbolo, textos
institucionais, certificações, descrição para prompts, cláusulas de contrato) salvo na `Empresa`
(em transição: na tabela Config já existente) e editável pelo gestor em Configurações. Enums de
marca viram `z.string()` validado contra as marcas da empresa. Começar pelos templates de PDF
(visível ao cliente final), depois prompts e contratos.

### 3.3 IA presa a um PC (✅)

**Problema.** `docs/prod-setup.md:13-21`: "a IA em prod só funciona com PC + Ollama + túnel
ligados"; URL trycloudflare muda a cada restart e exige `vercel --prod` de novo
(`scripts/configurar-prod.sh:46`). `ollama.ts:30` retorna false na Vercel sem `OLLAMA_BASE_URL`;
`ollamaDisponivel()` gasta até 6s de timeout por request quando o túnel caiu. Refino de texto,
chat de edição, RAG e embeddings degradam ou dão 503. Textos de proposta e contratos de clientes
trafegam para uma máquina pessoal sem contrato de operador. `QDRANT_COLLECTION=indeba_rag` único.

**Proposta.** Provedor hospedado atrás da interface já existente `gerarJson/gerarTexto/embed`
(chaves já previstas em `.env.example`: DEEPSEEK/ANTHROPIC/OPENAI; ou Vercel AI Gateway).
Ollama só em dev. Coleção Qdrant por empresa. Registrar cada indisponibilidade com duração para
ter SLA real. Só então vender "IA" como item de plano com custo por tenant.

### 3.4 Planos sem mecanismo (não verificado)

**Problema.** `apresentacao/planos.html` §1-2 vende 3/4/5 ferramentas de uma lista de 7.
`grep plano|habilitad|feature` em `src` não acha nada; `MODULOS_DASHBOARD` (`page.tsx:1359-1460`)
é estático com só `soAdmin`. Gerador de Certificados não aparece em planos.html.

**Proposta.** `ferramentas: string[]` na Empresa, lido pelas rotas (`/api/visitas`,
`/api/solicitacoes-comerciais`, `/api/comodatos`, `/api/estoque-comodatos`, `/api/contrato`) e
pela UI. Bloqueio no backend, não só no menu. Viabiliza o upsell "R$ 1.000 por ferramenta extra".
Incluir Certificados como 8ª ferramenta.

### 3.5 CI vermelho desde setembro e migração no build (✅)

**Problema.** Todas as execuções recentes do GitHub Actions falham em ~45s no Lint: ESLint reprova
`public/gerador-contratos/pdf-lib.min.js` ("Unexpected aliasing of this"); `eslint.config.mjs`
não ignora `public/**`. Como o job é sequencial (`ci.yml:27-40`), typecheck, vitest, audit e build
nunca rodam. Deploy na Vercel é independente, então produção sobe sem portão. `package.json:7`:
`build = prisma generate && prisma migrate deploy && next build`: migra em todo build (inclusive
preview), sem backup, e o CI nem teria `DATABASE_URL`/`DIRECT_URL` (foi exatamente o erro do
preview da branch de hoje).

**Proposta.** Adicionar `**/*.min.js` e `public/**` ao `globalIgnores`. Separar `build` de
`db:deploy`; rodar `db:deploy` só em Production (Build Command por ambiente) ou via Actions após
CI verde, com backup antes. Branch protection em `main`. Versão (`VERCEL_GIT_COMMIT_SHA`) no rodapé
do app.

### 3.6 Healthcheck e validação de env (✅)

**Problema.** Nenhuma rota `/api/health`. ~35 leituras de `process.env` em 20 arquivos sem
schema central; `SITE_URL` lido cru em `render.ts:232` e só vira link em
`template-consolidada.ts:292`. Resultado concreto: `SITE_URL` apontou para o domínio antigo por 19
dias e todos os PDFs saíram com link de ficha morto, sem ninguém notar até o Mateus reclamar.
Único smoke de produção testa login e 401.

**Proposta.** `src/lib/env.ts` com Zod (obrigatórias por ambiente, URLs válidas) e `GET /api/health`
público sem dados: `{db, chromium, ia, siteUrl (HEAD 200), versao}`. Monitor externo gratuito a
cada 5 min com alerta para a Noxis. Smoke de produção passa a gerar um PDF e checar o link.

### 3.7 Observabilidade: erros só em `console.error` (não verificado)

`respostaErro` (`src/lib/erro.ts:7`) usado em 43 arquivos; +17 `console.error` soltos em
caminhos de degradação silenciosa (`catalogo.ts:56,82`, `propostas.ts:51,170`, `render.ts`). Zero
SDK de erro; `SENTRY_DSN` só no `.env.example`. Proposta: `@sentry/nextjs` (free tier), logger com
rota/usuário/tenant, Log Drain para reter além de 1h.

### 3.8 Backup e anexos em `Bytes` (não verificado)

Fotos, fichas, contratos e anexos são `Bytes` no Postgres (schema l.120-291). Supabase free sem
PITR; nenhum script de dump. Proposta: `scripts/backup-db.mts` (pg_dump → gz → bucket, retenção 30
dias) por cron do Actions; restore testado mensalmente; anexos novos para storage.

### 3.9 Segurança (não verificado, mas evidência direta no código)

- **Upload confia no MIME declarado** (`anexos/route.ts:29-42`, `visitas/[id]/fotos/route.ts:23`)
  e serve `inline` com CSP `script-src 'unsafe-inline'` (`next.config.ts:18`): SVG com script vira
  XSS armazenado que escala vendedor para admin. Validar magic bytes, allowlist fechada,
  `Content-Disposition: attachment` fora da allowlist.
- **Sessão não revogável**: cookie autocontido, `validarSessao` nunca consulta o banco
  (`auth.ts:127-146`); bloqueio ou troca de senha não derruba sessão ativa por até 8h; várias rotas
  (`/api/pdf`, `/api/montar`, `/api/perfil`...) não chamam `usuarioAtual`. Proposta:
  `sessaoVersao` no Usuario e helper `exigirUsuario(req)` em toda rota.
- **Rate limit falha aberto** sem Upstash (`ratelimit.ts:30,47`); só por IP; sem balde por conta.
- **Cadastro público** sem verificação de e-mail, com enumeração (409 "já tem conta"). Trocar por
  convite com token assinado.
- **Auditoria** cobre só login e PDF (este em Redis sem retenção). Model `Auditoria` no Prisma.
- **LGPD**: contatos, fotos, IP/UA sem prazo; prospecção minera perfis pessoais via Tavily
  (`prospectar.ts:160-181`). Inventário de dados, expurgo, anonimização a pedido, DPA por
  distribuidora, lista de suboperadores no contrato.

### 3.10 UX do vendedor (✅ 7 achados confirmados)

- **Itens excluídos voltam** ao reabrir: `excluded` é `Set` em estado React (`page.tsx:469`),
  `persistirProposta(scope)` grava o scope completo e `reabrirProposta` zera o Set. O total salvo
  difere do PDF que o cliente recebeu. Persistir `incluido` por item.
- **Erros invisíveis**: um `error` único (`page.tsx:466`) consumido só pela `PdfScreen`; refinar,
  reabrir e editar falham em silêncio. Toasts sem `aria-live`, somem em 3,2s mesmo em erro.
- **Rascunho só em memória**: `screen` é `useState`, sem URL/`localStorage`/`beforeunload`; F5 ou
  Voltar perdem tudo; sem deep-link de proposta.
- **Validação da montagem** um erro por clique, banner fora da viewport no celular, sem foco no
  campo. Validar continuamente e marcar cada item pendente.
- **Mobile**: botões −/+/× de 24-26px sem `aria-label`; inputs <16px (zoom iOS); lista com scroll
  aninhado; painel Selecionados vai para o fim da página abaixo de 1180px.
- **Preço não controlado** (`defaultValue` + `onBlur`): não reflete mudança via chat/teto; exibe
  com ponto enquanto o resto usa vírgula.
- **Overlay enganoso**: 3 passos onde o 3º nunca ativa; texto "IA roda no computador da equipe";
  sem cancelar nem timeout.

### 3.11 `page.tsx` com 6.960 linhas (✅)

153 `useState`, 42 `fetch`, 948 estilos inline, 63 `Hoverable`, 23 telas no mesmo arquivo, 9 delas
sem porta de entrada (prospeccao, instagram, financeiro, cobranca, compras, fiscal, contabil,
atendimento, contrato) mas no bundle. Zero teste de componente (vitest só `tests/**/*.test.ts`,
environment node). Proposta: apagar/mover as 9 telas mortas (~2.000 linhas), extrair uma tela por
PR para `src/components/screens/`, hooks de dados em `src/hooks/`, `api-client.ts` tipado pelos
contratos Zod, jsdom + Testing Library para montagem→revisão→PDF antes de refatorar.

### 3.12 Onboarding e comercial (✅ / não verificado)

- `planos.html` §4 promete 30 dias de implantação, mas admin vem de `ADMIN_EMAILS` no env,
  catálogo entra por commit em JSON, cadastro de produto é 1 por vez. Proposta: tela/CLI "criar
  empresa" (gestor inicial, logo, planilha XLSX de produtos com fichas em lote; SheetJS já está no
  bundle em `page.tsx:5754`), checklist de go-live. (✅)
- Diferenciais de IA que já existem e não estão na apresentação: RAG do catálogo
  (`rag/indexar.ts`), edição por comando (`edicao-chat.tsx`), importar orçamento PDF
  (`/api/orcamento/importar`), prospecção Tavily. Empacotar como add-on mensal. (não verificado)
- Proposta termina no download: sem envio, sem rastreio. Fase 1: link público assinado (mesmo
  padrão da ficha técnica liberada hoje em `a2bab59`) + wa.me + e-mail; status "enviada"
  automático. Fase 2: "visualizada". (não verificado)
- 7 telas de agentes (fiscal, contábil, financeiro, compras, cobrança, instagram, atendimento)
  fora do menu e dos planos: decidir se viram oferta (Cobrança tem aderência) ou saem. (não verificado)

## 4. Roadmap sugerido

**Semana 1 (horas cada, destrava o resto)**
- CI verde (`globalIgnores` + separar `build`/`db:deploy`), branch protection.
- `/api/health` + `src/lib/env.ts`; monitor externo; smoke de produção gerando PDF.
- Sentry free + logger.
- Upload com magic bytes; anexos `attachment`.
- UX: erros em toast, campo de preço controlado, overlay honesto, `maxDuration` na rota de registros.

**Mês 1**
- Decisão tenant (a) vs (b) e o objeto `Marca` lido do banco, começando pelos PDFs e contratos.
- IA em provedor hospedado; túnel só em dev.
- Planos como `ferramentas[]` com bloqueio no backend.
- Backup diário + anexos para storage.
- UX: itens excluídos persistidos, URL/rascunho/auto-save, validação por item, mobile.
- Sessão revogável, cadastro por convite, auditoria em tabela.

**Trimestre**
- Multi-tenant real (model `Empresa`, `$extends`, catálogo no banco, seed Indeba).
- Onboarding por tela/CLI com importação de planilha.
- Quebra do `page.tsx`, telas mortas fora, testes de componente e integração.
- Base comum dos templates de PDF; render de PDF fora do bundle se o custo justificar.
- LGPD: inventário, expurgo, anonimização, DPA; add-on IA e botão Enviar nos planos.

## Feito (loop noturno 08→09/10/2026)

Cada item: commit na `main`, lint/tsc/testes verdes, deploy READY e smoke de produção 9/9.

| Hora | Item | Commit |
|---|---|---|
| 23:26 | #5 CI verde: ESLint ignora `public/**`, `*.min.js`, `apresentacao/**`; build do CI compila sem `migrate deploy`. Primeiro run verde desde 23/09. | `26b784b` |
| 23:31 | #12 erros de refinar/reabrir/editar/montar em toast com mensagem humana; toast `role=status`, erro dura 7s. #26 campo de preço controlado em PT-BR. #27 overlay honesto. #23 `maxDuration` na rota de PDF dos registros. | `9382364` |
| 23:35 | #11 item tirado na Revisão persiste (`incluido: false`), volta excluído ao reabrir, total salvo ignora. | `521bc4b` |
| 23:43 | #9 upload valida tipo pelos bytes (PNG/JPEG/WebP/PDF) em anexos, fotos, documento, foto/ficha de produto; entrega inline só para a allowlist. Fecha o XSS por SVG. | `fc5386a` |
| 23:46 | #14 montagem lista todas as pendências de uma vez, rola até o banner (`role=alert`) e repete no toast. | `c6f9f48` |
| 23:48 | #25 botões −/+ com 36px e `aria-label`; rodapé da Revisão sem padding fantasma. | `8f99aef` |

Conferido em produção (Chrome logado como Matheus): Revisão da Engepack mostra "159,00", botões rotulados, rodapé correto.

### Rodada 2 (23:46 → 00:05)

| Item | Commit |
|---|---|
| #13 URL reflete tela e proposta (`?tela=…&id=…`), Voltar/Avançar do navegador trocam a tela, deep-link reabre proposta, aviso ao fechar com rascunho. Fix do deep-link que a sincronia apagava. | `6ec4270`, `94d4ac3` |
| #2 (passo 1) identidade da empresa nos PDFs sai de `src/lib/empresa.ts` (CNPJ, IE, endereço, telefone, e-mail, cidade, região de entrega, consultor padrão); saída idêntica, teste-guardião. | `e4f85ef` |
| #24 `esc`/`brl` dos templates de PDF num único `pdf/base.ts` (eram 5 cópias em 2 variantes); pasta vazia `templates/` removida. | `3227c56` |
| #6 (parte sem segredos) `instrumentation.ts` + `lib/env-check.ts`: no boot, avisa SITE_URL ausente/errada/diferente do domínio de produção da Vercel, e em produção falta de segredo de sessão, banco, Upstash, SMTP, contato do consultor, Ollama. Teria pego o domínio morto no dia 1. | `bc3ccd4` |
| #7 (parte sem Sentry) `respostaErro` loga uma linha JSON com nível, status, tipo do erro, stack curta e commit — filtrável nos logs da Vercel. | `5164ecf` |
| #27 timeout de 60s em montar e 90s em gerar PDF, com mensagem humana (demora e sem conexão). | `a8cf4ce` |

Conferido em produção: `?tela=history` abre a lista direto; Voltar do navegador do Catálogo volta ao Dashboard; smoke 9/9; ficha 381534 responde 200.

**#17 (telas mortas) fica para decisão sua:** elas usam `Hoverable` e `brl` definidos dentro de `page.tsx`, e um `page.tsx` do Next não pode exportar helpers. Ou apagamos as 9 telas (ficam no git), ou movemos `Hoverable`/`brl` para um módulo e as telas para `src/components/legacy/`. Não fiz nenhum dos dois sem você.

**Deixado de fora de propósito nesta noite:** mudanças de auth/env/segredos (healthcheck público, sessão revogável, cadastro por convite, Sentry DSN) e qualquer migração de schema (auditoria em tabela), por não haver banco local para ensaiar a migração antes do build de produção.
