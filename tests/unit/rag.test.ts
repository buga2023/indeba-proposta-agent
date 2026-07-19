import { describe, it, expect, vi, afterEach } from "vitest";
import { chunk } from "@/lib/rag/chunk";
import { textoProduto } from "@/lib/rag/indexar";
import { responder } from "@/lib/rag/responder";
import type { Produto } from "@/lib/contracts";

afterEach(() => vi.unstubAllGlobals());

describe("chunk — quebra por tamanho respeitando parágrafos", () => {
  it("texto curto vira um único chunk", () => {
    expect(chunk("Texto curto.")).toEqual(["Texto curto."]);
  });
  it("texto longo vira vários chunks dentro do limite", () => {
    const paragrafo = "frase ".repeat(60).trim(); // ~360 chars
    const texto = Array(10).fill(paragrafo).join("\n\n");
    const partes = chunk(texto, 800);
    expect(partes.length).toBeGreaterThan(1);
    expect(partes.every((p) => p.length <= 800)).toBe(true);
  });
});

const PRODUTO: Produto = {
  codigo: "PRIMMAX-PLUS",
  nome: "Primmax Plus",
  marca: "indeba",
  linha: "alimentos_bebidas",
  descricaoCurta: "Detergente concentrado desengordurante",
  descricaoUso: "Lavar louças, pisos e bancadas.",
  segmentos: ["cozinha_industrial"],
  funcoes: ["desengordurante", "multiuso"],
  metodos: ["diluidor_automatico"],
  imagemPath: "/x.png",
  fichaTecnicaPath: null,
  ativo: true,
  embalagens: [{ tamanho: 5, unidade: "L", preco: "130.00", diluicaoMax: null, custoDiluido: null }],
};

describe("textoProduto — corpus pesquisável vem do catálogo (determinístico)", () => {
  it("inclui nome, código, uso, funções e embalagem com preço", () => {
    const t = textoProduto(PRODUTO);
    expect(t).toContain("Primmax Plus");
    expect(t).toContain("código PRIMMAX-PLUS");
    expect(t).toContain("desengordurante");
    expect(t).toContain("5L a R$ 130.00");
  });
});

// Mocka embed (Ollama), busca (Qdrant) e geração (Qwen). `generateCalled` registra se a IA
// foi acionada — o guardião exige que ela NÃO seja chamada quando não há contexto relevante.
function mockRag(opts: { score: number; payloadTitulo?: string; generate?: string; generateOk?: boolean }) {
  const { score, payloadTitulo = "Primmax Plus", generate = "Resposta da IA [1].", generateOk = true } = opts;
  const estado = { generateCalled: false };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const u = String(url);
      if (u.includes("/api/embed")) return { ok: true, json: async () => ({ embeddings: [[0.1, 0.2, 0.3]] }) } as Response;
      if (u.includes("/points/search"))
        return {
          ok: true,
          json: async () => ({ result: [{ score, payload: { tipo: "produto", titulo: payloadTitulo, texto: "Primmax Plus é um detergente desengordurante." } }] }),
        } as Response;
      if (u.includes("/api/generate")) {
        estado.generateCalled = true;
        return { ok: generateOk, json: async () => ({ response: generate }) } as Response;
      }
      throw new Error(`fetch inesperado: ${u}`);
    }),
  );
  return estado;
}

describe("responder — guardião: resposta ancorada nas fontes, nunca alucinada (§2)", () => {
  it("recuperação relevante → resposta da IA + fontes vindas do Qdrant", async () => {
    mockRag({ score: 0.82 });
    const r = await responder("o que é o Primmax Plus?");
    expect(r.fontes).toHaveLength(1);
    expect(r.fontes[0].titulo).toBe("Primmax Plus"); // veio do payload, não do modelo
    expect(r.fontes[0].score).toBe(0.82);
    expect(r.resposta).toContain("Resposta da IA");
  });

  it("teste-guardião: sem trecho relevante → 'não sei' determinístico e SEM chamar a IA", async () => {
    const estado = mockRag({ score: 0.2 }); // abaixo do SCORE_MIN (0.35)
    const r = await responder("qual a capital da França?");
    expect(r.fontes).toEqual([]);
    expect(r.resposta).toMatch(/Não encontrei isso na base/);
    expect(estado.generateCalled).toBe(false); // não alucina: nem aciona o modelo
  });

  it("degradação (§5): IA fora do ar mas com contexto → entrega os trechos recuperados", async () => {
    mockRag({ score: 0.7, generateOk: false });
    const r = await responder("Primmax Plus");
    expect(r.fontes).toHaveLength(1);
    expect(r.resposta).toMatch(/IA está indisponível/);
  });
});
