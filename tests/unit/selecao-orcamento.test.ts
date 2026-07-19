import { describe, it, expect } from "vitest";
import { selecionarComOrcamento } from "@/lib/selecao/matcher";
import type { Produto, FacetasDetectadas, Funcao } from "@/lib/contracts";

// Guardião do chat de correção ("selecionar_por_necessidade"): a IA só descreve a
// necessidade (vira facetas) — quem decide preço/o que cabe é este motor determinístico.
const produto = (codigo: string, preco: string, funcoes: Funcao[] = ["desengordurante"]): Produto => ({
  codigo,
  nome: codigo,
  marca: "indeba",
  linha: "alimentos_bebidas",
  descricaoCurta: "x",
  descricaoUso: "x",
  segmentos: [],
  funcoes,
  metodos: [],
  imagemPath: "/produtos/x.png",
  fichaTecnicaPath: null,
  ativo: true,
  embalagens: [{ tamanho: 5, unidade: "L", preco, diluicaoMax: null, custoDiluido: null }],
});

const produtos: Produto[] = [
  produto("A", "100.00"),
  produto("B", "200.00"),
  produto("C", "50.00"),
  produto("D", "1000.00"),
];

const facetas: FacetasDetectadas = { linha: [], segmento: [], funcao: ["desengordurante"], metodo: [] };

describe("selecionarComOrcamento — guardião do chat (selecionar_por_necessidade)", () => {
  it("sem teto, se comporta como selecionar() puro (todos os candidatos, até o limite)", () => {
    const r = selecionarComOrcamento(produtos, facetas, null);
    expect(r.map((i) => i.codigo).sort()).toEqual(["A", "B", "C", "D"]);
  });

  it("nunca estoura o teto — só entram itens cuja soma cabe", () => {
    const r = selecionarComOrcamento(produtos, facetas, 250);
    const total = r.reduce((s, i) => s + Number(produtos.find((p) => p.codigo === i.codigo)!.embalagens[0].preco), 0);
    expect(total).toBeLessThanOrEqual(250);
    expect(r.some((i) => i.codigo === "D")).toBe(false); // R$1000 nunca cabe em R$250
  });

  it("teto zero/muito baixo → nenhum produto (não força um item caro além do teto)", () => {
    expect(selecionarComOrcamento(produtos, facetas, 10)).toEqual([]);
  });

  it("preço sempre lido do catálogo real — nunca inventado", () => {
    const r = selecionarComOrcamento(produtos, facetas, 100);
    // só cabe A (100) ou C (50)+algo — em qualquer caso, nenhum código fora da lista do catálogo
    for (const item of r) expect(produtos.map((p) => p.codigo)).toContain(item.codigo);
  });
});
