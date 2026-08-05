# F0 — Inventário do menu atual (portão do SPEC de reordenação)

**Data:** 2026-08-05 · **Fonte:** `src/app/page.tsx` (sidebar, linhas 840–913)
**Status:** de-para levantado — **aguardando aprovação antes de F1**

## 1. Menu atual, como está hoje

| Pos. | Seção | Rótulo na tela | `screen` | Visível para | Código |
|---|---|---|---|---|---|
| 1 | Visão geral | **Dashboard** | `dashboard` | todos | page.tsx:842 |
| 2 | Criar proposta | **Proposta manual** | `manual` / `review` / `pdf` | todos | page.tsx:853 |
| 3 | Criar proposta | **Importar orçamento** | `importar` | todos | page.tsx:860 |
| 4 | Criar proposta | **Propostas** | `history` | todos | page.tsx:867 |
| 5 | Criar proposta | **Catálogo** | `catalog` | todos | page.tsx:873 |
| 6 | Sistema | **Configurações** | `config` | **admin** | page.tsx:894 |

São **6 itens** em 3 seções, não uma lista plana. Não há rotas/URLs por item: a navegação é
estado local (`setScreen`), então "reordenar" é reordenar JSX — risco de 404 é zero.

## 2. De-para: SPEC × realidade

| SPEC (§3) | Existe no menu? | Existe no código? | Situação |
|---|---|---|---|
| 1. Proposta de Solução | não com esse nome | sim | É **"Proposta manual"**. "Proposta de Solução" hoje é o *tipo* de proposta (`TIPOS`, valor `consolidada`, page.tsx:343) — e é o único selecionável na criação. Renomear o item de menu é coerente. |
| 2. Importar Orçamento | **sim** | sim | Só ajustar caixa alta do rótulo. |
| 3. Propostas Feitas | como "Propostas" | sim | Renomear. |
| 4. Visitas e Prospecção | **NÃO** | sim — `ProspeccaoScreen` (page.tsx:3889) | Tela pronta e **sem porta de entrada** no menu. Só chega por ⌘K? Não: nem na paleta está. |
| 5. Comodatos | **NÃO** | **NÃO** | Não existe tela, componente nem rota. A palavra só aparece como texto de condição comercial em templates de PDF. **Feature nova inteira.** |
| 6. Contratos | **NÃO** | sim — `ContratoScreen` (page.tsx:4528) | Tela pronta, sem item no menu. |
| 7. Solicitações Internas | **NÃO** | provável — `ChamadosScreen` (`components/chamados-screen.tsx`) | Tela pronta, sem item no menu. **Confirmar se "Solicitações Internas" = Chamados.** |
| 8. Catálogo de Produtos | como "Catálogo" | sim | Renomear. |
| 9. Cadastro de Produtos | **NÃO como item** | **sim, já implementado** | Ver §4. |

**Itens do menu atual que o SPEC não menciona:** `Dashboard` e `Configurações`.
O SPEC diz "nenhum item pré-existente sumiu" (§6/F1) — então os dois precisam de posição definida.

## 3. Observação sobre a premissa do SPEC

O SPEC declara "sistema alvo: dashboard DevExpress". **Não há DevExpress neste projeto** —
é Next.js + React com estilos inline (`package.json` não tem nenhuma dependência DevExpress/DevExtreme).
Ou o SPEC foi escrito sem olhar o repositório, ou o Mateus estava se referindo a outro sistema.

## 4. C1 — Cadastro de Produtos já existe (e responde B1/B2/B3)

Implementado em `src/components/novo-produto.tsx`, aberto pelo **Catálogo → botão "Novo produto"**
(page.tsx:3684, 3718), **restrito ao gestor** (page.tsx:3727). Grava via `POST /api/produtos`.
Spec própria já escrita: `docs/spec-cadastro-produto.md`.

Os três bloqueantes do SPEC **já têm resposta no código em produção**:

| Bloqueante | Resposta encontrada |
|---|---|
| **B1 — Segmento é lista fechada?** | Há **dois** conceitos. `linha` é **enum fechado de 7 valores**: Lavanderia, Alimentos & Bebidas, Limpeza & Conservação, Higiene Clínica, Higiene Pessoal, Tratamento de Pisos, Automotiva (novo-produto.tsx:12–20). `segmentos` é **texto livre**, separado por vírgula, vira array (novo-produto.tsx:154). Provável que o "segmento" do Mateus seja a `linha`. |
| **B2 — Ficha Técnica é PDF, texto ou campos?** | **Os três.** Campos estruturados (pH, aspecto, cor, odor, rendimento, benefícios em lista, diluições uso/razão) **+** upload de arquivo opcional (`ficha`, novo-produto.tsx:164). |
| **B3 — Entra automático no Catálogo?** | **Sim, na hora, sem aprovação.** Texto da própria tela: *"Entra no catálogo na hora, disponível para montar proposta"* (novo-produto.tsx:194). O bug de "cadastrei e não apareceu" já foi corrigido via `catalogoVersao` (page.tsx:397–402). |

