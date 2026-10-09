import { describe, expect, it, vi, beforeEach } from "vitest";

// O bloqueio do plano é no SERVIDOR: aqui provamos que a rota devolve 403 quando a
// ferramenta não está habilitada e passa quando está — com o Config mockado.
const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { config: { findUnique: (...a: unknown[]) => findUnique(...a), upsert: vi.fn() } } }));

import { bloqueioDeFerramenta, ferramentasHabilitadas, TODAS } from "@/lib/plano";

// Chaves obrigatórias: devolver o mock faria o vitest chamá-lo como teardown (ver catalogo-override.test.ts).
beforeEach(() => {
  findUnique.mockReset();
});

describe("bloqueioDeFerramenta", () => {
  it("sem Config gravada, nada é bloqueado (instalação da Indeba segue completa)", async () => {
    findUnique.mockResolvedValue(null);
    expect(await ferramentasHabilitadas()).toEqual(TODAS);
    expect(await bloqueioDeFerramenta("gerador-contratos")).toBeNull();
  });

  it("plano Basic: gerador de contratos responde 403 com mensagem acionável; prospecções passam", async () => {
    findUnique.mockResolvedValue({ chave: "ferramentas", valor: JSON.stringify(["prospeccoes", "visitas-comerciais", "visitas-tecnicas"]) });
    const r = await bloqueioDeFerramenta("gerador-contratos");
    expect(r?.status).toBe(403);
    const corpo = await r!.json();
    expect(corpo.ferramenta).toBe("gerador-contratos");
    expect(corpo.erro).toMatch(/Gerador de Contratos.*plano/);
    expect(await bloqueioDeFerramenta("prospeccoes")).toBeNull();
  });

  it("banco fora do ar libera tudo em vez de trancar o cliente", async () => {
    // O aviso JSON de degradação é coberto em log-servidor.test.ts; aqui só o comportamento.
    findUnique.mockImplementation(() => { throw new Error("ECONNREFUSED"); });
    expect(await bloqueioDeFerramenta("estoque-comodatos")).toBeNull();
  });
});
