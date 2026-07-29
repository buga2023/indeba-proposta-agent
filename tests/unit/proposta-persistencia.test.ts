import { describe, it, expect } from "vitest";
import { StatusProposta, PropostaResumo, PropostaRegistro, type PropostaScope } from "@/lib/contracts";
import { totalDaProposta } from "@/lib/propostas";

// Persistência da proposta: status comercial + registro com o scope canônico.
// O contrato Zod é a fonte única de validação (constituição §3).

const scopeBase: PropostaScope = {
  id: "p1",
  criadoEm: "2026-06-24T00:00:00.000Z",
  status: "rascunho",
  tipo: "orcamento",
  template: "indeba",
  cliente: { razaoSocial: "Frigorífico X", cnpj: null, segmento: null, responsavel: null },
  textoApresentacao: { conteudo: "texto", procedencia: "IA-TEXTO" },
  itens: [
    {
      codigo: "A1",
      nome: "Bota PVC",
      descricaoUso: "uso",
      imagemPath: "/img/a1.png",
      embalagens: [{ tamanho: 1, unidade: "un", preco: "50.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 3,
      procedenciaSelecao: "IA-SELEÇÃO",
      motivo: "casou",
      tamanhosDisponiveis: [],
      fichaTecnicaPath: null,
    },
  ],
  condicoesComerciais: { validade: "30 dias", prazoEntrega: "15 dias", pagamento: "à vista", frete: "CIF" },
};

describe("contrato de persistência da proposta", () => {
  it("StatusProposta cobre exatamente o fluxo comercial decidido", () => {
    expect(StatusProposta.options).toEqual(["rascunho", "em_edicao", "enviada", "aprovada", "recusada", "arquivada"]);
    expect(StatusProposta.safeParse("finalizada").success).toBe(false); // status do DOCUMENTO, não comercial
  });

  it("PropostaResumo valida um registro de listagem e rejeita status inválido", () => {
    const resumo = {
      id: "p1", status: "enviada", autor: "mateus", cliente: "Frigorífico X",
      segmento: null, tipo: "orcamento", total: "150.00", qtdItens: 1,
      criadoEm: "2026-06-24T00:00:00.000Z", atualizadoEm: "2026-06-24T00:00:00.000Z",
    };
    expect(PropostaResumo.safeParse(resumo).success).toBe(true);
    expect(PropostaResumo.safeParse({ ...resumo, status: "gerada" }).success).toBe(false);
  });

  it("PropostaRegistro carrega o scope canônico (para reabrir / gerar contrato)", () => {
    const reg = PropostaRegistro.parse({
      id: "p1", status: "rascunho", autor: "mateus", cliente: "Frigorífico X",
      segmento: null, tipo: "orcamento", total: "150.00", qtdItens: 1,
      criadoEm: "2026-06-24T00:00:00.000Z", atualizadoEm: "2026-06-24T00:00:00.000Z",
      scope: scopeBase,
    });
    expect(reg.scope.itens[0].codigo).toBe("A1");
  });

  // TESTE-GUARDIÃO: o total persistido é SEMPRE preço-do-catálogo × quantidade.
  // Nenhum valor vem do modelo; manipular outros campos não altera o preço.
  it("guardião: total persistido = preço do catálogo × quantidade", () => {
    expect(totalDaProposta(scopeBase)).toBe("150.00"); // 50.00 × 3

    // Mesmo que a IA "escreva" um motivo/texto enganoso, o total ignora isso — só lê embalagens[0].preco.
    const adulterado: PropostaScope = {
      ...scopeBase,
      itens: [{ ...scopeBase.itens[0], motivo: "preço promocional R$ 1,00", quantidade: 2 }],
    };
    expect(totalDaProposta(adulterado)).toBe("100.00"); // 50.00 × 2, não R$ 1,00
  });
});
