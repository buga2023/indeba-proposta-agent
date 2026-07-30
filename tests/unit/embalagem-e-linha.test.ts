import { describe, it, expect } from "vitest";
import { montarPropostaEstruturada } from "@/lib/montar";
import { carregarCatalogo } from "@/lib/catalogo";
import { rotuloSegmento, linhaDoSegmento } from "@/lib/segmento";
import { imagemEhIlustrativa, arteDoRecipiente, imagemDaEmbalagem, chaveImagem } from "@/lib/imagem-produto";

// Spec de ajustes da montagem (jul/2026), Itens 1 a 3. Os três nasceram do mesmo QA:
// o consultor escolhia 200 kg e a proposta saía com 200 kg E 20 kg ao mesmo preço, a
// ficha anunciava "LINHA KITCHEN" numa proposta de lavanderia, e produto sem foto caía
// num frasco cinza com "?" que não tinha nada a ver com a embalagem.

const cliente = { razaoSocial: "Frigorífico X", cnpj: null, segmento: null, responsavel: null };
const cotada = { tamanho: 20, unidade: "kg" as const, preco: "77.00", diluicaoMax: "1:100", custoDiluido: null };

describe("Item 3 — a proposta carrega só a embalagem COTADA", () => {
  it("GUARDIÃO: manda um tamanho, recebe UM tamanho — nunca a lista inteira do catálogo", async () => {
    const multi = carregarCatalogo().produtos.find((p) => p.embalagens.length > 1)!;
    const scope = await montarPropostaEstruturada({
      cliente,
      tipo: "consolidada",
      textoApresentacao: "t",
      itens: [{ codigo: multi.codigo, quantidade: 2, embalagens: [cotada] }],
    });
    expect(scope.itens[0].embalagens).toHaveLength(1);
    expect(scope.itens[0].embalagens[0].tamanho).toBe(20);
    expect(scope.itens[0].embalagens[0].preco).toBe("77.00");
  });

  it("os demais tamanhos seguem visíveis na ficha, SEM preço (tamanhosDisponiveis)", async () => {
    const multi = carregarCatalogo().produtos.find((p) => p.embalagens.length > 1)!;
    const scope = await montarPropostaEstruturada({
      cliente,
      tipo: "consolidada",
      textoApresentacao: "t",
      itens: [{ codigo: multi.codigo, quantidade: 1, embalagens: [cotada] }],
    });
    const disponiveis = scope.itens[0].tamanhosDisponiveis ?? [];
    expect(disponiveis).toHaveLength(multi.embalagens.length);
    expect(disponiveis).toEqual(multi.embalagens.map((e) => ({ tamanho: e.tamanho, unidade: e.unidade })));
    // sem preço em lugar nenhum dessa lista — é informação de ficha técnica, não oferta
    for (const d of disponiveis) expect(d).not.toHaveProperty("preco");
  });

  it("sem embalagem informada, cota UMA (a primeira com preço), não todas", async () => {
    const comPreco = carregarCatalogo().produtos.find((p) => p.embalagens.some((e) => e.preco !== null));
    if (!comPreco) return; // catálogo sem preço: quem cota é o consultor (nada a testar aqui)
    const scope = await montarPropostaEstruturada({
      cliente,
      tipo: "consolidada",
      textoApresentacao: "t",
      itens: [{ codigo: comPreco.codigo, quantidade: 1 }],
    });
    expect(scope.itens[0].embalagens).toHaveLength(1);
  });
});

describe("Item 4 — remontar uma proposta existente não duplica", () => {
  it("com `id` na entrada, o scope montado mantém o MESMO id (auto-save vira update)", async () => {
    const codigo = carregarCatalogo().produtos[0].codigo;
    const entrada = {
      id: "prop-existente-1",
      cliente,
      tipo: "consolidada" as const,
      textoApresentacao: "t",
      itens: [{ codigo, quantidade: 1, embalagens: [cotada] }],
    };
    const scope = await montarPropostaEstruturada(entrada);
    expect(scope.id).toBe("prop-existente-1");
    // sem id → proposta nova, id sorteado
    const nova = await montarPropostaEstruturada({ ...entrada, id: undefined });
    expect(nova.id).not.toBe("prop-existente-1");
  });
});

