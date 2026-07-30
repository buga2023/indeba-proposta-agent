# QA de navegador — a imagem bate com o tamanho cotado? (catálogo INTEIRO)

Roteiro para o **Claude de navegador** (extensão Claude in Chrome) executar sozinho e
devolver um relatório. Sob teste: a regra de `src/lib/imagem-produto.ts`
(`imagemDaEmbalagem`) **chegando na tela e no PDF** — escolher 20 L e ver o balde, escolher
200 kg e ver o tambor.

**Cobertura exigida: todos os produtos, em todos os tamanhos.** Hoje são **150 produtos /
198 pares (produto, embalagem)**. Nada de amostra: o teste cobre os 198, e o roteiro é
montado para isso caber numa sessão de navegador.

É a lista de QA de 29/07 ("embalagem cotada 20 L, aparece apenas a de 50 L") virada em teste
repetível. Histórico do bug: `docs/spec-imagem-por-embalagem.md`.

> **Falha aqui é falha de produto, não de pixel.** O cliente recebe o PDF com a foto do
> recipiente que ele **não** comprou. Divergência entre tamanho e imagem é BUG, mesmo que a
> foto seja bonita e do produto certo.

---

## 1. Preparação

| Item | Valor |
|---|---|
| App local | `pnpm dev` → **http://127.0.0.1:3000** |
| Produção | https://indeba-propostas-agent.vercel.app |
| Login | só existe se houver usuários cadastrados (em local fica aberto). Em produção, entrar em `/login` **antes** — o agente não cria conta |
| Janela | `resize_window` ≥ 1440×900. Abaixo de 760px a sidebar vira gaveta e os passos mudam |

Prefira **local**: mesmo catálogo (`data/catalogo.json`), sem rate limit (o limite de
30 req/60 s só liga com Upstash configurado) e sem sujar o histórico do time.

Conduta do agente:

- abra **aba nova** (`tabs_create_mcp`); não reaproveite aba do usuário;
- **não** clique em nada que abra `confirm`/`alert` — trava a extensão;
- as Camadas A–C **não gravam nada** (montagem não persiste; quem grava é "Baixar PDF");
- se um passo falhar 2–3 vezes, **pare e relate** — não fique variando o approach.

---

## 2. A regra sob teste

`imagemDaEmbalagem(produto, embalagemCotada)`, nesta ordem:

1. `embalagens[i].imagemPath` — foto do próprio tamanho, quando existe. **Vence tudo.**
2. produto cuja `imagemPath` já é arte (`/produtos/_*.svg`) → **arte do recipiente cotado**.
3. produto sem `fotoEmbalagem` no catálogo → a foto do produto, em qualquer tamanho.
4. tem `fotoEmbalagem`: mesmo recipiente que o cotado → foto; recipiente diferente →
   **arte do recipiente cotado**.

Faixa de recipiente (`arteDoRecipiente`). `kg` e `L` dividem a faixa: kg é o mesmo
recipiente pesado (23 kg é o balde de 20 L; 58 kg é a bombona de 50 L).

| Tamanho | Arte | Como se parece |
|---|---|---|
| `un` | `_generico.svg` | frasco cinza com "?" |
| `ml` ou ≤ 1 | `_frasco.svg` | frasco de bancada |
| ≤ 9 | `_galao-5l.svg` | galão de 5 L, alça no topo |
| ≤ 29 | `_balde-20.svg` | balde com tampa e alça em arco |
| ≤ 119 | `_tonel-50.svg` | bombona azul abaulada, dois bujões no topo |
| ≤ 600 | `_tambor-200.svg` | tambor cilíndrico com aros |
| > 600 | `_ibc-1000.svg` | IBC em gaiola metálica |

Invariantes válidas em **toda** tela:

- **Selo ⟺ arte.** Path começa com `/produtos/_` ⟺ aparece "imagem ilustrativa" (revisão) /
  "Imagem ilustrativa da embalagem" (preview e PDF). Desenho nunca passa por foto.
