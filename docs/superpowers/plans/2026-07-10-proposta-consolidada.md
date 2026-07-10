# Proposta Consolidada — Implementation Plan (Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um 4º tipo de proposta, `consolidada` (marca IES), que gera um PDF de 5 seções — incluindo **uma página rica por produto** montada a partir de um novo bloco `ficha` no catálogo — com preço editável na revisão.

**Architecture:** Estende o contrato do catálogo (`FichaProduto`) e do `PropostaScope` (tipo `consolidada` + bloco `consolidada` de textos institucionais). Um novo template puro `consolidadaHtml(scope, imagens, assets)` emite as 5 seções, repetindo `paginaProduto()` por item; `render.ts` roteia por `scope.tipo`. Defaults institucionais vêm de `consolidadaDefaults()`. Fase 1 entrega o PDF ponta a ponta com os textos institucionais em default; a edição desses textos na UI é Fase 2 (fora deste plano).

**Tech Stack:** TypeScript, Zod, Next.js (App Router), Vitest, Playwright/Chromium (render já existente).

## Global Constraints

- Preço SEMPRE como string decimal `^\d+\.\d{2}$` — nunca float (constituição §1.1). Copiar do catálogo; a IA nunca emite preço.
- Dado crítico do item é **snapshot copiado do catálogo** na montagem — o PDF deve ser reproduzível apenas pelo `PropostaScope`.
- `ficha` e o bloco `consolidada` são **opcionais**: produtos/propostas existentes seguem válidos. O template omite qualquer bloco ausente.
- Testes rodam com `pnpm test` (vitest). Alias de import: `@/` → `src/`.
- `data/catalogo.json` tem hoje **9 produtos**; nenhuma alteração pode mudar essa contagem.
- Paleta: navy `#0b2a4a`, laranja `#e8622a`.

---

### Task 1: Contrato `FichaProduto` + `Produto.ficha`

**Files:**
- Modify: `src/lib/contracts/produto.ts`
- Test: `tests/unit/ficha-produto.test.ts`

**Interfaces:**
- Produces: `FichaProduto` (Zod schema + type), `Produto` agora com `ficha?: FichaProduto | null`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/ficha-produto.test.ts
import { describe, it, expect } from "vitest";
import { Produto, FichaProduto } from "@/lib/contracts/produto";

const base = {
  codigo: "X",
  nome: "X",
  linha: "alimentos_bebidas",
  descricaoCurta: "",
  descricaoUso: "",
  segmentos: [],
  funcoes: [],
  metodos: [],
  imagemPath: "/x.png",
  fichaTecnicaPath: null,
  ativo: true,
  embalagens: [{ tamanho: 5, unidade: "L", preco: "10.00", diluicaoMax: null, custoDiluido: null }],
};

