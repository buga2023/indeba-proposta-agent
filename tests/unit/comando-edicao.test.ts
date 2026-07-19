import { describe, it, expect, vi } from "vitest";
import { itemDoCatalogo } from "@/lib/montar";

// Catálogo com preço real — teste-guardião do chat de correção: "adicionar_item_catalogo"
// só pode receber um `codigo` da IA; o preço/nome/imagem SEMPRE vêm daqui, nunca de um
// valor que a IA tenha "decidido" (constituição §2).
const { carregarCatalogo } = vi.hoisted(() => ({
  carregarCatalogo: vi.fn(() => ({
    marca: "indeba_express" as const,
    produtos: [
      {
        codigo: "PRIMMAX-PLUS",
        nome: "Primmax Plus",
        marca: "indeba",
        linha: "alimentos_bebidas",
        descricaoCurta: "Detergente concentrado",
        descricaoUso: "Lavar louças e pisos",
        segmentos: [],
        funcoes: [],
        metodos: [],
        imagemPath: "/produtos/primmax-plus.png",
        fichaTecnicaPath: null,
        ativo: true,
        embalagens: [{ tamanho: 5, unidade: "L" as const, preco: "111.11", diluicaoMax: "1:100", custoDiluido: null }],
      },
      {
        codigo: "SEM-PRECO",
        nome: "Produto Sem Preço",
        marca: "indeba",
        linha: "alimentos_bebidas",
        descricaoCurta: "x",
        descricaoUso: "x",
        segmentos: [],
        funcoes: [],
        metodos: [],
        imagemPath: "/produtos/x.png",
        fichaTecnicaPath: null,
        ativo: true,
        embalagens: [{ tamanho: 5, unidade: "L" as const, preco: null, diluicaoMax: null, custoDiluido: null }],
      },
    ],
  })),
}));
vi.mock("@/lib/catalogo", () => ({
  carregarCatalogo,
  produtoPorCodigo: (codigo: string) => carregarCatalogo().produtos.find((p: { codigo: string }) => p.codigo === codigo),
}));

describe("itemDoCatalogo — guardião do chat de correção (adicionar_item_catalogo)", () => {
  it("resolve nome/preço/imagem do CATÁLOGO a partir só do código", () => {
    const item = itemDoCatalogo("PRIMMAX-PLUS", 3);
    expect(item.nome).toBe("Primmax Plus");
    expect(item.embalagens[0].preco).toBe("111.11"); // preço do catálogo, nunca da IA
    expect(item.imagemPath).toBe("/produtos/primmax-plus.png");
    expect(item.quantidade).toBe(3);
  });

  it("quantidade sempre inteira e no mínimo 1", () => {
    expect(itemDoCatalogo("PRIMMAX-PLUS", 0).quantidade).toBe(1);
    expect(itemDoCatalogo("PRIMMAX-PLUS", 2.7).quantidade).toBe(3);
  });

  it("código inexistente no catálogo → lança (não inventa item)", () => {
    expect(() => itemDoCatalogo("NAO-EXISTE")).toThrow(/não está no catálogo/);
  });

  it("produto sem nenhum preço cadastrado → lança (não emite valor inventado)", () => {
    expect(() => itemDoCatalogo("SEM-PRECO")).toThrow(/sem preço/);
  });
});
