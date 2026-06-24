import { z } from "zod";

/**
 * Agente de Atendimento (RAG sobre a base da empresa, via Qdrant).
 *
 * Constituição §2: o dado crítico (a RESPOSTA factual) nunca vem do modelo — vem dos
 * trechos RECUPERADOS no Qdrant. O Qwen só redige a resposta ANCORADA nesses trechos e,
 * se a busca não trouxer nada relevante, o agente diz que não sabe (não alucina).
 * §7: toda resposta carrega suas FONTES (procedência rastreável).
 */

export const FonteRag = z.object({
  titulo: z.string(), // produto/documento de origem
  tipo: z.string(), // "produto" | "doc"
  trecho: z.string(), // pedaço recuperado (do payload do Qdrant, não do modelo)
  score: z.number(), // similaridade (0..1)
});
export type FonteRag = z.infer<typeof FonteRag>;

export const RagResposta = z.object({
  resposta: z.string(), // IA-TEXTO, ancorada nas fontes (ou "não sei" determinístico)
  fontes: z.array(FonteRag), // MOTOR (recuperação no Qdrant)
});
export type RagResposta = z.infer<typeof RagResposta>;

export const RagIndexResultado = z.object({
  ok: z.boolean(),
  colecao: z.string(),
  pontos: z.number().int(), // quantos vetores foram indexados
});
export type RagIndexResultado = z.infer<typeof RagIndexResultado>;

// Ação discriminada da API: perguntar, reindexar o catálogo ou indexar um documento.
export const RagRequest = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("perguntar"), pergunta: z.string().min(1).max(2000) }),
  z.object({ acao: z.literal("indexar-catalogo") }),
  z.object({
    acao: z.literal("indexar-doc"),
    titulo: z.string().min(1).max(200),
    texto: z.string().min(1).max(500_000),
  }),
]);
export type RagRequest = z.infer<typeof RagRequest>;
