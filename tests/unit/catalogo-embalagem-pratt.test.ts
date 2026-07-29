import { describe, it, expect } from "vitest";
import { carregarCatalogo } from "@/lib/catalogo";

// BUG-01 do QA (jul/2026): a ficha técnica do Pratt Álcool Gel diz "bombonas plásticas de
// 05 litros e refis de 800mL", mas o catálogo só tinha 800 ml — o consultor não conseguia
// cotar o galão. Conferido no PDF (public/fichas-tecnicas/pratt-alcool-gel-70.pdf).
describe("PRATT-ALCOOL-GEL — embalagens conforme a ficha técnica", () => {
  const p = carregarCatalogo().produtos.find((x) => x.codigo === "PRATT-ALCOOL-GEL")!;

  it("oferece os dois tamanhos da ficha: 5 L e 800 ml", () => {
    expect(p.embalagens.map((e) => `${e.tamanho}${e.unidade}`)).toEqual(["5L", "800ml"]);
  });

  // Com 2 embalagens o card volta a renderizar o seletor de tamanho (page.tsx), que é o
  // que o vendedor reclamou de não ver.
  it("tem mais de uma embalagem, então a tela mostra seletor e não rótulo fixo", () => {
    expect(p.embalagens.length).toBeGreaterThan(1);
  });

  it("segue sem preço fixo no catálogo (quem cota é o consultor)", () => {
    for (const e of p.embalagens) expect(e.preco).toBeNull();
  });
});
