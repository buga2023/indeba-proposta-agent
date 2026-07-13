# Spec Unificada — Agente de Proposta (Indeba)

*Documento canônico e executável. Governa contratos de dados e marcos do gerador
automático de propostas comerciais em PDF. Companheiro: `Guia_Desenvolvimento_Agente_Proposta.md`
(visão geral). Esta spec é a fonte da verdade — em caso de divergência, vale ela.*

**Casamento principal:** a entrada do produto é o **briefing em linguagem natural** — o
vendedor descreve o projeto e sai o PDF padrão Indeba. Por baixo, o PDF **não é gerado
pela IA**: a IA *lê o briefing*, escolhe os produtos no catálogo e escreve o texto; o PDF
é **renderizado** a partir do `PropostaScope`, o mesmo objeto que o vendedor revisa na
tela. Preço, imagem, embalagem e ficha entram nesse objeto **direto do catálogo**; a IA
nunca emite dado crítico. Briefing em linguagem natural na entrada, PDF na saída, zero
fabricação no meio.

**Procedência (deste documento):** `[FONTE]` verificado nos arquivos enviados ·
`[INFERÊNCIA]` deduzido, confirmar · `[DESIGN]` decisão de engenharia · `[GUIA]` do
`Guia_Desenvolvimento_Agente_Proposta.md` · `[REPO]` a levantar no código quando existir.

**Procedência (em runtime, por item da proposta):** `[CATÁLOGO]` dado real do catálogo
(fonte da verdade) · `[IA-SELEÇÃO]` produto sugerido pela IA (revisável) · `[IA-TEXTO]`
texto gerado pela IA (revisável) · `[MANUAL]` ajuste do vendedor.

**Base de evidência:** 4 áudios do Mateus/Indeba Express descrevendo a necessidade ·
`GVA_ALIMENTOS_Orcamento_9572` (orçamento auto do ERP) · `Proposta_Comercial` /
Laticínio Taquipe (referência visual A — Indeba fabricante) · `Proposta_GVA` / Proposta
de implantação (referência visual B — Indeba Express, Matheus Resende). Detalhe em §8.

**Achados dos arquivos (afetam o template e a faceta):**
- **Duas identidades coexistem.** "Indeba" (fabricante, desde 1966) e "Indeba Express /
  IES" (distribuidor, Boca do Rio) têm logo, cor e formato de proposta diferentes. O
  template **parametriza a marca** — nada hardcoded. **DECIDIDO (v1):** marca padrão
  `indeba_express` (o Mateus é da Express), configurável via `MARCA_PADRAO`; trocar para
  `indeba` é só config, sem refator. `[DESIGN]`
- **As 7 linhas de atuação já existem.** A página institucional lista lavanderia,
  alimentos e bebidas, limpeza e conservação, higiene clínica, higiene pessoal,
  tratamento de pisos, automotiva → faceta primária `F1.Linha`. `[FONTE]`

---

## 1. Princípios (Constituição — não violar)

1. **Backbone determinístico, IA como tempero.** Preço, imagem, embalagem e ficha vêm do
   catálogo. A IA só toca em seleção de produto e texto de apresentação. `[DESIGN]`
2. **Dados Primeiro.** Nenhuma feature antes do schema correspondente em §4. Marco 0
   (catálogo) antes de qualquer outra coisa. `[DESIGN]`
3. **Todo dado crítico cita a origem.** Cada item carrega `procedencia`; preço é sempre
   `[CATÁLOGO]`. Se um valor não tem origem no catálogo, ele não sai. `[GUIA]`
4. **Toda seleção e todo texto são inspecionáveis e corrigíveis.** O vendedor revisa e
   ajusta antes do export. (Mateus: a referência da Indeba é "meio que editável".) `[FONTE]`
5. **Degradação graciosa, nunca fabricação.** Sem produto/preço no catálogo → sinaliza a
   lacuna, não inventa. Preço alucinado em proposta = prejuízo/processo. `[DESIGN]`
6. **Renderização ≠ geração.** PDF é *view* do `PropostaScope`. O objeto editado é o que
   renderiza. Um template, um contrato. `[DESIGN]`
7. **Estender, não bifurcar.** Reaproveitar o motor do `editorial-pdf` (HTML → Chromium →
   PDF). Não criar um segundo pipeline de PDF. `[GUIA]`
8. **Log append-only.** Toda proposta gerada fica registrada (cliente, itens, preços
   aplicados, quem editou, quando). `[DESIGN]`

