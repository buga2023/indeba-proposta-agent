# Dashboard, catálogo e escopo por perfil — 01/08/2026

Origem: vídeo de validação com o Mateus (líder Indeba). Seis pedidos; cinco de código, um de
dado — e o de dado explicava sozinho metade das queixas.

## O que estava acontecendo

**141 dos 150 produtos do catálogo estavam com `ativo: false`.** A tela de Catálogo lista só
`ativo`, então ele via 9 produtos — 6% do catálogo — e reclamou de "não tá aparecendo todos os
produtos", "Subzero não apareceu" e "aqui tá bem arquivado inclusive". O código funcionava
exatamente como escrito. O dado é que estava errado.

Os 141 escondidos vieram da importação da base técnica INDEBA/PRATT, com foto e ficha técnica
completas: 150/150 tinham `imagemPath` e `fichaTecnicaPath` apontando para arquivo existente em
disco. Não faltava nada para eles estarem no ar.

## As lições que ficam

### `ativo` é flag de negócio, não lixeira de importação

Produto importado nasce ativo se tem asset; arquivar é ato deliberado do gestor. Um catálogo
que esconde 94% de si mesmo por default é bug de dado disfarçado de comportamento correto do
código — e a correção é no dado (`scripts/ativar-catalogo.mjs`), nunca com um `if` na tela.

O critério do script é asset em disco, não uma lista de códigos. Hoje passa 150/150, mas é ele
que barra a próxima importação que traga produto sem foto ou sem ficha. Guardado por
`tests/unit/catalogo-assets.test.ts`.

### `ativo` governa quatro caminhos, não um

Mexer nele é mudança de comportamento do agente, não de tela:

| Caminho | Onde |
|---|---|
| Vitrine do Catálogo | `src/app/page.tsx` (`CatalogScreen`) |
| Seleção automática de produtos | `src/lib/selecao/matcher.ts` |
| Índice RAG | `src/lib/rag/indexar.ts` |
| Lista que a IA cita no comando de edição | `src/app/api/comando-edicao/route.ts` |
| Contagem do assistente de ajuda | `src/components/ajuda-chat-logic.ts` |

Depois de mudar `ativo` em massa: **rodar `pnpm rag:index`** e reiniciar o processo (o catálogo
é memoizado em módulo em `src/lib/catalogo.ts` e no corpo/ETag de `api/catalogo/route.ts` —
editar o JSON não invalida em runtime).

### Ficha técnica compartilhada denuncia duplicata

`SPAR-HT2`/`SPAR-HT-2`, `SPAR-HT3`/`SPAR-HT-3` e `PRATT-ALCOOL-GEL`/`PRATT-ALCOOL-GEL-70`
apontavam para o **mesmo PDF de ficha** — é o mesmo produto com o código grafado de dois jeitos.
Ficaram os códigos da importação (nome, ficha e foto reais); os do seed saíram de linha. Isso
resolveu de quebra o pedido de trocar a imagem do Pratt Álcool Gel: quem ficou é o `-70`, que já
apontava para a foto de estúdio.

Já `PRIMMAX-HORT`/`PRIMMAX-HORT-FLV` e `PRIMMAX-LDF`/`PRIMMAX-LDF-PLUS` têm ficha própria cada
um — são produtos distintos e os quatro seguem ativos.

### Busca por texto é intenção explícita

Ela atravessa o filtro de arquivamento: procurar um produto arquivado dentro de "Todos" nunca
achava nada. E comparar as formas cruas não casa o jeito como o vendedor fala com o jeito como o
catálogo grava — `"dg clor"` não bate em `PRIMMAX-DGCLOR`, `"spar ht 2"` não bate em `SPAR-HT-2`.
Normalizar acento e separador dos dois lados (`chaveBusca` em `page.tsx`) resolve. Foi esse o
produto que ele procurou e não achou, e ele **estava ativo o tempo todo**: o arquivamento
escondia uns, a normalização escondia outros.

### "Deixa enxuto pros demais" era isolamento de dados

O pedido veio como UX. Por baixo, `GET /api/propostas` devolvia **todas** as propostas para
qualquer sessão autenticada: um vendedor via nome de cliente e valor de cada proposta dos
colegas. Agora o recorte é por autor no `WHERE` (índice `@@index([autor])` já existia), espelhando
`listarChamados`. Três camadas, e as três importam:

1. **Listagem** — `listarPropostas(limite, arquivadas, autor?)`.
2. **Acesso direto por id** — `GET`/`PATCH` de `/api/propostas/[id]` conferem o dono. Sem isso,
   bastava trocar o id na URL. Responde **404 e não 403**: 403 confirmaria que a proposta existe.
3. **Escrita** — o `POST` faz upsert casando só por `id`, e o `id` vem do cliente. Sem a
   conferência de dono, reenviar o scope com o id de um colega **sobrescrevia** a proposta dele.
   Escopar leitura sem escopar escrita não é isolamento.

Gate por papel no front (menu, `Ctrl+K`, roteador de telas) é camada de UI, não de autorização —
sempre em par com o gate no servidor. Esconder no front e deixar a rota aberta é fachada.

### Gráfico que só pode mostrar zero é lixo visual

"Propostas por tipo" iterava `TIPOS` inteiro, mas desde jul/2026 só `consolidada` pode ser criada
(`TIPOS_SELECIONAVEIS`) — três das quatro barras eram zero permanente. Saiu o gráfico, ficaram os
tipos: proposta antiga com `tipo: "orcamento"` precisa continuar abrindo e exportando, e
`tests/unit/proposta-tipo-legado.test.ts` guarda isso.

## Fora de escopo (fase 2)

- **Cadastro de produto pela tela de Configurações.** O botão "Novo produto" existe desabilitado.
  Depende de decidir se `data/catalogo.json` continua sendo a fonte ou migra para o Prisma.
- **Estética.** "Não vou me preocupar com a estética agora não."
