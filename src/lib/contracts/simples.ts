import { z } from "zod";

/**
 * Tabelas do Simples Nacional (LC 123/2006, Anexos I–V — redação da LC 155/2016).
 *
 * A alíquota EFETIVA não é a nominal: depende da RBT12 (receita bruta dos últimos 12
 * meses) via fórmula (RBT12 × nominal − PD) / RBT12. O Fator R (folha/RBT12) decide, para
 * certos serviços, entre Anexo III (≥28%) e V (<28%). §2: os valores vêm desta base, não
 * do modelo; ainda assim, confirme o anexo da sua atividade com o contador.
 */

export const FaixaSimples = z.object({
  ate: z.number(), // teto de RBT12 da faixa
  nominal: z.number(), // alíquota nominal (%)
  pd: z.number(), // parcela a deduzir (R$)
});
export type FaixaSimples = z.infer<typeof FaixaSimples>;

export const AnexoSimples = z.object({
  atividade: z.string(),
  faixas: z.array(FaixaSimples),
});
export type AnexoSimples = z.infer<typeof AnexoSimples>;

export const TabelaSimples = z.object({
  fonte: z.string(),
  oficial: z.boolean(),
  limiteRBT12: z.number(), // teto do Simples (R$)
  fatorRMinimoAnexoIII: z.number(), // 28
  anexos: z.record(z.string(), AnexoSimples),
});
export type TabelaSimples = z.infer<typeof TabelaSimples>;
