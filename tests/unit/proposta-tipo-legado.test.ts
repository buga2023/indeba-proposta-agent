import { describe, it, expect } from "vitest";
import { montarDocumento } from "@/lib/pdf/render";
import { Tipo, type PropostaScope } from "@/lib/contracts";

// Teste-guardião dos tipos legados. Em 01/08/2026 o dashboard perdeu o gráfico "Propostas
// por tipo" — desde jul/2026 só "Proposta de Solução" pode ser criada, então três das quatro
// barras eram zero permanente. Tirar o gráfico é UI; o risco é alguém concluir que os tipos
// antigos morreram e limpar TIPOS / o campo `tipo` / os templates junto.
//
// Não morreram. Existe proposta salva com `tipo: "orcamento"`, "implantacao" e "comercial",
// e reabrir e exportar essas propostas tem que continuar funcionando — é histórico comercial
// da Indeba, não código morto. Enquanto este teste passar, o roteamento está de pé.
const base: PropostaScope = {
  id: "1", criadoEm: "2026-07-10T00:00:00.000Z", status: "rascunho",
  tipo: "orcamento", template: "indeba_express",
  cliente: { razaoSocial: "ACME", cnpj: null, segmento: null, responsavel: null },
  textoApresentacao: { conteudo: "x", procedencia: "MANUAL" },
  itens: [{ codigo: "A", nome: "Produto A", descricaoUso: "u", imagemPath: "/a.png",
    embalagens: [{ tamanho: 5, unidade: "L", preco: "100.00", diluicaoMax: null, custoDiluido: null }],
    quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "", tamanhosDisponiveis: [], fichaTecnicaPath: null, ficha: null }],
  condicoesComerciais: { validade: "30 dias", prazoEntrega: "15d", pagamento: "boleto", frete: "CIF" },
};

describe("proposta de tipo legado continua abrindo e exportando", () => {
  it("o contrato ainda aceita os quatro tipos", () => {
    expect(Tipo.options).toEqual(
      expect.arrayContaining(["orcamento", "implantacao", "comercial", "consolidada"]),
    );
  });

  for (const tipo of ["orcamento", "implantacao", "comercial"] as const) {
    it(`tipo "${tipo}" roteia para um template e gera HTML com o cliente`, () => {
      const doc = montarDocumento({ ...base, tipo }, { A: "data:,x" }, "", () => "data:,logo");
      expect(doc.html.length).toBeGreaterThan(0);
      expect(doc.html).toContain("ACME");
    });
  }
});
