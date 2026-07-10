# Proposta Consolidada — Design

> Novo tipo de proposta `consolidada` (marca IES / Indeba Express), baseado no
> modelo `proposta-indeba-consolidada.pdf`. O núcleo do pedido: **uma página de
> produto rica, gerada automaticamente para cada item da proposta**, a partir dos
> dados do catálogo.

Data: 2026-07-10 · Fonte do modelo: `proposta-indeba-consolidada (4).pdf` (5 páginas).

## Contexto

Hoje o sistema tem 3 tipos de proposta (`orcamento`, `implantacao`, `comercial`),
roteados por `scope.tipo` em `src/lib/pdf/render.ts`, cada um com seu template
(`template-orcamento.ts`, `template.ts`, `template-comercial.ts`). O objeto
canônico `PropostaScope` (`src/lib/contracts/proposta.ts`) vira PDF via Chromium
headless. O catálogo é `data/catalogo.json`, validado por Zod
(`src/lib/contracts/produto.ts`) e lido/cacheado por `src/lib/catalogo.ts`
(MVP sem Postgres). A tela única `src/app/page.tsx` (~4.3k linhas) faz Briefing →
Revisão (edita quantidade + incluir/excluir) → histórico.

O modelo consolidado exige, na página de produto, muito mais dado do que o
catálogo guarda hoje (benefícios, características físico-químicas, modos de
diluição múltiplos, rendimento, título/subtítulo de marketing). Como é um
documento comercial com **afirmações técnicas** (pH, diluição), esses dados
**não podem ser inventados** — precisam vir de uma fonte autoritativa.

## Decisões (aprovadas)

1. **Fonte dos dados ricos:** estender o catálogo com um bloco opcional `ficha`
   por produto. Dados reais, cadastrados por produto. O template omite qualquer
   bloco ausente (degrada com elegância).
2. **Preço editável pelo usuário:** override por embalagem, salvo na proposta
   (`scope.itens[].embalagens[].preco`). O catálogo permanece intacto.
3. **Todos os textos institucionais editáveis** por proposta, com defaults
   pré-preenchidos a partir do conteúdo do modelo.
4. **Novo tipo `consolidada`** (não substitui os existentes), template visual
   `indeba_express`, marca IES.
5. **Comodatos:** lista editável (defaults do modelo; o vendedor pode
   remover/editar/adicionar).
6. **Produtos-piloto** com `ficha` preenchida primeiro: `PRIMMAX-PLUS` e
   `PRIMMAX-DGCLOR`.

## Estrutura do documento (5 seções)

Novo `src/lib/pdf/template-consolidada.ts` exportando
`consolidadaHtml(scope, imagens, assets): string`, plugado no `switch (scope.tipo)`
de `montarDocumento` em `render.ts` como `case "consolidada"`. Rodapé: variante
enxuta (paginação), à semelhança de comercial.

1. **Capa** — logo IES, título "Proposta de Solução", subtítulo, card com
   Cliente / CNPJ / Segmento / **Responsável**, consultor responsável, cidade + data.
2. **Apresentação** — saudação ("Prezado(a),") + parágrafos institucionais +
   4 cards (Produtos Certificados / Atendimento Consultivo / Entrega Ágil /
   Suporte Técnico) + assinatura.
3. **Comodatos Oferecidos** — intro + N cards de equipamento (título + descrição)
   + faixa "Vantagens do Comodato" (bullets com check).
4. **Produto** — **uma página por item de `scope.itens`** (`.map()` com
   `page-break-after: always`). Layout rico: foto grande do produto à esquerda;
   badge de linha; título + subtítulo; descrição; "Indicado para" (ícones);
   "Principais Benefícios" (bullets check); rodapé de blocos — "Modo de Diluição"
   (uso → razão), "Rendimento Aproximado", "Embalagens Disponíveis",
   "Características" (pH/aspecto/cor/odor/uso); faixa "Valor" com preço por
   embalagem. Cada bloco só aparece se a `ficha`/dado existir.
5. **Condições Comerciais** — itens (validade / prazo / pagamento / frete /
   suporte) + card de fechamento (mensagem + assinatura do consultor).

**Chrome visual:** ondas navy, grid de pontos e swoosh laranja reconstruídos em
**CSS/SVG inline** (paleta navy `#0b2a4a` + laranja `#e8622a`), sem depender de
assets ainda inexistentes em `public/`. Ícones via um pequeno set SVG inline
mapeado por nome. **Tradeoff aceito:** fidelidade "fiel, não pixel-perfeito" ao
original do Canva — visual limpo e consistente, ícones não idênticos.
O logo IES usa o asset existente (`public/marca/header-ies.png` / logo IES).

## Modelo de dados

### `src/lib/contracts/produto.ts` — bloco `ficha`

Novo schema `FichaProduto`, todos os campos internos opcionais; `Produto` ganha
`ficha: FichaProduto.nullable().optional()`. Não quebra o catálogo atual (produtos
sem `ficha` continuam válidos).