---

## 2. Arquitetura e fluxo

**Entrada = linguagem natural.** O vendedor passa o briefing do projeto em texto livre; a
IA lê, seleciona os produtos no catálogo e escreve o texto. A seleção manual existe só
como **superfície de revisão** (ajuste pós-briefing) e como harness de dev no Marco 1 —
não é a interface do produto.

```
[Vendedor] digita o BRIEFING em linguagem natural          ← interface primária
   ex.: "Laticínio Taquipe, limpeza CIP das linhas, desinfecção e sabonete"
   │
   ▼  normaliza → PedidoScope (§4.2)
┌──────────────────────────────────────────────────────────────┐
│ SELEÇÃO (recuperação híbrida, 3 passos)                      │
│   1. filtro duro      por F1.Linha + F2.Segmento             │
│   2. overlap de faceta por F3.Função + F4.Método             │
│   3. desempate        semântico (IA) → SelecaoExplicada §4.3 │
├──────────────────────────────────────────────────────────────┤
│ MONTAGEM → PropostaScope (§4.4) — OBJETO CANÔNICO           │
│   dados do item entram do CATÁLOGO; IA só anexa seleção+texto│
├──────────────────────────────────────────────────────────────┤
│ REVISÃO  vendedor edita (Edicao §4.5) → volta pro mesmo objeto│
├──────────────────────────────────────────────────────────────┤
│ RENDER   PropostaScope → template HTML (marca param.) →       │
│          Chromium headless → PDF  [motor do editorial-pdf]    │
└──────────────────────────────────────────────────────────────┘
   │
   ▼  PDF + registro no log append-only
```

A correção do vendedor volta para o **mesmo** `PropostaScope` que será renderizado — não
há objeto paralelo. O que o vendedor edita é exatamente o que vira PDF; resultado e
revisão nunca são objetos separados que possam divergir.

---

## 3. Facetas (vocabulário de match)

Cada produto é anotado com estas facetas no Marco 0 — é o vocabulário que liga o briefing
aos produtos do catálogo.

- **F1 — Linha** (primária, 7 valores Indeba): `lavanderia` · `alimentos_bebidas` ·
  `limpeza_conservacao` · `higiene_clinica` · `higiene_pessoal` · `tratamento_pisos` ·
  `automotiva`. `[FONTE]`
- **F2 — Segmento do cliente:** `laticinio` · `cozinha_industrial` · `hortifruti` ·
  `industria_bebidas` · `administrativo` · ... (expansível). `[INFERÊNCIA]` (extraído das propostas)
- **F3 — Função:** `desengordurante` · `desinfetante` · `desincrustante` · `sabonete` ·
  `antisseptico` · `multiuso` · `cip`. `[FONTE]`
- **F4 — Método de uso:** `diluidor_automatico` · `pulverizacao` · `imersao` ·
  `circulacao_cip` · `manual`. `[FONTE]`
- **Faceta de embalagem:** cada produto tem **N** embalagens
  com preço/diluição próprios (Taquipe: 7,5kg / 75kg). `[FONTE]`

Match = `PedidoScope.facetas` ∩ facetas do produto. Filtro duro em F1+F2, overlap em
F3+F4, semântico como desempate.

---

## 4. Contratos de dados

> Schemas únicos. Nenhuma tool/feature nova sem o schema correspondente já definido aqui.

### 4.1 Catálogo

```jsonc
// Produto
{
  "id": "uuid",
  "codigo": "string",              // código Indeba do produto
  "nome": "string",
  "linha": "F1.Linha",
  "descricao_curta": "string",
  "descricao_uso": "string",       // "para que serve" (vai no card)
  "segmentos": ["F2"], "funcoes": ["F3"], "metodos": ["F4"],
  "imagem_path": "string",
  "ficha_tecnica_path": "string|null",
  "ativo": true
}

// Embalagem (1 produto → N embalagens)
{
  "id": "uuid", "produto_id": "uuid",
  "tamanho": 5, "unidade": "L",    // L | kg | un
  "preco": 130.00,
  "diluicao_max": "1:100",
  "custo_diluido": 0.26
}

// Cliente
{
  "id": "uuid", "razao_social": "string", "cnpj": "string",
  "endereco": "string", "contato": "string", "segmento": "F2|null"
}
```

### 4.2 PedidoScope — normalização do briefing

