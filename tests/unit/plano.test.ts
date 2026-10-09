import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { config: { findUnique: vi.fn(), upsert: vi.fn() } } }));

import { FERRAMENTAS, PLANOS, TODAS, interpretarFerramentas, planoDe } from "@/lib/plano";

describe("plano de ferramentas", () => {
  it("são as 7 ferramentas da tabela de planos", () => {
    expect(FERRAMENTAS.map((f) => f.id)).toEqual([
      "prospeccoes", "visitas-comerciais", "solicitacoes", "visitas-tecnicas", "contratos-comodatos", "estoque-comodatos", "gerador-contratos",
    ]);
  });

  it("presets batem com a apresentação: Basic 3, Regular 4, Premium 6 (5 + gerador), Completo 7", () => {
    expect(PLANOS.basic).toHaveLength(3);
    expect(PLANOS.regular).toHaveLength(4);
    expect(PLANOS.premium).toContain("gerador-contratos");
    expect(PLANOS.completo).toEqual(TODAS);
  });

  it("valor ausente ou inválido libera tudo — nunca tranca o cliente fora", () => {
    expect(interpretarFerramentas(null)).toEqual(TODAS);
    expect(interpretarFerramentas("isso não é json")).toEqual(TODAS);
    expect(interpretarFerramentas('{"a":1}')).toEqual(TODAS);
  });

  it("lista gravada é respeitada e ids desconhecidos são ignorados", () => {
    expect(interpretarFerramentas('["prospeccoes","xpto","estoque-comodatos"]')).toEqual(["prospeccoes", "estoque-comodatos"]);
    expect(interpretarFerramentas("[]")).toEqual([]);
  });

  it("planoDe reconhece o preset em qualquer ordem e devolve null para personalizado", () => {
    expect(planoDe([...PLANOS.regular].reverse())).toBe("regular");
    expect(planoDe(["prospeccoes"])).toBeNull();
  });
});
