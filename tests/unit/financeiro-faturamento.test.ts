import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { carregarCsv } from "@/lib/financeiro/ingest";
import { totalizar } from "@/lib/financeiro/engine";

// Dados REAIS do usuário (faturamento_2026.xlsx → CSV). O bug: o motor somava
// "Valor Unitário" (903,70) em vez de "Valor Total" (36.865,80).
const csv = readFileSync(new URL("../fixtures/faturamento_2026.csv", import.meta.url), "utf-8");
const t = carregarCsv(csv);

function valor(res: ReturnType<typeof totalizar>): number {
  if (!res.ok) throw new Error(res.erro);
  return res.valor as number;
}
function grupo(res: ReturnType<typeof totalizar>, nome: string): number {
  if (!res.ok) throw new Error(res.erro);
  const tabela = res.tabela as Array<{ grupo: string; valor: number }>;
  const l = tabela.find((r) => r.grupo === nome);
  if (!l) throw new Error(`grupo não encontrado: ${nome}`);
  return l.valor;
}

describe("financeiro: motor soma a coluna de TOTAL, não a de unitário (dados reais)", () => {
  it("quantas notas → 55 linhas", () => {
    expect(t.linhas).toHaveLength(55);
  });

  it("faturamento total → R$ 36.865,80 (não 903,70 do unitário)", () => {
    const r = totalizar(t, { metrica: "soma" });
    expect(valor(r)).toBeCloseTo(36865.8, 2);
  });

  it("ticket médio → R$ 670,29", () => {
    const r = totalizar(t, { metrica: "media" });
    expect(valor(r)).toBeCloseTo(670.29, 1);
  });

  it("faturamento por categoria → Limpeza 12.565,70 · Higiene 12.363,50 · Descartáveis 11.936,60", () => {
    const r = totalizar(t, { agruparPor: "categoria", metrica: "soma" });
    expect(grupo(r, "Limpeza")).toBeCloseTo(12565.7, 2);
    expect(grupo(r, "Higiene")).toBeCloseTo(12363.5, 2);
    expect(grupo(r, "Descartáveis")).toBeCloseTo(11936.6, 2);
  });

  it("faturamento por vendedor → líder fatura 14.609,50 (tabela ordenada desc)", () => {
    const r = totalizar(t, { agruparPor: "vendedor", metrica: "soma" });
    if (!r.ok) throw new Error(r.erro);
    const tabela = r.tabela as Array<{ grupo: string; valor: number }>;
    expect(tabela[0].valor).toBeCloseTo(14609.5, 2);
  });

  it("pago vs pendente → 21.080,80 pago · 15.785,00 pendente", () => {
    const pago = totalizar(t, { metrica: "soma", filtros: { status: "Pago" } });
    const pend = totalizar(t, { metrica: "soma", filtros: { status: "Pendente" } });
    expect(valor(pago)).toBeCloseTo(21080.8, 2);
    expect(valor(pend)).toBeCloseTo(15785.0, 2);
  });

  it("§2: mesmo se o roteador pedir 'valor_unitario', o motor usa o total (não 903,70)", () => {
    const r = totalizar(t, { colunaValor: "valor_unitario_r", metrica: "soma" });
    expect(valor(r)).toBeCloseTo(36865.8, 2);
  });
});
