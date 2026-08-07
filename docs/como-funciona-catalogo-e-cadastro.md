# Catálogo e cadastro de produto — como funciona na prática

Documento **operacional**: o que acontece de fato quando alguém cadastra um produto, por
onde ele se propaga e o que já foi verificado. O *porquê* das decisões de arquitetura está
em [`spec-cadastro-produto.md`](spec-cadastro-produto.md) — aqui é o funcionamento.

Verificado em 02/08/2026, local e em produção.

## 1. O catálogo tem duas fontes

```
data/catalogo.json  ──┐
  (150 produtos,      ├──►  catalogoCompleto()  ──►  /api/catalogo  ──►  telas, PDF, RAG
   versionado no git) │
tabela ProdutoCustom ─┘
  (cadastrados pela tela, Postgres)
```

Quem consome não sabe de onde o produto veio: os dois lados falam o mesmo contrato Zod
(`Produto`). A diferença aparece só nos caminhos de arquivo:

| | Produto do JSON | Produto cadastrado pela tela |
|---|---|---|
| Foto | `/produtos/<slug>.png` (arquivo em `public/`) | `/api/produtos/<codigo>/imagem` (bytes no Postgres) |
| Ficha | `/fichas-tecnicas/<slug>.pdf` | `/api/produtos/<codigo>/ficha` |
| Editável pela tela | Não | Sim (editar e remover) |

Os dois caminhos do produto do banco são **derivados do código na leitura**, nunca lidos do
que foi gravado — um `dados` adulterado não consegue apontar a foto para fora do sistema.

## 2. Quem pode cadastrar

Só **gestor** (`papel = "admin"`). A trava existe em duas camadas:

- **UI** — o botão "Novo produto" fica esmaecido; clicar mostra um aviso explicando a
  permissão que falta e onde pedir. (Antes ele simplesmente não fazia nada, o que era
  indistinguível de tela quebrada — foi a queixa que originou esta rodada.)
- **API** — `POST/GET/PUT/DELETE /api/produtos` respondem **403** para quem não é gestor.
  Esta é a trava que vale; a de cima é só cortesia.

O papel vem do **banco** a cada carregamento (`/api/me` → `estadoDaConta`), não do cookie.
Promover alguém em Configurações → Colaboradores vale na navegação seguinte, sem precisar
sair e entrar.

## 3. Cadastrando um produto

Catálogo → **Novo produto**. O formulário tem cinco blocos:

**Identificação** — Código (obrigatório, só letras/números/hífen, vira maiúsculo) e Nome
(obrigatório). Marca (Indeba/Pratt) e Linha.

**Onde o produto se encaixa** — **Funções é obrigatório**: é por elas que a seleção
automática da IA acha o produto. Sem função, o produto existe mas nunca é sugerido.
Métodos e Segmentos são opcionais.

**Embalagens** — ao menos uma, com tamanho válido. **Preço não se cadastra aqui**: o
catálogo é fonte de produto; o valor vem do humano na montagem (constituição §1.2).
Nenhum produto do catálogo tem preço.

**Ficha do produto** — título, rendimento, parágrafo de abertura, benefícios (um por
linha), pH/aspecto/cor/odor e diluições. É isto que preenche a página do produto no PDF.
Deixar vazio gera produto com página pobre — por isso o formulário cobre a ficha rica
junto, e não em um segundo passo.

**Arquivos** — Foto (**obrigatória**, PNG/JPG/WebP, até 5 MB) e Ficha técnica (**PDF,
opcional**, até 20 MB).

### Validações que barram o envio

| Situação | Resposta |
|---|---|
| Código ou nome vazio | Aviso no formulário |
| Nenhuma embalagem com tamanho válido | Aviso no formulário |
| Nenhuma função marcada | Aviso no formulário |
| Sem foto | Aviso no formulário |
| Código já existe (JSON **ou** banco) | 409 — o JSON é checado explicitamente, porque o `@unique` da tabela só enxerga o banco |
| Ficha que não é PDF | 400 |
| Foto que não é PNG/JPG/WebP | 400 |

## 4. O que acontece depois de salvar

O produto **nasce ativo** — quem cadastrou quer usar. Arquivar é ato deliberado depois.

A propagação é imediata, sem deploy e sem reiniciar nada:

1. **Catálogo** — a lista recarrega e o produto aparece com foto e link da ficha.
2. **Proposta manual** — a tela de montagem passa a enxergar o produto **na hora**.
   > Este ponto tinha um bug até 02/08/2026. A tela de montagem **nunca desmonta** (é o
   > rascunho vivo — sai de foco com `display:none` para não perder a seleção em curso), e
   > por isso buscava o catálogo uma única vez, no carregamento da página. O gestor
   > cadastrava, via o produto no Catálogo, ia montar a proposta e ele não estava lá: a API
   > devolvia 151, a montagem seguia com 150. Corrigido com um contador de versão do
   > catálogo, que dispara **só o refetch** — remontar por `key` traria a lista nova mas
   > jogaria fora a seleção, que é justamente o que aquela tela existe para preservar.
