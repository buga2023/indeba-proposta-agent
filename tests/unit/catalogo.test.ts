import { describe, it, expect } from "vitest";
import { carregarCatalogo } from "@/lib/catalogo";
import { selecionar } from "@/lib/selecao/matcher";
import { porPalavraChave } from "@/lib/llm/extrair-pedido";

// Teste-guardião (constituição §1.2 / §2): preço/dado crítico NUNCA nasce fora do
// catálogo. O matcher pontua o que já existe e nunca emite preço.
describe("catálogo — fonte da verdade dos preços", () => {
  const catalogo = carregarCatalogo();

  it("valida contra o Zod e traz os 9 produtos ativos da Proposta GVA", () => {
    // Catálogo cresceu com a base técnica INDEBA/PRATT (fichas técnicas + fotos),
    // mas os produtos novos entram ativo:false até alguém definir preço real —
    // preço nunca nasce da IA (constituição §1.2). Os 9 originais continuam ativos.
    expect(catalogo.produtos.filter((p) => p.ativo).length).toBe(9);
    const plus = catalogo.produtos.find((p) => p.codigo === "PRIMMAX-PLUS");
    expect(plus?.embalagens[0].preco).toBe("130.00"); // valor real do PDF
  });

  it("todo preço do catálogo é decimal string (nunca float)", () => {
    for (const p of catalogo.produtos) {
      for (const e of p.embalagens) {
        expect(e.preco).toMatch(/^\d+\.\d{2}$/);
      }
    }
  });

  it("GUARDIÃO: a seleção referencia produtos reais e NÃO emite preço", () => {
    const facetas = porPalavraChave(
      "Cozinha industrial: desengordurante para louças e bancadas no diluidor automático, desinfecção do ambiente, sabonete e álcool gel para as mãos.",
    );
    const selecao = selecionar(catalogo.produtos, facetas);
    expect(selecao.itens.length).toBeGreaterThan(0);

    for (const item of selecao.itens) {
      // todo item selecionado aponta para um código real do catálogo
      const doCatalogo = catalogo.produtos.find((p) => p.codigo === item.codigo);
      expect(doCatalogo).toBeDefined();
      // o item de seleção é estruturalmente incapaz de carregar preço
      expect(item).not.toHaveProperty("preco");
      expect(item).not.toHaveProperty("embalagens");
    }
  });
});
