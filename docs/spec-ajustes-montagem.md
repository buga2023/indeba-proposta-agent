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

## Rodada 29/07 — ficha de produto (WhatsApp do Matheus sobre a proposta do Farid)

Três pontos, todos medidos na própria proposta antes de mexer em código. (Os outros dois
pedidos da mensagem — diluição do Pratt Desincrustante e tela de edição — o Matheus
retirou no mesmo fio: a diluição tinha sido digitada errada e a edição já estava no ar.)

**Imagem no tamanho do card.** O card da foto tinha 240x460 px e a foto travava em 208 px
de LARGURA (o recipiente é sempre mais alto que largo), desenhando 208x250 — 47% do card,
com ~200 px de branco morto. Pior: o arquivo de estúdio traz uma moldura transparente
enorme (o produto ocupa ~1/3 dos 750x900 do arquivo), então o produto saía com ~110x150 px
de verdade. Agora o render recorta a margem transparente (`recortarMargem` em
[render.ts](src/lib/pdf/render.ts), com cache e fallback pro arquivo original se o sharp
falhar) e o card virou 240x330 — o produto passou a ocupar **~80% do card**, contra ~16%.

**Zona de Valor +25%.** Segundo print do mesmo dia: a caixa que o cliente lê primeiro
(VALOR · preço · valor por litro diluído · nota de maiores volumes · link da ficha ·
rodapé da página) vinha em corpo de nota de rodapé, 8,5-9,5 px. Toda a caixa subiu 25%,
linha a linha, para a hierarquia não mudar: 9,5→11,9 · 12→15 · 27→33,8 · 17→21,3 ·
9→11,3 · 8,5→10,6. Cabe na rail sem espremer a foto — o card segue em 240x330 e a
varredura do catálogo inteiro continua em 0 problemas.

**Embalagem cotada sempre visível.** O painel de embalagens só saía com 2+ tamanhos, então
produto de tamanho único (Primmax Hort FLV 5,3 kg, Pratt Desincrustante 5 L) não dizia em
lugar nenhum da página que aquela era a embalagem cotada. Agora sai com um tamanho
também, e nesse caso o título é **"Embalagem cotada"** em vez de "Embalagens disponíveis".

**Tamanho com vírgula.** `${e.tamanho}` interpolado direto imprimia o separador decimal do
JavaScript: "5.3 kg" na proposta do cliente. [embalagem.ts](src/lib/embalagem.ts)
centraliza o rótulo (`5 L`, `5,3 kg`, `1.240 kg`) e é usado nos quatro templates de PDF e
nos rótulos de embalagem da tela.

**Arte de recipiente na mesma escala da foto.** Com a imagem passando a seguir a
embalagem cotada (commit anterior), muita ficha caiu na arte do recipiente — e as seis
artes eram desenhos verticais dentro de uma `viewBox` QUADRADA de 300x300, com metade da
largura vazia. No card, o SVG entrava como quadrado e o desenho ficava com ~95x168 px,
contra 216x290 de uma foto recortada. A `viewBox` (e o width/height) de cada arte foi
apertada na caixa do desenho — só a moldura, nenhum traço redesenhado: galão 0,58 ·
balde 0,65 · bombona 0,57 · tambor 0,60 · IBC 0,74 · frasco 0,44 de proporção.

**Diluição da ficha como sugestão.** Fecha o último ponto do áudio de 24/07 ("não me deu
o principal, que é o valor por litro diluído, na diluição que a ficha técnica puxa" — era
o Primmax DT). Em 22 produtos a diluição só existe no texto da ficha, não no
`diluicaoMax` da embalagem: o campo da montagem abria vazio e, como diluição é
obrigatória (Item 3 acima), o consultor tinha que abrir o PDF da ficha e digitar. Agora
aparece um botão **"ficha: até 1:N"** ao lado do campo, que preenche num clique
(`diluicaoSugeridaDaFicha` em [diluicao.ts](src/lib/diluicao.ts)). Continua sendo
sugestão: nada entra na proposta sem o consultor clicar, porque o número da ficha é a
diluição máxima TEÓRICA — no Farid o Matheus cotou o DT a 1:500, e a ficha diz até
1:1000. A decisão de 25/07 ("a diluição é sempre do consultor") segue valendo.