3. **PDF da proposta** — `render.ts` reconhece `/api/produtos/<codigo>/imagem` e lê os bytes
   do Postgres direto (o PDF é montado no servidor). O link "Ver ficha técnica completa"
   sai apontando para a rota da ficha.
4. **Seleção pela IA** — entra pelo mesmo `catalogoCompleto()`, achado pelas funções
   marcadas.

## 5. Editando (05/08/2026)

Na lista do Catálogo, o gestor vê dois botões por linha — **lápis** (editar) e **lixeira**
(excluir). Eles só aparecem nos produtos **cadastrados pela tela**; o produto do JSON mostra
o rótulo `base` com a explicação no hover. Quem decide isso é o `GET /api/produtos`, que
lista o que mora no banco: sem essa checagem, clicar em "editar" num produto da base levaria
404 na cara sem motivo aparente.

O formulário de edição é o **mesmo** do cadastro, com quatro diferenças:

| | Cadastro | Edição |
|---|---|---|
| Código | Obrigatório, vira maiúsculo | **Travado** — é ele que forma os caminhos da foto/ficha e liga as propostas já geradas ao produto. Para mudar de código: apaga e cadastra |
| Foto | Obrigatória | Opcional — não anexar **mantém** a atual (a miniatura aparece embaixo do campo) |
| Ficha técnica | Opcional | Só troca com arquivo novo; para tirar, existe o **"Remover a ficha deste produto"**. Não anexar nada nunca apaga a que está lá |
| Ativo | Nasce ativo | Checkbox **"Ativo no catálogo"** — desmarcar arquiva (some dos filtros e da seleção automática, continua na busca e nas propostas antigas) |

`PUT /api/produtos` recebe o mesmo FormData do cadastro. O que o formulário **não** exibe
("indicado para" e rótulo de linha da ficha, `fotoEmbalagem`, preço/custo diluído por
embalagem, características fora das quatro da tela) é preservado pelo merge de
`lib/produto-merge.ts`: editar o nome de um produto não pode apagar em silêncio o que outra
parte do sistema gravou.

A regra do merge, em uma linha: **campo ausente significa "não mexi"; campo vazio significa
"apaguei"**. Por isso o formulário envia sempre os campos que ele controla, em branco quando
o gestor limpou — sem essa distinção, limpar um subtítulo errado seria impossível.

O formulário abre a partir de `GET /api/produtos/<codigo>`, que devolve o produto **inteiro**.
Antes ele partia do produto da listagem, e a listagem vem de `/api/catalogo` com a ficha
recortada para título e descrição — o gestor trocava só a foto e o salvamento levava embora
benefícios, diluições e características (relato do Matheus, 06/08/2026).

Os campos seguem a ordem da **ficha técnica impressa** (abertura, benefícios, composição,
aplicação, modo de uso, diluições, rendimento, características), e o botão **"Preencher campos
a partir da ficha"** lê o PDF anexado e propõe o conteúdo — extração determinística por
cabeçalho (`lib/ficha-tecnica-parse.ts`), sem IA, com o gestor confirmando antes de salvar.

**Clicar fora do formulário não fecha nada** — o clique no fundo escurecido só mostra um
aviso dizendo por onde se sai. Sair é sempre deliberado: o **×**, o **Esc**, o **Cancelar**
ou o **Salvar**.

**E nada do que você digita se perde ao sair.** O formulário guarda um rascunho no próprio
navegador a cada tecla. O × e o Esc fecham **guardando** — reabrir o mesmo produto (ou o
"Novo produto") devolve tudo onde estava, com um aviso no topo. Só o botão **Cancelar**
descarta, e ele pergunta antes. Foto e ficha em PDF são a exceção: o navegador não permite
repovoar um campo de arquivo, então precisam ser anexadas de novo.

O rascunho é por produto (a edição do Alvaclor não se mistura com a do Sanquat) e vive só na
máquina de quem digitou — salvar apaga o rascunho e passa a valer o que está no servidor.

Por causa da edição, a foto e a ficha deixaram de ser servidas como `immutable` — a URL é
fixa e o conteúdo agora troca por dentro dela, então o cache passou a revalidar.

## 6. Removendo

`DELETE /api/produtos?codigo=<CODIGO>` — alcança **qualquer** produto, inclusive os do JSON
(desde 06/08/2026). A linha não é apagada: ela ganha uma **lápide** (`ProdutoCustom.excluido`)
e `catalogoCompleto()` remove aquele código das duas fontes. É o único jeito de sumir com um
produto versionado no git, já que a função da Vercel não reescreve o arquivo.

