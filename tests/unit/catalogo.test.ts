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
    // mas o `ativo` é sobre o produto estar em linha — não sobre ter preço.
    expect(catalogo.produtos.filter((p) => p.ativo).length).toBe(9);
    expect(catalogo.produtos.find((p) => p.codigo === "PRIMMAX-PLUS")).toBeDefined();
  });

  // O catálogo é a fonte da verdade de PRODUTO (nome/ficha/foto/embalagens), não de preço:
  // preço é do consultor, digitado na montagem ou vindo do orçamento importado, e viaja no
  // PropostaScope. Guardião: nenhum preço volta a ser fixado aqui — foi justamente isso que
  // deixava o app anunciar valor defasado sem ninguém ter cotado.
  it("GUARDIÃO: o catálogo não carrega preço — nenhum preco/custoDiluido fixo", () => {
    for (const p of catalogo.produtos) {
      for (const e of p.embalagens) {
        expect(e.preco).toBeNull();
        expect(e.custoDiluido).toBeNull();
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