- **Arte não tem número desenhado.** O tamanho só aparece no texto ao lado
  (`Embalagem — 23 kg`). Número dentro do desenho = bug.

---

## 3. Cobertura em 4 camadas

| Camada | O que faz | Cobertura | Custo |
|---|---|---|---|
| **A** | Oráculo: calcula a imagem esperada de cada par a partir do `/api/catalogo` e checa se todo arquivo carrega | 198/198 | ~1 min |
| **B** | Monta **de verdade** todos os pares pelo `/api/montar-estruturado` e compara com o oráculo | 198/198 | ~3 min |
| **C** | Folha de contato: grade com a imagem **entregue** + rótulo do tamanho, para o agente **olhar** | 198/198 | ~10 screenshots |
| **D** | Clique a clique na UI (montagem → revisão → preview → PDF) nos 8 casos-âncora | 8 pares | ~15 min |

A, B e C cobrem o catálogo inteiro; D prova que as telas usam mesmo esse caminho.
**Nenhuma pode ser pulada** — B pega dado errado, C pega foto errada com dado certo (o
catálogo pode estar mentindo sobre a foto), D pega a tela que não usa a regra.

---

## 4. Camada A — oráculo (198/198)

Com a app aberta, rode via `javascript_tool` (mesma origem, usa o cookie de sessão):

```js
const { produtos } = await (await fetch('/api/catalogo')).json();
const arte = (t, u) =>
  u === 'ml' ? '_frasco' : u === 'un' ? '_generico' :
  t <= 1 ? '_frasco' : t <= 9 ? '_galao-5l' : t <= 29 ? '_balde-20' :
  t <= 119 ? '_tonel-50' : t <= 600 ? '_tambor-200' : '_ibc-1000';
const esperado = (p, e) => {
  if (e.imagemPath) return e.imagemPath;
  if (/^\/produtos\/_/.test(p.imagemPath)) return `/produtos/${arte(e.tamanho, e.unidade)}.svg`;
  if (!p.fotoEmbalagem) return p.imagemPath;
  return arte(e.tamanho, e.unidade) === arte(p.fotoEmbalagem.tamanho, p.fotoEmbalagem.unidade)
    ? p.imagemPath : `/produtos/${arte(e.tamanho, e.unidade)}.svg`;
};
window.__qa = produtos.flatMap(p => p.embalagens.map(e => ({
  codigo: p.codigo, nome: p.nome, tam: e.tamanho, un: e.unidade,
  rotulo: `${e.tamanho} ${e.unidade}`, esperado: esperado(p, e),
  recipiente: arte(e.tamanho, e.unidade),
})));
console.log('[QA-A] produtos:', produtos.length, '| pares:', window.__qa.length,
  '| em arte:', window.__qa.filter(l => /\/_/.test(l.esperado)).length);
```

**Números de sanidade em 29/07: 150 produtos, 198 pares, 26 em arte.** Divergiu muito? O
catálogo mudou — siga assim mesmo, mas registre os números novos no relatório (o oráculo é
a verdade corrente, não esta tabela).

Todo arquivo referenciado tem que existir e carregar:

```js
const paths = [...new Set(window.__qa.map(l => l.esperado))];
const quebradas = [];
for (const src of paths) {
  const ok = await new Promise(r => { const i = new Image();
    i.onload = () => r(i.naturalWidth > 0); i.onerror = () => r(false); i.src = src; });
  if (!ok) quebradas.push(src);
}
console.log('[QA-A] paths distintos:', paths.length, '| quebradas:', JSON.stringify(quebradas));
```

Leia com `read_console_messages`, pattern `\[QA-`.

---

## 5. Camada B — montar todos os pares de verdade (198/198)

`/api/montar-estruturado` é **exatamente** o que a tela de Proposta manual chama, e a
resposta traz o `imagemPath` que revisão, preview e PDF vão usar. Dá para cobrir o catálogo
inteiro em ~8 lotes, sem clicar.

