import { describe, it, expect } from "vitest";
import { clausulasPara, clausulaDe, categoriasSemModelo, AVISO_CLAUSULAS } from "@/lib/contrato/banco-clausulas";

describe("banco de cláusulas (geração ancorada, com procedência)", () => {
  it("retorna as cláusulas de um tipo de contrato, todas com fonte", () => {
    const cs = clausulasPara("fornecimento");
    expect(cs.length).toBeGreaterThan(0);
    expect(cs.every((c) => typeof c.fonte.oficial === "boolean")).toBe(true);
    // ainda rascunho: nenhuma revisada por advogado por padrão
    expect(cs.every((c) => c.fonte.revisadoPor === null)).toBe(true);
  });

  it("acha a cláusula de uma categoria e ela usa placeholders (preenchidos por dado)", () => {
    const lgpd = clausulaDe("lgpd", "fornecimento");
    expect(lgpd?.fundamento).toMatch(/13\.709/);
    const multa = clausulaDe("multa", "fornecimento");
    expect(multa?.texto).toMatch(/\{percentualMulta\}/);
  });

  it("categoria sem modelo → null (lacuna a curar, não inventa)", () => {
    expect(clausulaDe("forca_maior", "fornecimento")).toBeNull();
    expect(categoriasSemModelo(["multa", "forca_maior"], "fornecimento")).toEqual(["forca_maior"]);
  });

  it("o aviso deixa claro que é rascunho a revisar por advogado", () => {
    expect(AVISO_CLAUSULAS).toMatch(/advogado/i);
  });
});
