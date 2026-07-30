# Imagem da embalagem cotada (rodada 29/07/2026)

Lista de QA do Gustavo (29/07): 26 linhas do mesmo tipo — *"embalagem cotada 20 L, aparece
apenas a de 50 L"*, *"primmax cl aparece apenas a de 5 kg mesmo escolhendo a de 20 kg"*,
*"auto car 1000 plus (não aparece 200 kg)"*. Duas causas independentes, as duas corrigidas.

## Causa 1 — recorte de fundo velho no PDF

O card branco da ficha usa a foto com fundo removido: `<foto>-cutout.png`, ao lado da
original (`src/lib/pdf/render.ts`, `resolverImagemProduto`). O nome-base é o mesmo para
`.jpg` e `.png`, então `autocar-plus.jpg` e `autocar-plus.png` disputam
`autocar-plus-cutout.png`.

Os recortes nasceram em `d59facf`, quando o catálogo apontava para os `.jpg`. Em `97b4b8d`
entraram fotos `.png` melhores — de **outra embalagem** — e o catálogo passou a apontar
para elas, mas os recortes antigos continuaram no disco e o PDF seguiu usando eles. Daí o
Autocar Plus (balde de 20 kg na foto atual) sair no PDF como galão de 5 L.

Casos com recipiente trocado: Autocar Plus, City T Líquido, Primmax CIP DT, Primmax CIP
Nitro, Primmax DT, Primmax Sanap, Texspar Degrease, Spar HT-2/HT-4/HT-5, Pratt Ultra,
Pratt Amaciante Premium, Letahzyme 5E.

Além disso, 25 fotos já vêm do fornecedor com fundo transparente. Nessas o script pulava a
geração ("dispensa cutout") — mas o recorte velho continuava no disco e **vencia** a foto
no `resolverImagemProduto`.

**Correção** — `scripts/gerar-cutouts.mjs`:

- `veioDaFoto()` valida se o recorte saiu da foto ATUAL (mesma dimensão + mesmo RGB nos
  pixels opacos, tolerância de 2/255 para recompressão). Recorte que não casa é regerado
  mesmo sem `--forcar`;
- foto já transparente → o recorte obsoleto é **apagado**, não ignorado;
- o script agora percorre também as fotos por tamanho (`embalagens[].imagemPath`).

Todos os 111 recortes foram regerados e os 25 obsoletos removidos.

## Causa 2 — uma foto, vários tamanhos

Causa estrutural: o produto tem **uma** foto de estúdio, de **um** recipiente, e era ela
que ia pra ficha em qualquer tamanho cotado. Texspar DSA é vendido em 20 L e 50 L e a foto
é a bombona de 50 L — cotar 20 L mostrava ao cliente uma embalagem que não era a dele.

**Correção** — `fotoEmbalagem` no catálogo (qual recipiente a foto mostra, auditado
visualmente nos 42 produtos multi-embalagem com foto) + `imagemDaEmbalagem()` em
`src/lib/imagem-produto.ts`, na ordem:

1. `embalagens[].imagemPath` — foto do próprio tamanho, quando cadastrada;
2. produto que já era arte → arte do recipiente **cotado** (Texspar DTT, Primmax Citrus);
3. foto do produto, quando ela mostra o recipiente cotado — ou quando o catálogo não diz
   qual recipiente ela mostra (tamanho único / não auditado: comportamento antigo);
4. arte do recipiente cotado — a foto existe, mas é de outro recipiente.

`montar.ts` resolve por aí nos três caminhos (seleção por IA, montagem estruturada e
`itemDoCatalogo` do chat de correção), então UI, preview e PDF seguem a mesma imagem.

### Artes de recipiente

Duas novas, porque o granel caía na bombona de 50: `_tambor-200.svg` (200/220 kg) e
`_ibc-1000.svg` (1000 L / 1240 kg). `_tonel-50.svg` foi redesenhado como a **bombona** real
da linha (corpo abaulado, bujões no topo), que é o que a foto mostra.

O número saiu de todas as artes. `kg` é o mesmo recipiente pesado, então a mesma arte serve
23 kg, 58 kg e 75 kg — um "20" desenhado no balde contradiz a embalagem cotada de 23 kg. O
tamanho aparece no texto ao lado (`Valor — 23 kg`); o desenho só mostra o recipiente.
Guardião em `tests/unit/embalagem-e-linha.test.ts`: nenhuma arte `_*.svg` tem `<text>`.

### Fotos por tamanho

Primeiro vieram cinco recuperadas do `.jpg` legado do próprio repo (a foto do galão de 5 L
que estava lá antes do catálogo apontar para o `.png` do tamanho grande): City T 5 L,
Primmax CIP DT 7,5 kg, Primmax CIP Nitro 6,6 kg, Primmax Sanap 5 kg, Texspar Degrease 5 L.

