# Ajustes pedidos pelo Matheus (áudios 08/10) — Plano de Implementação

> **Para executores:** usar `superpowers:executing-plans` (nativo) ou
> `subagent-driven-development`. Cada tarefa fecha com deliverable testável.
> TDD onde há lógica pura; itens de UI validados no navegador (SPA).

**Goal:** Implementar os 8 pedidos do Matheus na plataforma Indeba, testados no navegador.

**Arquitetura:** Front é um SPA em `src/app/page.tsx` (~6800 linhas), navegação por
estado (`setScreen`), sem rotas por tela. PDFs/fichas via Playwright+Chromium (já
instalados). Lógica de filtro/diluição em `src/lib/*`. Mudanças concentradas em
`page.tsx`, alguns componentes em `src/components/` e libs em `src/lib/`.

**Tech Stack:** Next.js 16, React 19, TypeScript, Prisma/Postgres, Playwright (PDF),
sharp, vitest.

**Spec:** Transcrição dos áudios em `audios-matheus/` + entendimento validado com Gustavo.

## Global Constraints
- Nada vai para a nuvem (dados Indeba/Petrobras). Tudo local.
- Seguir PGI-DEV-001: conventional commits, DoD, TDD onde aplicável.
- SPA: reordenar/criar telas via estado `Screen` — zero risco de 404.
- Não quebrar o PDF final: toda mudança visual na "Proposta de Solução" precisa
  refletir tanto no preview (`page.tsx`) quanto no template (`template-consolidada.ts`).

## Review Focus
- Ficha técnica de produto SEM PDF salvo → hoje abre aba com 404/500; esperado: feedback claro, não erro cru.
- PDF da proposta com asset de marca faltando (`public/marca`) → deve degradar, não derrubar com 500.
- Filtro por vendedor com `autorNome` nulo → não pode esconder registros válidos nem quebrar.
- Agrupamento por ano/mês com `data` inválida/nula → cair num grupo "Sem data", não sumir.
- Propostas feitas: filtro sobre lista vazia → tela não pode quebrar.

---

## Item 1+2 (BUG — foco do Matheus): Ficha técnica não abre / PDF falha

**Files:**
- Investigar/Modify: `src/app/api/produtos/[codigo]/ficha/route.ts`, `src/lib/produto-custom.ts`
- Investigar: `src/app/api/pdf/route.ts`, `src/lib/pdf/render.ts`, `src/lib/pdf/template-consolidada.ts`
- Modify (UX do link): `src/app/page.tsx:4688-4699` (link ficha do produto)
- Rota registro PDF: `src/app/api/registros/[tipo]/[id]/pdf/route.ts`

- [ ] **Passo 1 (debug sistemático):** reproduzir cada erro de verdade — abrir ficha de produto sem PDF; POST em `/api/pdf` com uma proposta de solução real; ler stack no server. Registrar a causa EXATA antes de corrigir.
- [ ] **Passo 2:** se causa = PDF ausente do produto → retornar mensagem amigável (404 tratado na UI, não aba de erro cru). Teste: req a `/ficha` de produto sem bytes → resposta JSON tratada.
- [ ] **Passo 3:** se causa = exceção no template/asset → corrigir ponto específico (ex. asset de `public/marca` faltando, `img.decode()`/`networkidle` travando). Teste: `POST /api/pdf` com escopo mínimo → 200 + `application/pdf`.
- [ ] **Passo 4:** validar no navegador: abrir ficha técnica e gerar PDF de uma proposta pronta. Evidência: PDF baixado/aberto sem erro.
- [ ] **Passo 5:** commit `fix: corrige abertura da ficha técnica e geração de PDF`.

## Item 3: Valor por litro diluído em evidência (acima, mesmo tamanho)

**Files:**
- Modify: `src/app/page.tsx:3756-3758` (PdfScreen), `:3822-3824` e `:3915-3917` (previews consolidada)
- Modify: `src/lib/pdf/template-consolidada.ts` (bloco "litro diluído"/"Valor embalagem")

- [ ] **Passo 1:** inverter a ordem visual — "Valor por litro diluído" ACIMA do "Valor da embalagem", mesmo tamanho de fonte, só variação de cor (destaque no diluído). Aplicar nos 3 pontos de `page.tsx`.
- [ ] **Passo 2:** espelhar a mesma hierarquia no `template-consolidada.ts` (PDF final).
- [ ] **Passo 3:** validar no navegador (preview) e no PDF gerado. Evidência: screenshot do preview + PDF.
- [ ] **Passo 4:** commit `feat: destaca valor por litro diluido acima da embalagem`.

## Item 5: Filtro de registros técnicos por vendedor

