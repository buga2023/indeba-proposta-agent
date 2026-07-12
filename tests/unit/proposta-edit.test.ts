import { describe, it, expect } from "vitest";
import { setPrecoEmbalagem, normalizarPreco, extrairNumero, setClienteCampo, setQuantidadeAbsoluta, setCondicaoComercial } from "@/lib/proposta-edit";
import type { PropostaScope } from "@/lib/contracts";

const scope = {
  cliente: { razaoSocial: "Cliente X", cnpj: null, segmento: null, responsavel: null },
  condicoesComerciais: { validade: "15 dias", prazoEntrega: "72h", pagamento: "Boleto", frete: "CIF" },
  itens: [
    { codigo: "A", quantidade: 1, embalagens: [{ tamanho: 5, unidade: "L", preco: "100.00", diluicaoMax: null, custoDiluido: null }] },
  ],
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

  // Chat de correção (comando-edicao): a IA nunca decide o número — só extrairNumero,
  // sobre a mensagem ORIGINAL do vendedor, entrega o valor a aplicar.
  describe("extrairNumero — trava de preço/quantidade do chat de correção", () => {
    it("extrai preço em formato R$ e decimal com vírgula", () => {
      expect(extrairNumero("muda o preço pra R$ 25,90")).toBe("25,90");
      expect(extrairNumero("quero 25.90 nesse item")).toBe("25.90");
    });
    it("extrai quantidade inteira", () => {
      expect(extrairNumero("muda a quantidade pra 5")).toBe("5");
    });
    it("mensagem sem número reconhecível devolve null — não aplica, não adivinha", () => {
      expect(extrairNumero("troca o cliente")).toBeNull();
    });
  });

  it("setClienteCampo troca só o campo pedido, sem mutar o original", () => {
    const novo = setClienteCampo(scope, "cnpj", "00.000.000/0001-00");
    expect(novo.cliente.cnpj).toBe("00.000.000/0001-00");
    expect(novo.cliente.razaoSocial).toBe("Cliente X");
    expect(scope.cliente.cnpj).toBeNull(); // imutável
  });

  it("setQuantidadeAbsoluta define a quantidade (nunca abaixo de 1)", () => {
    expect(setQuantidadeAbsoluta(scope, "A", 5).itens[0].quantidade).toBe(5);
    expect(setQuantidadeAbsoluta(scope, "A", 0).itens[0].quantidade).toBe(1);
    expect(setQuantidadeAbsoluta(scope, "A", -3).itens[0].quantidade).toBe(1);
  });

  it("setCondicaoComercial troca só o campo pedido", () => {
    const novo = setCondicaoComercial(scope, "frete", "FOB");
    expect(novo.condicoesComerciais.frete).toBe("FOB");
    expect(novo.condicoesComerciais.pagamento).toBe("Boleto");
  });
});
