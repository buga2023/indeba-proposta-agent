import { describe, it, expect, vi, afterEach } from "vitest";
import { aprenderComFeedback } from "@/lib/feedback/aprender";
import type { FeedbackRequest } from "@/lib/contracts";

afterEach(() => vi.unstubAllGlobals());

// Mocka Ollama embed + Qdrant (garantir coleção + upsert) p/ o caminho de indexação.
function mockIndexacao() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = String(url);
      if (u.includes("/api/embed")) return { ok: true, json: async () => ({ embeddings: [[0.1, 0.2, 0.3]] }) } as Response;
      if (u.includes("/collections/") && init?.method === undefined) return { ok: true, json: async () => ({}) } as Response; // coleção existe
      if (u.includes("/points")) return { ok: true, text: async () => "" } as Response; // upsert
      throw new Error(`fetch inesperado: ${u}`);
    }),
  );
}

describe("aprenderComFeedback — o loop que melhora o agente sem treinar modelo (§2)", () => {
  it("correção no Atendimento é reindexada no Qdrant (vira conhecimento)", async () => {
    mockIndexacao();
    const fb: FeedbackRequest = {
      agente: "atendimento",
      pergunta: "qual o prazo de entrega?",
      resposta: "não sei",
      util: false,
      correcao: "O prazo padrão é de 10 dias úteis para a capital.",
    };
    const r = await aprenderComFeedback(fb);
    expect(r.aprendido).toBe(true);
    expect(r.detalhe).toMatch(/indexada na base/);
  });

  it("👍 sem correção apenas registra (não indexa nada)", async () => {
    const fb: FeedbackRequest = {
      agente: "atendimento",
      pergunta: "x",
      resposta: "y",
      util: true,
      correcao: null,
    };
    const r = await aprenderComFeedback(fb);
    expect(r.aprendido).toBe(false);
  });

  it("correção em outro agente (ainda) não fecha loop no Qdrant — só registra", async () => {
    const fb: FeedbackRequest = {
      agente: "financeiro",
      pergunta: "x",
      resposta: "y",
      util: false,
      correcao: "resposta certa",
    };
    const r = await aprenderComFeedback(fb);
    expect(r.aprendido).toBe(false);
    expect(r.detalhe).toMatch(/registrado/);
  });
});