**Files:**
- Modify: `src/lib/filtro-registros.ts` (tipo `FiltroRegistros` + `passaNoFiltro`)
- Modify: `src/components/ferramentas-tecnicas-screen.tsx` (`BarraFiltros` ~110-166; chamada `passaNoFiltro` ~816)
- Modify (espelho comercial): `src/components/ferramentas-comerciais-screen.tsx`
- Test: `tests/` (vitest) para `passaNoFiltro`

- [ ] **Passo 1 (teste que falha):** `passaNoFiltro` com filtro `vendedor` casando `autorNome` (inclui caso `autorNome` nulo → não filtra fora quando vendedor vazio; some quando vendedor setado e não casa).
- [ ] **Passo 2:** rodar teste → falha.
- [ ] **Passo 3:** estender `FiltroRegistros` com `vendedor?` e cruzar em `passaNoFiltro`.
- [ ] **Passo 4:** teste passa.
- [ ] **Passo 5:** UI — adicionar `<select>`/input de vendedor em `BarraFiltros` e passar `v.autorNome` na chamada.
- [ ] **Passo 6:** validar no navegador. Commit `feat: filtro de registros por vendedor`.

## Item 6: Organizar registros por ano/mês (pastas)

**Files:**
- Create: helper `src/lib/agrupar-registros.ts` (agrupa por ano→mês; `data` inválida → "Sem data")
- Modify: `src/components/ferramentas-tecnicas-screen.tsx` (`AbaVisitas` ~783+, render ~1100) e espelho comercial
- Test: `tests/` para o helper

- [ ] **Passo 1 (teste que falha):** `agruparPorAnoMes(registros)` → estrutura `{ano: {mes: [...]}}`, ordenada desc, com bucket "Sem data".
- [ ] **Passo 2:** rodar → falha. **Passo 3:** implementar. **Passo 4:** passa.
- [ ] **Passo 5:** UI — render agrupado colapsável (ano/mês) no lugar da lista plana.
- [ ] **Passo 6:** validar no navegador. Commit `feat: agrupa registros por ano e mes`.

## Item 7: Filtros e organização em "Propostas feitas"

**Files:**
- Modify: `src/app/page.tsx` `HistoryScreen` (~3959; render ~1218) — adicionar busca (cliente/consultor/status) + agrupamento por ano/mês reusando `agrupar-registros.ts`

- [ ] **Passo 1:** adicionar barra de filtro (termo + período + status) sobre a tabela.
- [ ] **Passo 2:** agrupar linhas por ano/mês (reuso do helper do Item 6).
- [ ] **Passo 3:** validar no navegador (incl. lista vazia). Commit `feat: filtros e organizacao em propostas feitas`.

## Item 4: Campos editáveis da Proposta de Solução (prioridade menor)

**Files:**
- Modify: `src/lib/proposta-edit.ts` (persistência de rótulos editáveis)
- Modify: `src/lib/consolidada-defaults.ts` (rótulos default: título, "Comodatos oferecidos")
- Modify: `src/app/page.tsx` (campos de edição na Revisão, ~3258/3301/3331; rótulo ~3925) e `template-consolidada.ts`

- [ ] **Passo 1:** tornar editáveis os rótulos/títulos da Proposta de Solução (ex. "Comodatos oferecidos" → "Tecnologia oferecida"), persistindo por proposta.
- [ ] **Passo 2:** refletir no preview e no PDF.
- [ ] **Passo 3:** validar no navegador. Commit `feat: rotulos editaveis na proposta de solucao`.

## Item 8: Gerador de Certificados (por último; depende de arquivo do Matheus)

**Files:**
- Create: `public/gerador-certificados/index.html` (espelha `public/gerador-contratos/index.html` — **conteúdo final vem do Matheus**)
- Modify: `src/app/page.tsx` — tipo `Screen` (+`"gerador-certificados"`), sidebar (~1101-1107), `MODULOS_DASHBOARD` (~1387-1397), topo (~1257-1258), render iframe (~1262-1268), `CMD_ITEMS` (~395)

- [ ] **Passo 1:** criar o "encaixe" (menu, card, screen, iframe) apontando para `/gerador-certificados/index.html`.
- [ ] **Passo 2:** placeholder funcional na página estática até o Matheus mandar o HTML pronto.
- [ ] **Passo 3:** validar navegação no navegador. Commit `feat: encaixe do gerador de certificados (placeholder)`.
- [ ] **PENDENTE:** substituir o placeholder pelo HTML que o Matheus enviar.

---

## Ordem de execução (prioridade do Matheus)
1. Itens **1+2** (bugs — "foca nisso agora")
2. Item **3** (valor diluído)
3. Itens **5, 6, 7** (filtros/organização)
4. Item **4** (editáveis — menor prioridade)
5. Item **8** (certificados — por último; fecha quando chegar o arquivo)
