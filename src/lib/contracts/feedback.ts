import { z } from "zod";

/**
 * Camada de feedback — é assim que os agentes "melhoram com o tempo" SEM treinar modelo
 * (constituição §2: o modelo não muda; o sistema aprende). Toda resposta pode receber
 * 👍/👎 e uma CORREÇÃO humana. O feedback é log append-only (auditável, §1.8) e, no
 * Atendimento, a correção é reindexada no Qdrant — vira conhecimento recuperável.
 */

export const AgenteId = z.enum([
  "atendimento",
  "financeiro",
  "contrato",
  "proposta",
  "prospeccao",
  "instagram",
]);
export type AgenteId = z.infer<typeof AgenteId>;

export const FeedbackRequest = z.object({
  agente: AgenteId,
  pergunta: z.string().max(4000).nullable().default(null), // input/contexto que gerou a resposta
  resposta: z.string().max(40_000), // o que o agente respondeu
  util: z.boolean(), // 👍 true / 👎 false
  correcao: z.string().max(40_000).nullable().default(null), // resposta certa (humana), opcional
});
export type FeedbackRequest = z.infer<typeof FeedbackRequest>;

export const FeedbackResponse = z.object({
  ok: z.boolean(),
  aprendido: z.boolean(), // true quando a correção virou conhecimento indexado
  detalhe: z.string(),
});
export type FeedbackResponse = z.infer<typeof FeedbackResponse>;
