import { describe, it, expect } from "vitest";
import {
  aliquotaVigente,
  regrasVigentes,
  impostosDoRegime,
  AVISO_LEGAL,
} from "@/lib/financeiro/tributario";

describe("base tributária datada (reforma IBS/CBS por ano)", () => {
  it("2026: IBS/CBS na fase de testes (0,1% / 0,9%) com fonte oficial", () => {
    const cbs = aliquotaVigente("ibs_cbs", "CBS", 2026);
    const ibs = aliquotaVigente("ibs_cbs", "IBS", 2026);
    expect(cbs?.aliquota).toBe(0.9);
    expect(ibs?.aliquota).toBe(0.1);
    expect(cbs?.fonte.oficial).toBe(true);
    expect(cbs?.fonte.nome).toMatch(/LC 214\/2025/);
  });

  it("2025: IBS ainda não vigente → null (não inventa)", () => {
    expect(aliquotaVigente("ibs_cbs", "IBS", 2025)).toBeNull();
  });

  it("2027: a fase de testes 2026 já expirou (vigenciaFim)", () => {
    expect(aliquotaVigente("ibs_cbs", "CBS", 2027)).toBeNull();
  });

  it("regimes atuais: ICMS presumido 18% marcado como EXEMPLO (oficial:false)", () => {
    const icms = aliquotaVigente("presumido", "ICMS", 2026);
    expect(icms?.aliquota).toBe(18);
    expect(icms?.fonte.oficial).toBe(false); // exige validação do contador/SEFAZ
  });

  it("impostosDoRegime lista os tributos vigentes do regime no ano", () => {
    const pres = impostosDoRegime("presumido", 2026).map((r) => r.imposto);
    expect(pres).toEqual(expect.arrayContaining(["PIS", "COFINS", "ICMS", "ISS", "IRPJ", "CSLL"]));
  });

  it("folha: CPP (INSS patronal) 20% é fonte oficial; RAT é exemplo a validar", () => {
    expect(aliquotaVigente("folha", "CPP", 2026)?.aliquota).toBe(20);
    expect(aliquotaVigente("folha", "CPP", 2026)?.fonte.oficial).toBe(true);
    expect(aliquotaVigente("folha", "RAT", 2026)?.fonte.oficial).toBe(false);
    expect(aliquotaVigente("folha", "FGTS", 2026)?.aliquota).toBe(8);
  });

  it("o aviso legal está sempre disponível para carimbar a resposta", () => {
    expect(AVISO_LEGAL).toMatch(/contador/i);
    expect(regrasVigentes(2026).length).toBeGreaterThan(0);
  });
});