Como a linha fica, toda exclusão é reversível: `PATCH /api/produtos` com `{ codigo }`
restaura, e o painel no topo do Catálogo lista os excluídos para o gestor. Arquivar (`ativo:
false`) continua sendo o caminho do meio — some dos filtros, continua achável pela busca.

Proposta já salva não quebra: o `PropostaScope` é snapshot, e `comImagensDoCatalogo()` só
recalcula enquanto o código existir.

## 7. Estado verificado em produção (02/08/2026)

- Tabela `ProdutoCustom` **existe e funciona** — `GET /api/produtos` responde 200. Se a
  migração não tivesse rodado, o Prisma quebraria e a rota daria 500.
- **O caminho de escrita foi exercitado em produção** (02/08/2026): cadastro completo pela
  tela com foto e PDF (`ZZ-TESTE-CLAUDE`), catálogo 150 → 151, imagem e ficha servindo 200,
  a tela de montagem enxergando o produto **sem F5**, e remoção depois — voltando a 150 e à
  tabela vazia. O catálogo real não ficou com resíduo.
- 150 produtos (todos do JSON), 13 propostas.
- 9 pessoas: 2 gestores, 7 vendedores; 6 liberados, 3 revogados.
- Todas as telas renderizam sem erro de JavaScript; todas as chamadas de API em 200.

### O que foi testado de ponta a ponta (ambiente local)

- Cadastro pela tela com foto **e** PDF → produto no catálogo, imagem servida, link da
  ficha funcionando.
- O PDF da ficha volta **byte a byte idêntico** ao enviado.
- Produto sem PDF fica com `fichaTecnicaPath: null` (opcional de verdade).
- Arquivo que não é PDF no campo da ficha → 400.
- Produto recém-cadastrado entra na montagem **sem F5** (151 → 152).
- Proposta montada com o produto cadastrado pela tela, até a tela de Revisão.

### O que foi verificado da edição (05/08/2026, build de produção local)

- Cadastrar → **editar sem anexar nada** → a foto e a ficha continuam servindo 200, com os
  mesmos bytes; o texto novo aparece na lista.
- `removerFicha=1` → ficha vira 404, **imagem segue viva**.
- Ficha rica (título, benefícios) sobrevive à edição que não mexe nela.
- Desmarcar "Ativo no catálogo" → badge **Arquivado** na lista, produto ainda encontrável.
- Excluir → confirmação, produto some, `/imagem` passa a 404.
- Produto do catálogo-base aparece com o rótulo `base`, sem botões.

> Nota de ambiente: no `next dev` deste projeto (Next 16.2.9 + Turbopack no Windows)
> **toda** rota dinâmica — `/api/produtos/[codigo]/imagem`, `/api/propostas/[id]`,
> `/api/chamados/[id]` — devolve 500 com "Jest worker encountered child process exceptions".
> É falha do dev server, não do código: as mesmas rotas respondem 200 em `next build` +
> `next start`. Não perca tempo caçando isso na rota.

## 7. Armadilhas ao depurar isto

Aprendidas na marra nesta rodada — todas custaram diagnóstico errado antes de virar nota:

**O middleware responde 401 antes do roteamento.** `GET /api/qualquer-coisa` devolve
`401 {"erro":"Não autenticado."}` mesmo para rota que **não existe**. Um 401 nunca prova que
a rota foi deployada. Para saber o que está no ar, procure um marcador de string dentro dos
chunks JS servidos, ou use `vercel inspect`.

**Existem dois `.ies-head` no DOM.** A tela de montagem fica montada e escondida, com o
cabeçalho dela junto. `document.querySelector('.ies-head')` pega o errado e faz parecer que
a navegação travou. Use o último, ou confira por screenshot.

**Buscar botão por texto no DOM inteiro pega elemento de tela escondida.** Mesma causa.
Filtre por visibilidade ou pelo `title`.

**Botão sem `onClick` é indistinguível de bug.** Foi o que gerou "o botão não está
funcionando". Se um controle não pode agir, ele precisa dizer por quê no clique — `title`
não resolve: ninguém passa o mouse antes de clicar, e no celular não existe hover.

**Ícone tem que corresponder ao destino.** O sino de notificações do header levava à régua
de inadimplência e não notificava nada — existia só porque Cobrança não tinha entrada no
menu. Uma tela sem porta com o nome dela empurra a navegação para o primeiro ícone
disponível, e o ícone errado vira navegação oficial.

Em 02/08/2026 o sino saiu. Cobrança chegou a ganhar item próprio na seção Sistema, mas o
Gustavo pediu para tirar também: hoje ela **não tem nenhuma entrada na interface** — nem
menu, nem paleta ⌘K. A tela (`CobrancaScreen`) e as rotas (`/api/cobranca` e
`/api/cobranca/disparar`, ambas exigindo admin) continuam no código e funcionando; o que
não existe é caminho de clique até lá. Para reativar, basta devolver o item ao bloco
`{ehAdmin && …}` da sidebar.
