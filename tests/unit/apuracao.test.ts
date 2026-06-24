import { describe, it, expect } from "vitest";
import { apurar, compararRegimes } from "@/lib/financeiro/apuracao";

const FAT = 36865.8; // faturamento real do fixture

function linha(ap: ReturnType<typeof apurar>, imposto: string) {
  return ap.linhas.find((l) => l.imposto === imposto);
}

describe("apuração de imposto (especialista, determinística, ciente da atividade)", () => {
  it("ICMS presumido (comércio) sobre 36.865,80 = R$ 6.635,84", () => {
    const ap = apurar({ regime: "presumido", atividade: "comercio", ano: 2026, faturamento: FAT });
    expect(linha(ap, "ICMS")?.valor).toBeCloseTo(6635.84, 2);
    expect(linha(ap, "ICMS")?.aliquota).toBe(18);
    expect(linha(ap, "ICMS")?.oficial).toBe(false); // exemplo a validar na SEFAZ-BA
  });

  it("comércio apura ICMS e NÃO ISS; serviço apura ISS e NÃO ICMS", () => {
    const com = apurar({ regime: "presumido", atividade: "comercio", ano: 2026, faturamento: FAT });
    const serv = apurar({ regime: "presumido", atividade: "servico", ano: 2026, faturamento: FAT });
    expect(linha(com, "ICMS")).toBeTruthy();
    expect(linha(com, "ISS")).toBeUndefined();
    expect(linha(serv, "ISS")).toBeTruthy();
    expect(linha(serv, "ICMS")).toBeUndefined();
  });

  it("Simples: só DAS, 6% = R$ 2.211,95", () => {
    const ap = apurar({ regime: "simples", atividade: "comercio", ano: 2026, faturamento: FAT });
    expect(linha(ap, "DAS")?.valor).toBeCloseTo(2211.95, 2);
    expect(ap.linhas.filter((l) => l.imposto !== "DAS")).toHaveLength(0);
  });

  it("2026: reforma em teste — IBS/CBS somam ~1% do faturamento", () => {
    const ap = apurar({ regime: "ibs_cbs", atividade: "comercio", ano: 2026, faturamento: FAT });
    expect(ap.totalSobreFaturamento).toBeCloseTo(FAT * 0.01, 1); // 0,9% + 0,1%
  });

  it("IRPJ/CSLL entram nas linhas mas FORA da carga sobre faturamento (base é lucro)", () => {
    const ap = apurar({ regime: "presumido", atividade: "comercio", ano: 2026, faturamento: FAT });
    expect(linha(ap, "IRPJ")?.nota).toMatch(/lucro/i);
    // carga sobre faturamento = PIS + COFINS + ICMS (não IRPJ/CSLL)
    expect(ap.totalSobreFaturamento).toBeCloseTo(239.63 + 1105.97 + 6635.84, 1);
  });

  it("compararRegimes ordena pela carga: Simples é o menor aqui", () => {
    const { ranking } = compararRegimes({ atividade: "comercio", ano: 2026, faturamento: FAT });
    expect(ranking[0].regime).toBe("simples");
    expect(ranking[0].total).toBeLessThan(ranking[ranking.length - 1].total);
  });
});
