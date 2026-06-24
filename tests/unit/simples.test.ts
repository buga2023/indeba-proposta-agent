import { describe, it, expect } from "vitest";
import { faixaDe, aliquotaEfetiva, calcularDAS, fatorR } from "@/lib/financeiro/simples";

describe("Simples Nacional: anexo/faixa, alíquota efetiva e Fator R", () => {
  it("acha a faixa pela RBT12 (Anexo I)", () => {
    expect(faixaDe(100000, "I")?.indice).toBe(1); // ≤ 180k
    expect(faixaDe(200000, "I")?.indice).toBe(2); // ≤ 360k
    expect(faixaDe(5000000, "I")).toBeNull(); // > teto 4,8M → desenquadrado
  });

  it("alíquota efetiva = (RBT12 × nominal − PD)/RBT12 (Anexo I, faixa 2 ≈ 4,33%)", () => {
    // (200000×7,3% − 5940)/200000 = 8660/200000 = 4,33%
    expect(aliquotaEfetiva(200000, "I")).toBeCloseTo(4.33, 2);
    // faixa 1 (PD=0) → efetiva = nominal
    expect(aliquotaEfetiva(100000, "I")).toBeCloseTo(4.0, 2);
  });

  it("DAS = receita do mês × efetiva, com memória de cálculo (o porquê)", () => {
    const r = calcularDAS(20000, 200000, "I");
    expect(r.das).toBeCloseTo(866.0, 2); // 20000 × 4,33%
    expect(r.faixa).toBe(2);
    expect(r.memoria).toMatch(/Efetiva =/);
    expect(r.memoria).toMatch(/DAS =/);
  });

  it("Fator R decide Anexo III (≥28%) ou V (<28%)", () => {
    expect(fatorR(60000, 200000).anexoAplicavel).toBe("III"); // 30%
    expect(fatorR(40000, 200000).anexoAplicavel).toBe("V"); // 20%
    expect(fatorR(60000, 200000).memoria).toMatch(/Fator R =/);
  });

  it("serviço Anexo V é mais caro que III na mesma faixa (justifica o Fator R)", () => {
    expect(aliquotaEfetiva(200000, "V")).toBeGreaterThan(aliquotaEfetiva(200000, "III"));
  });

  it("RBT12 acima do teto → erro (não inventa alíquota)", () => {
    expect(() => calcularDAS(50000, 5000000, "I")).toThrow(/teto|fora/i);
  });
});
