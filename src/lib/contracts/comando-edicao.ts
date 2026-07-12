import { z } from "zod";

// Comando de edição da proposta via chat em linguagem natural (Revisão). Espelha o
// padrão do roteador financeiro (Roteamento, src/lib/contracts/financeiro.ts): a IA
// só classifica a AÇÃO e resolve QUAL item/campo é o alvo — nunca decide um valor
// numérico (preço/quantidade) sozinha. O número vem sempre de regex determinístico
// sobre a mensagem original do vendedor (constituição §2: dado crítico nunca vem do modelo).
export const AcaoEdicao = z.enum([
  "alterar_razao_social",
  "alterar_cnpj",
  "alterar_segmento",
  "alterar_responsavel_cliente",
  "alterar_quantidade_item",
  "remover_item",
  "adicionar_item_catalogo",
  "alterar_preco_item",
  "alterar_condicao_comercial",
  "nao_entendi",
]);
export type AcaoEdicao = z.infer<typeof AcaoEdicao>;

export const ComandoEdicao = z.object({
  acao: AcaoEdicao,
  // Novo texto (razão social/CNPJ/segmento/responsável/condição) OU o termo que o
  // vendedor usou para se referir ao item, quando codigoItem não pôde ser resolvido.
  valorTexto: z.string().nullable().default(null),
  // Código do catálogo do item-alvo, resolvido pela IA a partir do texto + itens da proposta.
  codigoItem: z.string().nullable().default(null),
  // Só quando acao === "alterar_condicao_comercial".
  campoCondicao: z.enum(["validade", "prazoEntrega", "pagamento", "frete"]).nullable().default(null),
});
export type ComandoEdicao = z.infer<typeof ComandoEdicao>;
