import { describe, it, expect } from "vitest";
import { montarPropostaEstruturada } from "@/lib/montar";
import { carregarCatalogo } from "@/lib/catalogo";
import { rotuloSegmento, linhaDoSegmento } from "@/lib/segmento";
import { imagemEhIlustrativa, arteDoRecipiente } from "@/lib/imagem-produto";

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
