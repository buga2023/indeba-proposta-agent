import { z } from "zod";

/**
 * Banco de cláusulas/modelos — a fonte de GERAÇÃO do agente de contrato.
 *
 * O agente NÃO inventa cláusula: ele monta a partir deste banco, curado por alguém com
 * responsabilidade jurídica. Cada cláusula carrega PROCEDÊNCIA (fonte + se foi revisada
 * por advogado) e fundamento legal. Enquanto não revisado, é RASCUNHO (§6: revisável;
 * o agente entrega triagem, não parecer). Dataset PT-BR é ativo proprietário (raro).
 */

export const TipoContrato = z.enum([
  "prestacao_servico",
  "fornecimento",
  "nda",
  "locacao",
  "compra_venda",
]);
export type TipoContrato = z.infer<typeof TipoContrato>;

export const FonteClausula = z.object({
  nome: z.string(), // origem do modelo (ex.: "modelo interno", "Clicksign", "Planalto")
  url: z.string().nullable().default(null),
  revisadoPor: z.string().nullable().default(null), // advogado/OAB responsável; null = não revisado
  oficial: z.boolean().default(false),
});
export type FonteClausula = z.infer<typeof FonteClausula>;

export const Clausula = z.object({
  id: z.string(),
  categoria: z.string(), // casa com o id da categoria do checklist (vigencia, multa, lgpd...)
  tiposContrato: z.array(TipoContrato),
  titulo: z.string(),
  texto: z.string(), // template com {placeholders} preenchidos por dado determinístico
  fundamento: z.string().nullable().default(null),
  fonte: FonteClausula,
});
export type Clausula = z.infer<typeof Clausula>;

export const BancoClausulas = z.object({
  atualizadoEm: z.string(),
  aviso: z.string(),
  clausulas: z.array(Clausula),
});
export type BancoClausulas = z.infer<typeof BancoClausulas>;