```js
const CHUNK = 25, entregue = [], falhas = [];
for (let i = 0; i < window.__qa.length; i += CHUNK) {
  const lote = window.__qa.slice(i, i + CHUNK);
  const r = await fetch('/api/montar-estruturado', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tipo: 'consolidada',
      cliente: { razaoSocial: `QA Imagem lote ${i / CHUNK + 1}`, cnpj: null, segmento: null, responsavel: null },
      // OBRIGATÓRIO: sem textoApresentacao a montagem chama a IA (Ollama) para escrever a
      // apresentação — lento em local e sujeito ao túnel em produção. Não afeta a imagem.
      textoApresentacao: 'QA — não usar',
      itens: lote.map(l => ({ codigo: l.codigo, quantidade: 1, embalagens: [
        { tamanho: l.tam, unidade: l.un, preco: '100.00', diluicaoMax: null, custoDiluido: null } ] })),
    }),
  });
  if (!r.ok) { falhas.push({ lote: i / CHUNK + 1, status: r.status, corpo: (await r.text()).slice(0, 200) }); continue; }
  const scope = await r.json();
  scope.itens.forEach((it, j) => entregue.push({ ...lote[j], entregue: it.imagemPath,
    conferiu: it.codigo === lote[j].codigo }));
  await new Promise(r2 => setTimeout(r2, 1100)); // rate limit da produção (30 req/60 s)
}
window.__entregue = entregue;
const div = entregue.filter(l => l.entregue !== l.esperado);
const selo = entregue.filter(l => /^\/produtos\/_/.test(l.entregue));
console.log('[QA-B] montados:', entregue.length, '| lotes com erro:', JSON.stringify(falhas),
  '| desalinhados:', entregue.filter(l => !l.conferiu).length,
  '| em arte:', selo.length, '| DIVERGENTES:', div.length);
console.log('[QA-B] lista:', JSON.stringify(div.map(d => `${d.nome} ${d.rotulo}: esperado ${d.esperado} | entregue ${d.entregue}`), null, 1));
```

Cada linha de `DIVERGENTES` é um achado. Antes de reportar, classifique pela §8
(conhecido × novo). `entregue.length` **tem** que bater com `window.__qa.length` — se um
lote falhou, refaça só aquele lote antes de seguir.

---

## 6. Camada C — folha de contato: olhar os 198 (o olho é insubstituível)

Camadas A e B comparam **strings**. Se o catálogo diz que `texspar-dta-balde.png` é um balde
e a foto é uma bombona, as duas passam e o cliente recebe errado do mesmo jeito. É aqui que
o agente ganha do teste automatizado: **ver**.

Abra uma **segunda aba** da app (mesma origem, para as imagens carregarem) e substitua o
corpo pela grade — a aba é descartável, feche ao final:

```js
document.title = 'QA folha de contato';
const dados = window.opener?.__entregue || window.__entregue;   // cole __entregue nesta aba se preciso
document.body.style.cssText = 'margin:0;background:#fff;font:12px/1.3 system-ui';
document.body.innerHTML = `<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;padding:8px">` +
  dados.map((l, n) => `<div style="border:1px solid #ddd;border-radius:8px;padding:6px;text-align:center">
    <div style="height:120px;display:flex;align-items:center;justify-content:center">
      <img src="${l.entregue}" style="max-width:100%;max-height:118px;object-fit:contain">
    </div>
    <div style="font-weight:700">${n + 1}. ${l.nome}</div>
    <div style="font-size:15px;color:#0b4f8a;font-weight:800">${l.rotulo}</div>
    <div style="color:#888;font-size:10px">${l.entregue.split('/').pop()}</div>
    <div style="color:#b45309;font-size:10px">${/\/_/.test(l.entregue) ? 'ARTE' : 'foto'} · esperado ${l.recipiente}</div>
  </div>`).join('') + `</div>`;
