import { describe, it, expect } from "vitest";
import { paginaProduto } from "@/lib/pdf/template-consolidada";
import type { PropostaItem } from "@/lib/contracts";

const item: PropostaItem = {
  codigo: "PRIMMAX-PLUS",
  nome: "Primmax Plus",
  descricaoUso: "Lavar louças e pisos.",
  imagemPath: "/produtos/primmax-plus.png",
  embalagens: [
    { tamanho: 5, unidade: "L", preco: "130.00", diluicaoMax: "1:100", custoDiluido: "0.26" },
    { tamanho: 20, unidade: "L", preco: "480.00", diluicaoMax: "1:100", custoDiluido: "0.24" },
  ],
  quantidade: 1,
  procedenciaSelecao: "MANUAL",
  motivo: "",
  ficha: {
    titulo: "Detergente Desengordurante",
    subtitulo: "Alcalino Concentrado",
    linhaLabel: "KITCHEN",
    descricao: "Remove as gorduras mais difíceis.",
    indicadoPara: [{ label: "Cozinhas industriais", icone: "cozinha" }],
    beneficios: ["Remove gordura pesada", "Alto rendimento"],
    diluicoes: [{ uso: "Limpeza pesada", razao: "1:20" }],
    rendimento: "Até 100 litros",
    caracteristicas: { pH: "12,5 – 13,5", cor: "Esverdeado", aspecto: "Líquido", odor: "Característico", uso: "Profissional" },
  },
};

describe("paginaProduto", () => {
  it("renderiza título, benefícios, diluição, características e preço por embalagem", () => {
    const html = paginaProduto(item, "data:image/png;base64,AAAA", 4);
    expect(html).toContain("Detergente Desengordurante");
    expect(html).toContain("Proposta de Solução <b>04</b>");
    expect(html).toContain("Alcalino Concentrado");
    expect(html).toContain("KITCHEN");
    expect(html).toContain("Remove gordura pesada");
    expect(html).toContain("Limpeza pesada");
    expect(html).toContain("1:20");
    expect(html).toContain("12,5 – 13,5"); // pH
    expect(html).toContain("R$ 130,00");
    expect(html).toContain("R$ 480,00");
    expect(html).toContain('class="prodpg"'); // a quebra de página vem do CSS de consolidadaHtml
  });

  it("degrada com elegância quando não há ficha (usa nome + descricaoUso + preço)", () => {
    const semFicha = { ...item, ficha: null };
    const html = paginaProduto(semFicha, "data:image/png;base64,AAAA", 5);
    expect(html).toContain("Primmax Plus");
    expect(html).toContain("R$ 130,00");
    expect(html).not.toContain("undefined");
  });
});
