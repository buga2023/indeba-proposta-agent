import { describe, it, expect } from "vitest";
import { consolidadaDefaults } from "@/lib/consolidada-defaults";
import { ConsolidadaBloco } from "@/lib/contracts";

describe("consolidadaDefaults", () => {
  it("retorna um ConsolidadaBloco válido e não-vazio", () => {
    const d = consolidadaDefaults();
    expect(() => ConsolidadaBloco.parse(d)).not.toThrow();
    expect(d.apresentacao.cards.length).toBe(4);
    expect(d.comodatos.equipamentos.length).toBeGreaterThanOrEqual(4);
    expect(d.condicoes.itens.length).toBeGreaterThanOrEqual(5);
  });

  it("aceita override de consultor e cidade", () => {
    const d = consolidadaDefaults({ consultor: "Fulano", cidade: "Recife - PE" });
    expect(d.capa.consultor).toBe("Fulano");
    expect(d.capa.cidade).toBe("Recife - PE");
    expect(d.condicoes.consultor).toBe("Fulano");
  });
});