```jsonc
{
  "cliente_id": "uuid",
  "necessidade_texto": "string",   // o que o vendedor digitou
  "facetas_detectadas": {          // preenchido pela IA no Marco 2; vazio no MVP
    "linha": ["F1"], "segmento": ["F2"], "funcao": ["F3"], "metodo": ["F4"]
  },
  "produtos_explicitos": ["produto_id"]  // se o vendedor já escolheu na mão (MVP)
}
```

### 4.3 SelecaoExplicada — por que cada produto entrou (contrato de explicabilidade)

```jsonc
{
  "itens": [
    {
      "produto_id": "uuid",
      "score": 0.0,
      "facetas_batidas": ["F2:laticinio", "F3:cip"],
      "motivo": "string",          // legível: por que casou
      "procedencia": "IA-SELEÇÃO"  // ou "MANUAL"
    }
  ]
}
```

### 4.4 PropostaScope — objeto canônico (fonte da verdade que vira PDF)

```jsonc
{
  "id": "uuid",
  "cliente": { /* snapshot do Cliente + responsavel|null (quem recebe a proposta — capa Express) */ },
  "criado_em": "iso", "status": "rascunho|finalizada",
  "template": "indeba | indeba_express",       // identidade param.
  "texto_apresentacao": {
    "conteudo": "string",
    "procedencia": "IA-TEXTO | MANUAL"
  },
  "itens": [
    {
      "produto_id": "uuid", "codigo": "...", "nome": "...",   // [CATÁLOGO]
      "descricao_uso": "...",                                 // [CATÁLOGO]
      "imagem_path": "...",                                   // [CATÁLOGO]
      "embalagens": [ { "tamanho": 5, "unidade": "L",
                        "preco": 130.00, "diluicao_max": "1:100",
                        "custo_diluido": 0.26 } ],            // [CATÁLOGO]
      "procedencia_selecao": "IA-SELEÇÃO | MANUAL",
      "override_preco": null                                  // ver §4.5; rastreado
    }
  ],
  "condicoes_comerciais": { "validade": "...", "prazo_entrega": "...",
                            "pagamento": "...", "frete": "..." }
}
```

Regra: campos marcados `[CATÁLOGO]` são **cópia direta** do catálogo. A IA preenche
`texto_apresentacao` e `procedencia_selecao` — nada mais.

### 4.5 Edicao — correção do vendedor

```jsonc
{
  "proposta_id": "uuid",
  "remover_itens": ["produto_id"],
  "adicionar_itens": ["produto_id"],
  "override_preco": [ { "produto_id": "uuid", "embalagem_id": "uuid",
                        "valor": 125.00 } ],   // override manual, sempre rastreado
  "editar_texto": { "conteudo": "string" }     // vira procedencia: MANUAL
}
```

Toda `Edicao` muta o **mesmo** `PropostaScope` e registra a mudança no log.

---

## 5. Marcos e sequência de tarefas

> 4 marcos. **O produto (briefing → PDF) fecha no Marco 2.** Os Marcos 0–1 são a fundação
> — catálogo + render + superfície de revisão — que a IA precisa pra existir (ela escolhe
> de um catálogo e popula um render que já têm que estar de pé).

### Marco 0 — Fundação do catálogo
*Sem IA. É a parte mais importante.*
- **T0.1** — Schema do catálogo em Postgres + Prisma (§4.1). `[GUIA]`
- **T0.2** — Importar os ~200 produtos dos arquivos do Mateus → `catalogo.json` → banco.
  (Começar pelos mais vendidos é opção — confirmar escopo.) `[FONTE]`
- **T0.3** — Padronizar imagens (fundo branco, dimensão e otimização consistentes).
- **T0.4** — Anotar facetas (§3) por produto.

### Marco 1 — Render + superfície de revisão (harness, sem IA ainda)
*Não é o produto — é a fundação que a IA popula no Marco 2 e a tela onde o vendedor revisa
o resultado do briefing. Objetivo: provar que o PDF sai no padrão Indeba antes de plugar a IA.*
- **T1.1** — Superfície de itens (busca/adiciona/edita/remove/preço): harness de dev agora,
  vira a tela de revisão pós-briefing depois.
- **T1.2** — Template HTML com identidade **parametrizada** (Indeba / Indeba Express):
  capa, institucional, card de produto (imagem + embalagens + preço + custo diluído),
  condições comerciais. Validar contra a proposta da Taquipe. `[FONTE]`
