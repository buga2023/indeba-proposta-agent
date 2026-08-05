# Spec — Proposta Consolidada (rodada de ajustes de jul/2026)

Origem: áudio do Matheus em 24/07/2026 validando o primeiro PDF real gerado pelo
agente, mais as decisões do Gustavo em 25/07. Este documento registra o que foi
pedido, a decisão tomada em cada ponto e onde a regra vive no código — para que a
próxima mudança no template não desfaça uma delas sem saber o motivo.

Escopo: template da **Proposta Consolidada** (`src/lib/pdf/template-consolidada.ts`),
o cálculo de diluição (`src/lib/diluicao.ts`) e a montagem na Proposta Manual
(`src/app/page.tsx`). Não toca em Orçamento nem no template Comercial.

---

## 1. Resumo do feedback

| # | Pedido (áudio 24/07) | Situação |
|---|---|---|
| 1 | "Aumentar a letra do Vantagens do Comodato, está muito pequenininho" | Feito |
| 2 | "Todas as páginas estão com esse recorte / cortezinho branco no final" | Feito |
| 3 | "Marquei o de 5 litros, ele puxou a embalagem de 20" | Feito |
| 4 | "O meio ainda ficou branco com cinza" (card da foto) | Feito |
| 5 | "Não me deu o principal, que é o valor por litro diluído" | Feito |
| 6 | "Achei muito interessante o link da ficha técnica, ele já abre" | Mantido |
| 7 | "Muitos saíram sem imagem — o Wash Affinity, o DT" | Feito |

Fora do áudio, na mesma rodada: formatação do painel *Modo de diluição*, ordenação
de embalagens em kg, páginas de ficha longa estourando o A4, e uma varredura de QA
de layout sobre o catálogo inteiro.

---

## 2. Vantagens do Comodato — legibilidade

