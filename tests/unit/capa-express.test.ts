import { describe, it, expect } from "vitest";
import { capaExpressHtml } from "@/lib/pdf/capa-express";
import { documentoHtml } from "@/lib/pdf/template";
import { PropostaScope, ClienteSnapshot } from "@/lib/contracts";

const base = {
  id: "capa-teste",
  criadoEm: "2026-07-07T12:00:00.000Z",
  status: "rascunho",
  tipo: "implantacao",
  template: "indeba_express",
  cliente: {
    razaoSocial: "Laticínio São João Ltda",
    cnpj: "12.345.678/0001-90",
    segmento: "laticinio",
    responsavel: "Maria Souza",
  },
  textoApresentacao: { conteudo: "Apresentação.", procedencia: "MANUAL" },
  itens: [
    {
      codigo: "DET-01",
      nome: "Detergente Alcalino",
      descricaoUso: "Limpeza pesada",
      imagemPath: "/produtos/_generico.svg",
      embalagens: [{ tamanho: 5, unidade: "L", preco: "130.00", diluicaoMax: null, custoDiluido: null }],
      quantidade: 1,
      procedenciaSelecao: "MANUAL",
      motivo: "teste",
    },
  ],
  condicoesComerciais: { validade: "15 dias", prazoEntrega: "72h", pagamento: "Boleto", frete: "CIF" },
};

const scope = () => PropostaScope.parse(structuredClone(base));

describe("capa Indeba Express", () => {
  it("renderiza os 4 campos do card e a data por extenso", () => {
    const html = capaExpressHtml(scope());
    expect(html).toContain("Proposta de Solução");
    expect(html).toContain("Soluções em Higienização Profissional");
    expect(html).toContain("Laticínio São João Ltda");
    expect(html).toContain("12.345.678/0001-90");
    expect(html).toContain("laticinio");
    expect(html).toContain("Maria Souza");
    expect(html).toContain("Consultor Responsável");
    expect(html).toContain("07 de julho de 2026");
  });

  it("campos ausentes viram traço — nunca dado inventado", () => {
    const s = scope();
    s.cliente.cnpj = null;
    s.cliente.segmento = null;
    s.cliente.responsavel = null;
    const html = capaExpressHtml(s);
    expect(html).toContain("—");
    expect(html).not.toContain("00.000.000");
  });

  it("escapa HTML vindo do cliente (scope chega do POST /api/pdf)", () => {
    const s = scope();
    s.cliente.razaoSocial = `<script>alert("x")</script>`;
    const html = capaExpressHtml(s);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("documento Express abre com a capa; marca Indeba não", () => {
    const express = documentoHtml(scope(), {}, "");
    expect(express).toContain('class="capa-x"');
    const s = PropostaScope.parse({ ...structuredClone(base), template: "indeba" });
    const indeba = documentoHtml(s, {}, "");
    expect(indeba).not.toContain('class="capa-x"');
  });

  it("guardião: preço do documento continua sendo o do catálogo", () => {
    const html = documentoHtml(scope(), {}, "");
    expect(html).toContain("130,00");
  });

  it("retrocompat: proposta antiga sem responsavel parseia com null", () => {
    const antigo = ClienteSnapshot.parse({ razaoSocial: "X", cnpj: null, segmento: null });
    expect(antigo.responsavel).toBeNull();
  });
});
