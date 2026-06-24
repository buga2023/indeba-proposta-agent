import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocka só o acesso ao banco — o foco é o TETO do `take` (anti-coleta em massa).
const findMany = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { empresaReceita: { findMany: (a: unknown) => findMany(a) } } }));

import { buscarEmpresas } from "@/lib/prospeccao/empresas";

const takeDe = () => findMany.mock.calls[0][0].take as number;

beforeEach(() => {
  findMany.mockReset().mockResolvedValue([]); // sem linhas — só inspecionamos o `take`
});

describe("buscarEmpresas — teto rígido de resultados (LGPD)", () => {
  it("clampa um limite absurdo no máximo (50)", async () => {
    await buscarEmpresas({ cnaes: ["4646002"], limite: 100000 });
    expect(takeDe()).toBe(50);
  });

  it("respeita um limite pequeno", async () => {
    await buscarEmpresas({ cnaes: ["4646002"], limite: 10 });
    expect(takeDe()).toBe(10);
  });

  it("default quando não passa limite", async () => {
    await buscarEmpresas({ cnaes: ["4646002"] });
    expect(takeDe()).toBe(12);
  });

  it("nunca abaixo de 1 (limite 0/negativo)", async () => {
    await buscarEmpresas({ cnaes: ["4646002"], limite: 0 });
    expect(takeDe()).toBe(1);
  });

  it("sem CNAEs → nem consulta o banco", async () => {
    expect(await buscarEmpresas({ cnaes: [] })).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
