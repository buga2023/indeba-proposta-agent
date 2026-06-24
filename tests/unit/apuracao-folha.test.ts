import { describe, it, expect } from "vitest";
import { apurarFolha } from "@/lib/financeiro/apuracao-folha";

function enc(ap: ReturnType<typeof apurarFolha>, e: string) {
  return ap.linhas.find((l) => l.encargo === e);
}

describe("apuração de encargos de folha (patronais)", () => {
  const ap = apurarFolha({ folha: 100000, ano: 2026 });

  it("calcula CPP/RAT/Terceiros/FGTS sobre a folha", () => {
    expect(enc(ap, "CPP")?.valor).toBeCloseTo(20000, 2); // 20%
    expect(enc(ap, "RAT")?.valor).toBeCloseTo(2000, 2); // 2%
    expect(enc(ap, "TERCEIROS")?.valor).toBeCloseTo(5800, 2); // 5,8%
    expect(enc(ap, "FGTS")?.valor).toBeCloseTo(8000, 2); // 8%
  });

  it("total de encargos e custo total da folha", () => {
    expect(ap.totalEncargos).toBeCloseTo(35800, 2);
    expect(ap.custoTotalFolha).toBeCloseTo(135800, 2); // folha + encargos
  });

  it("CPP é oficial; RAT é exemplo a validar", () => {
    expect(enc(ap, "CPP")?.oficial).toBe(true);
    expect(enc(ap, "RAT")?.oficial).toBe(false);
  });

  it("no Simples, sinaliza que a CPP pode estar no DAS", () => {
    const s = apurarFolha({ folha: 100000, ano: 2026, regime: "simples" });
    expect(enc(s, "CPP")?.nota).toMatch(/DAS/);
  });

  it("memória + aviso (INSS do empregado é retido, não custo patronal)", () => {
    expect(ap.memoria).toMatch(/Custo total da folha/);
    expect(ap.aviso).toMatch(/retido/i);
  });
});
