import { z } from "zod";
import { Embalagem } from "./produto";

// PropostaScope — objeto canônico que vira PDF (spec §4.4).
// Campos do item marcados [CATÁLOGO] são cópia direta do catálogo.
// A IA só preenche `textoApresentacao` e `procedenciaSelecao`.
export const ClienteSnapshot = z.object({
  razaoSocial: z.string(),
  cnpj: z.string().nullable(),
  segmento: z.string().nullable(),
});

export const PropostaItem = z.object({
  codigo: z.string(), // [CATÁLOGO]
  nome: z.string(), // [CATÁLOGO]
  descricaoUso: z.string(), // [CATÁLOGO]
  imagemPath: z.string(), // [CATÁLOGO]
  embalagens: z.array(Embalagem), // [CATÁLOGO]
  // Quantidade ajustável pelo vendedor na tela de revisão. Subtotal = preço da
  // 1ª embalagem × quantidade (modelo de orçamento). Default 1.
  quantidade: z.number().int().positive().default(1),
  procedenciaSelecao: z.enum(["IA-SELEÇÃO", "MANUAL"]),
  motivo: z.string(),
});
export type PropostaItem = z.infer<typeof PropostaItem>;

// 3 tipos de proposta (estrutura do documento). Detectado pelo prompt; ver
// docs/estrutura-modelos.md. Eixo separado de `template` (identidade visual).
export const Tipo = z.enum(["orcamento", "implantacao", "comercial"]);
export type Tipo = z.infer<typeof Tipo>;

export const PropostaScope = z.object({
  id: z.string(),
  criadoEm: z.string(),
  status: z.enum(["rascunho", "finalizada"]),
  tipo: Tipo,
  template: z.enum(["indeba", "indeba_express"]),
  cliente: ClienteSnapshot,
  textoApresentacao: z.object({
    conteudo: z.string(),
    procedencia: z.enum(["IA-TEXTO", "MANUAL"]),
  }),
  itens: z.array(PropostaItem),
  condicoesComerciais: z.object({
    validade: z.string(),
    prazoEntrega: z.string(),
    pagamento: z.string(),
    frete: z.string(),
  }),
});
export type PropostaScope = z.infer<typeof PropostaScope>;

// ── Persistência (registro comercial da proposta) ──
// Status COMERCIAL, MUTÁVEL — eixo separado do `status` do documento (rascunho/finalizada).
// A proposta gerada é persistida (store de trabalho); o log append-only (lib/log.ts)
// continua sendo a auditoria imutável de cada PDF emitido (constituição §8).
export const StatusProposta = z.enum(["rascunho", "em_edicao", "enviada", "aprovada", "recusada"]);
export type StatusProposta = z.infer<typeof StatusProposta>;

// Linha do histórico — leve (sem o scope inteiro) para listar.
export const PropostaResumo = z.object({
  id: z.string(),
  status: StatusProposta,
  autor: z.string(),
  cliente: z.string(), // razão social (denormalizado do scope)
  segmento: z.string().nullable(),
  tipo: Tipo,
  total: z.string(), // decimal string — Σ subtotais (mesma convenção do log.ts)
  qtdItens: z.number().int().nonnegative(),
  criadoEm: z.string(),
  atualizadoEm: z.string(),
});
export type PropostaResumo = z.infer<typeof PropostaResumo>;

// Registro completo — resumo + o PropostaScope canônico (para reabrir e gerar contrato).
export const PropostaRegistro = PropostaResumo.extend({ scope: PropostaScope });
export type PropostaRegistro = z.infer<typeof PropostaRegistro>;

// Mudança de status (PATCH).
export const StatusUpdate = z.object({ status: StatusProposta });
export type StatusUpdate = z.infer<typeof StatusUpdate>;
