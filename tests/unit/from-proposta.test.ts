import { describe, it, expect } from "vitest";
import type { PropostaScope, PropostaItem } from "@/lib/contracts";
import {
  propostaParaPlanilha,
  totalPropostaCentavos,
  subtotalCentavos,
  propostaParaCsv,
  propostaParaPlanilhaInput,
} from "@/lib/financeiro/from-proposta";
import { totalizar } from "@/lib/financeiro/engine";
import { carregarCsv } from "@/lib/financeiro/ingest";

// Constrói um item com preço de catálogo (1ª embalagem). Só o que o adapter lê importa,
// mas montamos itens válidos para casar com o contrato.
function item(codigo: string, nome: string, preco: string, quantidade: number): PropostaItem {
  return {
    codigo,
    nome,
    descricaoUso: "uso",
    imagemPath: "/img.png",
    embalagens: [{ tamanho: 5, unidade: "L", preco, diluicaoMax: null, custoDiluido: null }],
    quantidade,
    procedenciaSelecao: "IA-SELEÇÃO",
    motivo: "encaixe",
    fichaTecnicaPath: null,
  };
}

function scopeDe(itens: PropostaItem[]): PropostaScope {
  return {
    id: "p1",
    criadoEm: "2026-06-24T00:00:00Z",
    status: "rascunho",
    tipo: "orcamento",
    template: "indeba_express",
    cliente: { razaoSocial: "Cliente X", cnpj: null, segmento: null, responsavel: null },
    textoApresentacao: { conteudo: "olá", procedencia: "IA-TEXTO" },
    itens,
    condicoesComerciais: { validade: "10 dias", prazoEntrega: "5 dias", pagamento: "à vista", frete: "CIF" },
  };
}

describe("handoff proposta→financeiro: preço crítico vem do catálogo (§2)", () => {
  it("teste-guardião: total da planilha (via motor financeiro) == total da proposta do catálogo", () => {
    const scope = scopeDe([
      item("A1", "Desengordurante", "130.00", 2),
      item("B2", "Detergente", "45.50", 3),
    ]);

    // total esperado, derivado SÓ do catálogo: 130,00×2 + 45,50×3 = 396,50
    const esperadoCentavos = 130_00 * 2 + 45_50 * 3; // 39650
    expect(totalPropostaCentavos(scope)).toBe(esperadoCentavos);

    const planilha = propostaParaPlanilha(scope);
    const r = totalizar(planilha, { colunaValor: "valor_total", metrica: "soma" });
    expect(r.ok).toBe(true);
    // O número que o financeiro reporta é EXATAMENTE o total da proposta (sem drift de float).
    if (r.ok) expect(Math.round((r.valor as number) * 100)).toBe(esperadoCentavos);
  });

  it("preço unitário e valor_total saem da embalagem do catálogo, não inventados", () => {
    const t = propostaParaPlanilha(scopeDe([item("A1", "X", "130.00", 2)]));
    expect(t.linhas[0].codigo).toBe("A1");
    expect(t.linhas[0].preco_unitario).toBe(130);
    expect(t.linhas[0].valor_total).toBe(260);
  });

  it("item sem embalagem → subtotal 0 (lacuna, não preço inventado)", () => {
    const semEmb = { ...item("C3", "Sem preço", "0.00", 1), embalagens: [] };
    expect(subtotalCentavos(semEmb)).toBe(0);
  });
});

describe("handoff via CSV: o que a FinanceiroScreen envia reconstrói o total exato", () => {
  it("teste-guardião round-trip: CSV -> ingest -> motor == total da proposta", () => {
    const scope = scopeDe([
      item("A1", "Desengordurante", "130.00", 2),
      item("B2", "Detergente", "45.50", 3),
    ]);
    const csv = propostaParaCsv(scope);
    // reparse pelo MESMO ingest que o /api/financeiro usa
    const tabela = carregarCsv(csv);
    const r = totalizar(tabela, { colunaValor: "valor_total", metrica: "soma" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(Math.round((r.valor as number) * 100)).toBe(totalPropostaCentavos(scope));
  });

  it("nome com ';' não quebra o CSV (escapado)", () => {
    const scope = scopeDe([item("A1", "Limpa; Brilha", "10.00", 1)]);
    const tabela = carregarCsv(propostaParaCsv(scope));
    expect(tabela.linhas).toHaveLength(1);
    expect(tabela.linhas[0].produto).toBe("Limpa; Brilha");
  });

  it("propostaParaPlanilhaInput devolve {nome, csv} pronto p/ a UI empilhar", () => {
    const scope = scopeDe([item("A1", "X", "10.00", 1)]);
    const p = propostaParaPlanilhaInput(scope);
    expect(p.nome).toBe("Proposta Cliente X");
    expect(p.csv).toContain("valor_total");
  });
});
