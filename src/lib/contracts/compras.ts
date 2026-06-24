import { z } from "zod";
import { PlanilhaInput } from "./financeiro";

/**
 * Agente de Compras/Cotação — compara fornecedores e recomenda a melhor compra.
 *
 * §2: custo total, custo efetivo (ajustado pelo prazo de pagamento = valor do dinheiro no
 * tempo), ranking e economia vêm SEMPRE do motor determinístico. A IA (§1) só REDIGE a
 * recomendação em palavras — nunca calcula nem decide o vencedor.
 */

export const Cotacao = z.object({
  fornecedor: z.string(),
  item: z.string().nullable(), // se a planilha discriminar o item cotado
  precoUnitario: z.string(), // decimal string
  quantidade: z.number(),
  frete: z.string(), // decimal string
  prazoDias: z.number().int(), // prazo de pagamento (0 = à vista)
  custoTotal: z.string(), // preço×qtd + frete
  custoEfetivo: z.string(), // custoTotal descontado pelo valor do prazo
});
export type Cotacao = z.infer<typeof Cotacao>;

export const ComprasRequest = z.object({
  planilha: PlanilhaInput,
  // Taxa mensal p/ trazer o custo a valor presente pelo prazo (default 2%/mês).
  taxaMensal: z.number().min(0).max(1).nullable().default(null),
});
export type ComprasRequest = z.infer<typeof ComprasRequest>;

export const ComprasResponse = z.object({
  cotacoes: z.array(Cotacao), // ranqueadas por custo efetivo (menor primeiro)
  melhorFornecedor: z.string(),
  economia: z.string(), // custo efetivo do 2º − do 1º (quanto a melhor escolha economiza)
  recomendacao: z.string(), // IA-TEXTO, sobre os números do motor
  aviso: z.string().nullable().default(null),
});
export type ComprasResponse = z.infer<typeof ComprasResponse>;
