import { describe, it, expect } from "vitest";
import { carregarCatalogo } from "@/lib/catalogo";

describe("catálogo — fichas dos produtos-piloto", () => {
  const cat = carregarCatalogo();
  it("mantém 9 produtos", () => expect(cat.produtos.length).toBe(9));
  it("PRIMMAX-PLUS tem ficha rica", () => {
    const p = cat.produtos.find((x) => x.codigo === "PRIMMAX-PLUS");
    expect(p?.ficha?.titulo).toBeTruthy();
    expect((p?.ficha?.beneficios ?? []).length).toBeGreaterThan(0);
    expect(p?.ficha?.caracteristicas?.pH).toBeTruthy();
    expect((p?.ficha?.diluicoes ?? []).length).toBeGreaterThan(0);
  });
  it("PRIMMAX-DGCLOR tem ficha rica", () => {
    const p = cat.produtos.find((x) => x.codigo === "PRIMMAX-DGCLOR");
    expect(p?.ficha?.titulo).toBeTruthy();
    expect((p?.ficha?.beneficios ?? []).length).toBeGreaterThan(0);
  });
});
