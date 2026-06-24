import { describe, it, expect } from "vitest";
import { referenciaDe, ancorar, LEIS } from "@/lib/contrato/fundamentos";
import { CATEGORIAS } from "@/lib/contrato/checklist";

describe("grounding jurídico: fundamento → norma oficial (Planalto)", () => {
  it("reconhece a lei citada no fundamento", () => {
    expect(referenciaDe("CC art. 408-416 (cláusula penal)")).toBe(LEIS.CC);
    expect(referenciaDe("Lei 13.709/2018 (LGPD)")).toBe(LEIS.LGPD);
    expect(referenciaDe("CPC art. 63 (foro de eleição)")).toBe(LEIS.CPC);
    expect(referenciaDe(null)).toBeNull();
    expect(referenciaDe("texto sem lei conhecida")).toBeNull();
  });

  it("toda referência aponta para uma URL oficial do Planalto", () => {
    for (const ref of Object.values(LEIS)) {
      expect(ref.fonte).toBe("Planalto");
      expect(ref.url).toMatch(/^https:\/\/www\.planalto\.gov\.br\//);
    }
  });

  it("ancora as categorias do checklist que têm fundamento", () => {
    const ancoradas = ancorar(CATEGORIAS);
    const lgpd = ancoradas.find((c) => c.id === "lgpd");
    expect(lgpd?.referencia?.lei).toBe("Lei 13.709/2018");
    expect(lgpd?.referencia?.url).toContain("l13709");
    // categoria sem fundamento → referência null (não inventa norma)
    const partes = ancoradas.find((c) => c.id === "partes");
    expect(partes?.referencia).toBeNull();
  });
});
