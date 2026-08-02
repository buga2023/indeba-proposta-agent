import { describe, it, expect, vi } from "vitest";
import { montarPropostaEstruturada } from "@/lib/montar";
import { EntradaEstruturada } from "@/lib/contracts";

// Catálogo SEM preço (fonte de produto; o valor vem do orçamento importado).
// `catalogoCompleto` é a leitura que une JSON + produtos cadastrados pela tela — é ela que
// `montar.ts` usa desde o cadastro pela interface (docs/spec-cadastro-produto.md).
const { catalogoCompleto } = vi.hoisted(() => ({
  catalogoCompleto: vi.fn(async () => ({
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
        embalagens: [{ tamanho: 5, unidade: "L" as const, preco: null, diluicaoMax: "1:100", custoDiluido: null }],
      },
    ],
  })),
}));
vi.mock("@/lib/catalogo", () => ({ catalogoCompleto, produtoPorCodigo: () => undefined }));

const entrada = (itens: unknown[]) =>
  EntradaEstruturada.parse({
    tipo: "implantacao",
    cliente: { razaoSocial: "Cliente X" },
    itens,
    textoApresentacao: "Apresentação.", // MANUAL — não chama a IA no teste
  });

describe("catálogo sem valor — o preço autoritativo vem do orçamento importado", () => {
  it("guardião: codigo + embalagens → foto/descrição do catálogo, PREÇO do orçamento", async () => {
    const scope = await montarPropostaEstruturada(
      entrada([
        {
          codigo: "PRIMMAX-PLUS",
          nome: "PRIMMAX PLUS - Bombona 5L",
          embalagens: [{ tamanho: 5, unidade: "L", preco: "111.11", diluicaoMax: null, custoDiluido: null }],
          quantidade: 2,
        },
      ]),
    );
    const item = scope.itens[0];
    expect(item.nome).toBe("Primmax Plus"); // canônico do catálogo
    expect(item.imagemPath).toBe("/produtos/primmax-plus.png"); // foto do catálogo
    expect(item.embalagens[0].preco).toBe("111.11"); // preço do ORÇAMENTO, não do catálogo
    expect(item.quantidade).toBe(2);
  });

  it("codigo só (sem embalagens) com catálogo sem preço → erro claro, sem inventar valor", async () => {
    await expect(montarPropostaEstruturada(entrada([{ codigo: "PRIMMAX-PLUS" }]))).rejects.toThrow(
      /sem preço no catálogo/,
    );
  });
});