describe("Item 2 — a LINHA da ficha vem do segmento do cliente", () => {
  it("normaliza slug, sinônimo e caixa para um rótulo único", () => {
    expect(rotuloSegmento("lavanderia_hospitalar")).toBe("Lavanderia Hospitalar");
    expect(rotuloSegmento("lavanderias hospitalares")).toBe("Lavanderia Hospitalar");
    expect(rotuloSegmento("HOSPITAIS")).toBe("Hospitalar");
    expect(rotuloSegmento("industria_alimenticia")).toBe("Indústria Alimentícia");
  });

  it("segmento livre (fora da lista) sai legível, nunca como slug cru", () => {
    expect(rotuloSegmento("laticinio_artesanal")).toBe("Laticinio Artesanal");
    expect(rotuloSegmento("fábrica de sorvete")).toBe("Fábrica de Sorvete");
  });

  it("a linha usa o PRIMEIRO segmento, em caixa alta; sem segmento, não há linha", () => {
    expect(linhaDoSegmento("lavanderia_hospitalar, hotelaria")).toBe("LAVANDERIA HOSPITALAR");
    expect(linhaDoSegmento(null)).toBeNull();
    expect(linhaDoSegmento("  ")).toBeNull();
  });
});

describe("Item 1 — imagem coerente com a embalagem, e marcada como ilustrativa", () => {
  it("recipiente segue a convenção do catálogo: 5 galão, 20 balde, 50 tonel", () => {
    expect(arteDoRecipiente(5, "L")).toContain("galao");
    expect(arteDoRecipiente(20, "L")).toContain("balde");
    expect(arteDoRecipiente(20, "kg")).toContain("balde");
    expect(arteDoRecipiente(50, "L")).toContain("tonel");
    expect(arteDoRecipiente(500, "ml")).toContain("frasco");
  });

  it("kg é o MESMO recipiente pesado: 6,2 kg é galão de 5 L; 62 kg, tonel de 50 L", () => {
    // Primmax CIP DTX (d≈1,24): 6.2 / 62 / 1240 kg são 5 L, 50 L e 1000 L.
    expect(arteDoRecipiente(6.2, "kg")).toBe(arteDoRecipiente(5, "L"));
    expect(arteDoRecipiente(62, "kg")).toBe(arteDoRecipiente(50, "L"));
    expect(arteDoRecipiente(23, "kg")).toBe(arteDoRecipiente(20, "L")); // DGClor, d≈1,15
  });

  it("GUARDIÃO: nenhum produto do catálogo usa mais o placeholder genérico", () => {
    const genericos = carregarCatalogo().produtos.filter((p) => p.imagemPath === "/produtos/_generico.svg");
    expect(genericos.map((p) => p.codigo)).toEqual([]);
  });

  it("toda arte de recipiente é reconhecida como ilustrativa; foto real, não", () => {
    expect(imagemEhIlustrativa("/produtos/_balde-20.svg")).toBe(true);
    expect(imagemEhIlustrativa("/produtos/_generico.svg")).toBe(true);
    expect(imagemEhIlustrativa("/produtos/primmax-plus.png")).toBe(false);
  });

  it("todo produto sem foto real aponta para uma arte compatível com sua embalagem", () => {
    for (const p of carregarCatalogo().produtos) {
      if (!imagemEhIlustrativa(p.imagemPath)) continue;
      const e = p.embalagens[0];
      expect(p.imagemPath).toBe(arteDoRecipiente(e.tamanho, e.unidade));
    }
  });
});

