import { describe, it, expect } from "vitest";
import { montarPropostaEstruturada } from "@/lib/montar";

// O catálogo não carrega mais preço (todo preco/custoDiluido é null): quem cota é o
// consultor, e a tela manda as embalagens com o valor digitado (page.tsx, ramo
// "catálogo sem preço"). Estes testes são sobre o BLOCO consolidada, não sobre preço —
// então mandam a embalagem cotada explícita, igual ao que a UI real envia.
const item = (over: Record<string, unknown> = {}) => ({
  codigo: "PRIMMAX-PLUS",
  quantidade: 1,
  embalagens: [{ tamanho: 5, unidade: "L" as const, preco: "130.00", diluicaoMax: "1:100", custoDiluido: null }],
  ...over,
});

describe("montarPropostaEstruturada — consolidada", () => {
  it("injeta bloco consolidada e copia ficha do catálogo por item", async () => {
    const scope = await montarPropostaEstruturada({
      cliente: { razaoSocial: "Sua Empresa", cnpj: null, segmento: null, responsavel: null },
      tipo: "consolidada",
      textoApresentacao: "texto manual (sem IA)",
      itens: [item()],
    });
    expect(scope.tipo).toBe("consolidada");
    expect(scope.consolidada).toBeDefined();
    expect(scope.consolidada?.apresentacao.cards.length).toBe(4);
    // PRIMMAX-PLUS terá ficha após a Task 8; aqui só garantimos que o campo é propagado quando existe
    expect(scope.itens[0]).toHaveProperty("ficha");
  });

  it("condições comerciais preenchidas na montagem substituem os defaults", async () => {
    const itens = [
      { titulo: "Validade da Proposta", texto: "Válida por 10 dias.", icone: "validade" },
      { titulo: "Pedido Mínimo", texto: "Pedido mínimo: R$ 800,00.", icone: "caixa" },
    ];
    const scope = await montarPropostaEstruturada({
      cliente: { razaoSocial: "Sua Empresa", cnpj: null, segmento: null, responsavel: null },
      tipo: "consolidada",
      textoApresentacao: "t",
      itens: [item()],
      condicoesConsolidada: itens,
    });
    expect(scope.consolidada?.condicoes.itens).toEqual(itens);
    expect(scope.consolidada?.condicoes.consultor).toBeTruthy(); // resto do bloco intacto
  });

  it("sem condições na entrada, mantém os defaults", async () => {
    const scope = await montarPropostaEstruturada({
      cliente: { razaoSocial: "Sua Empresa", cnpj: null, segmento: null, responsavel: null },
      tipo: "consolidada",
      textoApresentacao: "t",
      itens: [item()],
    });
    expect(scope.consolidada?.condicoes.itens.length).toBe(7);
  });

  // O mesmo produto pode ser cotado em duas embalagens (5 L e 20 L) — viram DOIS itens
  // independentes, cada um com seu preço/diluição/quantidade (pedido do Gustavo 25/07).
  it("aceita o mesmo produto duas vezes, em embalagens diferentes", async () => {
    const scope = await montarPropostaEstruturada({
      cliente: { razaoSocial: "Sua Empresa", cnpj: null, segmento: null, responsavel: null },
      tipo: "consolidada",
      textoApresentacao: "t",
      itens: [
        { codigo: "PRIMMAX-PLUS", quantidade: 1, embalagens: [{ tamanho: 5, unidade: "L", preco: "130.00", diluicaoMax: "1:100", custoDiluido: null }] },
        { codigo: "PRIMMAX-PLUS", quantidade: 2, embalagens: [{ tamanho: 20, unidade: "L", preco: "480.00", diluicaoMax: "1:200", custoDiluido: null }] },
      ],
    });
    expect(scope.itens.length).toBe(2);
    expect(scope.itens.map((i) => i.embalagens[0].tamanho)).toEqual([5, 20]);
    expect(scope.itens.map((i) => i.embalagens[0].preco)).toEqual(["130.00", "480.00"]);
    expect(scope.itens.map((i) => i.quantidade)).toEqual([1, 2]);
  });

  it("NÃO injeta consolidada para outros tipos", async () => {
    const scope = await montarPropostaEstruturada({
      cliente: { razaoSocial: "X", cnpj: null, segmento: null, responsavel: null },
      tipo: "orcamento",
      textoApresentacao: "t",
      itens: [item()],
    });
    expect(scope.consolidada ?? null).toBe(null);
  });
});
