import { describe, it, expect } from "vitest";
import { montarDocumento } from "@/lib/pdf/render";
import { consolidadaDefaults } from "@/lib/consolidada-defaults";
import type { PropostaScope } from "@/lib/contracts";

const scope: PropostaScope = {
  id: "1", criadoEm: "2026-07-10T00:00:00.000Z", status: "rascunho",
  tipo: "consolidada", template: "indeba_express",
  cliente: { razaoSocial: "ACME", cnpj: null, segmento: null, responsavel: null },
  textoApresentacao: { conteudo: "x", procedencia: "MANUAL" },
  itens: [{ codigo: "A", nome: "Produto A", descricaoUso: "u", imagemPath: "/a.png",
    embalagens: [{ tamanho: 5, unidade: "L", preco: "100.00", diluicaoMax: null, custoDiluido: null }],
    quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", ficha: null }],
  condicoesComerciais: { validade: "30 dias", prazoEntrega: "15d", pagamento: "boleto", frete: "CIF" },
  consolidada: consolidadaDefaults(),
};

describe("montarDocumento — consolidada", () => {
  it("roteia para consolidadaHtml", () => {
    const doc = montarDocumento(scope, { A: "data:,x" }, "", () => "data:,logo");
    expect(doc.html).toContain("PROPOSTA DE SOLUÇÃO");
    expect(doc.html).toContain("ACME");
  });
});
