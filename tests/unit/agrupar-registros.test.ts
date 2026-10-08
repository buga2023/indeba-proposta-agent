import { describe, it, expect } from "vitest";
import { agruparPorAnoMes } from "@/lib/agrupar-registros";

describe("agruparPorAnoMes", () => {
  it("agrupa ano -> mes em ordem decrescente", () => {
    const r = agruparPorAnoMes([
      { id: 1, data: "2025-12-31" },
      { id: 2, data: "2026-01-05" },
      { id: 3, data: "2026-09-01" },
      { id: 4, data: "2026-09-20" },
    ]);
    expect(r.map((a) => a.ano)).toEqual(["2026", "2025"]);
    expect(r[0].meses.map((m) => m.mes)).toEqual(["09", "01"]);
    expect(r[0].meses[0].itens.map((i) => i.id)).toEqual([3, 4]);
    expect(r[1].meses[0].itens[0].id).toBe(1);
  });

  it("data invalida, nula ou ausente vai para 'Sem data' no fim", () => {
    const r = agruparPorAnoMes([
      { id: 1, data: "lixo" },
      { id: 2, data: null },
      { id: 3 },
      { id: 4, data: "2026-13-01" },
      { id: 5, data: "2024-02-10" },
      { id: 6, data: new Date("x") },
    ]);
    expect(r.map((a) => a.ano)).toEqual(["2024", "Sem data"]);
    expect(r[1].meses).toEqual([{ mes: "Sem data", itens: [{ id: 1, data: "lixo" }, { id: 2, data: null }, { id: 3 }, { id: 4, data: "2026-13-01" }, { id: 6, data: expect.any(Date) }] }]);
  });

  it("aceita Date e lista vazia", () => {
    expect(agruparPorAnoMes([])).toEqual([]);
    const r = agruparPorAnoMes([{ data: new Date(2026, 2, 15) }]);
    expect(r[0].ano).toBe("2026");
    expect(r[0].meses[0].mes).toBe("03");
  });
});
