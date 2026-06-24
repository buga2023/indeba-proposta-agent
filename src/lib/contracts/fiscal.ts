import { z } from "zod";

/**
 * Agente Fiscal / NF-e — lê o XML da nota, extrai os dados e valida consistência.
 *
 * §2: número, partes, itens, impostos e totais vêm SEMPRE do parse determinístico do XML
 * (a verdade é o documento fiscal). A IA (§1) só RESUME e comenta os achados em palavras —
 * nunca recalcula imposto nem inventa valor.
 */

export const ItemNota = z.object({
  codigo: z.string(),
  descricao: z.string(),
  quantidade: z.string(),
  valorUnitario: z.string(),
  valorTotal: z.string(),
});
export type ItemNota = z.infer<typeof ItemNota>;

export const NotaFiscal = z.object({
  numero: z.string(),
  serie: z.string(),
  dataEmissao: z.string(),
  naturezaOperacao: z.string(),
  chaveAcesso: z.string(),
  emitente: z.object({ documento: z.string(), nome: z.string() }),
  destinatario: z.object({ documento: z.string(), nome: z.string() }),
  itens: z.array(ItemNota),
  valorProdutos: z.string(),
  valorFrete: z.string(),
  valorICMS: z.string(),
  valorTotal: z.string(),
});
export type NotaFiscal = z.infer<typeof NotaFiscal>;

export const AchadoFiscal = z.object({
  tipo: z.string(), // ex.: "divergencia_total", "cnpj_invalido", "chave_ausente"
  descricao: z.string(), // texto factual derivado do parse (não da IA)
  severidade: z.enum(["alta", "media", "baixa"]),
});
export type AchadoFiscal = z.infer<typeof AchadoFiscal>;

export const FiscalRequest = z.object({
  xml: z.string().min(1).max(5_000_000),
});
export type FiscalRequest = z.infer<typeof FiscalRequest>;

export const FiscalResponse = z.object({
  nota: NotaFiscal,
  achados: z.array(AchadoFiscal), // MOTOR (validações sobre o XML)
  resumo: z.string(), // IA-TEXTO (explica a nota e os achados)
});
export type FiscalResponse = z.infer<typeof FiscalResponse>;