```

Com 6 colunas, cada tela mostra ~24 cartões → **~9 screenshots** para os 198. Role de tela
em tela (`computer` → scroll + screenshot) e, em cada cartão, responda:

1. o recipiente **na imagem** é o da faixa do rótulo? (`20 L` → balde; `200 kg` → tambor;
   `50 L`/`58 kg` → bombona abaulada; `5 L` → galão; `1000 L` → IBC em gaiola)
2. tem **número desenhado** na arte? (bug — só o texto pode dizer o tamanho)
3. o cartão diz `ARTE` mas a imagem é uma foto de estúdio, ou o contrário? (bug de dado)

Anote o **número do cartão** de cada suspeita — é o índice em `window.__entregue`, e é o que
liga o achado ao produto no relatório.

---

## 7. Camada D — ponta a ponta na UI (8 casos-âncora)

Prova que as telas consomem a mesma resolução. Os âncoras cobrem os 4 ramos da regra e as
2 regressões conhecidas:

| # | Produto | Tamanho | Imagem esperada | Ramo | Selo? |
|---|---|---|---|---|---|
| 1 | **Texspar DSA** | 20 L | `texspar-dsa-balde.png` | 1 — foto do tamanho | não |
| 2 | **Texspar DSA** | 50 L | `texspar-dsa.png` | 4 — foto casa | não |
| 3 | **Texspar DTC** | 20 L | `_balde-20.svg` | 4 — foto é de 50 L | **sim** |
| 4 | **Texspar DTT** | 50 L | `_tonel-50.svg` | 2 — produto já era arte | **sim** |
| 5 | **Autocar Plus** | 200 kg | `autocar-plus-tambor.png` | 1 | não |
| 6 | **City T Líquido** | 5 L | `city-t-liquido-galao.png` | 1 | não |
| 7 | **Soft's Max Karícia** | 20 L | `_balde-20.svg` | 4 — foto é de 5 L | **sim** |
| 8 | **Autocar Plus** | 20 kg | `autocar-plus.png` | 4 — foto casa | não |

O par 5 + 8 é o **teste do `chaveImagem`**: os dois na MESMA proposta têm que sair com
imagens diferentes. Se as duas linhas mostrarem o mesmo recipiente, o mapa de imagens do PDF
voltou a ser chaveado só por código.

### 7.1 Montagem (tela "Proposta manual")

1. Sidebar → **Criar proposta → Proposta manual**.
2. **Razão social** (obrigatório): `QA Imagem — <data>`.
3. Card **Catálogo** → campo `Buscar produto por nome ou código…` → nome do caso.
4. Na linha do produto o tamanho aparece **sempre**: `<select>` (title *"Tamanho cotado…"*)
   quando há mais de um; rótulo fixo quando há um só. Selecione o tamanho do caso.
5. **O catálogo está sem preço** (decisão de produto) → aparece o input `Preço R$`. Digite
   `100`. Sem preço, o `+` fica desabilitado.
6. **Diluição é obrigatória** para montar: marque **"não dilui"** (mais rápido, não
   interfere na imagem).
7. Clique no **`+`** (aria-label `Adicionar <produto> à proposta`).
8. Repita 3–7 para os 8 âncoras. Preço e diluição são por **produto + tamanho**: ao trocar o
   seletor para o segundo tamanho do mesmo produto, os dois campos voltam vazios e o `+`
   reabilita — é assim que entram os casos 1+2 e 5+8.
9. **Montar proposta** (botão laranja no topo).

### 7.2 Revisão (cards)

Cada card traz a imagem (90 px), nome, código e `/ <tamanho>` ao lado do preço.

```js
const cards = [...document.querySelectorAll('img[alt]')]
  .filter(i => (i.currentSrc || '').includes('/produtos/'))
  .map(i => ({ alt: i.alt, src: new URL(i.currentSrc).pathname, carregou: i.naturalWidth > 0,
    selo: /ilustrativa/i.test(i.closest('div')?.parentElement?.textContent || '') }));
