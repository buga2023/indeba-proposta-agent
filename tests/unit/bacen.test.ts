import { describe, it, expect, vi, afterEach } from "vitest";
import { urlUltimos, urlPeriodo, parsePontos, buscarSerie, SERIES } from "@/lib/financeiro/bacen";

afterEach(() => vi.unstubAllGlobals());

describe("BACEN SGS — fonte oficial de índices (procedência auditável)", () => {
  it("monta a URL de /ultimos e limita a 20 (limite do SGS)", () => {
    expect(urlUltimos(432, 1)).toBe("https://api.bcb.gov.br/dados/serie/bcdata.sgs.432/dados/ultimos/1?formato=json");
    expect(urlUltimos(11, 999)).toContain("/ultimos/20");
    expect(urlUltimos(11, 0)).toContain("/ultimos/1");
  });

  it("monta a URL de período", () => {
    expect(urlPeriodo(433, "01/01/2026", "31/12/2026")).toBe(
      "https://api.bcb.gov.br/dados/serie/bcdata.sgs.433/dados?formato=json&dataInicial=01/01/2026&dataFinal=31/12/2026",
    );
  });

  it("parseia valores com ponto OU vírgula decimal", () => {
    const pts = parsePontos([
      { data: "05/08/2026", valor: "14.25" },
      { data: "01/05/2026", valor: "0,58" },
    ]);
    expect(pts[0].valor).toBe(14.25);
    expect(pts[1].valor).toBe(0.58);
  });

  it("buscarSerie devolve pontos + a URL como procedência", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => [{ data: "05/08/2026", valor: "14.25" }] }) as Response),
    );
    const r = await buscarSerie("selic_meta", { ultimos: 1 });
    expect(r.serie).toEqual(SERIES.selic_meta);
    expect(r.pontos[0].valor).toBe(14.25);
    expect(r.referencia).toBe("05/08/2026");
    expect(r.fonte).toContain("bcdata.sgs.432");
  });

  it("HTTP != ok lança com a URL (não inventa número)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 }) as Response));
    await expect(buscarSerie(433)).rejects.toThrow(/HTTP 503/);
  });
});
