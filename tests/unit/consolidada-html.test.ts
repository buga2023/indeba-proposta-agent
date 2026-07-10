import { describe, it, expect } from "vitest";
import { consolidadaHtml } from "@/lib/pdf/template-consolidada";
import { consolidadaDefaults } from "@/lib/consolidada-defaults";
import type { PropostaScope } from "@/lib/contracts";

const scope: PropostaScope = {
  id: "1", criadoEm: "2026-07-10T00:00:00.000Z", status: "rascunho",
  tipo: "consolidada", template: "indeba_express",
  cliente: { razaoSocial: "Sua Empresa", cnpj: "00.000.000/0000-00", segmento: "Alimentação", responsavel: "João" },
  textoApresentacao: { conteudo: "x", procedencia: "MANUAL" },
  itens: [
    { codigo: "A", nome: "Produto A", descricaoUso: "uso A", imagemPath: "/a.png",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "100.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", ficha: { titulo: "TitA" } },
    { codigo: "B", nome: "Produto B", descricaoUso: "uso B", imagemPath: "/b.png",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "200.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", ficha: null },
  ],
  condicoesComerciais: { validade: "30 dias", prazoEntrega: "15d", pagamento: "boleto", frete: "CIF" },
  consolidada: consolidadaDefaults(),
};

describe("consolidadaHtml", () => {
  it("emite as 5 seções e uma página por produto", () => {
    const html = consolidadaHtml(scope, { A: "data:,x", B: "data:,y" }, { logo: "data:,logo" });
    expect(html).toContain("Proposta de Solução");
    expect(html).toContain("Sua Empresa");
    expect(html).toContain("00.000.000/0000-00");
    expect(html).toContain("João"); // responsável
    expect(html).toContain("APRESENTAÇÃO");
    expect(html).toContain("COMODATOS");
    expect(html).toContain("CONDIÇÕES COMERCIAIS");
    expect(html).toContain("TitA"); // página produto A
    expect(html).toContain("Produto B"); // produto sem ficha cai no nome
    // duas páginas de produto (dois blocos prodpg)
    expect(html.match(/class="prodpg"/g)?.length).toBe(2);
  });

  it("usa consolidadaDefaults quando scope.consolidada está ausente", () => {
    const html = consolidadaHtml({ ...scope, consolidada: undefined }, { A: "d", B: "d" }, { logo: "l" });
    expect(html).toContain("Matheus Maristane Resende");
  });
});
