# Spec — Ajustes na Montagem de Proposta (jul/2026)

Rodada de QA sobre o fluxo de **Proposta manual** e a renderização da Proposta de
Solução. Quatro defeitos, todos reproduzidos antes de mexer em código.

Complementa [spec-proposta-consolidada.md](docs/spec-proposta-consolidada.md), que cobre
o layout do PDF. Aqui é a **montagem**: o que a tela envia, o que a proposta guarda.

## Convenção de embalagem do catálogo

Informação do Gustavo (jul/2026), que passa a valer em código:

| Tamanho | Recipiente |
|---|---|
| 5 (L/kg) | galão |
| 20 (L/kg) | balde |
| 50 (L/kg) | tonel azul |
| ml | frasco |

Os tamanhos "estranhos" em kg do catálogo **não são erro de cadastro**: são os mesmos
recipientes pesados, `kg = litros × densidade`. Primmax CIP DTX (d≈1,24) aparece como
6,2 / 62 / 1240 kg — que são o galão de 5 L, o tonel de 50 L e o IBC de 1000 L. Primmax
DGClor (d≈1,16): 23 kg é o balde de 20 L, 58 kg é o tonel de 50 L. Por isso a regra em
[imagem-produto.ts](src/lib/imagem-produto.ts) é por **volume equivalente**, com faixas,
e não por número exato — e `kg` e `L` compartilham a mesma faixa.

Conferido contra as fichas técnicas do fabricante em `public/fichas-tecnicas/`: as
embalagens citadas na ficha batem com as do catálogo (DGClor 5 L · 23 kg · 58 kg;
Texspar DTT 20 · 50 litros; Sanquat 05 · 1.000 litros).

## Item 1 — Produto sem foto

**Era:** 6 produtos caíam em `/produtos/_generico.svg`, um frasco cinza com "?" que não
representava embalagem nenhuma e podia contradizer o tamanho cotado.

**Ficou:** cada um aponta para a **arte do recipiente** correspondente à sua embalagem
(`_galao-5l.svg`, `_balde-20.svg`, `_tonel-50.svg`, `_frasco.svg`), e tanto o card da
revisão quanto a ficha do PDF marcam **"imagem ilustrativa da embalagem"** — desenho
nunca passa por foto do que o cliente recebe.

| Produto | Embalagem | Arte |
|---|---|---|
| Primmax AE Food Grade | 500 ml | frasco |
| Primmax Citrus | 20 L | balde |
| Primma Oxy S | 20 kg | balde |
| Texspar DTT | 20 L | balde |
| Spar Floor Plus | 5 L | galão |
| Pratt Álcool 70% | 5 L | galão |

Onde: [imagem-produto.ts](src/lib/imagem-produto.ts) · selo em
[template-consolidada.ts](src/lib/pdf/template-consolidada.ts) (`.pp-ilustrativa`) e em
[page.tsx](src/app/page.tsx). Guardião: nenhum produto do catálogo usa mais o genérico.

## Item 2 — LINHA {SEGMENTO}

**Era:** o rótulo da rail vinha de `ficha.linhaLabel`, campo **estático por produto**,
com 30 valores inconsistentes e metade em inglês (`KITCHEN`, `AUTO`, `LAUNDRY`,
`LINEN`, `HANDWASH`) e 3 produtos sem valor. Uma proposta de lavanderia saía com
"LINHA KITCHEN".

**Ficou:** o rótulo é derivado do **segmento do cliente**, informado na montagem —
"LINHA LAVANDERIA HOSPITALAR". Sem segmento, a ficha simplesmente não exibe o rótulo;
nunca cai de volta no rótulo antigo. `linhaLabel` continua no contrato como metadado
interno, mas não é mais exibido.

O campo Segmento ganhou **seleção controlada** (datalist com os segmentos que o catálogo
usa, grafia única) e normaliza o que for digitado: `lavanderia_hospitalar`,
`LAVANDERIA HOSPITALAR` e `lavanderias hospitalares` viram a mesma tag. A tela mostra,
ainda na montagem, o rótulo que vai sair impresso.

