import { describe, it, expect } from "vitest";
import { PropostaScope } from "@/lib/contracts";
import { capaExpressHtml } from "@/lib/pdf/capa-express";
import { assinaturaConsultor } from "@/lib/pdf/template";

/**
 * A capa do Indeba Express (Orçamento e Implantação) trazia "Matheus Resende" CHUMBADO no
 * template: toda proposta saía assinada com esse nome, tivesse quem tivesse montado, e a
 * transferência de carteira não mudava nada — achado no teste em produção de 02/09/2026.
 *
 * O nome agora viaja em `scope.consultor`. Propostas anteriores ao campo não têm o dado e
 * continuam caindo no nome antigo — tirar o fallback deixaria um histórico inteiro de
 * propostas com a capa sem assinatura.
 */

const base = {
  id: "p-1",
  criadoEm: "2026-09-02T12:00:00.000Z",
  status: "rascunho" as const,
  tipo: "orcamento" as const,
  template: "indeba_express" as const,
  cliente: { razaoSocial: "Frigorífico Teste", cnpj: null, segmento: null, responsavel: null },
  textoApresentacao: { conteudo: "texto", procedencia: "MANUAL" as const },
  itens: [],
  condicoesComerciais: { validade: "", prazoEntrega: "", pagamento: "", frete: "" },
};

const scopeCom = (consultor: unknown) => PropostaScope.parse({ ...base, consultor });

describe("consultor no PDF Express", () => {
  it("capa mostra o consultor da proposta, não o nome do template", () => {
    const html = capaExpressHtml(scopeCom({ nome: "Austin Consultor", email: "austin@indeba.com", telefone: null }));
    expect(html).toContain("Austin Consultor");
    expect(html).not.toContain("Matheus Resende");
  });

  it("proposta antiga (sem o campo) cai no nome padrão, sem capa sem assinatura", () => {
    const html = capaExpressHtml(PropostaScope.parse(base));
    expect(html).toContain("Matheus Resende");
  });

  it("assinatura do fechamento acompanha o consultor, com telefone quando existe", () => {
    expect(assinaturaConsultor(scopeCom({ nome: "Austin Consultor", email: null, telefone: "(71) 90000-0000" })))
      .toBe("Austin Consultor · (71) 90000-0000");
    // Sem telefone cadastrado: só o nome — melhor que exibir o telefone de outra pessoa.
    expect(assinaturaConsultor(scopeCom({ nome: "Austin Consultor", email: null, telefone: null }))).toBe("Austin Consultor");
    expect(assinaturaConsultor(PropostaScope.parse(base))).toBe("Matheus Resende · (71) 99196-2650");
  });
});