// Lista de QA do Gustavo (29/07): 26 produtos em que "a embalagem cotada é 20 L e aparece
// a de 50 L". A causa é estrutural — o produto tem UMA foto de estúdio, de UM recipiente,
// e era ela que ia pra ficha em qualquer tamanho cotado. `fotoEmbalagem` (catálogo) diz
// qual recipiente a foto mostra; `imagemDaEmbalagem` troca por arte quando não é o cotado.
describe("imagem segue a EMBALAGEM COTADA, não a foto fixa do produto", () => {
  const comFoto = { imagemPath: "/produtos/texspar-dsa.png", fotoEmbalagem: { tamanho: 50, unidade: "L" as const } };

  it("recipiente cotado é o da foto → sai a FOTO", () => {
    expect(imagemDaEmbalagem(comFoto, { tamanho: 50, unidade: "L" })).toBe("/produtos/texspar-dsa.png");
  });

  it("recipiente cotado é OUTRO → sai a arte do recipiente cotado, nunca a foto errada", () => {
    expect(imagemDaEmbalagem(comFoto, { tamanho: 20, unidade: "L" })).toContain("balde");
    expect(imagemDaEmbalagem(comFoto, { tamanho: 5, unidade: "L" })).toContain("galao");
  });

  it("kg equivalente conta como o MESMO recipiente: 58 kg é a bombona de 50 L da foto", () => {
    expect(imagemDaEmbalagem(comFoto, { tamanho: 58, unidade: "kg" })).toBe("/produtos/texspar-dsa.png");
  });

  it("granel ganhou arte própria: 200 kg é tambor e 1000 L é IBC, não a bombona de 50", () => {
    // "auto car 1000 plus (nao aparece 200 kg)": a foto é o balde de 20 kg.
    const autocar = { imagemPath: "/produtos/autocar-1000-plus.png", fotoEmbalagem: { tamanho: 20, unidade: "kg" as const } };
    expect(imagemDaEmbalagem(autocar, { tamanho: 200, unidade: "kg" })).toContain("tambor");
    expect(arteDoRecipiente(1000, "L")).toContain("ibc");
    expect(arteDoRecipiente(1240, "kg")).toBe(arteDoRecipiente(1000, "L"));
  });

  it("foto do próprio tamanho, quando cadastrada, vence tudo", () => {
    expect(imagemDaEmbalagem(comFoto, { tamanho: 20, unidade: "L", imagemPath: "/produtos/x-20l.png" })).toBe("/produtos/x-20l.png");
  });

  it("produto sem fotoEmbalagem mantém o comportamento antigo (foto do produto)", () => {
    expect(imagemDaEmbalagem({ imagemPath: "/produtos/spar-lg.png" }, { tamanho: 20, unidade: "L" })).toBe("/produtos/spar-lg.png");
  });

  it("produto que já era arte segue o tamanho cotado, não a arte fixa do catálogo", () => {
    // Texspar DTT está cadastrado com _balde-20.svg e é vendido em 20 L e 50 L.
    expect(imagemDaEmbalagem({ imagemPath: "/produtos/_balde-20.svg" }, { tamanho: 50, unidade: "L" })).toContain("tonel");
  });

  it("nenhuma arte de recipiente escreve tamanho no desenho (contradiria o cotado)", async () => {
    const { readFileSync, readdirSync } = await import("node:fs");
    // _generico.svg fica fora: ele não é recipiente de tamanho nenhum (é o "Item manual",
    // produto de fora do catálogo), então o texto dele não pode contradizer embalagem.
    const artes = readdirSync("public/produtos").filter((f) => /^_.*\.svg$/.test(f) && f !== "_generico.svg");
    expect(artes.length).toBeGreaterThan(4);
    for (const arte of artes) {
      expect(readFileSync(`public/produtos/${arte}`, "utf8"), arte).not.toMatch(/<text/);
    }
  });

  it("catálogo: fotoEmbalagem sempre aponta pra um tamanho que o produto realmente tem", () => {
    for (const p of carregarCatalogo().produtos) {
      if (!p.fotoEmbalagem) continue;
      const tem = p.embalagens.some((e) => e.tamanho === p.fotoEmbalagem!.tamanho && e.unidade === p.fotoEmbalagem!.unidade);
      expect(tem, `${p.codigo}: fotoEmbalagem ${p.fotoEmbalagem.tamanho}${p.fotoEmbalagem.unidade} não está nas embalagens`).toBe(true);
    }
  });

  // A auditoria de `fotoEmbalagem` só alcança produto MULTI-embalagem: com um tamanho só
  // não há o que declarar, e a foto ia pra proposta sem ninguém conferir. Foi assim que
  // Spar HT-6 e Primmax Inox — cadastrados em 500 ml — saíram com o mock-up genérico do
  // GALÃO DE 5 L da linha (o rótulo nem texto real tem: "NONONO NONO"). QA de navegador
  // 29/07, folha de contato. Os dois foram reapontados para `_frasco.svg`, como já se fez
  // com o Primmax CIP DTX. Frasco de bancada é o tamanho mais fácil de errar assim, porque
  // o mock-up de 5 L é o mesmo em toda a linha — e `fotoEmbalagem` não resolve: ela precisa
  // apontar para um tamanho que o produto TEM, e esses não têm 5 L nenhum.
  it("GUARDIÃO: produto de tamanho único em ml/≤1 L não usa foto de estúdio sem auditoria", () => {
    const suspeitos = carregarCatalogo()
      .produtos.filter(
        (p) =>
          p.embalagens.length === 1 &&
          (p.embalagens[0].unidade === "ml" || p.embalagens[0].tamanho <= 1) &&
          !p.embalagens[0].imagemPath && // foto do próprio tamanho é auditoria suficiente
          !imagemEhIlustrativa(p.imagemPath),
      )
      .map((p) => `${p.codigo} (${p.embalagens[0].tamanho}${p.embalagens[0].unidade} → ${p.imagemPath})`);
    expect(suspeitos).toEqual([]);
  });

  it("GUARDIÃO: todo produto multi-embalagem COM foto declara qual recipiente ela mostra", () => {
    const semAuditoria = carregarCatalogo()
      .produtos.filter((p) => p.embalagens.length > 1 && !imagemEhIlustrativa(p.imagemPath) && !p.fotoEmbalagem)
      .map((p) => p.codigo);
    expect(semAuditoria).toEqual([]);
  });

  it("mesmo produto em dois tamanhos são duas imagens diferentes no PDF (chave por embalagem)", () => {
    const base = { codigo: "PRIMMAX-CL", embalagens: [{ tamanho: 5, unidade: "L" }] };
    const outro = { codigo: "PRIMMAX-CL", embalagens: [{ tamanho: 20, unidade: "L" }] };
    expect(chaveImagem(base)).not.toBe(chaveImagem(outro));
  });
});

