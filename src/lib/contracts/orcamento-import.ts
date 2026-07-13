import { z } from "zod";

/**
 * Import de orçamento anexado (PDF do ERP) → dados estruturados para montar a
 * proposta estética. A IA só ESTRUTURA o que está no documento; o preço tem
 * guarda determinística: só entra se constar literalmente no texto extraído
 * (item que falha vai para `rejeitados`, nunca para a proposta). O vendedor
 * confere tudo na tela antes de montar (constituição §6).
 */

// Item como está no orçamento. Preço na convenção do projeto: string decimal.
// `codigoCatalogo`/`nomeCatalogo` são preenchidos DEPOIS da IA, por casamento
// determinístico com o catálogo (foto/descrição no PDF); o preço segue o do orçamento.
export const ItemOrcamento = z.object({
  nome: z.string().min(1),
  quantidade: z.number().int().positive().default(1),
  tamanho: z.number().positive().nullable().default(null), // ex.: 5 (da embalagem "5 L")
  unidade: z.enum(["L", "kg", "un", "ml"]).nullable().default(null),
  preco: z.string().regex(/^\d+\.\d{2}$/, "preço deve ser decimal string, ex '130.00'"),
  codigoCatalogo: z.string().nullable().default(null),
  nomeCatalogo: z.string().nullable().default(null),
});
export type ItemOrcamento = z.infer<typeof ItemOrcamento>;

// Saída da IA (schema-restrita) sobre o texto do orçamento. Campos sem origem
// no documento vêm null — nunca inventados.
export const OrcamentoExtraido = z.object({
  cliente: z.object({
    razaoSocial: z.string().nullable().default(null),
    cnpj: z.string().nullable().default(null),
    segmento: z.string().nullable().default(null),
    responsavel: z.string().nullable().default(null),
  }),
  itens: z.array(ItemOrcamento),
  condicoes: z
    .object({
      validade: z.string().nullable().default(null),
      prazoEntrega: z.string().nullable().default(null),
      pagamento: z.string().nullable().default(null),
      frete: z.string().nullable().default(null),
    })
    .default({ validade: null, prazoEntrega: null, pagamento: null, frete: null }),
});
export type OrcamentoExtraido = z.infer<typeof OrcamentoExtraido>;

// Item barrado pela guarda de preço (preço não consta no texto do orçamento).
export const ItemRejeitado = z.object({
  nome: z.string(),
  preco: z.string(),
  motivo: z.string(),
});
export type ItemRejeitado = z.infer<typeof ItemRejeitado>;

// Resposta de POST /api/orcamento/importar — o que a tela de conferência mostra.
export const OrcamentoImportResponse = z.object({
  extraido: OrcamentoExtraido,
  rejeitados: z.array(ItemRejeitado),
  nomeArquivo: z.string(),
  chars: z.number().int().nonnegative(),
});
export type OrcamentoImportResponse = z.infer<typeof OrcamentoImportResponse>;
