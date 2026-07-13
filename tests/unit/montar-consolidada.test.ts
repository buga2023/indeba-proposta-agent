import { describe, it, expect } from "vitest";
import { montarPropostaEstruturada } from "@/lib/montar";

describe("montarPropostaEstruturada — consolidada", () => {
  it("injeta bloco consolidada e copia ficha do catálogo por item", async () => {
    const scope = await montarPropostaEstruturada({
      cliente: { razaoSocial: "Sua Empresa", cnpj: null, segmento: null, responsavel: null },
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
      cliente: { razaoSocial: "X", cnpj: null, segmento: null, responsavel: null },
      tipo: "orcamento",
      textoApresentacao: "t",
      itens: [{ codigo: "PRIMMAX-PLUS", quantidade: 1 }],
    });
    expect(scope.consolidada ?? null).toBe(null);
  });
});
