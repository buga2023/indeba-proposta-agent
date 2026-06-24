import { describe, it, expect } from "vitest";
import { apurarNaoCumulativo, apurarIcms } from "@/lib/financeiro/nao-cumulativo";

// Dados reais do fixture: vendas 36.865,80 / custo (entradas) 22.390,84.
const VENDAS = 36865.8;
const COMPRAS = 22390.84;

describe("apuração não-cumulativa (débito − crédito)", () => {
  it("ICMS a recolher = débito sobre vendas − crédito sobre compras", () => {
    const r = apurarIcms({ vendas: VENDAS, compras: COMPRAS, regime: "presumido", ano: 2026 });
    expect(r.debito).toBeCloseTo(6635.84, 2); // 36.865,80 × 18%
    expect(r.credito).toBeCloseTo(4030.35, 2); // 22.390,84 × 18%
    expect(r.aRecolher).toBeCloseTo(2605.49, 2); // débito − crédito
    expect(r.saldoCredor).toBe(0);
  });

  it("não-cumulativo recolhe MENOS que cumulativo (o crédito abate)", () => {
    const r = apurarIcms({ vendas: VENDAS, compras: COMPRAS, regime: "presumido", ano: 2026 });
    const cumulativo = VENDAS * 0.18; // sem crédito
    expect(r.aRecolher).toBeLessThan(cumulativo);
  });

  it("crédito maior que débito → saldo credor a transportar (não recolhe)", () => {
    const r = apurarNaoCumulativo({ imposto: "ICMS", baseSaidas: 1000, aliquotaSaida: 18, baseEntradas: 2000 });
    expect(r.aRecolher).toBe(0);
    expect(r.saldoCredor).toBeCloseTo(180, 2); // (2000−1000)×18%
    expect(r.memoria).toMatch(/saldo credor/);
  });

  it("alíquota de entrada interestadual (12%) difere da saída (18%)", () => {
    const r = apurarNaoCumulativo({ imposto: "ICMS", baseSaidas: 1000, aliquotaSaida: 18, baseEntradas: 1000, aliquotaEntrada: 12 });
    expect(r.debito).toBeCloseTo(180, 2);
    expect(r.credito).toBeCloseTo(120, 2);
    expect(r.aRecolher).toBeCloseTo(60, 2);
  });

  it("a memória explica débito, crédito e o resultado", () => {
    const r = apurarIcms({ vendas: VENDAS, compras: COMPRAS, regime: "presumido", ano: 2026 });
    expect(r.memoria).toMatch(/débito =/);
    expect(r.memoria).toMatch(/crédito =/);
    expect(r.memoria).toMatch(/a recolher =/);
  });
});