- **T1.3** — Pipeline de render: `PropostaScope` → HTML → Chromium headless → PDF
  (motor do `editorial-pdf`). `[GUIA]`
- **T1.4** — Export + preview na tela.

### Marco 2 — Briefing → PDF (a IA fecha o produto)
*O fluxo do produto fecha aqui: o vendedor digita o briefing em linguagem natural, a IA lê,
seleciona do catálogo e escreve o texto, populando a superfície do Marco 1; o vendedor
revisa (opcional) e exporta.*
- **T2.1** — Subir Ollama + Qwen2.5 (**testar 7B antes do 14B**). `[GUIA]`
- **T2.2** — Briefing → `PedidoScope`: a IA extrai as facetas do texto livre (§4.2).
- **T2.3** — Seleção: recuperação híbrida (§2) → `SelecaoExplicada` (§4.3) → popula o `PropostaScope`.
- **T2.4** — Geração do `texto_apresentacao` personalizado por cliente/segmento.
- **T2.5** — Procedência por item gravada; preço/imagem sempre `[CATÁLOGO]`, nunca da IA.

### Marco 3 — Revisão, edição e refinamentos
- **T3.1** — Edição inline com `override_preco` rastreado (§4.5).
- **T3.2** — Histórico de propostas + duplicar proposta anterior.
- **T3.3** — Múltiplos templates.
- **T3.4** — Log append-only (§1.8).

---

## 6. Stack

Decidido — versões e justificativa no `Guia_Desenvolvimento_Agente_Proposta.md`:
**Next.js 15 (App Router), app único** (UI + API em route handlers) · React 19 · Tailwind
v4 · shadcn/ui · contratos em **Zod** (`lib/contracts`, fonte única) · **PostgreSQL 16 +
Prisma** (preço como `Decimal`) · **Ollama + Qwen2.5 7B Instruct** (sem fine-tune; saída
JSON restrita por schema) · render com **Playwright/Chromium** sobre template React (mesmo
approach do `editorial-pdf`) · **Vitest + Playwright Test** · deploy local na LAN.

---

## 7. Riscos e mitigações

| Risco | Mitigação | Princípio |
|---|---|---|
| Alucinação de preço | Dado sempre do catálogo; IA nunca emite número | §1.1, §1.5 |
| 200 imagens inconsistentes | Padronizar no Marco 0 (T0.3) | §1.2 |
| Marca errada no PDF | Template parametriza identidade (Indeba × Indeba Express) | Achados |
| Fidelidade visual à referência | Validar T1.2 contra a Taquipe | §1.4 |
| Preço desatualiza | Catálogo editável; sem rebuild | §1.2 |
| Dados do cliente (LGPD) | Tudo local; B2B; baixo risco, tratar com cuidado | §1.8 |
| Escopo inflar (200 de uma vez) | Começar pelos mais vendidos; expandir | T0.2 |

---

## 8. Base de evidência (detalhe)

- **Áudios (Mateus / Indeba Express).** Necessidade: vendedores não copiarem/colarem
  imagem e texto no Word; digitar produto → sai nome, imagem, valor por litro, diluição,
  "para que serve". Referência citada: sistema da "Endeba" (= Indeba) que puxa por linha
  e é "meio que editável". O ERP atual já gera **orçamento**; falta a **proposta**. `[FONTE]`
- **`GVA_ALIMENTOS_Orcamento_9572`.** Saída do ERP: tabela simples (qt., produto, valor
  unitário, subtotal). É o que **já existe**, não o alvo. `[FONTE]`
- **`Proposta_Comercial` / Laticínio Taquipe.** Referência visual **A** (Indeba
  fabricante): capa, institucional, "linhas de atuação", mapa de distribuidores,
  diagrama "Experiência Segura", produtos com imagem + embalagens + preço + custo
  diluído, condições comerciais. `[FONTE]`
- **`Proposta_GVA` / Proposta de implantação.** Referência visual **B** (Indeba Express,
  Matheus Resende): item-a-item, imagem do produto, valor da embalagem, valor por litro
  diluído, observações, diluidores Seko Pro Max. `[FONTE]`

**Decisão de marca (v1):** template-alvo = **B / Indeba Express** (Matheus Resende), por
ser quem pediu. Marca padrão `indeba_express`, configurável via `MARCA_PADRAO`. A
identidade A (Indeba fabricante) entra como segundo template no Marco 3, sem refator —
o template já nasce parametrizado. Nenhuma pendência bloqueia o T1.2. `[DESIGN]`
