import { describe, it, expect, vi, afterEach } from "vitest";
import { reescreverApresentacao } from "@/lib/llm/escrever-texto";

// Mocka o fetch: /api/tags (ollamaDisponivel) e /api/generate (gerarTexto) — mesmo
// padrão de tests/unit/prospeccao.test.ts.
function mockFetch(opts: { tagsOk?: boolean; resposta?: string; generateOk?: boolean }) {
  const { tagsOk = true, resposta = "Texto reescrito.", generateOk = true } = opts;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/api/tags")) return { ok: tagsOk } as Response;
      if (url.includes("/api/generate")) {
        if (!generateOk) return { ok: false, status: 500 } as Response;
        return { ok: true, json: async () => ({ response: resposta }) } as Response;
      }
      throw new Error(`fetch inesperado: ${url}`);
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("reescreverApresentacao — refino pontual do texto (Revisão)", () => {
  it("reescreve o texto seguindo a instrução quando o Ollama responde", async () => {
    mockFetch({ resposta: "Prezados, segue a proposta de forma mais curta e formal." });
    const r = await reescreverApresentacao(
      "Prezados da Empresa X, apresentamos nossa proposta bem longa e informal...",
      "deixe mais curto e formal",
      [{ nome: "Primmax Plus", funcoes: ["desengordurante"] }],
    );
    expect(r).not.toBeNull();
    expect(r!.conteudo).toBe("Prezados, segue a proposta de forma mais curta e formal.");
    expect(r!.procedencia).toBe("IA-TEXTO");
  });

  it("teste-guardião: Ollama indisponível → null, nunca inventa texto de substituição", async () => {
    mockFetch({ tagsOk: false });
    const r = await reescreverApresentacao("Texto atual.", "deixe mais formal", []);
    expect(r).toBeNull();
  });

  it("Ollama falha na geração → null (chamador mantém o texto atual, não quebra a proposta)", async () => {
    mockFetch({ generateOk: false });
    const r = await reescreverApresentacao("Texto atual.", "deixe mais formal", []);
    expect(r).toBeNull();
  });

  it("instrução vazia → null sem chamar o modelo", async () => {
    mockFetch({});
    const r = await reescreverApresentacao("Texto atual.", "   ", []);
    expect(r).toBeNull();
  });

  it("saída com caractere CJK (surto do modelo) é descartada — não vaza pro PDF", async () => {
    mockFetch({ resposta: "这是一个测试" });
    const r = await reescreverApresentacao("Texto atual.", "deixe mais curto", []);
    expect(r).toBeNull();
  });
});
