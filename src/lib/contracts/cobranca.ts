import { z } from "zod";
import { PlanilhaInput } from "./financeiro";

/**
 * Agente de Cobrança — fecha o ciclo comercial (proposta→venda→recebível→cobrança).
 *
 * §2: vencido, valor devido, dias de atraso e total vêm SEMPRE do motor determinístico
 * (parse da planilha de contas a receber). A IA (§1) só escreve a RÉGUA — 3 templates de
 * mensagem (leve/média/grave) com placeholders {cliente}/{valor}/{dias} que o motor
 * substitui pelos valores reais. O modelo nunca emite número nem decide quem deve.
 */

export const SeveridadeCobranca = z.enum(["leve", "media", "grave"]);
export type SeveridadeCobranca = z.infer<typeof SeveridadeCobranca>;

export const Inadimplente = z.object({
  cliente: z.string(),
  valorDevido: z.string(), // decimal string — soma dos títulos vencidos (motor)
  titulos: z.number().int(), // quantos títulos vencidos
  vencimentoMaisAntigo: z.string(), // YYYY-MM-DD
  diasAtraso: z.number().int(), // do título mais antigo até "hoje"
  severidade: SeveridadeCobranca,
  mensagem: z.string(), // régua (IA-TEXTO) com os valores do motor já preenchidos
});
export type Inadimplente = z.infer<typeof Inadimplente>;

export const CobrancaRequest = z.object({
  planilha: PlanilhaInput, // contas a receber (mesmo transporte do Financeiro)
  hoje: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null), // override (testes); default = data do servidor
});
export type CobrancaRequest = z.infer<typeof CobrancaRequest>;

export const CobrancaResponse = z.object({
  inadimplentes: z.array(Inadimplente),
  totalDevido: z.string(), // decimal string — soma geral
  aviso: z.string().nullable().default(null), // lacunas de schema (ex.: sem coluna de status)
});
export type CobrancaResponse = z.infer<typeof CobrancaResponse>;
