import { describe, it, expect } from "vitest";
import { PropostaScope, Tipo } from "@/lib/contracts/proposta";

const scopeBase = {
  id: "1",
  criadoEm: "2026-07-10T00:00:00.000Z",
  status: "rascunho",
  tipo: "consolidada",
  template: "indeba_express",
  cliente: { razaoSocial: "Sua Empresa", cnpj: null, segmento: null, responsavel: "Fulano" },
  textoApresentacao: { conteudo: "oi", procedencia: "MANUAL" },
  itens: [
    {
      codigo: "P", nome: "P", descricaoUso: "", imagemPath: "/p.png",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "10.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1, procedenciaSelecao: "MANUAL", motivo: "",
      ficha: { titulo: "T", beneficios: ["a"] },
    },
  ],
  condicoesComerciais: { validade: "30 dias", prazoEntrega: "15d", pagamento: "boleto", frete: "CIF" },
  consolidada: {
    capa: { consultor: "Matheus", cidade: "Salvador - BA", subtitulo: "Soluções em Higienização Profissional" },
    apresentacao: { saudacao: "Prezado(a),", paragrafos: ["p1"], cards: [{ titulo: "Certificados", texto: "t", icone: "selo" }] },
    comodatos: { intro: "i", equipamentos: [{ titulo: "Dispenser", descricao: "d", icone: "dispenser" }], vantagens: ["v1"] },
    condicoes: { itens: [{ titulo: "Validade", texto: "30 dias", icone: "validade" }], mensagemFechamento: "Aguardamos.", consultor: "Matheus", cargo: "Consultor Comercial" },
  },
};

describe("PropostaScope — tipo consolidada", () => {
  it("Tipo inclui consolidada", () => {
    expect(Tipo.parse("consolidada")).toBe("consolidada");
  });

  it("parseia scope consolidada completo (item com ficha + bloco consolidada)", () => {
    const s = PropostaScope.parse(scopeBase);
    expect(s.cliente.responsavel).toBe("Fulano");
    expect(s.itens[0].ficha?.titulo).toBe("T");
    expect(s.consolidada?.comodatos.equipamentos[0].titulo).toBe("Dispenser");
  });

  it("segue aceitando scope SEM consolidada e SEM responsavel (retrocompatível)", () => {
    const semExtras = {
      ...scopeBase, tipo: "orcamento",
      cliente: { razaoSocial: "X", cnpj: null, segmento: null },
      itens: [{ ...scopeBase.itens[0], ficha: undefined }],
      consolidada: undefined,
    };
    const s = PropostaScope.parse(semExtras);
    expect(s.consolidada ?? null).toBe(null);
    expect(s.cliente.responsavel ?? null).toBe(null);
  });
});