Campos que o cadastro **já exige** e o SPEC não previa: `codigo` (SKU, obrigatório),
`marca` (indeba/pratt), `funcoes` (obrigatório — é por elas que a IA acha o produto),
`metodos`, `embalagens` (obrigatório, ao menos uma). **Preço é deliberadamente ausente**
(constituição §1.2: preço vem do humano na montagem).

→ **C1 não é feature nova.** O trabalho real é decidir se ele vira **item de menu próprio**
(hoje é modal dentro do Catálogo) e se continua **só para gestor**.

## 5. F1 — EXECUTADO (05/08/2026)

> **Correção de rumo (Gustavo, 05/08/2026):** a lista do Mateus é a grade de módulos do
> **DASHBOARD** ("Visão Geral", a tela inicial), **não** a sidebar. A sidebar fica só com o
> fluxo de proposta. A primeira tentativa pôs tudo na lateral e foi desfeita.

### 5.1 Dashboard — `MODULOS_DASHBOARD` (grade nova)

O Dashboard não tinha grade de módulos nenhuma: só hero, KPIs e gráficos. Ela nasce agora,
entre os KPIs e os gráficos — os números respondem "como estou", os cards respondem
"o que faço agora".

| Pos. | Card | `screen` | Situação |
|---|---|---|---|
| 1 | **Proposta de Solução** | `manual` | rótulo da foto |
| 2 | **Importar Orçamento** | `importar` | rótulo da foto |
| 3 | **Propostas Feitas** | `history` | rótulo da foto |
| 4 | **Visitas e Prospecção** | `prospeccao` | **primeira porta de entrada** do sistema |
| 5 | **Contratos** | `contrato` | **primeira porta de entrada** do sistema |
| 6 | **Solicitações Internas** | `chamados` | **primeira porta de entrada** do sistema |
| 7 | **Catálogo de Produtos** | `catalog` | por último, como ele pediu |

### 5.2 Sidebar — inalterada em estrutura, só rótulos

| Seção | Rótulo | `screen` | O que mudou |
|---|---|---|---|
| Visão geral | Dashboard | `dashboard` | inalterado |
| Criar proposta | **Proposta de Solução** | `manual`/`review`/`pdf` | era "Proposta manual" |
| Criar proposta | **Importar Orçamento** | `importar` | caixa alta |
| Criar proposta | **Propostas Feitas** | `history` | era "Propostas" |
| Criar proposta | **Catálogo de Produtos** | `catalog` | era "Catálogo" |
| Sistema | Configurações | `config` | inalterado (admin, rodapé) |

Os rótulos acompanharam os do Dashboard de propósito: a lateral e os cards abrem a **mesma
tela**, e chamá-la por dois nomes diferentes confundiria mais que ajudaria.

### 5.3 Decisões

- **Comodatos ficou fora.** Não existe módulo; card apontando para o vazio é pior que ausência.
- **Cadastro de Produtos ficou onde está** (modal dentro do Catálogo, só gestor) — já funciona.
- A **paleta ⌘K** (`CMD_ITEMS`) recebeu os rótulos novos e as 3 telas antes órfãs: nome
  divergente ali faria a busca por "Propostas Feitas" não achar o histórico.
- Rótulo `Visitas e Prospecção` (singular), conforme a foto. Confirmar com o Mateus.
- `ScreenHead` da tela de montagem e o erro do importador passaram a dizer "Proposta de Solução".

Verificação: `npm run lint` 0 erros (3 warnings pré-existentes, fora destes arquivos) ·
`npx tsc --noEmit` limpo · `npm test` 467 testes / 75 arquivos, todos passando.
Navegação é estado local (`setScreen`), não rota — risco de 404 é estruturalmente zero.
**Não verificado visualmente:** o Dashboard exige login, e credenciais não são inseridas por mim.

## 6. Perguntas em aberto

Para o Mateus confirmar (nenhuma delas bloqueia o que já subiu):

1. **Comodatos** — é módulo novo mesmo, ou outro nome para algo que já existe? O que precisa
   fazer nessa tela?
2. **Solicitações Internas** = a tela de Chamados (abrir bug/dúvida/sugestão para o time)?
   Foi o palpite adotado.
3. **"Visitas e Prospecção"** — a foto diz singular, o áudio disse "prospecções". Ficou singular.
4. **"Proposta de Solução"** como item de menu = a antiga "Proposta manual". Confirma?
5. **Cadastro de Produtos** — ele já existe dentro do Catálogo. Serve assim, ou quer item
   próprio no menu?