// QA de navegador (29/07, docs/spec-qa-navegador-imagem-embalagem.md): a tela manual manda
// a embalagem cotada com tamanho/preço/diluição e SEM `imagemPath` — dado que é do
// catálogo, ela não tem por que reenviar. A regra 1 de `imagemDaEmbalagem` ("foto do
// próprio tamanho vence tudo") então não disparava na montagem, e 29 pares que TÊM foto do
// recipiente certo (Texspar DSA 20 L, Autocar Plus 200 kg, City T Líquido 5 L…) saíam com a
// arte ilustrativa. O consultor via desenho onde havia foto real do que o cliente recebe.
describe("a foto do PRÓPRIO TAMANHO chega na proposta montada pela tela", () => {
  const pares = carregarCatalogo().produtos.flatMap((p) =>
    p.embalagens.filter((e) => e.imagemPath).map((e) => ({ p, e })),
  );

  it("GUARDIÃO: toda embalagem com foto cadastrada sai com ela — a tela não reenvia o imagemPath", async () => {
    expect(pares.length).toBeGreaterThan(20); // 29 em 29/07; o guardião não depende do número
    const scope = await montarPropostaEstruturada({
      cliente,
      tipo: "consolidada",
      textoApresentacao: "t",
      itens: pares.map(({ p, e }) => ({
        codigo: p.codigo,
        quantidade: 1,
        // exatamente o payload da tela manual: sem imagemPath
        embalagens: [{ tamanho: e.tamanho, unidade: e.unidade, preco: "100.00", diluicaoMax: null, custoDiluido: null }],
      })),
    });
    const erradas = scope.itens
      .map((it, i) => ({ it, esperado: pares[i].e.imagemPath }))
      .filter(({ it, esperado }) => it.imagemPath !== esperado)
      .map(({ it, esperado }) => `${it.codigo} ${it.embalagens[0].tamanho}${it.embalagens[0].unidade}: ${it.imagemPath} (esperado ${esperado})`);
    expect(erradas).toEqual([]);
  });

  it("embalagem SEM foto do tamanho continua caindo na regra do fotoEmbalagem/arte", async () => {
    // Texspar DTC: a foto é a bombona de 50 L e o 20 L não tem foto própria → arte do balde.
    const scope = await montarPropostaEstruturada({
      cliente,
      tipo: "consolidada",
      textoApresentacao: "t",
      itens: [{ codigo: "TEXSPAR-DTC", quantidade: 1, embalagens: [{ tamanho: 20, unidade: "L", preco: "100.00", diluicaoMax: null, custoDiluido: null }] }],
    });
    expect(scope.itens[0].imagemPath).toContain("balde");
    expect(imagemEhIlustrativa(scope.itens[0].imagemPath)).toBe(true);
  });
});
