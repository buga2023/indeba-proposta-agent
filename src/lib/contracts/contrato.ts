import { z } from "zod";
import { PropostaScope } from "./proposta";

/**
 * Agente de Contrato — fecha o handoff Proposta → Contrato (e analisa contratos recebidos).
 *
 * Constituição §4 (render ≠ geração): o contrato é uma VIEW determinística do
 * `PropostaScope`. Partes, itens, valor e condições são CÓPIA do escopo/catálogo — a IA
 * (§1) só REDIGE o texto das cláusulas (procedência IA-TEXTO) e EXPLICA achados de análise.
 * §2: valor, prazos e partes nunca vêm do modelo. Sem CNPJ/endereço de origem no escopo,
 * o campo sai como "[preencher]" — sinaliza a lacuna, não inventa dado legal.
 */

export const PROCEDENCIA_CLAUSULA = z.enum(["IA-TEXTO", "MODELO-FIXO"]);
export type ProcedenciaClausula = z.infer<typeof PROCEDENCIA_CLAUSULA>;

export const ParteContrato = z.object({
  razaoSocial: z.string(),
  cnpj: z.string(), // pode ser "[preencher]" quando não há origem determinística
  endereco: z.string(),
});
export type ParteContrato = z.infer<typeof ParteContrato>;

export const ItemContrato = z.object({
  codigo: z.string(),
  nome: z.string(),
  quantidade: z.number().int().positive(),
  precoUnitario: z.string(), // decimal string, do catálogo (1ª embalagem)
  subtotal: z.string(), // decimal string = precoUnitario × quantidade
});
export type ItemContrato = z.infer<typeof ItemContrato>;

export const Clausula = z.object({
  titulo: z.string(),
  texto: z.string(),
  procedencia: PROCEDENCIA_CLAUSULA,
});
export type Clausula = z.infer<typeof Clausula>;

export const ContratoScope = z.object({
  id: z.string(),
  criadoEm: z.string(),
  origemPropostaId: z.string(),
  contratada: ParteContrato, // fornecedor (Indeba)
  contratante: ParteContrato, // cliente (do PropostaScope)
  objeto: z.string(), // resumo determinístico do fornecimento
  itens: z.array(ItemContrato),
  valorTotal: z.string(), // decimal string — Σ subtotais (o número-guardião)
  condicoes: z.object({
    validade: z.string(),
    prazoEntrega: z.string(),
    pagamento: z.string(),
    frete: z.string(),
  }),
  clausulas: z.array(Clausula),
});
export type ContratoScope = z.infer<typeof ContratoScope>;

// ── Análise de contrato recebido ──
export const TipoAchado = z.enum([
  "multa",
  "prazo",
  "rescisao",
  "reajuste",
  "foro",
  "valor",
  "vigencia",
]);
export type TipoAchado = z.infer<typeof TipoAchado>;

export const Achado = z.object({
  tipo: TipoAchado,
  trecho: z.string(), // o pedaço LITERAL do contrato (extraído por regex, não pela IA)
  valor: z.string().nullable(), // ex.: "10%", "30 dias", "R$ 5.000,00"
  severidade: z.enum(["alta", "media", "baixa"]),
});
export type Achado = z.infer<typeof Achado>;

export const ContratoAnalise = z.object({
  achados: z.array(Achado), // procedência: MOTOR (regex sobre o texto)
  explicacao: z.string(), // procedência: IA-TEXTO (só comenta os achados)
});
export type ContratoAnalise = z.infer<typeof ContratoAnalise>;

// ── Requisição da API (ação discriminada) ──
export const ContratoRequest = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("gerar"), proposta: PropostaScope }),
  z.object({ acao: z.literal("analisar"), texto: z.string().min(1).max(200_000) }),
]);
export type ContratoRequest = z.infer<typeof ContratoRequest>;