Junto: o **slug cru vazava para o cliente** na capa ("Segmento lavanderia_hospitalar").
`segmentosLegiveis()` agora cobre capa consolidada, capa Express, orçamento, revisão e
histórico.

Onde: [segmento.ts](src/lib/segmento.ts) · `SegmentoInput` em [page.tsx](src/app/page.tsx).

## Item 3 — Só a embalagem cotada

**Era (confirmado no payload):** escolher "200 kg" no seletor e a tela enviava **todas**
as embalagens do produto, no ramo sem preço replicando o mesmo valor digitado em cada
uma — `[{200kg, 77.00}, {20kg, 77.00}]`. Total inconsistente e tamanho não ofertado
saindo com preço.

**Ficou:** o payload leva **uma** embalagem, a escolhida, com o preço daquele tamanho.
Quem quer o mesmo produto em dois tamanhos adiciona os dois — a seleção é chaveada por
produto+tamanho e cada linha tem preço, diluição e quantidade próprios.

O bloco "Embalagens disponíveis" da ficha **não** desapareceu (decisão do cliente, áudio
16:24): passou a sair de `tamanhosDisponiveis`, novo campo do `PropostaItem` copiado do
catálogo, **sem preço**. No PDF: `5 L · 23 kg (cotada) · 58 kg`, com valor só na cotada.

Onde: `montar()` em [page.tsx](src/app/page.tsx) · `tamanhosDoProduto` em
[montar.ts](src/lib/montar.ts) · contrato em
[contracts/proposta.ts](src/lib/contracts/proposta.ts). Campo **opcional**: proposta
antiga persistida continua parseando e cai na lista de embalagens, como antes.

## Item 4 — Editar depois de montar e depois de salvar

**Era:** depois de "Montar proposta" não havia volta não-destrutiva. "Nova" e o item
lateral "Proposta manual" **desmontavam** a tela e o estado local ia junto: cliente,
itens, tamanhos, preços e diluições, tudo perdido. Não havia como reabrir uma proposta
salva para alterar a seleção.

**Ficou:**

- a tela de montagem fica **montada o tempo todo**, escondida fora de foco — é o
  rascunho vivo. Só `builderKey` a zera, e só "Nova proposta" troca a key (com
  confirmação);
- botão **"Voltar e editar"** na revisão, no lugar da seta que dizia "Nova" e resetava;
- **"Editar"** no histórico: carrega o scope na montagem, com a seleção hidratada
  (produto → tamanho cotado → preço → diluição; item fora do catálogo volta como item
  próprio, sem sumir);
- a remontagem leva o **mesmo `id`** (`EntradaEstruturada.id`), e como o auto-save é
  upsert, editar **atualiza** o registro em vez de duplicar no histórico.

O `GET /api/propostas` 500 foi corrigido em [propostas.ts](src/lib/propostas.ts): uma
linha com `status` fora do enum derrubava `PropostaResumo.parse` e, com ele, a **lista
inteira** — uma proposta ruim escondia todo o histórico. Agora normaliza o status e pula
linha fora do contrato, registrando.

## Verificação

- `pnpm test` — inclui [embalagem-e-linha.test.ts](tests/unit/embalagem-e-linha.test.ts)
  (12 testes: cotada única, tamanhos disponíveis, id preservado, normalização de
  segmento, recipiente por volume equivalente, nenhum genérico no catálogo).
- `pnpm exec vitest run --config vitest.qa.config.ts tests/qa-proposta.qa.ts` — monta
  uma proposta real (3 produtos, um deles cotado num tamanho que **não** é o primeiro do
  catálogo), gera o PDF pelo mesmo `renderPdf` da rota e confere item a item.
- `pnpm qa:layout` — varredura de layout do catálogo inteiro.
