import { describe, it, expect } from "vitest";
import { irpjCsllPresumido } from "@/lib/financeiro/tributos-lucro";

describe("IRPJ/CSLL presumido com presunção + adicional de 10%", () => {
  it("comércio, sem adicional quando a base ≤ limite do período", () => {
    // receita 600.000/trim, comércio: baseIRPJ = 8% = 48.000; limite = 20k×3 = 60.000 → sem adicional
    const r = irpjCsllPresumido({ receita: 600000, atividade: "comercio", meses: 3 });
    expect(r.baseIRPJ).toBeCloseTo(48000, 2);
    expect(r.adicional).toBe(0);
    expect(r.irpjTotal).toBeCloseTo(7200, 2); // 15% de 48.000
    expect(r.csll).toBeCloseTo(6480, 2); // 9% de (600.000×12% = 72.000)
  });

  it("comércio COM adicional quando a base excede o limite", () => {
    // receita 1.000.000/trim: baseIRPJ = 80.000; limite 60.000; excedente 20.000
    const r = irpjCsllPresumido({ receita: 1000000, atividade: "comercio", meses: 3 });
    expect(r.baseIRPJ).toBeCloseTo(80000, 2);
    expect(r.adicional).toBeCloseTo(2000, 2); // 10% de 20.000
    expect(r.irpjTotal).toBeCloseTo(14000, 2); // 12.000 + 2.000
  });

  it("serviço usa presunção de 32% (IRPJ e CSLL)", () => {
    const r = irpjCsllPresumido({ receita: 300000, atividade: "servico", meses: 3 });
    expect(r.baseIRPJ).toBeCloseTo(96000, 2); // 32%
    expect(r.baseCSLL).toBeCloseTo(96000, 2);
  });

  it("a memória de cálculo explica o porquê (presunção, 15%, adicional, CSLL)", () => {
    const r = irpjCsllPresumido({ receita: 1000000, atividade: "comercio", meses: 3 });
    expect(r.memoria).toMatch(/adicional 10%/);
    expect(r.memoria).toMatch(/IRPJ/);
    expect(r.memoria).toMatch(/CSLL/);
  });
});