Depois o Gustavo mandou o pacote **"Fotos Produtos"** (WhatsApp, 29/07, 229 arquivos) — e ele
resolve a maior parte do resto, porque **o nome do arquivo traz a embalagem**:

```
BB05L/BB05/BB5L/BD05  bombona ou balde de 5 L      BB50/BB50L/50L  bombona de 50 L
BD20/BD20L/BB20/SC20  balde 20, saco 20 (pó)       TB200/TB220     tambor de 200 / 220
BD22/BB25L            balde 22, bombona 25         G500            frasco de 500 ml
BD04, BB32, BB35      4 kg, 32 kg, 35 kg           Borrifador      pulverizador
```

`scripts/importar-fotos-produto.mjs` casa isso com o catálogo e importa **só o que falta** —
cada par (produto, embalagem) que cairia em arte, e produto sem foto nenhuma. Foto que já
está certa não é tocada. Rode sempre `gerar-cutouts.mjs` depois:

```
node scripts/importar-fotos-produto.mjs "<pasta do pacote>"            # plano
node scripts/importar-fotos-produto.mjs "<pasta do pacote>" --gravar   # aplica
node scripts/gerar-cutouts.mjs
```

25 fotos entraram por aí, incluindo os tambores de 200/220 (Autocar 1000 Plus, Autocar Plus,
City T) e a foto que faltava do **Spar Floor Plus**. Dos 53 tamanhos da lista de QA, **51
saem com foto real**; só Texspar DTC 20 L e Soft's Max Karícia 20 L seguem em arte, porque o
pacote não tem esses dois.

O script é conservador de propósito, e o que ele não sabe resolver ele lista em vez de
adivinhar: variante de fragrância de produto que o catálogo tem como um só (Spar HT-2/HT-4/
HT-5, Iguatemi, Spar 24, Dermol Classic — 19 arquivos), produto fora do catálogo (Spar Pro
1–4, Pratt Auto, Pratt Letahgel), foto ambígua (`Alvaclor_BD20.jpg` não diz se é o 165 ou o
180; `Primmax CL_50L.png` é de um tamanho que o Primmax CL não tem cadastrado) e o
`ALIAS`/`IGNORAR` com o motivo de cada caso.

### A foto por tamanho não chegava na montagem (achado do QA de navegador, 29/07)

As fotos por tamanho acima só valem se a **regra 1** (`embalagens[].imagemPath` vence tudo)
disparar — e ela não disparava em nenhum caminho de montagem real. A tela manual monta o
body do `/api/montar-estruturado` com a embalagem cotada em tamanho, preço e diluição, sem
a `imagemPath`: é dado do catálogo, e a UI não tem por que devolver. `montar.ts` usava a
embalagem do item como veio, então **29 dos 198 pares** saíam com a arte ilustrativa mesmo
tendo foto real do recipiente cotado (Texspar DSA 20 L, Autocar Plus 200 kg, City T Líquido
5 L e 220 kg, Primmax CL 20 L, Primmax DGA nos dois, Texspar Degrease 5 L…). Recipiente
certo, foto perdida — o consultor via desenho onde havia foto do que o cliente recebe.

**Correção** — `imagemDaCotada()` em `src/lib/imagem-produto.ts`: re-hidrata a foto do
próprio tamanho pelo par (tamanho, unidade) antes de aplicar `imagemDaEmbalagem`. É por onde
`montar.ts` passa nos três caminhos (seleção por IA, montagem estruturada e `itemDoCatalogo`),
então tela manual e orçamento importado ganham juntos. Guardião em
`tests/unit/embalagem-e-linha.test.ts`: monta os pares com foto cadastrada exatamente como a
tela manda e exige que **todos** saiam com a foto.

Proposta já salva guardou o `imagemPath` resolvido — corrigir o código não desfaz o
snapshot. `comImagensDoCatalogo()` (`src/lib/propostas.ts`) recalcula a imagem na leitura do
registro, então reabrir uma proposta antiga já mostra a foto certa e o auto-save regrava
(mesma cura que `statusDaLinha` faz com status inválido). Para reescrever o banco de uma vez:

```
node --env-file=.env.local scripts/corrigir-imagem-propostas.mjs            # plano
node --env-file=.env.local scripts/corrigir-imagem-propostas.mjs --gravar   # aplica
```

O roteiro que achou isso está em `docs/spec-qa-navegador-imagem-embalagem.md` (QA de
navegador, catálogo inteiro em 4 camadas).

### Chave do mapa de imagens do PDF

