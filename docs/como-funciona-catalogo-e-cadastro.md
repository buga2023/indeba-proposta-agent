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
| Editável pela tela | Não | Sim (remover) |

Os dois caminhos do produto do banco são **derivados do código na leitura**, nunca lidos do
que foi gravado — um `dados` adulterado não consegue apontar a foto para fora do sistema.

## 2. Quem pode cadastrar

Só **gestor** (`papel = "admin"`). A trava existe em duas camadas:

- **UI** — o botão "Novo produto" fica esmaecido; clicar mostra um aviso explicando a
  permissão que falta e onde pedir. (Antes ele simplesmente não fazia nada, o que era
  indistinguível de tela quebrada — foi a queixa que originou esta rodada.)
- **API** — `POST/GET/DELETE /api/produtos` respondem **403** para quem não é gestor. Esta
  é a trava que vale; a de cima é só cortesia.

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

## 5. Removendo

`DELETE /api/produtos?codigo=<CODIGO>` — **só alcança produto cadastrado pela tela**.
Produto do JSON não é apagável por aqui (nem deveria: é versionado no git).

Proposta já salva não quebra: o `PropostaScope` é snapshot, e `comImagensDoCatalogo()` só
recalcula enquanto o código existir.

## 6. Estado verificado em produção (02/08/2026)

- Tabela `ProdutoCustom` **existe e está vazia** — `GET /api/produtos` responde 200 com
  `{"produtos":[]}`. Se a migração não tivesse rodado, o Prisma quebraria e a rota daria
  500. Ninguém cadastrou produto pela tela em produção ainda.
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
