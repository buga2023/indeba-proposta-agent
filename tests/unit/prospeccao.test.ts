import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prospectar, IaIndisponivelError } from "@/lib/prospeccao/prospectar";
import type { ProspeccaoRequest } from "@/lib/contracts";

const REQ: ProspeccaoRequest = {
  nicho: "Produtos de limpeza industrial",
  tipoCliente: "Hospitais e hotéis",
  servicoOferecido: "Fornecimento com entrega rápida",
  localizacao: "Salvador, BA",
};

// Mocka o fetch: /api/tags (ollamaDisponivel), /api/generate (gerarJson) e,
// opcionalmente, a Tavily (fontes web com texto pra minerar contatos).
function mockFetch(opts: {
  tagsOk?: boolean;
  resposta?: string;
  tavily?: Array<{ url: string; content?: string; raw_content?: string }>;
}) {
  const { tagsOk = true, resposta = "{}", tavily } = opts;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/api/tags")) return { ok: tagsOk } as Response;
      if (url.includes("/api/generate")) {
        return { ok: true, json: async () => ({ response: resposta }) } as Response;
      }
      if (url.includes("tavily.com")) {
        return { ok: true, json: async () => ({ results: tavily ?? [] }) } as Response;
      }
      throw new Error(`fetch inesperado: ${url}`);
    }),
  );
}

beforeEach(() => {
  delete process.env.TAVILY_API_KEY;
});
afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.TAVILY_API_KEY;
});

describe("prospectar — contato e procedência vêm do backend (§2: dado crítico nunca do modelo)", () => {
  it("teste-guardião: sem fonte que case, prospect sai 'estimado' e SEM contato — mesmo se a IA sugerir empresa", async () => {
    // Sem TAVILY_API_KEY não há fontes; a IA só propõe a empresa.
    const ia = {
      prospects: [
        { nome: "Hospital A", setor: "Saúde", site: "https://hospitala.com.br", comoAjudar: "x", mensagemPronta: "olá" },
      ],
      abordagens: [],
    };
    mockFetch({ resposta: JSON.stringify(ia) });

    const res = await prospectar(REQ);
    expect(res.prospects[0].confiabilidade).toBe("estimado");
    expect(res.prospects[0].emails).toEqual([]);
    expect(res.prospects[0].telefones).toEqual([]);
    expect(res.prospects[0].fonte).toBeNull();
  });

  it("teste-guardião: e-mail só sai se for minerado de uma fonte que case com o domínio do prospect", async () => {
    process.env.TAVILY_API_KEY = "k";
    const ia = {
      prospects: [
        { nome: "Acme Hotelaria", setor: "Hotelaria", site: "https://acme.com.br", comoAjudar: "y", mensagemPronta: "oi" },
      ],
      abordagens: [],
    };
    mockFetch({
      resposta: JSON.stringify(ia),
      tavily: [
        {
          url: "https://acme.com.br/contato",
          content: "Fale conosco",
          raw_content: "Contato: vendas@acme.com.br Tel (71) 99888-7766 https://instagram.com/acmehotel",
        },
        // ruído: outra empresa, outro domínio — NÃO deve vazar pro prospect Acme
        { url: "https://outra.com/x", raw_content: "contato@outra.com" },
      ],
    });

    const res = await prospectar(REQ);
    const p = res.prospects[0];
    expect(p.confiabilidade).toBe("confirmado");
    expect(p.emails).toContain("vendas@acme.com.br");
    expect(p.emails).not.toContain("contato@outra.com"); // domínio diferente → barrado
    expect(p.telefones.length).toBeGreaterThan(0);
    expect(p.redes.instagram).toBe("https://instagram.com/acmehotel");
    expect(p.fonte).toBe("https://acme.com.br/contato");
  });

  it("`total` é a contagem real dos prospects (calculada no backend)", async () => {
    const ia = {
      prospects: [
        { nome: "A", setor: "S", site: null, comoAjudar: "x", mensagemPronta: "m" },
        { nome: "B", setor: "S", site: null, comoAjudar: "y", mensagemPronta: "m" },
      ],
      abordagens: [],
    };
    mockFetch({ resposta: JSON.stringify(ia) });

    const res = await prospectar(REQ);
    expect(res.total).toBe(2);
    expect(res.prospects).toHaveLength(2);
  });
});

describe("prospectar — degradação", () => {
  it("Ollama fora do ar → IaIndisponivelError (não há fallback determinístico)", async () => {
    mockFetch({ tagsOk: false });
    await expect(prospectar(REQ)).rejects.toBeInstanceOf(IaIndisponivelError);
  });
});
