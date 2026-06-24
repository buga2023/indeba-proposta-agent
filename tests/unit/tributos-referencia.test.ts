import { describe, it, expect } from "vitest";
import { todos, porEsfera, porStatus, buscarTributo, AVISO_TRIBUTOS } from "@/lib/financeiro/tributos-referencia";

describe("catálogo de tributos (base de conhecimento do chat fiscal)", () => {
  it("cobre as 4 esferas e tem volume razoável de tributos", () => {
    expect(todos().length).toBeGreaterThanOrEqual(28);
    for (const esfera of ["federal", "estadual", "municipal", "reforma"] as const) {
      expect(porEsfera(esfera).length).toBeGreaterThan(0);
    }
  });

  it("marca corretamente os que estão em extinção e os novos da reforma", () => {
    const extincao = porStatus("em_extincao").map((t) => t.sigla);
    expect(extincao).toEqual(expect.arrayContaining(["PIS", "COFINS", "IPI", "ICMS", "ISS"]));
    const novos = porStatus("novo").map((t) => t.sigla);
    expect(novos).toEqual(expect.arrayContaining(["CBS", "IBS", "IS"]));
  });

  it("busca por sigla e por termo (para o chat explicar)", () => {
    expect(buscarTributo("ICMS")?.esfera).toBe("estadual");
    expect(buscarTributo("icms")?.status).toBe("em_extincao");
    const das = buscarTributo("DAS");
    expect(das?.comoApurar).toMatch(/RBT12/);
    expect(buscarTributo("inexistente_xyz")).toBeNull();
  });

  it("cada tributo explica como apurar e tem fonte; aviso lembra que os variáveis vêm da fonte datada", () => {
    expect(todos().every((t) => t.comoApurar.length > 0 && t.fonte.length > 0)).toBe(true);
    expect(AVISO_TRIBUTOS).toMatch(/fonte datada|nunca crava/i);
  });
});