Junto, do mesmo print: os rótulos de "Indicado para" saíam **crus** para o cliente
(`packing_house`, `cozinha_comercial`). 45 rótulos de 15 produtos normalizados em
`data/catalogo-ficha-rascunho.json` para a grafia que o próprio arquivo já usava
("Packing House", "Cozinha Industrial") — mesmo defeito que o Item 2 corrigiu no segmento.

## Rodada 30/07 — ordem dos produtos por arrasto

**Era:** a ordem em que os produtos saem no PDF não tinha controle nenhum. Ela era um
efeito colateral: ordem de inserção das chaves do `Record` de seleção, com os **itens
próprios sempre empurrados para o fim** do payload, mesmo tendo sido adicionados primeiro.
Zerar a quantidade de um item e readicioná-lo mandava ele para o fim. Para pôr o carro-chefe
na primeira página, o consultor tinha que remover tudo e readicionar na sequência desejada.

Isso importa porque `scope.itens` é o **único portador de ordem** — não existe campo
`ordem` no contrato. Na Consolidada cada item é uma página A4, e o índice do array vira o
número impresso no header e a paginação; no Orçamento, a sequência das linhas da tabela.

**Ficou:** o painel "Selecionados" tem **alça de arrasto** e numeração visível (1, 2, 3…).
Arrastar reordena, e a lista se reorganiza embaixo do cursor — o que se vê arrastando já é
o resultado. Item próprio arrasta junto com os do catálogo, para qualquer posição. Reabrir
uma proposta salva para editar devolve a lista na ordem gravada.

Duas decisões que valem registro:

- **Ponteiro, não a API HTML5 de drag-and-drop.** A HTML5 é inerte no toque, e a tela desce
  até o layout de celular — a alça ficaria morta lá, sem nem sinalizar. Eventos de ponteiro
  cobrem mouse e dedo no mesmo caminho. Sem biblioteca nova: o projeto não tem nenhuma de
  DnD e não passou a ter.
- **Mover e soltar são ouvidos na janela, não na alça.** Com `setPointerCapture` na alça o
  arrasto travava depois de UMA posição: ao reordenar, o React move o nó da linha no DOM, o
  navegador solta a captura e os `pointermove` seguintes iam para outro elemento. Quem
  arrastasse do 1º para o 4º lugar parava no 2º. Pego pelo QA de navegador, não a olho.

A alça também é operável por **teclado** (↑ ↓ com ela em foco) — sem mouse e sem toque,
ninguém fica sem reordenar.

Onde: `ordem` / `selecionadas` em [page.tsx](src/app/page.tsx) — a mesma lista ordenada
alimenta o painel **e** o payload de `montar()`, para tela e PDF não discordarem.

## Verificação

- `pnpm test` — inclui [embalagem-e-linha.test.ts](tests/unit/embalagem-e-linha.test.ts)
  (12 testes: cotada única, tamanhos disponíveis, id preservado, normalização de
  segmento, recipiente por volume equivalente, nenhum genérico no catálogo).
- `pnpm test` — inclui
  [ficha-embalagem-cotada.test.ts](tests/unit/ficha-embalagem-cotada.test.ts) (6 testes
  da rodada 29/07: rótulo de tamanho em pt-BR, painel de tamanho único com selo de
  cotada, guardião contra ponto decimal na página).
- `pnpm test` — inclui [ordem-itens.test.ts](tests/unit/ordem-itens.test.ts) (4 testes da
  rodada 30/07: `montarPropostaEstruturada` preserva a ordem do payload com item próprio no
  MEIO; a mesma seleção em ordem diferente sai em ordem diferente; Consolidada e Orçamento
  emitem os itens na ordem do array).
- Os QA de navegador (Playwright) que cobriam a reordenação por arrasto, a proposta ponta a
  ponta e a varredura de layout do catálogo **foram removidos do repositório** (ago/2026, a
  pedido do Gustavo). O que eles provavam na tela — arrasto, ordem do payload, PDF item a
  item — não tem cobertura automatizada hoje; a verificação é manual, com o app rodando.
