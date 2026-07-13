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

  it("numera Condições Comerciais contando as páginas de produto (não fica hardcoded em 04)", () => {
    // 2 itens -> páginas de produto usam 04 e 05; Condições deve ser 06, não 04.
    const doisItens: PropostaScope = { ...scope, itens: [scope.itens[0], { ...scope.itens[0], codigo: "B" }] };
    const doc = montarDocumento(doisItens, { A: "data:,x", B: "data:,x" }, "", () => "data:,logo");
    expect(doc.html).toContain("Proposta de Solução <b>04</b>");
    expect(doc.html).toContain("Proposta de Solução <b>05</b>");
    expect(doc.html).toContain("Proposta de Solução <b>06</b>");
  });
});
