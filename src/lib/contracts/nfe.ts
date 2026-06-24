import { z } from "zod";

/**
 * NF-e / NFS-e — fonte PRIMÁRIA de faturamento (melhor que planilha digitada).
 *
 * O XML é a verdade fiscal: número, partes, itens, valores e impostos (e agora os
 * campos de IBS/CBS da reforma). Parse 100% determinístico — o LLM não toca aqui.
 * Preço como string decimal (§preço nunca float).
 */

export const ItemNfe = z.object({
  codigo: z.string(),
  descricao: z.string(),
  ncm: z.string().nullable().default(null),
  quantidade: z.number(),
  valorUnitario: z.string(), // vUnCom — decimal string
  valorTotal: z.string(), // vProd — decimal string
});
export type ItemNfe = z.infer<typeof ItemNfe>;

export const ParteNfe = z.object({
  documento: z.string().nullable().default(null), // CNPJ/CPF
  nome: z.string().nullable().default(null),
});

export const NotaFiscal = z.object({
  numero: z.string(),
  serie: z.string().nullable().default(null),
  dataEmissao: z.string().nullable().default(null), // AAAA-MM-DD
  emitente: ParteNfe,
  destinatario: ParteNfe,
  itens: z.array(ItemNfe),
  valorTotal: z.string(), // vNF — o número-guardião (autoritativo do XML)
});
export type NotaFiscal = z.infer<typeof NotaFiscal>;
