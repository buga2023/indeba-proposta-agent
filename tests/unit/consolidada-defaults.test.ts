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

  it("aplica os ajustes do Matheus (jul/2026)", () => {
    const d = consolidadaDefaults();
    expect(d.apresentacao.cards[0].texto).toBe("Produtos Indeba certificados pela Anvisa.");
    expect(d.comodatos.equipamentos.map((e) => e.titulo)).toEqual([
      "Diluidores Automáticos",
      "Dosadores Automáticos",
      "Equipamentos de Limpeza",
      "Dispensers de Sabonete e Papel",
    ]);
    // cards de comodato viraram só título + ícone
    expect(d.comodatos.equipamentos.every((e) => !e.descricao)).toBe(true);
    const frete = d.condicoes.itens.find((i) => i.titulo === "Frete e Entrega");
    expect(frete?.texto).toContain("Salvador e região metropolitana");
    const contrato = d.condicoes.itens.find((i) => i.titulo === "Contrato Mínimo");
    expect(contrato?.texto).toBe("Contrato mínimo de 12 (doze) meses.");
    const pedido = d.condicoes.itens.find((i) => i.titulo === "Pedido Mínimo");
    expect(pedido?.texto).toBe("Pedido mínimo para entrega e faturamento: R$ 400,00.");
    // contato ainda sem valores reais (TODO) — PDF não pode exibir número fictício
    expect(d.contato).toEqual({ whatsapp: null, emailConsultor: null });
  });

  it("aceita override de consultor e cidade", () => {
    const d = consolidadaDefaults({ consultor: "Fulano", cidade: "Recife - PE" });
    expect(d.capa.consultor).toBe("Fulano");
    expect(d.capa.cidade).toBe("Recife - PE");
    expect(d.condicoes.consultor).toBe("Fulano");
  });
});
