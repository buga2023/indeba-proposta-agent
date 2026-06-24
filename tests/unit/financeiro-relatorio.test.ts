import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { carregarCsv } from "@/lib/financeiro/ingest";
import { montarRelatorio } from "@/lib/financeiro/relatorio";

const csv = readFileSync(new URL("../fixtures/faturamento_2026.csv", import.meta.url), "utf-8");
const rel = montarRelatorio(carregarCsv(csv));

describe("relatório financeiro determinístico (dados reais)", () => {
  it("KPIs principais batem com a planilha", () => {
    expect(rel.numNotas).toBe(55);
    expect(rel.faturamentoTotal).toBeCloseTo(36865.8, 2);
    expect(rel.ticketMedio).toBeCloseTo(670.29, 1);
    expect(rel.custoTotal).toBeCloseTo(22390.84, 2);
    expect(rel.margemBruta).toBeCloseTo(14474.96, 2); // 36865,80 − 22390,84
    expect(rel.margemPct).toBeCloseTo(39.26, 1);
  });

  it("pago vs pendente somam o total", () => {
    expect(rel.pago).toBeCloseTo(21080.8, 2);
    expect(rel.pendente).toBeCloseTo(15785.0, 2);
    expect((rel.pago ?? 0) + (rel.pendente ?? 0)).toBeCloseTo(rel.faturamentoTotal, 2);
  });

  it("quebras por categoria/vendedor/cidade", () => {
    const cat = (n: string) => rel.porCategoria.find((g) => g.grupo === n)?.valor ?? NaN;
    expect(cat("Limpeza")).toBeCloseTo(12565.7, 2);
    expect(cat("Higiene")).toBeCloseTo(12363.5, 2);
    expect(cat("Descartáveis")).toBeCloseTo(11936.6, 2);
    expect(rel.porVendedor[0].valor).toBeCloseTo(14609.5, 2); // líder
    expect(rel.porCidade.length).toBeGreaterThan(0);
  });

  it("procedência: colunas detectadas (auditável)", () => {
    expect(rel.colunas.valor).toBe("valor_total_r");
    expect(rel.colunas.custo).toBe("custo_total_r");
    expect(rel.colunas.status).toBe("status");
    expect(rel.colunas.categoria).toBe("categoria");
    expect(rel.colunas.vendedor).toBe("vendedor");
    expect(rel.colunas.cidade).toBe("cidade");
  });
});
