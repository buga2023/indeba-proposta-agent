# Remover "Nova proposta por IA" da navegação; polir a Proposta Manual

Data: 2026-07-16
Pedido original: "SEU FOCO E INTERFACE QUERO QUE VOCE TIRE A NOVO PROPOSTA PO IA DEIXE SO A MANUAL E MELHORE A INTERFACE DELA"

## Contexto

`src/app/page.tsx` hoje oferece duas portas de entrada pra criar uma proposta do zero:
- **Nova proposta** (tela `briefing`): o vendedor digita um texto livre e a IA (`/api/montar`) escolhe os produtos do catálogo e redige o texto.
- **Proposta manual** (tela `manual`): o vendedor escolhe os produtos e quantidades direto do catálogo; preço sempre vem do catálogo (ou é digitado, pra itens arquivados).

Pedido: tirar a porta de entrada por IA da interface, deixar só a Manual como forma de criar proposta do zero, e melhorar visualmente a tela Manual.

## Decisões (via brainstorming com o Gustavo)

1. **Prospecção** hoje manda o lead direto pro motor de IA (`startGeneration` com `prospect`). Isso sai: o clique em "Gerar proposta" de um lead passa a abrir a Proposta Manual com Razão social/Segmento pré-preenchidos a partir do lead.
2. **Fallbacks** que hoje caem na tela de IA quando não há proposta aberta (CTA do dashboard, Revisão sem proposta, histórico vazio, Contrato sem proposta) passam todos a abrir a Proposta Manual direto.
3. **"Refinar com IA"** (dentro da tela de Revisão — reprocessa os itens de uma proposta já montada a partir de um pedido em texto livre) **fica** — é uma feature diferente da criação do zero, usada depois que a proposta já existe (manual ou importada). Não é tocada.
4. **Importar orçamento** (PDF → proposta) **fica** intocado — não é a "proposta por IA" a que o pedido se referia.
5. **Proposta Manual**: a reorganização em passos (wizard Cliente → Produtos → Revisão) foi cogitada e **descartada** — "não quero que mude o que já está validado, quero só mudanças visuais pra deixar mais simples o uso". A tela continua uma página só, com a mesma estrutura (Cliente/tipo → Catálogo → Selecionados) e a mesma lógica (preço do catálogo, item próprio, validações, `/api/montar-estruturado`). Só a apresentação visual muda.
6. O motor de IA no backend (`/api/montar`, `startGeneration`-equivalente) não é apagado — só deixa de ter ponto de entrada na interface como "criar proposta do zero".

## Parte A — Remover a porta de entrada por IA

Trocas de destino (tudo que chamava a tela `briefing` passa a chamar `manual`):

| Local | Antes | Depois |
|---|---|---|
| Nav lateral | Item "Nova proposta" (IA) + item "Proposta manual" | Só "Proposta manual" (vira o único ponto de criação na seção) |
| Paleta (Ctrl+K) | `{ key: "briefing", label: "Nova proposta" }` | Removido |
| Dashboard (hero) | Dois botões: "Nova proposta" (IA) e "Proposta manual" | Um botão só, estilo de CTA principal, indo pra `manual` |
| Dashboard (texto do hero) | Descreve o fluxo de IA | Descreve o fluxo manual |
| Revisão sem proposta / Histórico vazio | `goToBriefing` → tela `briefing` | Vai pra `manual` |
| Contrato sem proposta | `setScreen(scope ? "review" : "briefing")` | `setScreen(scope ? "review" : "manual")` |
| Prospecção → "Gerar proposta" | `setBriefingText` + `setScreen("briefing")` + `startGeneration(briefing, prospect)` | `setScreen("manual")` com um prefill de `{ razaoSocial, segmento }` lido pela tela Manual |

Remoções de código (tudo que só existe pra sustentar a tela de briefing/loading):
- Componentes `BriefingScreen` e `LoadingScreen`
- Tipo `Screen`: remove `"briefing"` e `"loading"`
- Função `startGeneration`, `parseCliente`
- Estados: `loadingStep`, `hasLoadedOnce`, `quickLoading`, `generating`, `tipoProposta`/`setTipoProposta` (nível Home), `stepTimer`/`stopStepTimer`, `textareaRef`
- Constantes `LOADING_MSGS`, `LOADING_LABELS` (só usadas pela LoadingScreen)

Mantido: `briefingText`/`setBriefingText` (usado como acumulador de contexto pelo "Refinar com IA" — `refinarProposta` já funciona corretamente hoje quando a proposta nasce fora da tela de briefing, porque parte de uma string vazia).

## Parte B — Polimento visual da Proposta Manual

Sem mudar estrutura (Cliente+tipo / Catálogo / Selecionados), sem mudar nenhuma função de lógica (`add`, `setQtd`, `addCustom`, `montar`, `precoDe`):

- Mais respiro e hierarquia visual mais clara entre as 3 áreas
- Chips de filtro por linha de produto acima da busca do catálogo — filtra a lista já renderizada (`filtrados`), não muda nenhuma regra de negócio
- Cartões de produto e o painel "Selecionados" com visual mais limpo (espaçamento, estados vazio/carregando)
- Aviso visual quando os campos de cliente vêm pré-preenchidos de um lead da Prospecção

## Fora de escopo

- Qualquer mudança de fluxo/wizard na Proposta Manual
- Autocomplete de cliente, fotos de produto, "mais usados" — não pedidos
- Remoção do motor de IA no backend
- Mudanças em Importar orçamento e em "Refinar com IA"
