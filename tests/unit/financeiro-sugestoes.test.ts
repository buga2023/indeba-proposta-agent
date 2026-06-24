import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { carregarCsv } from "@/lib/financeiro/ingest";
import { montarRelatorio } from "@/lib/financeiro/relatorio";
import { acharInsights, gerarSugestoes } from "@/lib/financeiro/sugestoes";

const rel = montarRelatorio(carregarCsv(readFileSync(new URL("../fixtures/faturamento_2026.csv", import.meta.url), "utf-8")));

afterEach(() => vi.unstubAllGlobals());

describe("sugestões de IA ancoradas nos números do motor (§2)", () => {
  it("acharInsights extrai achados determinísticos do relatório", () => {
    const ins = acharInsights(rel);
    const inad = ins.find((i) => i.tipo === "inadimplencia");
    const marg = ins.find((i) => i.tipo === "margem");
    const mix = ins.find((i) => i.tipo === "mix");
    expect(inad?.valor).toBeCloseTo(15785.0, 2); // pendente real
    expect(marg?.valor).toBeCloseTo(39.26, 1); // margem %
    expect(mix?.valor).toBeCloseTo(12565.7, 2); // categoria líder
  });

  it("o NÚMERO da sugestão vem do motor, não do texto da IA", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/tags")) return { ok: true } as Response;
        // a IA "alucina" um número no texto — não pode contaminar o valor estruturado
        const sugestoes = acharInsights(rel).map((_, i) => ({
          indice: i,
          titulo: "Ação",
          acao: "Cobrar R$ 999.999.999 amanhã",
        }));
        return { ok: true, json: async () => ({ response: JSON.stringify({ sugestoes }) }) } as Response;
      }),
    );

    const res = await gerarSugestoes(rel);
    expect(res.sugestoes.length).toBeGreaterThan(0);
    const inad = res.sugestoes.find((s) => s.tipo === "inadimplencia");
    expect(inad?.valor).toBeCloseTo(15785.0, 2); // do motor, não 999.999.999
    expect(inad?.base).toContain("pendente");
    expect(res.aviso).toMatch(/contador/i);
  });

  it("Ollama fora do ar → erro (a parte criativa não tem fallback, mas o número nunca depende dela)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false }) as Response));
    await expect(gerarSugestoes(rel)).rejects.toThrow(/indispon/i);
  });
});
