import { describe, it, expect, vi, afterEach } from "vitest";
import { carregarCsv } from "@/lib/financeiro/ingest";
import { compararCotacoes } from "@/lib/compras/comparar";
import { processarCompras } from "@/lib/compras/processar";

// Alfa: 10×100+50=1050, 30d → efetivo 1050/1.02=1029.41
// Beta: 9,50×100+120=1070, 0d → efetivo 1070.00
// Gama: 10,20×100+0=1020, 60d → efetivo 1020/1.04=980.77  ← melhor
const CSV = `Fornecedor;Item;Preco;Quantidade;Frete;Prazo
Alfa;Detergente;10,00;100;50,00;30
Beta;Detergente;9,50;100;120,00;0
Gama;Detergente;10,20;100;0,00;60`;

afterEach(() => vi.unstubAllGlobals());

describe("compararCotacoes — custo efetivo ajustado pelo prazo (motor §2)", () => {
  it("ranqueia por custo efetivo: prazo maior compensa preço um pouco maior", () => {
    const r = compararCotacoes(carregarCsv(CSV), 0.02);
    expect(r.cotacoes.map((c) => c.fornecedor)).toEqual(["Gama", "Alfa", "Beta"]);
    expect(r.cotacoes[0].custoTotal).toBe("1020.00");
    expect(r.cotacoes[0].custoEfetivo).toBe("980.77");
    expect(r.melhorFornecedor).toBe("Gama");
    expect(r.economia).toBe("48.64"); // 1029.41 − 980.77
  });

  it("sem qtd/frete/prazo → usa só preço e sinaliza a lacuna", () => {
    const r = compararCotacoes(carregarCsv("Fornecedor;Preco\nA;10,00\nB;9,00"), 0.02);
    expect(r.melhorFornecedor).toBe("B");
    expect(r.aviso).toMatch(/quantidade\/frete\/prazo/);
  });
});

function mockOllama(tagsOk: boolean, texto = "Compre da Gama.") {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/tags")) return { ok: tagsOk } as Response;
      if (String(url).includes("/api/generate")) return { ok: true, json: async () => ({ response: texto }) } as Response;
      throw new Error(`fetch inesperado: ${url}`);
    }),
  );
}

describe("processarCompras — guardião: ranking/custos vêm do motor, IA só recomenda", () => {
  it("a recomendação é texto da IA, mas os custos da tabela são do motor", async () => {
    mockOllama(true, "Recomendo a Gama pelo melhor custo efetivo.");
    const r = await processarCompras({ planilha: { nome: "cot", csv: CSV }, taxaMensal: null });
    expect(r.melhorFornecedor).toBe("Gama");
    expect(r.cotacoes[0].custoEfetivo).toBe("980.77"); // motor, não IA
    expect(r.recomendacao).toContain("Gama");
  });

  it("degradação (§5): sem Ollama, recomendação determinística com os números do motor", async () => {
    mockOllama(false);
    const r = await processarCompras({ planilha: { nome: "cot", csv: CSV }, taxaMensal: null });
    expect(r.recomendacao).toMatch(/Gama/);
    expect(r.recomendacao).toMatch(/R\$ 980,77/);
  });
});