console.log('[QA-D] revisão:', JSON.stringify(cards, null, 1));
```

Para cada card: `src` == esperado da tabela; `carregou === true`; `selo` presente ⟺ `src`
começa com `/produtos/_`. Depois **screenshot** e confira o recipiente com o olho.

### 7.3 Preview do PDF

**Gerar PDF** leva ao preview. O tipo padrão é **Proposta de Solução (consolidada)**: imagem
à esquerda, caixa **Embalagem** com o tamanho à direita — o par sob teste, lado a lado.

1. Screenshot de cada item: a caixa "Embalagem" diz `20 L` e o desenho ao lado é um balde?
2. Rode o snippet do §7.2 nesta tela.
3. Item em arte tem que exibir **"Imagem ilustrativa da embalagem"** sob a foto, como no
   PDF (`template-consolidada.ts`). Nenhum item em arte sem legenda.

> O toggle de tipo de proposta **não aparece**: `TIPOS_SELECIONAVEIS` (page.tsx) filtra só
> `consolidada`, então Implantação/Comercial são preview morto hoje. Não procure o toggle e
> não reporte a ausência como bug — se um dia voltarem a ser selecionáveis, a imagem tem que
> ser a mesma nos três (o tipo do documento não muda a embalagem cotada).

### 7.4 PDF gerado

1. **Baixar PDF** → cai em Downloads como `proposta-QA-Imagem--<data>.pdf`. **Este é o único
   passo que grava**: além do arquivo, o `baixarPdf` chama o auto-save (`POST /api/propostas`)
   e a proposta de QA entra no histórico, mais um evento no log append-only. Em local, sem
   problema — arquive depois pelo histórico. **Em produção, não faça este passo** sem o
   usuário pedir: vira registro no histórico real do time.
2. Abra em aba: `file:///C:/Users/<user>/Downloads/<arquivo>.pdf`. Se a extensão não tiver
   permissão para `file://`, **pule e diga isso no relatório** — não insista.
3. Uma página por produto: foto no card branco + texto do tamanho. Confira os 8 pares e a
   legenda "Imagem ilustrativa da embalagem" exatamente nos que estão em arte.

Divergência **preview OK / PDF errado** aponta para `resolverImagemProduto` e os recortes
`-cutout.png` (causa 1 da spec original) — reporte com essa suspeita explícita.

> Existe também o QA de layout do catálogo inteiro em PDF (`pnpm qa:layout` →
> `generated/catalogo-completo.pdf`, 150+ páginas). Fora do escopo do navegador, mas se o
> arquivo já existir na máquina, abri-lo é a forma mais rápida de varrer imagem quebrada no
> PDF de todos os produtos.

---

## 8. Linha de base: **zero divergentes**

A primeira execução desta spec (29/07) achou **29 pares** em que o catálogo tem foto do
próprio tamanho (`embalagens[].imagemPath`) e a montagem entregava a **arte** do recipiente
— Texspar DSA 20 L, Autocar Plus 200 kg, City T Líquido 5 L e 220 kg, Primmax CL 20 L,
Primmax DGA 20 L e 50 L, Texspar Degrease 5 L e mais 22. Causa: a tela manda a embalagem
cotada sem o `imagemPath` (dado do catálogo, ela não reenvia) e a regra 1 (*foto do próprio
tamanho vence tudo*) nunca disparava. O recipiente saía **certo**; perdia-se a foto real em
favor do desenho.

Corrigido em `imagemDaCotada` (`src/lib/imagem-produto.ts`), que re-hidrata a foto do
tamanho a partir do catálogo antes de aplicar a regra — vale para a tela manual, o orçamento
importado e a seleção por IA. Guardião: `tests/unit/embalagem-e-linha.test.ts`, *"toda
embalagem com foto cadastrada sai com ela"*. Propostas antigas, que congelaram a arte no
snapshot, são curadas na leitura (`comImagensDoCatalogo` em `src/lib/propostas.ts`); para
reescrever o banco de uma vez existe `scripts/corrigir-imagem-propostas.mjs`.

