import { z } from "zod";

/**
 * Base tributária DATADA e com FONTE. A reforma (LC 214/2025) troca PIS/COFINS/IPI por
 * CBS e ICMS/ISS por IBS numa transição 2026–2033 — então alíquota NÃO é constante, é
 * função do ANO. Toda regra carrega vigência + procedência; onde a fonte não é oficial,
 * é EXEMPLO a validar com o contador. O agente nunca inventa alíquota (§2).
 */

export const FonteTributaria = z.object({
  nome: z.string(), // "LC 214/2025", "Portal Simples Nacional", "exemplo (tax-rules)"
  url: z.string().nullable().default(null),
  oficial: z.boolean(), // true = fonte oficial; false = placeholder/exemplo a validar
});
export type FonteTributaria = z.infer<typeof FonteTributaria>;

export const RegraTributaria = z.object({
  regime: z.string(), // simples | presumido | real | ibs_cbs
  imposto: z.string(), // ICMS | ISS | PIS | COFINS | IPI | CBS | IBS | DAS | IRPJ | CSLL
  aliquota: z.number(), // % — valor da FONTE, nunca do modelo
  vigenciaInicio: z.string(), // "AAAA-MM-DD"
  vigenciaFim: z.string().nullable().default(null), // null = sem fim previsto
  fonte: FonteTributaria,
  nota: z.string().nullable().default(null),
});
export type RegraTributaria = z.infer<typeof RegraTributaria>;

export const BaseTributaria = z.object({
  atualizadoEm: z.string(),
  avisoLegal: z.string(),
  regras: z.array(RegraTributaria),
});
export type BaseTributaria = z.infer<typeof BaseTributaria>;
