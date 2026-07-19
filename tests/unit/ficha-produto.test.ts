import { describe, it, expect } from "vitest";
import { Produto, FichaProduto } from "@/lib/contracts/produto";

const base = {
  codigo: "X",
  nome: "X",
  marca: "indeba",
  linha: "alimentos_bebidas",
  descricaoCurta: "",
  descricaoUso: "",
  segmentos: [],
  funcoes: [],
  metodos: [],
  imagemPath: "/x.png",
  fichaTecnicaPath: null,
  ativo: true,
  embalagens: [{ tamanho: 5, unidade: "L", preco: "10.00", diluicaoMax: null, custoDiluido: null }],
};

describe("FichaProduto", () => {
  it("aceita produto SEM ficha (retrocompatível)", () => {
    expect(Produto.parse(base).ficha ?? null).toBe(null);
  });

  it("aceita ficha completa", () => {
    const ficha = {
      titulo: "Detergente Desengordurante",
      subtitulo: "Alcalino Concentrado",
      linhaLabel: "KITCHEN",
      descricao: "Remove gorduras difíceis.",
      indicadoPara: [{ label: "Cozinhas industriais", icone: "cozinha" }],
      beneficios: ["Remove gordura pesada", "Alto rendimento"],
      diluicoes: [{ uso: "Limpeza pesada", razao: "1:20" }],
      rendimento: "Até 100 litros",
      caracteristicas: { pH: "12,5 – 13,5", aspecto: "Líquido", cor: "Esverdeado", odor: "Característico", uso: "Profissional" },
    };
    const p = Produto.parse({ ...base, ficha });
    expect(p.ficha?.titulo).toBe("Detergente Desengordurante");
    expect(p.ficha?.diluicoes?.[0].razao).toBe("1:20");
  });

  it("valida direto pelo schema FichaProduto e aceita campos ausentes", () => {
    expect(FichaProduto.parse({ beneficios: ["a"] }).titulo ?? null).toBe(null);
  });
});