```
FichaProduto = {
  titulo?: string,            // "Detergente Desengordurante"
  subtitulo?: string,         // "Alcalino Concentrado"
  linhaLabel?: string,        // "KITCHEN"
  descricao?: string,         // parágrafo hero
  indicadoPara?: [{ label: string, icone: string }],
  beneficios?: string[],
  diluicoes?: [{ uso: string, razao: string }],   // { "Limpeza pesada", "1:20" }
  rendimento?: string,        // "Até 100 litros"
  caracteristicas?: { pH?: string, aspecto?: string, cor?: string,
                      odor?: string, uso?: string },
}
```

`icone` é uma chave de um enum fechado de nomes (ex.: `cozinha`, `restaurante`,
`hotel`, `padaria`, `churrascaria`) resolvida pelo set SVG do template. Valor
desconhecido cai num ícone genérico.

### `src/lib/contracts/proposta.ts`

- `Tipo` passa a `z.enum(["orcamento","implantacao","comercial","consolidada"])`.
- `ClienteSnapshot` ganha `responsavel: z.string().nullable()`.
- `PropostaItem` ganha `ficha: FichaProduto.nullable().optional()` — snapshot
  copiado do catálogo na montagem (mantém o PDF reproduzível apenas pelo scope,
  conforme a constituição §4.4). As `embalagens` do item (já um snapshot) passam
  a ser a fonte **editável** do preço.
- Novo bloco `consolidada` no `PropostaScope`, opcional, com todos os textos
  institucionais editáveis:

```
consolidada?: {
  capa: { consultor: string, cidade: string, subtitulo: string },
  apresentacao: { saudacao: string, paragrafos: string[],
                  cards: [{ titulo: string, texto: string, icone: string }] },
  comodatos: { intro: string,
               equipamentos: [{ titulo: string, descricao: string, icone: string }],
               vantagens: string[] },
  condicoes: { itens: [{ titulo: string, texto: string, icone: string }],
               mensagemFechamento: string, consultor: string, cargo: string },
}
```

Presente somente quando `tipo === "consolidada"`. Preenchido na montagem por
`consolidadaDefaults()` (novo helper) com o conteúdo textual do modelo. Cliente,
CNPJ, segmento e data vêm de `ClienteSnapshot` / `criadoEm` (não duplicados aqui).

## Fluxo

- **Montagem** (`src/app/api/montar/route.ts` e `montar-estruturado/route.ts`,
  via `src/lib/montar.ts`): quando `tipo === "consolidada"`, seleciona produtos
  com a lógica atual, **copia `ficha` snapshot** para cada `PropostaItem`, e
  injeta `scope.consolidada` a partir de `consolidadaDefaults()`. O `responsavel`
  do cliente entra vazio/`null` (editado na revisão).
- **Revisão** (`src/app/page.tsx`): adicionar `consolidada` ao array `TIPOS`
  (template `indeba_express`); **edição de preço por embalagem** de cada item; e,
  para `consolidada`, um painel de edição dos textos institucionais
  (`scope.consolidada.*`). Persistência reaproveita o PATCH atual do scope.
- **Render** (`src/lib/pdf/render.ts`): `case "consolidada"` chama
  `consolidadaHtml`; imagens dos produtos já são resolvidas para data-URI pelo
  laço existente sobre `scope.itens`.

## Faseamento

- **Fase 1 (núcleo do pedido — entrega o PDF ponta a ponta):**
  - `FichaProduto` + `Produto.ficha` (contrato).
  - `Tipo += "consolidada"`, `ClienteSnapshot.responsavel`,
    `PropostaItem.ficha`, `PropostaScope.consolidada`.
  - `consolidadaDefaults()` com o conteúdo do modelo.
  - `template-consolidada.ts` completo (5 seções + página de produto repetível +
    chrome CSS/SVG + set de ícones).
  - Wiring em `render.ts`.
  - Montagem copia `ficha` e injeta defaults.
  - `ficha` preenchida no `catalogo.json` para `PRIMMAX-PLUS` e `PRIMMAX-DGCLOR`.
  - Preço editável por embalagem na revisão.
  - Testes: contratos Zod (aceita produto com/sem `ficha`), snapshot do HTML da
    página de produto, roteamento do render por tipo.
- **Fase 2:** UI completa de edição dos textos institucionais
  (`scope.consolidada.*`) na revisão — a parte "tudo editável" mais pesada de
  front. Modelo de dados já suporta desde a Fase 1.

## Riscos e mitigação

- **Dados técnicos inventados** → mitigado pela decisão 1 (`ficha` autoritativa,
  template omite o que faltar). Nada de pH/cor/odor sem cadastro.
- **Fidelidade visual ao Canva** → tradeoff explícito: "fiel, não pixel-perfeito".
- **`page.tsx` já enorme (~4.3k linhas)** → a UI de edição institucional (Fase 2)
  entra como componente isolado, não engrossando o corpo do arquivo.
- **Quebra de compatibilidade do catálogo** → evitada: `ficha` é opcional;
  produtos existentes seguem válidos.

## Fora de escopo

- Migração do catálogo para Postgres (segue como JSON, mesmo contrato).
- Editor visual/WYSIWYG das páginas institucionais (Fase 2 usa formulário simples).
- Reprodução pixel-perfeita dos ícones e ilustrações do Canva.