**Problema.** O painel navy da página 03 usava 9,5 px no texto das vantagens ("sem
custo de aquisição", "manutenção preventiva", "substituição"). Legível na tela,
ilegível no impresso.

**Decisão.** Escalar a caixa inteira junto, não só o corpo do texto — título, ícone
de check e espaçamento — para o painel não ficar desequilibrado.

- Texto da vantagem: **12 px** (era 9,5)
- Título "VANTAGENS DO COMODATO": 13 px, `letter-spacing` 1,8 px
- Círculo do check: 30 px; `gap` do grid: 18 px; `padding` do painel: 26/28 px

Onde: `.adv`, `.adv h4`, `.adv-grid`, `.av` em [template-consolidada.ts:482-492](src/lib/pdf/template-consolidada.ts#L482-L492).

## 3. Faixa branca no rodapé de todas as páginas

**Problema.** O Chromium reservava a margem inferior do PDF para o rodapé nativo,
e o fundo colorido de cada seção parava antes dela — desenhando uma tira branca no
pé de **toda** página, não só da capa.

**Decisão.** Margem inferior **zero** e paginação desenhada no HTML, dentro da área
imprimível. A altura de página passa a ser exatamente A4 menos a margem.

- `MARGEM_INFERIOR_CONSOLIDADA = 0` — [template-consolidada.ts:41](src/lib/pdf/template-consolidada.ts#L41)
- `ALTURA_PAGINA = 297mm - margem` — [template-consolidada.ts:42](src/lib/pdf/template-consolidada.ts#L42)
- Consumido em `marginBottom` no render — [render.ts:118](src/lib/pdf/render.ts#L118)

**Regra:** a constante é a fonte única. Quem mexer na margem do Chromium tem de
mexer nela, nunca no `page.pdf()` direto — senão a faixa volta.

## 4. Embalagem cotada vs. embalagens disponíveis

**Problema.** O consultor cotou 5 L e o PDF exibiu 20 L. Duas coisas distintas
estavam se misturando: o tamanho **cotado** (o que tem preço) e a lista de tamanhos
que o produto **tem** (informação da ficha técnica).

**Decisão.**

- A embalagem cotada é **sempre `embalagens[0]`** — convenção já usada em preço,
  subtotal e revisão no resto do app. O tamanho escolhido na montagem é movido para
  a posição 0 ([page.tsx:1296](src/app/page.tsx#L1296)).
- A **zona de Valor** da rail mostra só a cotada. Nenhum outro tamanho recebe preço
  em lugar nenhum do card — [template-consolidada.ts:218-233](src/lib/pdf/template-consolidada.ts#L218-L233).
- "Embalagens disponíveis" lista todos os tamanhos, **sem preço**, e marca a cotada
  com um selo laranja `cotada`. Sem o selo, o cliente lia os demais tamanhos como se
  também estivessem sendo ofertados àquele preço — [template-consolidada.ts:203-211](src/lib/pdf/template-consolidada.ts#L203-L211).
- Ordenação por volume equivalente em ml, com **kg contando como litro** (produtos
  são líquidos/pó de densidade ~1). Sem isso a lista saía "23 kg · 58 kg · 5 L" —
  [template-consolidada.ts:196-198](src/lib/pdf/template-consolidada.ts#L196-L198).

Consequência de contrato: o mesmo produto em dois tamanhos são **itens distintos** da
proposta, e a edição passa a ser por posição, não por código.

## 5. Card da foto — "branco com cinza no meio"

**Decisão.** O card que emoldura a foto do produto é **branco**, não cinza. O recorte
de fundo (`-cutout.png`) é gerado por flood-fill a partir da borda e aplicado a `.png`
também — antes o regex só cobria `.jpg/.jpeg`, e como quase todo produto do catálogo é
`.png`, o recorte nunca era aplicado: a foto de estúdio entrava com fundo branco opaco
colidindo com o card.

O gerador vive em [scripts/gerar-cutouts.mjs](scripts/gerar-cutouts.mjs) — antes era
ad-hoc e não versionado, o que deixou 6 fotos sem recorte sem ninguém perceber. `node
scripts/gerar-cutouts.mjs` cobre só o que falta; `--forcar` regenera.

Dois motivos legítimos para um produto **não** ter `-cutout.png`:

- **Embalagem translúcida** — o fundo vaza pra dentro do produto e o flood-fill o corrói:
  **Candall Cosmetic WR** e **Spar HT3**. Ficam na lista `EXCECOES` do script para que uma
  regeneração futura não os estrague de novo.
- **Foto que já vem transparente do fornecedor** — **Soft's Concentrado** e **Spar HT-8
  Oxy**. Um cutout aqui seria cópia idêntica; o script detecta pela borda e pula.

Nos dois casos o render cai no fallback da foto original (`resolverImagemProduto`,
[render.ts:67-74](src/lib/pdf/render.ts#L67-L74)), que ali já está correta. Fora desses
quatro, todo produto do catálogo tem recorte — é o que o gerador garante.

## 6. Valor por litro diluído — "o principal"

**Problema.** O preço da embalagem sozinho não sustenta a venda. R$ 90,00 num produto
que rende 1:1000 é R$ 0,018 por litro de solução pronta; sem esse número o cliente
compara R$/embalagem em vez de R$/litro de uso.

**Fórmula.** `(preço ÷ litros da embalagem cotada) ÷ fator de diluição`, onde fator =
partes de solução pronta por parte de produto (1:100 → 100).

**Fonte da diluição.** Decisão do Gustavo em 25/07: **sempre o consultor**. Ele informa
a diluição na montagem (ou marca "não dilui", produto pronto para uso). A diluição
automática da ficha técnica **não** é mais a fonte deste número — a ficha continua
descrevendo o modo de diluição no painel, mas não alimenta o cálculo.

**A cotada fala sozinha — no cálculo e no painel.** A montagem grava a diluição do
consultor só em `embalagens[0]`; os demais tamanhos seguem com o `diluicaoMax` do
catálogo ([page.tsx:1276-1290](src/app/page.tsx#L1276-L1290), `comDiluicao`). O painel
*Modo de diluição* lia a **primeira embalagem que tivesse diluição** — então o consultor
marcava "não dilui", o valor por litro diluído sumia (correto) e o painel continuava
anunciando a diluição de catálogo do 20 L, contradizendo o que ele informou. Hoje toda a
diluição da página sai da cotada ([template-consolidada.ts:120-132](src/lib/pdf/template-consolidada.ts#L120-L132)).
Coberto por dois testes em `pagina-produto.test.ts` ("não dilui" e "segue a COTADA").

**Regras de exibição.**

- Sem diluição informada na embalagem cotada → o bloco não aparece. Nunca estimar.
- Abaixo de R$ 0,10 usa **3 casas decimais** — em centavos, R$ 0,018/L viraria
  "R$ 0,02" e perderia a ordem de grandeza.
- Em faixas ("0,10% a 0,30%", "1 a 4 partes") vale a **menor concentração**, que é a
  maior diluição — responde "rende até quanto?".
- O cálculo parte do preço **realmente cotado** (o consultor pode ter mudado o preço na
  montagem), então nunca fica defasado em relação ao `custoDiluido` do catálogo.

Formas de diluição que o parser reconhece (`fatoresDiluicao`): `1:250`, `2 partes para
até 100 partes`, `de 0,10% a 0,30%`, `100 mL para 10 litros`.

Onde: [diluicao.ts](src/lib/diluicao.ts) · render do bloco em
[template-consolidada.ts:226-232](src/lib/pdf/template-consolidada.ts#L226-L232).

## 7. Link da ficha técnica

Aprovado como está. Mantida a regra: o link só é gerado quando o produto tem PDF
cadastrado **e** `siteUrl` está configurado — nunca um link relativo, já que o PDF
final é aberto fora do navegador. [template-consolidada.ts:238-240](src/lib/pdf/template-consolidada.ts#L238-L240)

## 8. Produtos sem imagem

40 fotos do catálogo apontavam para o placeholder (Primmax DT, Primmax Hort FLV, entre
outras) e saíam em branco no PDF. Todas religadas em `data/catalogo.json`.

**Invariante:** os **150** produtos do catálogo têm `imagemPath` preenchido e o arquivo
existe em `public/`. Zero placeholders. Verificável com:

```bash
node -e "const fs=require('fs'),c=JSON.parse(fs.readFileSync('data/catalogo.json','utf8'));
const p=Array.isArray(c)?c:c.produtos;
console.log(p.filter(x=>!x.imagemPath||!fs.existsSync('public'+x.imagemPath)).map(x=>x.nome))"
```

## 9. Painel "Modo de diluição" e ficha longa

Dois problemas de layout descobertos ao varrer o catálogo inteiro:

- **Modo de diluição em bandeira.** Com o texto alinhado à direita, a frase longa do
  Primmax DGCLOR virava um bloco serrilhado de 4 linhas. Passou a grid de colunas
  fixas, instrução alinhada à esquerda, fio separando finalidades. Quando a ficha traz
  `comoAplicar`, vira a tabela de 3 colunas *Modo de uso*
  ([template-consolidada.ts:175-182](src/lib/pdf/template-consolidada.ts#L175-L182)).
- **Página estourada.** A ficha do Primmax Sanap não cabia no A4 e o overflow cortava o
  último painel e o rodapé de contato. Solução: **modo denso automático** por peso de
  texto — `pesoFicha > 1100` liga a classe `prodpg-denso`
  ([template-consolidada.ts:146](src/lib/pdf/template-consolidada.ts#L146)).

## 10. Verificação

- `pnpm test` — unitários, incluindo `diluicao.test.ts`, `pagina-produto.test.ts`,
  `consolidada-html.test.ts`, `montar-consolidada.test.ts`.
- A varredura Playwright do catálogo inteiro (`qa:layout`, **154 páginas**, contra corte,
  imagem quebrada, vazamento de borda e colisão de rodapé) **foi removida do repositório**
  (ago/2026, a pedido do Gustavo).

Sem ela, mudança neste template não tem rede: os quatro defeitos acima só apareceram porque
alguém abriu o PDF de um produto específico. Gere e olhe o PDF dos produtos de ficha longa
(Primmax Sanap é o caso-âncora) antes de subir alteração de layout.

---

## Histórico

| Commit | O que entrou |
|---|---|
| `ee6fbe1` | escolher o tamanho cotado ao adicionar produto na Proposta Manual |
| `e43799c` | `fichaTecnicaPath` + link "Ver ficha técnica completa" |
| `c9d3478` | cutout de fundo para fotos `.png` + 12 cutouts faltantes |
| `5efebc1` | diluição do consultor, 40 fotos religadas, faixa branca, card branco, Vantagens do Comodato |
| `5363236` | Modo de diluição, ordenação kg, modo denso, QA de layout |
