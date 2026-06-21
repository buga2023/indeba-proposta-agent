import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prospectar, IaIndisponivelError } from "@/lib/prospeccao/prospectar";
import type { ProspeccaoRequest } from "@/lib/contracts";

const REQ: ProspeccaoRequest = {
  nicho: "Produtos de limpeza industrial",
  tipoCliente: "Hospitais e hotéis",
  servicoOferecido: "Fornecimento com entrega rápida",
  localizacao: "Salvador, BA",
};

// Mocka o fetch: /api/tags (ollamaDisponivel) e /api/generate (gerarJson).
// Sem TAVILY_API_KEY, buscarWeb nem chega a fazer fetch (degrada para "").
function mockOllama(opts: { tagsOk?: boolean; resposta?: string }) {
  const { tagsOk = true, resposta = "{}" } = opts;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/api/tags")) return { ok: tagsOk } as Response;
      if (url.includes("/api/generate")) {
        return { ok: true, json: async () => ({ response: resposta }) } as Response;
      }
      throw new Error(`fetch inesperado: ${url}`);
    }),
  );
}

beforeEach(() => {
  delete process.env.TAVILY_API_KEY; // garante busca web desligada no teste
});
afterEach(() => vi.unstubAllGlobals());

describe("prospectar — total e procedência vêm do backend (§2: dado crítico nunca do modelo)", () => {
  it("teste-guardião: `total` é a contagem real, ignora o número que o modelo mandar", async () => {
    // O modelo mente: diz total=999, mas só entrega 2 prospects.
    const ia = {
      total: 999,
      prospects: [
        { nome: "Hospital A", setor: "Saúde", comoAjudar: "x", confiabilidade: "confirmado" },
        { nome: "Hotel B", setor: "Hotelaria", comoAjudar: "y", confiabilidade: "estimado" },
      ],
      abordagens: [],
    };
    mockOllama({ resposta: JSON.stringify(ia) });

    const res = await prospectar(REQ);
    expect(res.total).toBe(2); // contagem real, não os 999 alucinados
    expect(res.prospects).toHaveLength(2);
  });

  it("normaliza contatos placeholder ('', 'null', 'N/A') para null", async () => {
    const ia = {
      prospects: [
        {
          nome: "Empresa X",
          setor: "Indústria",
          email: "null",
          telefone: "",
          site: "N/A",
          linkedin: "https://linkedin.com/company/x",
          comoAjudar: "z",
          confiabilidade: "estimado",
        },
      ],
      abordagens: [],
    };
    mockOllama({ resposta: JSON.stringify(ia) });

    const res = await prospectar(REQ);
    const p = res.prospects[0];
    expect(p.email).toBeNull();
    expect(p.telefone).toBeNull();
    expect(p.site).toBeNull();
    expect(p.linkedin).toBe("https://linkedin.com/company/x"); // valor real preservado
  });
});

describe("prospectar — degradação", () => {
  it("Ollama fora do ar → IaIndisponivelError (não há fallback determinístico)", async () => {
    mockOllama({ tagsOk: false });
    await expect(prospectar(REQ)).rejects.toBeInstanceOf(IaIndisponivelError);
  });
});