describe("FichaProduto", () => {
  it("aceita produto SEM ficha (retrocompatível)", () => {
    expect(Produto.parse(base).ficha ?? null).toBe(null);
  });

  it("aceita ficha completa", () => {
    const ficha = {
      titulo: "Detergente Desengordurante",
      subtitulo: "Alcalino Concentrado",
      linhaLabel: "KITCHEN",
      descricao: "Remove gorduras difíceis.",
      indicadoPara: [{ label: "Cozinhas industriais", icone: "cozinha" }],
      beneficios: ["Remove gordura pesada", "Alto rendimento"],
      diluicoes: [{ uso: "Limpeza pesada", razao: "1:20" }],
      rendimento: "Até 100 litros",
      caracteristicas: { pH: "12,5 – 13,5", aspecto: "Líquido", cor: "Esverdeado", odor: "Característico", uso: "Profissional" },
    };
    const p = Produto.parse({ ...base, ficha });
    expect(p.ficha?.titulo).toBe("Detergente Desengordurante");
    expect(p.ficha?.diluicoes?.[0].razao).toBe("1:20");
  });

  it("valida direto pelo schema FichaProduto e aceita campos ausentes", () => {
    expect(FichaProduto.parse({ beneficios: ["a"] }).titulo ?? null).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test ficha-produto`
Expected: FAIL — `FichaProduto` não exportado.

- [ ] **Step 3: Write minimal implementation**

Em `src/lib/contracts/produto.ts`, ANTES de `export const Produto`, adicione:

```typescript
// Ficha rica de vendas (modelo Proposta Consolidada). Tudo opcional — o template
// de PDF omite o bloco quando o dado não existe. Nada aqui é inventado pela IA:
// são dados técnicos cadastrados por produto.
export const FichaProduto = z.object({
  titulo: z.string().optional(),        // "Detergente Desengordurante"
  subtitulo: z.string().optional(),     // "Alcalino Concentrado"
  linhaLabel: z.string().optional(),    // "KITCHEN"
  descricao: z.string().optional(),     // parágrafo hero
  indicadoPara: z.array(z.object({ label: z.string(), icone: z.string() })).optional(),
  beneficios: z.array(z.string()).optional(),
  diluicoes: z.array(z.object({ uso: z.string(), razao: z.string() })).optional(),
  rendimento: z.string().optional(),
  caracteristicas: z
    .object({
      pH: z.string().optional(),
      aspecto: z.string().optional(),
      cor: z.string().optional(),
      odor: z.string().optional(),
      uso: z.string().optional(),
    })
    .optional(),
});
export type FichaProduto = z.infer<typeof FichaProduto>;
```

Dentro de `Produto = z.object({ ... })`, adicione o campo (após `embalagens`):

```typescript
  ficha: FichaProduto.nullable().optional(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test ficha-produto`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/contracts/produto.ts tests/unit/ficha-produto.test.ts
git commit -m "feat(contracts): FichaProduto opcional no catálogo"
```

---

### Task 2: Contrato proposta — tipo `consolidada`, `responsavel`, item.ficha, bloco `consolidada`

**Files:**
- Modify: `src/lib/contracts/proposta.ts`
- Test: `tests/unit/proposta-consolidada-contract.test.ts`

**Interfaces:**
- Consumes: `FichaProduto` de `./produto`.
- Produces: `Tipo` inclui `"consolidada"`; `ClienteSnapshot.responsavel: string | null`; `PropostaItem.ficha?`; `PropostaScope.consolidada?` com forma `{ capa, apresentacao, comodatos, condicoes }` (tipo `ConsolidadaBloco`).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/proposta-consolidada-contract.test.ts
import { describe, it, expect } from "vitest";
import { PropostaScope, Tipo } from "@/lib/contracts/proposta";

const scopeBase = {
  id: "1",
  criadoEm: "2026-07-10T00:00:00.000Z",
  status: "rascunho",
  tipo: "consolidada",
  template: "indeba_express",
  cliente: { razaoSocial: "Sua Empresa", cnpj: null, segmento: null, responsavel: "Fulano" },
  textoApresentacao: { conteudo: "oi", procedencia: "MANUAL" },
  itens: [
    {
      codigo: "P", nome: "P", descricaoUso: "", imagemPath: "/p.png",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "10.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "",
      ficha: { titulo: "T", beneficios: ["a"] },
    },
  ],
  condicoesComerciais: { validade: "30 dias", prazoEntrega: "15d", pagamento: "boleto", frete: "CIF" },
  consolidada: {
    capa: { consultor: "Matheus", cidade: "Salvador - BA", subtitulo: "Soluções em Higienização Profissional" },
    apresentacao: { saudacao: "Prezado(a),", paragrafos: ["p1"], cards: [{ titulo: "Certificados", texto: "t", icone: "selo" }] },
    comodatos: { intro: "i", equipamentos: [{ titulo: "Dispenser", descricao: "d", icone: "dispenser" }], vantagens: ["v1"] },
    condicoes: { itens: [{ titulo: "Validade", texto: "30 dias", icone: "validade" }], mensagemFechamento: "Aguardamos.", consultor: "Matheus", cargo: "Consultor Comercial" },
  },
};

describe("PropostaScope — tipo consolidada", () => {
  it("Tipo inclui consolidada", () => {
    expect(Tipo.parse("consolidada")).toBe("consolidada");
  });

  it("parseia scope consolidada completo (item com ficha + bloco consolidada)", () => {
    const s = PropostaScope.parse(scopeBase);
    expect(s.cliente.responsavel).toBe("Fulano");
    expect(s.itens[0].ficha?.titulo).toBe("T");
    expect(s.consolidada?.comodatos.equipamentos[0].titulo).toBe("Dispenser");
  });

  it("segue aceitando scope SEM consolidada e SEM responsavel (retrocompatível)", () => {
    const semExtras = {
      ...scopeBase, tipo: "orcamento",
      cliente: { razaoSocial: "X", cnpj: null, segmento: null },
      itens: [{ ...scopeBase.itens[0], ficha: undefined }],
      consolidada: undefined,
    };
    const s = PropostaScope.parse(semExtras);
    expect(s.consolidada ?? null).toBe(null);
    expect(s.cliente.responsavel ?? null).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test proposta-consolidada-contract`
Expected: FAIL — `consolidada`/`responsavel` não aceitos.

- [ ] **Step 3: Write minimal implementation**

Em `src/lib/contracts/proposta.ts`:

1. Importe `FichaProduto` no topo:
```typescript
import { Embalagem, FichaProduto } from "./produto";
```

2. `ClienteSnapshot` — adicione `responsavel`:
```typescript
export const ClienteSnapshot = z.object({
  razaoSocial: z.string(),
  cnpj: z.string().nullable(),
  segmento: z.string().nullable(),
  responsavel: z.string().nullable().optional(),
});
```

3. `PropostaItem` — adicione, após `embalagens`:
```typescript
  ficha: FichaProduto.nullable().optional(), // [CATÁLOGO] snapshot p/ página de produto
```

4. `Tipo` — inclua consolidada:
```typescript
export const Tipo = z.enum(["orcamento", "implantacao", "comercial", "consolidada"]);
```

5. ANTES de `export const PropostaScope`, defina o bloco:
```typescript
// Textos institucionais do modelo Consolidado (marca IES). Presente só quando
// tipo === "consolidada". Preenchido por consolidadaDefaults() na montagem;
// editável na revisão (Fase 2). Cliente/CNPJ/segmento/data vêm de outros campos.
export const ConsolidadaBloco = z.object({
  capa: z.object({ consultor: z.string(), cidade: z.string(), subtitulo: z.string() }),
  apresentacao: z.object({
    saudacao: z.string(),
    paragrafos: z.array(z.string()),
    cards: z.array(z.object({ titulo: z.string(), texto: z.string(), icone: z.string() })),
  }),
  comodatos: z.object({
    intro: z.string(),
    equipamentos: z.array(z.object({ titulo: z.string(), descricao: z.string(), icone: z.string() })),
    vantagens: z.array(z.string()),
  }),
  condicoes: z.object({
    itens: z.array(z.object({ titulo: z.string(), texto: z.string(), icone: z.string() })),
    mensagemFechamento: z.string(),
    consultor: z.string(),
    cargo: z.string(),
  }),
});
export type ConsolidadaBloco = z.infer<typeof ConsolidadaBloco>;
```

6. Dentro de `PropostaScope = z.object({ ... })`, adicione após `condicoesComerciais`:
```typescript
  consolidada: ConsolidadaBloco.optional(),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test proposta-consolidada-contract`
Expected: PASS (3 testes).

- [ ] **Step 5: Verify que nada quebrou nos contratos**

Run: `pnpm test proposta-persistencia from-proposta`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/contracts/proposta.ts tests/unit/proposta-consolidada-contract.test.ts
git commit -m "feat(contracts): tipo consolidada + bloco institucional editável"
```

---

### Task 3: `consolidadaDefaults()` — conteúdo default do modelo

**Files:**
- Create: `src/lib/consolidada-defaults.ts`
- Test: `tests/unit/consolidada-defaults.test.ts`

**Interfaces:**
- Consumes: tipo `ConsolidadaBloco` de `@/lib/contracts`.
- Produces: `consolidadaDefaults(opts?: { consultor?: string; cidade?: string }): ConsolidadaBloco`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/consolidada-defaults.test.ts
import { describe, it, expect } from "vitest";
import { consolidadaDefaults } from "@/lib/consolidada-defaults";
import { ConsolidadaBloco } from "@/lib/contracts";

describe("consolidadaDefaults", () => {
  it("retorna um ConsolidadaBloco válido e não-vazio", () => {
    const d = consolidadaDefaults();
    expect(() => ConsolidadaBloco.parse(d)).not.toThrow();
    expect(d.apresentacao.cards.length).toBe(4);
    expect(d.comodatos.equipamentos.length).toBeGreaterThanOrEqual(4);
    expect(d.condicoes.itens.length).toBeGreaterThanOrEqual(5);
  });

  it("aceita override de consultor e cidade", () => {
    const d = consolidadaDefaults({ consultor: "Fulano", cidade: "Recife - PE" });
    expect(d.capa.consultor).toBe("Fulano");
    expect(d.capa.cidade).toBe("Recife - PE");
    expect(d.condicoes.consultor).toBe("Fulano");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test consolidada-defaults`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/consolidada-defaults.ts
import type { ConsolidadaBloco } from "./contracts";

// Conteúdo institucional padrão do modelo Proposta Consolidada (marca IES),
// transcrito de proposta-indeba-consolidada.pdf. É só default: cada campo é
// editável por proposta (Fase 2). Nada de dado crítico (preço/produto) aqui.
export function consolidadaDefaults(opts?: { consultor?: string; cidade?: string }): ConsolidadaBloco {
  const consultor = opts?.consultor ?? "Matheus Maristane Resende";
  const cidade = opts?.cidade ?? "Salvador - BA";
  return {
    capa: { consultor, cidade, subtitulo: "Soluções em Higienização Profissional" },
    apresentacao: {
      saudacao: "Prezado(a),",
      paragrafos: [
        "A Indeba Express agradece a oportunidade de apresentar esta proposta comercial.",
        "Somos especializados em fornecer soluções completas em higienização profissional, oferecendo produtos de alta performance, equipamentos e suporte técnico para empresas que buscam eficiência, economia e segurança em seus processos de limpeza.",
        "Nosso compromisso é entender as necessidades de cada cliente e entregar soluções personalizadas que geram resultados reais, com qualidade, agilidade e confiabilidade.",
        "Esta proposta foi elaborada especialmente para sua empresa e esperamos que ela seja o início de uma parceria sólida e duradoura.",
      ],
      cards: [
        { titulo: "Produtos Certificados", texto: "Trabalhamos com as melhores marcas e produtos de alta qualidade.", icone: "selo" },
        { titulo: "Atendimento Consultivo", texto: "Entendemos sua necessidade e indicamos a melhor solução.", icone: "pessoa" },
        { titulo: "Entrega Ágil", texto: "Logística eficiente para garantir rapidez e segurança nas entregas.", icone: "entrega" },
        { titulo: "Suporte Técnico", texto: "Equipe especializada pronta para oferecer todo o suporte necessário.", icone: "suporte" },
      ],
    },
    comodatos: {
      intro: "A Indeba Express disponibiliza equipamentos em comodato para atender às necessidades operacionais da sua empresa, com tecnologia de ponta e assistência inclusa.",
      equipamentos: [
        { titulo: "Dispenser Automático", descricao: "Equipamento moderno e eficiente para dispensação de sabonete, álcool em gel ou papel.", icone: "dispenser" },
        { titulo: "Toalheiro Automático", descricao: "Solução prática e higiênica para fornecimento automático de papel toalha.", icone: "toalheiro" },
        { titulo: "Aromatizador Automático", descricao: "Equipamento que proporciona ambientes sempre perfumados e agradáveis.", icone: "aromatizador" },
        { titulo: "Lixeira com Tampa", descricao: "Lixeira resistente e com tampa para descarte seguro e higiênico de resíduos.", icone: "lixeira" },
      ],
      vantagens: [
        "Sem custo de aquisição dos equipamentos",
        "Manutenção preventiva e corretiva inclusa",
        "Substituição imediata em caso de necessidade",
        "Tecnologia atualizada e de alta performance",
      ],
    },
    condicoes: {
      itens: [
        { titulo: "Validade da Proposta", texto: "Esta proposta é válida por 30 (trinta) dias a partir da data de emissão.", icone: "validade" },
        { titulo: "Prazo de Implantação", texto: "Até 15 (quinze) dias úteis após a confirmação do pedido.", icone: "prazo" },
        { titulo: "Forma de Pagamento", texto: "Boleto bancário com vencimento para 30 dias.", icone: "pagamento" },
        { titulo: "Frete e Entrega", texto: "Entrega e instalação inclusas na cidade de Salvador - BA.", icone: "frete" },
        { titulo: "Suporte e Atendimento", texto: "Suporte técnico e atendimento consultivo durante toda a vigência do contrato.", icone: "suporte" },
      ],
      mensagemFechamento: "Nos colocamos à disposição para quaisquer esclarecimentos e aguardamos sua aprovação para darmos início a esta parceria de sucesso.",
      consultor,
      cargo: "Consultor Comercial",
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test consolidada-defaults`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/consolidada-defaults.ts tests/unit/consolidada-defaults.test.ts
git commit -m "feat: consolidadaDefaults() com o conteúdo institucional do modelo"
```

---

### Task 4: Montagem copia `ficha` snapshot e injeta bloco `consolidada`

**Files:**
- Modify: `src/lib/montar.ts`
- Test: `tests/unit/montar-consolidada.test.ts`

**Interfaces:**
- Consumes: `consolidadaDefaults` de `./consolidada-defaults`, `carregarCatalogo`.
- Produces: itens com `ficha` copiada do catálogo; `scope.consolidada` presente quando `tipo === "consolidada"`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/montar-consolidada.test.ts
import { describe, it, expect } from "vitest";
import { montarPropostaEstruturada } from "@/lib/montar";

describe("montarPropostaEstruturada — consolidada", () => {
  it("injeta bloco consolidada e copia ficha do catálogo por item", async () => {
    const scope = await montarPropostaEstruturada({
      cliente: { razaoSocial: "Sua Empresa", cnpj: null, segmento: null },
      tipo: "consolidada",
      textoApresentacao: "texto manual (sem IA)",
      itens: [{ codigo: "PRIMMAX-PLUS", quantidade: 1 }],
    });
    expect(scope.tipo).toBe("consolidada");
    expect(scope.consolidada).toBeDefined();
    expect(scope.consolidada?.apresentacao.cards.length).toBe(4);
    // PRIMMAX-PLUS terá ficha após a Task 8; aqui só garantimos que o campo é propagado quando existe
    expect(scope.itens[0]).toHaveProperty("ficha");
  });

  it("NÃO injeta consolidada para outros tipos", async () => {
    const scope = await montarPropostaEstruturada({
      cliente: { razaoSocial: "X", cnpj: null, segmento: null },
      tipo: "orcamento",
      textoApresentacao: "t",
      itens: [{ codigo: "PRIMMAX-PLUS", quantidade: 1 }],
    });
    expect(scope.consolidada ?? null).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test montar-consolidada`
Expected: FAIL — `consolidada` undefined / `ficha` ausente.

- [ ] **Step 3: Write minimal implementation**

Em `src/lib/montar.ts`:

1. Import no topo:
```typescript
import { consolidadaDefaults } from "./consolidada-defaults";
```

2. Nos DOIS mapeamentos de item que referenciam o catálogo (em `montarProposta` e no ramo `if (it.codigo)` de `montarPropostaEstruturada`), adicione `ficha: p.ficha ?? null,` ao objeto retornado (logo após `embalagens: p.embalagens,`). No ramo de item próprio (sem código) de `montarPropostaEstruturada`, adicione `ficha: null,`.

3. Extraia um helper de montagem do scope. ANTES das funções, adicione:
```typescript
// Quando tipo === "consolidada", anexa os textos institucionais default (editáveis
// depois na revisão). Para os demais tipos, retorna undefined (campo omitido).
const blocoConsolidada = (tipo: Tipo) =>
  tipo === "consolidada" ? consolidadaDefaults() : undefined;
```

4. Em AMBAS as chamadas `PropostaScope.parse({ ... })`, adicione a linha:
```typescript
    consolidada: blocoConsolidada(tipo),
```
(em `montarProposta` a variável é `tipo`; em `montarPropostaEstruturada` é a `const tipo` já existente logo acima do `return`).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test montar-consolidada`
Expected: PASS (2 testes).

- [ ] **Step 5: Regressão da montagem**

Run: `pnpm test from-proposta`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/montar.ts tests/unit/montar-consolidada.test.ts
git commit -m "feat(montar): snapshot da ficha + bloco consolidada na montagem"
```

---

### Task 5: `paginaProduto()` — uma página rica por produto

**Files:**
- Create: `src/lib/pdf/template-consolidada.ts` (começa aqui, cresce na Task 6)
- Test: `tests/unit/pagina-produto.test.ts`

**Interfaces:**
- Consumes: `PropostaItem` de `@/lib/contracts`.
- Produces: `paginaProduto(item: PropostaItem, dataUri: string): string` (exportada), `iconeSvg(nome: string): string`, `esc`, `brl`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/pagina-produto.test.ts
import { describe, it, expect } from "vitest";
import { paginaProduto } from "@/lib/pdf/template-consolidada";
import type { PropostaItem } from "@/lib/contracts";

const item: PropostaItem = {
  codigo: "PRIMMAX-PLUS",
  nome: "Primmax Plus",
  descricaoUso: "Lavar louças e pisos.",
  imagemPath: "/produtos/primmax-plus.png",
  embalagens: [
    { tamanho: 5, unidade: "L", preco: "130.00", diluicaoMax: "1:100", custoDiluido: "0.26" },
    { tamanho: 20, unidade: "L", preco: "480.00", diluicaoMax: "1:100", custoDiluido: "0.24" },
  ],
  quantidade: 1,
  procedenciaSelecao: "MANUAL",
  motivo: "",
  ficha: {
    titulo: "Detergente Desengordurante",
    subtitulo: "Alcalino Concentrado",
    linhaLabel: "KITCHEN",
    descricao: "Remove as gorduras mais difíceis.",
    indicadoPara: [{ label: "Cozinhas industriais", icone: "cozinha" }],
    beneficios: ["Remove gordura pesada", "Alto rendimento"],
    diluicoes: [{ uso: "Limpeza pesada", razao: "1:20" }],
    rendimento: "Até 100 litros",
    caracteristicas: { pH: "12,5 – 13,5", cor: "Esverdeado", aspecto: "Líquido", odor: "Característico", uso: "Profissional" },
  },
};

describe("paginaProduto", () => {
  it("renderiza título, benefícios, diluição, características e preço por embalagem", () => {
    const html = paginaProduto(item, "data:image/png;base64,AAAA");
    expect(html).toContain("Detergente Desengordurante");
    expect(html).toContain("Alcalino Concentrado");
    expect(html).toContain("KITCHEN");
    expect(html).toContain("Remove gordura pesada");
    expect(html).toContain("Limpeza pesada");
    expect(html).toContain("1:20");
    expect(html).toContain("12,5 – 13,5"); // pH
    expect(html).toContain("R$ 130,00");
    expect(html).toContain("R$ 480,00");
    expect(html).toContain('class="prodpg"'); // a quebra de página vem do CSS de consolidadaHtml
  });

  it("degrada com elegância quando não há ficha (usa nome + descricaoUso + preço)", () => {
    const semFicha = { ...item, ficha: null };
    const html = paginaProduto(semFicha, "data:image/png;base64,AAAA");
    expect(html).toContain("Primmax Plus");
    expect(html).toContain("R$ 130,00");
    expect(html).not.toContain("undefined");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test pagina-produto`
Expected: FAIL — módulo/função não existe.

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/pdf/template-consolidada.ts
import type { PropostaItem, PropostaScope } from "../contracts";

export const esc = (s: string) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const brl = (v: string) =>
  "R$ " + Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const NAVY = "#0b2a4a";
const ORANGE = "#e8622a";

// Set de ícones inline (traço navy). Chave desconhecida → ponto genérico. Usados
// em "indicado para", cards, comodatos e condições. Paths simples, estilo linha.
const ICONES: Record<string, string> = {
  cozinha: '<path d="M7 2v6M12 2v6M17 2v6M4 8h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M9 15v7M15 15v7"/>',
  restaurante: '<path d="M6 3v8a2 2 0 0 0 4 0V3M8 11v10M17 3c-2 0-3 2-3 5s1 4 3 4v9"/>',
  hotel: '<path d="M3 21V8l9-5 9 5v13M9 21v-6h6v6"/>',
  padaria: '<path d="M4 13a8 4 0 0 1 16 0v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>',
  churrascaria: '<path d="M12 2v8M8 6h8M5 14h14l-2 7H7z"/>',
  selo: '<circle cx="12" cy="9" r="6"/><path d="M9 14l-2 8 5-3 5 3-2-8"/>',
  pessoa: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  entrega: '<path d="M1 7h13v10H1zM14 10h5l3 3v4h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
  suporte: '<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="14" width="4" height="6" rx="1"/><rect x="18" y="14" width="4" height="6" rx="1"/>',
  dispenser: '<rect x="8" y="2" width="8" height="20" rx="2"/><path d="M10 18h4"/>',
  toalheiro: '<rect x="4" y="6" width="16" height="6" rx="2"/><path d="M8 12v6M16 12v6"/>',
  aromatizador: '<rect x="8" y="6" width="8" height="16" rx="2"/><path d="M12 2v4M10 4h4"/>',
  lixeira: '<path d="M4 7h16M6 7l1 14h10l1-14M9 7V4h6v3"/>',
  validade: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 12l2 2 4-4"/>',
  prazo: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>',
  pagamento: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  frete: '<path d="M1 7h13v10H1zM14 10h5l3 3v4h-8"/><circle cx="6" cy="19" r="2"/><circle cx="18" cy="19" r="2"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
};
export const iconeSvg = (nome: string, cor = NAVY): string =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="${cor}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONES[nome] ?? '<circle cx="12" cy="12" r="3"/>'}</svg>`;

// Uma página A4 rica por produto. Cada bloco só aparece se o dado existir.
export function paginaProduto(item: PropostaItem, dataUri: string): string {
  const f = item.ficha ?? null;
  const titulo = f?.titulo ? esc(f.titulo) : esc(item.nome);
  const subtitulo = f?.subtitulo ? `<div class="p-sub">${esc(f.subtitulo)}</div>` : "";
  const badge = f?.linhaLabel ? `<span class="p-badge">LINHA <b>${esc(f.linhaLabel)}</b></span>` : "";
  const descricao = esc(f?.descricao || item.descricaoUso || "");

  const indicado = f?.indicadoPara?.length
    ? `<div class="p-block"><div class="p-bt">Indicado para</div><div class="p-ind">${f.indicadoPara
        .map((i) => `<div class="p-ic"><span class="ic">${iconeSvg(i.icone)}</span><span>${esc(i.label)}</span></div>`)
        .join("")}</div></div>`
    : "";

  const beneficios = f?.beneficios?.length
    ? `<div class="p-block"><div class="p-bt">Principais benefícios</div><ul class="p-ben">${f.beneficios
        .map((b) => `<li><span class="ic ic-ok">${iconeSvg("check", ORANGE)}</span>${esc(b)}</li>`)
        .join("")}</ul></div>`
    : "";

  const diluicoes = f?.diluicoes?.length
    ? `<div class="p-mini"><div class="p-mt">Modo de diluição</div>${f.diluicoes
        .map((d) => `<div class="p-row"><span>${esc(d.uso)}</span><b>${esc(d.razao)}</b></div>`)
        .join("")}</div>`
    : "";
  const rendimento = f?.rendimento
    ? `<div class="p-mini"><div class="p-mt">Rendimento aproximado</div><div class="p-big">${esc(f.rendimento)}</div></div>`
    : "";
  const embalagens = item.embalagens.length
    ? `<div class="p-mini"><div class="p-mt">Embalagens disponíveis</div>${item.embalagens
        .map((e) => `<div class="p-row"><span>${e.tamanho} ${esc(e.unidade)}</span></div>`)
        .join("")}</div>`
    : "";
  const carac = f?.caracteristicas
    ? `<div class="p-mini"><div class="p-mt">Características</div>${Object.entries(f.caracteristicas)
        .filter(([, v]) => v)
        .map(([k, v]) => `<div class="p-row"><span>${k === "pH" ? "pH" : k[0].toUpperCase() + k.slice(1)}</span><b>${esc(String(v))}</b></div>`)
        .join("")}</div>`
    : "";

  const valores = item.embalagens
    .map((e) => `<div class="p-val"><div class="p-vl">${e.tamanho} ${esc(e.unidade)}</div><div class="p-vp">${brl(e.preco)}</div></div>`)
    .join("");

  return `<section class="prodpg">
    <div class="p-head">${badge}</div>
    <div class="p-top">
      <div class="p-foto"><img src="${dataUri}" alt="${titulo}"/></div>
      <div class="p-main">
        <h2 class="p-tit">${titulo}</h2>${subtitulo}
        ${descricao ? `<p class="p-desc">${descricao}</p>` : ""}
        ${indicado}
        ${beneficios}
      </div>
    </div>
    <div class="p-grid">${diluicoes}${rendimento}${embalagens}${carac}</div>
    <div class="p-valores"><span class="p-vtag">Valor</span>${valores}</div>
  </section>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test pagina-produto`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/template-consolidada.ts tests/unit/pagina-produto.test.ts
git commit -m "feat(pdf): paginaProduto() — página rica por produto (consolidada)"
```

---

### Task 6: `consolidadaHtml()` — documento completo (5 seções)

**Files:**
- Modify: `src/lib/pdf/template-consolidada.ts`
- Test: `tests/unit/consolidada-html.test.ts`

**Interfaces:**
- Consumes: `paginaProduto`, `iconeSvg`, `esc` (mesmo arquivo); `PropostaScope`; `consolidadaDefaults` (para fallback).
- Produces: `consolidadaHtml(scope: PropostaScope, imagens: Record<string,string>, assets: { logo: string }): string`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/consolidada-html.test.ts
import { describe, it, expect } from "vitest";
import { consolidadaHtml } from "@/lib/pdf/template-consolidada";
import { consolidadaDefaults } from "@/lib/consolidada-defaults";
import type { PropostaScope } from "@/lib/contracts";

const scope: PropostaScope = {
  id: "1", criadoEm: "2026-07-10T00:00:00.000Z", status: "rascunho",
  tipo: "consolidada", template: "indeba_express",
  cliente: { razaoSocial: "Sua Empresa", cnpj: "00.000.000/0000-00", segmento: "Alimentação", responsavel: "João" },
  textoApresentacao: { conteudo: "x", procedencia: "MANUAL" },
  itens: [
    { codigo: "A", nome: "Produto A", descricaoUso: "uso A", imagemPath: "/a.png",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "100.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", ficha: { titulo: "TitA" } },
    { codigo: "B", nome: "Produto B", descricaoUso: "uso B", imagemPath: "/b.png",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "200.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", ficha: null },
  ],
  condicoesComerciais: { validade: "30 dias", prazoEntrega: "15d", pagamento: "boleto", frete: "CIF" },
  consolidada: consolidadaDefaults(),
};

describe("consolidadaHtml", () => {
  it("emite as 5 seções e uma página por produto", () => {
    const html = consolidadaHtml(scope, { A: "data:,x", B: "data:,y" }, { logo: "data:,logo" });
    expect(html).toContain("Proposta de Solução");
    expect(html).toContain("Sua Empresa");
    expect(html).toContain("00.000.000/0000-00");
    expect(html).toContain("João"); // responsável
    expect(html).toContain("APRESENTAÇÃO");
    expect(html).toContain("COMODATOS");
    expect(html).toContain("CONDIÇÕES COMERCIAIS");
    expect(html).toContain("TitA"); // página produto A
    expect(html).toContain("Produto B"); // produto sem ficha cai no nome
    // duas páginas de produto (dois blocos prodpg)
    expect(html.match(/class="prodpg"/g)?.length).toBe(2);
  });

  it("usa consolidadaDefaults quando scope.consolidada está ausente", () => {
    const html = consolidadaHtml({ ...scope, consolidada: undefined }, { A: "d", B: "d" }, { logo: "l" });
    expect(html).toContain("Matheus Maristane Resende");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test consolidada-html`
Expected: FAIL — `consolidadaHtml` não exportado.

- [ ] **Step 3: Write minimal implementation**

Adicione ao FINAL de `src/lib/pdf/template-consolidada.ts`:

```typescript
import { consolidadaDefaults } from "../consolidada-defaults";

const dotgrid = `<svg class="dots" viewBox="0 0 60 60" fill="${ORANGE}"><g>${Array.from({ length: 25 })
  .map((_, i) => `<circle cx="${(i % 5) * 12 + 6}" cy="${Math.floor(i / 5) * 12 + 6}" r="1.6"/>`)
  .join("")}</g></svg>`;
const wave = `<svg class="wave" viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 60 Q120 10 260 50 T400 40 L400 120 L0 120 Z" fill="${NAVY}"/><path d="M0 78 Q120 30 260 68 T400 58" fill="none" stroke="${ORANGE}" stroke-width="3"/></svg>`;

export function consolidadaHtml(
  scope: PropostaScope,
  imagens: Record<string, string>,
  assets: { logo: string },
): string {
  const c = scope.consolidada ?? consolidadaDefaults();
  const cli = scope.cliente;
  const data = new Date(scope.criadoEm).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const header = (n: string) => `<div class="pg-head"><img class="hlogo" src="${assets.logo}" alt="IES"/><div class="hpg">Proposta de Solução <b>${n}</b></div></div>`;

  const cardCliente = (icone: string, rot: string, val: string) =>
    `<div class="cc-row"><span class="cc-ic">${iconeSvg(icone)}</span><div><div class="cc-r">${esc(rot)}</div><div class="cc-v">${esc(val)}</div></div></div>`;

  const capa = `<section class="capa">
    ${wave}
    <img class="capa-logo" src="${assets.logo}" alt="Indeba Express"/>
    <div class="capa-tit">PROPOSTA DE SOLUÇÃO</div>
    <div class="capa-sub">${esc(c.capa.subtitulo)}</div>
    <div class="capa-card">
      ${cardCliente("pessoa", "Cliente", cli.razaoSocial)}
      ${cardCliente("pagamento", "CNPJ", cli.cnpj || "—")}
      ${cardCliente("prazo", "Segmento", cli.segmento || "—")}
      ${cardCliente("pessoa", "Responsável", cli.responsavel || "—")}
    </div>
    <div class="capa-cons"><div class="cc-lab">Consultor Responsável</div><div class="cc-nome">${esc(c.capa.consultor)}</div>
      <div class="cc-cidade">${esc(c.capa.cidade)}<br/>${esc(data)}</div></div>
  </section>`;

  const apres = `<section class="pg sec">
    ${header("02")}
    <h1 class="sec-tit">APRESENTAÇÃO</h1><div class="sec-sub">${esc(c.capa.subtitulo)}</div>
    <p class="sd"><b>${esc(c.apresentacao.saudacao)}</b></p>
    ${c.apresentacao.paragrafos.map((p) => `<p class="pt">${esc(p)}</p>`).join("")}
    <div class="cards">${c.apresentacao.cards
      .map((cd) => `<div class="card"><span class="card-ic">${iconeSvg(cd.icone)}</span><div class="card-t">${esc(cd.titulo)}</div><div class="card-x">${esc(cd.texto)}</div></div>`)
      .join("")}</div>
  </section>`;

  const comod = `<section class="pg sec">
    ${header("03")}
    <h1 class="sec-tit">COMODATOS OFERECIDOS</h1><div class="sec-sub">Equipamentos em Comodato</div>
    <p class="pt">${esc(c.comodatos.intro)}</p>
    <div class="cards">${c.comodatos.equipamentos
      .map((e) => `<div class="card"><span class="card-ic">${iconeSvg(e.icone)}</span><div class="card-t">${esc(e.titulo)}</div><div class="card-x">${esc(e.descricao)}</div></div>`)
      .join("")}</div>
    <div class="vant-tit">VANTAGENS DO COMODATO</div>
    <div class="vant">${c.comodatos.vantagens
      .map((v) => `<div class="vant-i"><span class="ic ic-ok">${iconeSvg("check", ORANGE)}</span>${esc(v)}</div>`)
      .join("")}</div>
  </section>`;

  const produtos = scope.itens.map((it) => paginaProduto(it, imagens[it.codigo] ?? "")).join("");

  const cond = `<section class="pg sec">
    ${header("04")}
    <h1 class="sec-tit">CONDIÇÕES COMERCIAIS</h1><div class="sec-sub">Informações Gerais da Proposta</div>
    <div class="cond-wrap">
      <div class="cond-list">${c.condicoes.itens
        .map((i) => `<div class="cond-i"><span class="cond-ic">${iconeSvg(i.icone)}</span><div><div class="cond-t">${esc(i.titulo)}</div><div class="cond-x">${esc(i.texto)}</div></div></div>`)
        .join("")}</div>
      <div class="cond-close"><p>${esc(c.condicoes.mensagemFechamento)}</p><div class="cc-sep"></div>
        <div class="cc-at">Atenciosamente,</div><div class="cc-nome">${esc(c.condicoes.consultor)}</div>
        <div class="cc-cargo">${esc(c.condicoes.cargo)}</div><div class="cc-emp">Indeba Express</div></div>
    </div>
  </section>`;

  return `<html lang="pt-BR"><head><meta charset="utf-8"/><style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Segoe UI", Arial, sans-serif; color: #2a3746; font-size: 11.5px; }
.pg { padding: 14px 16mm 0; position: relative; }
.pg-head { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5ebf2; padding-bottom: 8px; margin-bottom: 18px; }
.hlogo { height: 34px; } .hpg { color: #7a8696; font-size: 11px; } .hpg b { color: ${NAVY}; }
.sec-tit { color: ${NAVY}; font-size: 30px; font-weight: 800; letter-spacing: -.5px; }
.sec-sub { color: ${ORANGE}; font-weight: 700; font-size: 13px; margin: 2px 0 14px; }
.sec-tit::before { content: ""; display: block; width: 46px; height: 5px; background: ${ORANGE}; border-radius: 3px; margin-bottom: 12px; }
.sd { margin: 6px 0 10px; } .pt { color: #4a5768; line-height: 1.6; margin-bottom: 10px; }
.cards { display: flex; gap: 12px; margin-top: 18px; }
.card { flex: 1; border: 1px solid #e5ebf2; border-radius: 12px; padding: 16px 12px; text-align: center; }
.card-ic { display: inline-flex; width: 46px; height: 46px; border-radius: 50%; background: ${NAVY}; align-items: center; justify-content: center; margin-bottom: 10px; }
.card-ic svg { width: 22px; height: 22px; stroke: #fff; } .card-t { color: ${NAVY}; font-weight: 800; font-size: 11.5px; text-transform: uppercase; }
.card-x { color: #6b7787; font-size: 10px; line-height: 1.4; margin-top: 6px; }
.vant-tit { text-align: center; color: ${NAVY}; font-weight: 800; letter-spacing: 1px; margin: 26px 0 14px; }
.vant { display: flex; gap: 10px; } .vant-i { flex: 1; text-align: center; color: #6b7787; font-size: 10px; }
.ic-ok svg { width: 18px; height: 18px; } .ic { display: inline-flex; vertical-align: middle; }
/* Capa */
.capa { height: 275mm; position: relative; display: flex; flex-direction: column; align-items: center; padding-top: 60px; page-break-after: always; overflow: hidden; }
.wave { position: absolute; bottom: 0; left: 0; width: 100%; height: 130px; }
.capa-logo { width: 200px; margin-bottom: 40px; }
.capa-tit { color: ${NAVY}; font-size: 26px; font-weight: 800; letter-spacing: 4px; }
.capa-sub { color: #6b7787; font-size: 13px; margin-top: 6px; }
.capa-card { background: #fff; border: 1px solid #eef2f7; border-radius: 16px; box-shadow: 0 8px 30px rgba(11,42,74,.08); padding: 18px 26px; margin-top: 40px; width: 340px; }
.cc-row { display: flex; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid #f0f3f7; }
.cc-row:last-child { border-bottom: none; } .cc-ic { width: 38px; height: 38px; border-radius: 50%; background: ${NAVY}; display: inline-flex; align-items: center; justify-content: center; }
.cc-ic svg { width: 18px; height: 18px; stroke: #fff; } .cc-r { color: #8a95a3; font-size: 9.5px; } .cc-v { color: ${NAVY}; font-weight: 800; font-size: 13px; }
.capa-cons { text-align: center; margin-top: 40px; } .cc-lab { color: #8a95a3; font-size: 11px; }
.cc-nome { color: ${NAVY}; font-weight: 800; font-size: 14px; margin-top: 2px; } .cc-cidade { color: #6b7787; font-size: 11px; margin-top: 28px; }
/* Condições */
.cond-wrap { display: flex; gap: 20px; } .cond-list { flex: 1.2; }
.cond-i { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f0f3f7; }
.cond-ic { width: 40px; height: 40px; border-radius: 10px; background: ${NAVY}; display: inline-flex; align-items: center; justify-content: center; flex: 0 0 40px; }
.cond-ic svg { width: 18px; height: 18px; stroke: #fff; } .cond-t { color: ${NAVY}; font-weight: 800; font-size: 12px; }
.cond-x { color: #6b7787; font-size: 10px; line-height: 1.4; }
.cond-close { flex: 1; background: #f7f9fc; border-radius: 14px; padding: 20px; text-align: center; color: #5a6878; font-size: 11px; }
.cc-sep { width: 40px; height: 4px; background: ${ORANGE}; border-radius: 2px; margin: 14px auto; } .cc-at { margin-bottom: 8px; }
.cc-cargo { color: #8a95a3; font-size: 10px; } .cc-emp { color: ${NAVY}; font-weight: 800; margin-top: 8px; }
/* Página de produto */
.prodpg { padding: 0 0 0; position: relative; page-break-after: always; min-height: 272mm; }
.p-head { background: ${NAVY}; height: 46px; display: flex; align-items: center; justify-content: flex-end; padding: 0 16mm; }
.p-badge { color: #fff; font-size: 12px; letter-spacing: 2px; } .p-badge b { color: ${ORANGE}; }
.p-top { display: flex; gap: 18px; padding: 20px 16mm 0; }
.p-foto { flex: 0 0 210px; height: 300px; background: #f2f6fa; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.p-foto img { max-width: 180px; max-height: 280px; object-fit: contain; }
.p-main { flex: 1; } .p-tit { color: ${NAVY}; font-size: 24px; font-weight: 800; line-height: 1.1; }
.p-sub { color: ${ORANGE}; font-weight: 700; font-size: 15px; margin-top: 2px; }
.p-desc { color: #4a5768; line-height: 1.5; margin: 12px 0; }
.p-block { margin-top: 12px; } .p-bt { color: #fff; background: ${NAVY}; display: inline-block; padding: 4px 12px; border-radius: 6px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
.p-ind { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 10px; } .p-ic { text-align: center; font-size: 9px; color: #6b7787; width: 64px; }
.p-ic .ic svg { width: 26px; height: 26px; } .p-ben { list-style: none; margin-top: 10px; }
.p-ben li { display: flex; align-items: center; gap: 8px; color: #3a4757; font-size: 11px; padding: 3px 0; }
.p-grid { display: flex; gap: 12px; padding: 18px 16mm 0; }
.p-mini { flex: 1; border: 1px solid #e5ebf2; border-radius: 10px; padding: 10px; }
.p-mt { color: ${NAVY}; font-weight: 800; font-size: 9.5px; text-transform: uppercase; text-align: center; margin-bottom: 8px; }
.p-row { display: flex; justify-content: space-between; font-size: 10px; color: #4a5768; padding: 3px 0; } .p-row b { color: ${NAVY}; }
.p-big { text-align: center; color: ${ORANGE}; font-weight: 800; font-size: 13px; }
.p-valores { display: flex; align-items: center; gap: 20px; margin: 20px 16mm 0; background: ${NAVY}; border-radius: 12px; padding: 14px 20px; }
.p-vtag { background: ${ORANGE}; color: #fff; font-weight: 800; padding: 6px 16px; border-radius: 8px; text-transform: uppercase; }
.p-val { text-align: center; color: #fff; } .p-vl { font-size: 10px; opacity: .8; } .p-vp { font-size: 20px; font-weight: 800; }
.dots { position: absolute; width: 60px; height: 60px; }
</style></head><body>
${capa}
${apres}
${comod}
${produtos}
${cond}
</body></html>`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test consolidada-html`
Expected: PASS (2 testes).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/template-consolidada.ts tests/unit/consolidada-html.test.ts
git commit -m "feat(pdf): consolidadaHtml() — documento de 5 seções (consolidada)"
```

---

### Task 7: Rotear `render.ts` para o tipo `consolidada`

**Files:**
- Modify: `src/lib/pdf/render.ts`
- Test: `tests/unit/render-consolidada.test.ts`

**Interfaces:**
- Consumes: `consolidadaHtml`.
- Produces: `montarDocumento` (agora **exportado**) roteia `case "consolidada"`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/render-consolidada.test.ts
import { describe, it, expect } from "vitest";
import { montarDocumento } from "@/lib/pdf/render";
import { consolidadaDefaults } from "@/lib/consolidada-defaults";
import type { PropostaScope } from "@/lib/contracts";

const scope: PropostaScope = {
  id: "1", criadoEm: "2026-07-10T00:00:00.000Z", status: "rascunho",
  tipo: "consolidada", template: "indeba_express",
  cliente: { razaoSocial: "ACME", cnpj: null, segmento: null, responsavel: null },
  textoApresentacao: { conteudo: "x", procedencia: "MANUAL" },
  itens: [{ codigo: "A", nome: "Produto A", descricaoUso: "u", imagemPath: "/a.png",
    embalagens: [{ tamanho: 5, unidade: "L", preco: "100.00", diluicaoMax: null, custoDiluido: null }],
    quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", ficha: null }],
  condicoesComerciais: { validade: "30 dias", prazoEntrega: "15d", pagamento: "boleto", frete: "CIF" },
  consolidada: consolidadaDefaults(),
};

describe("montarDocumento — consolidada", () => {
  it("roteia para consolidadaHtml", () => {
    const doc = montarDocumento(scope, { A: "data:,x" }, "", () => "data:,logo");
    expect(doc.html).toContain("PROPOSTA DE SOLUÇÃO");
    expect(doc.html).toContain("ACME");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test render-consolidada`
Expected: FAIL — `montarDocumento` não exportado / sem case consolidada.

- [ ] **Step 3: Write minimal implementation**

Em `src/lib/pdf/render.ts`:

1. Import junto aos outros templates:
```typescript
import { consolidadaHtml } from "./template-consolidada";
```

2. Troque `function montarDocumento(` por `export function montarDocumento(`.

3. Adicione o case ANTES do `default`:
```typescript
    case "consolidada":
      return {
        html: consolidadaHtml(scope, imagens, { logo: asset("/marca/indeba-logo.png") }),
        footer: FOOTER_PAG,
        marginTop: "0mm",
      };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test render-consolidada`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdf/render.ts tests/unit/render-consolidada.test.ts
git commit -m "feat(pdf): render roteia tipo consolidada"
```

---

### Task 8: Preencher `ficha` de PRIMMAX-PLUS e PRIMMAX-DGCLOR no catálogo

**Files:**
- Modify: `data/catalogo.json`
- Test: `tests/unit/catalogo-ficha.test.ts`

**Interfaces:**
- Produces: `PRIMMAX-PLUS` e `PRIMMAX-DGCLOR` com `ficha` preenchida; contagem segue 9.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/catalogo-ficha.test.ts
import { describe, it, expect } from "vitest";
import { carregarCatalogo } from "@/lib/catalogo";

describe("catálogo — fichas dos produtos-piloto", () => {
  const cat = carregarCatalogo();
  it("mantém 9 produtos", () => expect(cat.produtos.length).toBe(9));
  it("PRIMMAX-PLUS tem ficha rica", () => {
    const p = cat.produtos.find((x) => x.codigo === "PRIMMAX-PLUS");
    expect(p?.ficha?.titulo).toBeTruthy();
    expect((p?.ficha?.beneficios ?? []).length).toBeGreaterThan(0);
    expect(p?.ficha?.caracteristicas?.pH).toBeTruthy();
    expect((p?.ficha?.diluicoes ?? []).length).toBeGreaterThan(0);
  });
  it("PRIMMAX-DGCLOR tem ficha rica", () => {
    const p = cat.produtos.find((x) => x.codigo === "PRIMMAX-DGCLOR");
    expect(p?.ficha?.titulo).toBeTruthy();
    expect((p?.ficha?.beneficios ?? []).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test catalogo-ficha`
Expected: FAIL — `ficha` ausente.

- [ ] **Step 3: Write minimal implementation**

Em `data/catalogo.json`, no objeto de `PRIMMAX-PLUS`, adicione a chave `"ficha"` (depois de `"embalagens"`). Repita para `PRIMMAX-DGCLOR` com os dados dele. Exemplo para PRIMMAX-PLUS:

```json
      "ficha": {
        "titulo": "Detergente Desengordurante",
        "subtitulo": "Alcalino Concentrado",
        "linhaLabel": "KITCHEN",
        "descricao": "Fórmula poderosa que remove as gorduras mais difíceis com eficiência e rapidez. Ideal para uso profissional em cozinhas e ambientes que exigem alto padrão de limpeza.",
        "indicadoPara": [
          { "label": "Cozinhas industriais", "icone": "cozinha" },
          { "label": "Restaurantes", "icone": "restaurante" },
          { "label": "Hotéis", "icone": "hotel" },
          { "label": "Padarias", "icone": "padaria" },
          { "label": "Churrascarias", "icone": "churrascaria" }
        ],
        "beneficios": ["Remove gordura pesada", "Alto rendimento", "Baixa formação de espuma", "Seguro para superfícies laváveis", "Excelente custo-benefício"],
        "diluicoes": [
          { "uso": "Limpeza pesada", "razao": "1:20" },
          { "uso": "Limpeza diária", "razao": "1:50" },
          { "uso": "Manutenção", "razao": "1:100" }
        ],
        "rendimento": "Até 100 litros de solução pronta",
        "caracteristicas": { "pH": "12,5 – 13,5", "aspecto": "Líquido", "cor": "Esverdeado", "odor": "Característico", "uso": "Profissional" }
      }
```

Para `PRIMMAX-DGCLOR` (detergente clorado), use uma ficha análoga com valores próprios: `titulo` "Detergente Clorado", `subtitulo` "Alcalino Clorado", `linhaLabel` "KITCHEN", `descricao` a partir da `descricaoUso` existente, `beneficios` (ex.: "Ação desengordurante e desinfetante", "Remove manchas e odores", "Alto rendimento"), `diluicoes` a partir do `diluicaoMax` "1:100", `caracteristicas.cor` "Amarelado", `odor` "Cloro", `pH` "12,0 – 13,0", `aspecto` "Líquido", `uso` "Profissional".

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test catalogo-ficha catalogo`
Expected: PASS (novos testes + `catalogo.test.ts` intacto, ainda 9 produtos).

- [ ] **Step 5: Commit**

```bash
git add data/catalogo.json tests/unit/catalogo-ficha.test.ts
git commit -m "feat(catalogo): ficha rica de PRIMMAX-PLUS e PRIMMAX-DGCLOR"
```

---

### Task 9: UI — tipo `consolidada` selecionável + preço editável na revisão

**Files:**
- Create: `src/lib/proposta-edit.ts` (helper puro, testável)
- Test: `tests/unit/proposta-edit.test.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces: `setPrecoEmbalagem(scope, codigo, idx, valor): PropostaScope` — atualiza `itens[].embalagens[idx].preco` normalizando para decimal string, sem mutar o original.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/proposta-edit.test.ts
import { describe, it, expect } from "vitest";
import { setPrecoEmbalagem, normalizarPreco } from "@/lib/proposta-edit";
import type { PropostaScope } from "@/lib/contracts";

const scope = {
  itens: [{ codigo: "A", embalagens: [{ tamanho: 5, unidade: "L", preco: "100.00", diluicaoMax: null, custoDiluido: null }] }],
} as unknown as PropostaScope;

describe("proposta-edit", () => {
  it("normalizarPreco força decimal string com 2 casas", () => {
    expect(normalizarPreco("150")).toBe("150.00");
    expect(normalizarPreco("150,5")).toBe("150.50");
    expect(normalizarPreco("abc")).toBe("0.00");
  });
  it("setPrecoEmbalagem atualiza sem mutar o original", () => {
    const novo = setPrecoEmbalagem(scope, "A", 0, "250,90");
    expect(novo.itens[0].embalagens[0].preco).toBe("250.90");
    expect(scope.itens[0].embalagens[0].preco).toBe("100.00"); // imutável
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test proposta-edit`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Write minimal implementation (helper)**

```typescript
// src/lib/proposta-edit.ts
import type { PropostaScope } from "./contracts";

// Converte entrada humana ("150", "150,90") em decimal string canônica "\d+\.\d{2}".
// Preço nunca é float no domínio — sempre string (constituição §1.1).
export function normalizarPreco(v: string): string {
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

// Retorna um novo scope com o preço da embalagem [idx] do item [codigo] alterado.
// Imutável: não muta o scope recebido (React state).
export function setPrecoEmbalagem(scope: PropostaScope, codigo: string, idx: number, valor: string): PropostaScope {
  return {
    ...scope,
    itens: scope.itens.map((it) =>
      it.codigo !== codigo
        ? it
        : { ...it, embalagens: it.embalagens.map((e, i) => (i === idx ? { ...e, preco: normalizarPreco(valor) } : e)) },
    ),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test proposta-edit`
Expected: PASS (2 testes).

- [ ] **Step 5: Wire na UI (`src/app/page.tsx`)**

1. Import (topo, junto aos demais de `@/lib`):
```typescript
import { setPrecoEmbalagem } from "@/lib/proposta-edit";
```

2. No array `TIPOS` (por volta da linha 163), adicione a entrada:
```typescript
  { value: "consolidada", label: "Consolidada", hint: "IES, 1 página rica/produto" },
```
E em `TipoProposta` (linha ~159) inclua `| "consolidada"`.

3. Na tela de Revisão, onde hoje cada item mostra preço/quantidade, adicione um input de preço por embalagem chamando o handler. Junto de `adjustQuantidade` (linha ~325), adicione:
```typescript
  const editarPreco = (codigo: string, idx: number, valor: string) =>
    setScope((s) => (s ? setPrecoEmbalagem(s, codigo, idx, valor) : s));
```
E no JSX do item, para cada embalagem, renderize:
```tsx
<input
  aria-label={`Preço embalagem ${e.tamanho}${e.unidade} de ${it.nome}`}
  defaultValue={e.preco}
  onBlur={(ev) => editarPreco(it.codigo, i, ev.target.value)}
  style={{ width: 90 }}
/>
```
(onde `i`/`e` vêm de `it.embalagens.map((e, i) => ...)`). O `total` já recalcula a partir de `precoUnit(it)`.

- [ ] **Step 6: Verificar build/lint e comportamento**

Run: `pnpm lint && pnpm build`
Expected: sem erros de tipo/lint. O tipo `consolidada` aparece no seletor e o preço é editável na revisão. Invoque a skill `verify` (ou `run`) para dirigir a UI: montar uma proposta `consolidada`, editar um preço, gerar o PDF e conferir as 5 seções + 1 página por produto.

- [ ] **Step 7: Commit**

```bash
git add src/lib/proposta-edit.ts tests/unit/proposta-edit.test.ts src/app/page.tsx
git commit -m "feat(ui): tipo consolidada no seletor + preço editável na revisão"
```

---

## Verificação final (após todas as tasks)

- [ ] `pnpm test` — toda a suíte verde (incluindo `catalogo.test.ts` intacto).
- [ ] `pnpm lint && pnpm build` — sem erros.
- [ ] Skill `verify`: fluxo ponta a ponta — montar proposta `consolidada`, editar preço, POST `/api/pdf`, abrir o PDF e conferir: capa, apresentação, comodatos, **uma página por produto** (Primmax Plus e DGCLOR com ficha rica; produto sem ficha degrada pro nome), condições comerciais.

## Fora deste plano (Fase 2)

Edição na UI dos textos institucionais (`scope.consolidada.*`) — apresentação, cards, comodatos, condições. O modelo de dados e os defaults já suportam desde a Fase 1; falta o formulário de edição (componente isolado, para não engrossar `page.tsx`).
