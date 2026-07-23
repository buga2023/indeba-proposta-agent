# Próximos passos

Pendências abertas a partir da correção do **preço editável na Proposta manual**
(commits `544ea7d`, `763c17e`, `8b8b140` — branch `reconciliacao-modo-de-uso`).

O que já está pronto e em produção: todo produto do catálogo tem campo de preço
editável, pré-preenchido com o valor do catálogo; o digitado prevalece e chega ao
`/api/montar-estruturado` como embalagem explícita, só no tamanho cotado.

---

## 1. Validar em produção com usuário logado — **bloqueado**

A verificação end-to-end foi feita contra o servidor local com `AUTH_ENABLED=false`
(150 produtos / 197 embalagens, todos aprovados) e visualmente no navegador. Em
https://indeba-propostas-agent.vercel.app a checagem ainda **não** foi feita porque a
tela exige login e o agente não digita senha.

Roteiro para quando alguém logado puder validar:

1. Entrar e abrir **Proposta manual**.
2. Buscar `PRIMMAX-DGCLOR` — o campo deve vir com `110.00` já preenchido e editável.
3. Trocar para `88,90` → aparece a marca **editado**; o carrinho passa a mostrar
   "R$ 88,90 un. · preço digitado".
4. Trocar o tamanho no seletor → o campo volta ao preço de catálogo daquele tamanho.
5. Preencher a razão social, montar a proposta e **conferir o PDF**: o valor impresso
   tem que ser o digitado, não o do catálogo.

O passo 5 é o único que os testes atuais não cobrem (eles param no payload enviado,
com o backend stubado). É o que mais importa validar à mão.

## 2. Rodar os E2E no CI

`.github/workflows/ci.yml` roda lint, typecheck, `pnpm test` e build — os dois testes
Playwright (`tests/e2e/*.mjs`) ficam de fora e hoje só rodam localmente, à mão.

Para entrar no CI é preciso: subir o `next dev` (ou `next start`) com
`AUTH_ENABLED=false` em background, esperar a porta responder, instalar o Chromium do
Playwright (`pnpm exec playwright install --with-deps chromium`) e só então executar os
scripts. Vale medir o custo antes — o `preco-todos-produtos.mjs` varre 150 produtos e
leva alguns minutos.

## 3. Preço por tamanho nos produtos sem preço de catálogo

Para produto arquivado (todas as embalagens com `preco: null`), o valor digitado é
aplicado **igual a todos os tamanhos** — está explícito no comentário em
`src/app/page.tsx` (função `montar`). Um produto que vem em 5L / 20L / 200L com preços
diferentes não tem como ser cotado corretamente hoje.

A correção pede um campo de preço por embalagem, não por produto. Como o override já
viaja no payload por embalagem, a mudança é de UI mais do que de contrato.

## 4. Precificar o catálogo

Dos 150 produtos em `data/catalogo.json`, só **9** têm preço; os outros 141 estão com
`preco: null` e dependem de digitação a cada proposta. O campo editável resolve o
sintoma — a origem é o catálogo incompleto.

## 5. Decidir se o ajuste volta para o catálogo

Hoje o preço digitado vale **só naquela proposta**; `data/catalogo.json` não muda. Isso
é intencional (o catálogo é fonte da verdade e não deve ser editado por engano numa
proposta), mas significa que um preço corrigido precisa ser redigitado toda vez.

Se a decisão for permitir a volta, o caminho é uma tela de catálogo com permissão de
admin — nunca o campo da proposta escrevendo direto na fonte.

## 6. Atrito conhecido nos testes (não relacionado)

`tests/unit/cobranca.test.ts` falha (2 testes) sem um Postgres em `localhost:5432`.
Os outros 306 passam. Vale isolar essas duas com um mock ou marcá-las para pular quando
não houver banco, para que `pnpm test` rode limpo numa máquina nova.
