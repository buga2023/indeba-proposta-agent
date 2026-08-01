import { describe, it, expect } from "vitest";
import { carregarCatalogo } from "@/lib/catalogo";

describe("catálogo — fichas dos produtos-piloto", () => {
  const cat = carregarCatalogo();
  // O catálogo real inteiro está no ar desde 01/08/2026 (ver catalogo-assets.test.ts);
  // aqui o que importa é que os produtos com ficha rica continuam em linha.
  it("os produtos-piloto seguem ativos", () => {
    const ativos = cat.produtos.filter((p) => p.ativo);
    expect(ativos.find((p) => p.codigo === "PRIMMAX-PLUS")).toBeDefined();
    expect(ativos.find((p) => p.codigo === "PRIMMAX-DGCLOR")).toBeDefined();
  });
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