**Portanto: a Camada B tem que fechar com `DIVERGENTES: 0`.** Qualquer par divergente é
achado novo — reporte com detalhe. Se voltarem exatamente esses 29, a regressão é o
`imagemDaCotada` ter sido desfeito.

---

## 9. Relatório

Nada de resumo otimista: o que não deu para testar é **NÃO TESTADO**, não "OK".

```
Camada A — 150 produtos / 198 pares / 24 em arte · imagens quebradas: 0
Camada B — 198/198 montados · divergentes: 0
Camada C — 198 cartões olhados em 9 telas · suspeitas visuais: 2 (cartões 41, 117)
Camada D — 8 âncoras · revisão ✓ · preview ✓ · PDF ✓ (ou: PDF não testado — sem permissão file://)

| # | Produto      | Tamanho | Esperado              | Entregue              | Olho | Veredito |
|---|--------------|---------|-----------------------|-----------------------|------|----------|
| 1 | Texspar DSA  | 20 L    | texspar-dsa-balde.png | texspar-dsa-balde.png | ok   | PASSA    |
| 2 | Texspar DTC  | 20 L    | _balde-20.svg + selo  | texspar-dtc.jpg       | ✗    | FALHA    |
```

Em cada FALHA: camada, tela, o que apareceu (path **e** o recipiente que você **viu**), o
que era esperado, screenshot. Feche com: imagens quebradas, violações da invariante do selo,
artes com número desenhado, e o que ficou sem teste e por quê.

---

## 10. Armadilhas

- **Catálogo sem preço é o normal.** Não reporte "produto sem preço" como bug; digite `100`.
- **`textoApresentacao` no lote da Camada B não é opcional na prática** — sem ele a montagem
  chama a IA para escrever a apresentação (lento em local, dependente do túnel em produção).
- **Produto arquivado** aparece na busca com `· arquivado` no subtítulo. Serve para o teste.
- **304 do `/api/catalogo`.** Revalida por ETag: se `data/catalogo.json` acabou de mudar,
  recarregue a aba antes da Camada A para não comparar com dado velho.
- **`Primmax CIP DTX` está apontado para arte de propósito** (a foto disponível é do DT).
  Arte ali é o comportamento correto.
- **Texspar DTC 20 L e Soft's Max Karícia 20 L** estão em arte por falta de foto do
  fornecedor — esperado, e é o que os âncoras 3 e 7 fixam.
- **~100 produtos de tamanho único nunca foram auditados** (sem `fotoEmbalagem`): caem na
  regra 3 e mostram a foto do catálogo em qualquer caso. A Camada C é a primeira auditoria
  visual deles — foto de recipiente diferente do tamanho cadastrado ali é **achado novo**,
  e é exatamente a pendência que a spec original deixou em aberto. A primeira rodada da
  folha de contato já pescou dois: **Spar HT-6** e **Primmax Inox**, cadastrados em 500 ml,
  usavam o mock-up genérico do galão de 5 L da linha (o rótulo traz o placeholder "NONONO
  NONO"). Os dois foram reapontados para `_frasco.svg`; fica pendente confirmar com o
  NONO"). A ficha técnica dos dois diz *"apresentado em borrifadores plásticos de 500ml"*:
  cadastro certo, foto errada. Os dois foram reapontados para `_frasco.svg`. Guardião novo
  em `tests/unit/embalagem-e-linha.test.ts`: produto de tamanho único em ml/≤1 L não pode
  apontar para foto de estúdio.
- **A embalagem cadastrada já foi conferida contra a ficha técnica** —
  `scripts/conferir-embalagem-ficha.mjs`, 150/150 conferem em 29/07. Se a Camada C levantar
  suspeita de tamanho (não de foto), rode ele antes de reportar: ele diz o que o documento
  oficial do produto declara.