`chaveImagem(item)` = `codigo#tamanhounidade`. O mesmo produto pode estar na proposta duas
vezes em tamanhos diferentes (5 L e 20 L são duas linhas próprias); com a imagem seguindo a
embalagem cotada, chavear só por código faria a segunda linha sobrescrever a primeira.

## Pendências que dependem de material novo

- **Primmax CIP DTX está com a foto do Primmax CIP DT.** `primmax-cip-dtx.jpg` é copia byte
  a byte de `primmax-cip-dt.jpg` e o rótulo no frasco diz "PRIMMAX CIP DT". O catálogo foi
  reapontado para a arte de recipiente até existir a foto do DTX — foto de outro produto
  não vai pra proposta.
- **Primmax DGClor:** as embalagens cadastradas (5 L, 23 kg, 58 kg) conferem com a ficha
  técnica oficial ("baldes plásticos lacrados contendo 23 kg, bombonas de 5L e 58 kg"). O
  que estava errado era a imagem, agora resolvida.
- **Spar HT-6 e Primmax Inox (500 ml) usavam a foto do galão de 5 L** — resolvido. Achado
  da folha de contato do QA de navegador (29/07): produto de tamanho único não passa pela
  auditoria de `fotoEmbalagem` (com um tamanho só não há o que declarar), e os dois
  apontavam para o mock-up genérico de 5 L da linha — o rótulo nem texto real tem ("NONONO
  NONO"). A **ficha técnica** decidiu quem estava errado: *"O SPAR HT-6 é apresentado em
  borrifadores plásticos de 500ml"* (idem Primmax Inox). Cadastro certo, foto errada — os
  dois foram reapontados para `_frasco.svg`, como o Primmax CIP DTX. `fotoEmbalagem` não
  servia aqui: ela precisa apontar para um tamanho que o produto TEM, e nenhum dos dois tem
  5 L. Guardião novo: produto de tamanho único em ml/≤1 L não aponta para foto de estúdio
  (`tests/unit/embalagem-e-linha.test.ts`).

### A embalagem cadastrada bate com a ficha técnica? (150/150)

`scripts/conferir-embalagem-ficha.mjs` extrai a frase *"é apresentado em …"* das 150 fichas
em `public/fichas-tecnicas/` e compara com `embalagens[]` do catálogo. **Rodada de 29/07:
150 conferem, 0 divergências.** A ficha é o documento oficial: quando as duas discordarem,
é ela que manda (constituição §1).

```
node scripts/conferir-embalagem-ficha.mjs            # só as divergências
node scripts/conferir-embalagem-ficha.mjs --todos    # lista todos
node scripts/ler-ficha.mjs <slug> --embalagem        # uma ficha, à mão
```

Fica fora da suíte (abrir 150 PDFs leva ~2 min) — é checagem de dado, para rodar quando o
catálogo mudar. Armadilhas já tratadas no parser: `EMBALAGEM` é com **M** (`EMBALAGENS?` não
casa nada), o título some nas fichas Pratt, o PDF quebra a unidade (`20k g`), o milhar vem
com ponto (`1.240 kg`), as fichas escrevem `04 quilos`/`05 litros` e a do Metalic 5 SI tem
o typo "apresentado **e** bombonas".
- **Produtos de tamanho único não foram auditados.** Sem `fotoEmbalagem` eles mantêm o
  comportamento antigo (a foto do catálogo em qualquer caso). Se alguma dessas fotos for de
  recipiente diferente do tamanho cadastrado, o sintoma continua — a auditoria visual das
  outras ~100 fotos é o próximo passo. O pacote agora dá como cruzar isso sem olhar foto por
  foto: o sufixo do arquivo diz o recipiente, então basta comparar com o tamanho cadastrado.
- **24 pares seguem em arte** por falta de foto no pacote — os frascos de 800 ml (Letah Gel,
  Dermol Bacter Plus/Classic, Pratt Álcool Gel 70%/Sabonete Espuma), os IBC de 1000 L
  (Primmax Sanquat, CIP DTX), Texspar DTC 20 L, DTK/DXA/DXG 50 L, DXG Amon 20 L, DTT nos
  dois, Pratt Desinfetante Floral/Lavanda 50 L, Primmax Citrus 20 L, Primma Oxy S 20 kg,
  Primmax AE Food Grade 500 ml e Pratt Álcool 70%/Álcool Gel 5 L.
- **Candall TMI:** o catálogo diz 20 L e a foto do pacote é `Candall TMI_BB25L` (bombona de
  25 L). Mesmo recipiente pela faixa, mas vale confirmar se o cadastro devia ser 25 L.
- **Fora de escopo, mas veio no pacote:** `Cópia de RELAÇÃO DE CLIENTES ATIVOS.xlsx`, dentro
  de "Limpeza e Conservação". Não foi importada — planilha de clientes não entra em
  `public/`, que é servido publicamente.
