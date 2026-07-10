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
