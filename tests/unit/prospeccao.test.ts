import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prospectar, escoparBrasil, IaIndisponivelError } from "@/lib/prospeccao/prospectar";
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

  it("individualidade: social casa por slug e contato compartilhado some dos dois", async () => {
    process.env.TAVILY_API_KEY = "k";
    const ia = {
      prospects: [
        { nome: "Hotel Bahia Palace", setor: "Hotelaria", site: "https://bahiapalace.com.br", comoAjudar: "x", mensagemPronta: "m" },
        { nome: "Hotel Salvador Plaza", setor: "Hotelaria", site: null, comoAjudar: "y", mensagemPronta: "m" },
      ],
      abordagens: [],
    };
    // Página-diretório que cita os DOIS hotéis, com 1 LinkedIn e 1 telefone "geral".
    mockFetch({
      resposta: JSON.stringify(ia),
      tavily: [
        {
          url: "https://guiahoteis.com/salvador",
          raw_content:
            "Hotel Bahia Palace e Hotel Salvador Plaza em Salvador. " +
            "LinkedIn https://linkedin.com/company/bahiapalace Central (71) 3333-4444",
        },
      ],
    });

    const res = await prospectar(REQ);
    const bahia = res.prospects.find((p) => p.nome.includes("Bahia"))!;
    const plaza = res.prospects.find((p) => p.nome.includes("Plaza"))!;

    // LinkedIn casa só com Bahia (slug "bahiapalace"); Plaza NÃO herda.
    expect(bahia.redes.linkedin).toBe("https://linkedin.com/company/bahiapalace");
    expect(plaza.redes.linkedin).toBeNull();
    // Telefone "geral" aparecia nos dois → removido de ambos.
    expect(bahia.telefones).toEqual([]);
    expect(plaza.telefones).toEqual([]);
    // Nenhum valor de contato se repete entre prospects.
    const todos = res.prospects
      .flatMap((p) => [...p.emails, ...p.telefones, p.redes.linkedin, p.redes.instagram, p.redes.whatsapp])
      .filter(Boolean);
    expect(new Set(todos).size).toBe(todos.length);
  });
});

describe("escoparBrasil — busca web nunca sai do país (desambigua Salvador/El Salvador)", () => {
  it("anexa 'Brasil' quando falta", () => {
    expect(escoparBrasil("Salvador, BA")).toBe("Salvador, BA, Brasil");
    expect(escoparBrasil("Curitiba")).toBe("Curitiba, Brasil");
  });
  it("não duplica se já tem Brasil/Brazil", () => {
    expect(escoparBrasil("Salvador, BA, Brasil")).toBe("Salvador, BA, Brasil");
    expect(escoparBrasil("São Paulo - Brazil")).toBe("São Paulo - Brazil");
  });
  it("vazio/nulo → país inteiro", () => {
    expect(escoparBrasil("")).toBe("Brasil");
    expect(escoparBrasil(null)).toBe("Brasil");
    expect(escoparBrasil(undefined)).toBe("Brasil");
  });

  it("toda query enviada à Tavily carrega o escopo 'Brasil'", async () => {
    process.env.TAVILY_API_KEY = "k";
    mockFetch({
      resposta: JSON.stringify({ prospects: [], abordagens: [] }),
      tavily: [],
    });
    await prospectar(REQ); // localizacao: "Salvador, BA"

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const queries = fetchMock.mock.calls
      .filter(([url]) => String(url).includes("tavily.com"))
      .map(([, init]) => JSON.parse((init as RequestInit).body as string).query as string);

    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) expect(q).toMatch(/Brasil/);
  });
});

describe("prospectar — degradação", () => {
  it("Ollama fora do ar → IaIndisponivelError (não há fallback determinístico)", async () => {
    mockFetch({ tagsOk: false });
    await expect(prospectar(REQ)).rejects.toBeInstanceOf(IaIndisponivelError);
  });
});
